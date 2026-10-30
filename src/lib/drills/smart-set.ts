import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  concepts,
  questions,
  drillSessions,
  sessionAnswers,
  userConceptMastery,
} from "../../db/schema";

export class ConceptContentError extends Error {
  code: "TARGET_CONCEPT_DRILL_MISMATCH" | "INSUFFICIENT_CONCEPT_CONTENT";
  constructor(message: string, code: "TARGET_CONCEPT_DRILL_MISMATCH" | "INSUFFICIENT_CONCEPT_CONTENT") {
    super(message);
    this.name = "ConceptContentError";
    this.code = code;
  }
}

export async function generateSmartSet(
  userId: string,
  drillId: string,
  level: "foundational" | "mid" | "senior" | "staff",
  targetConceptId?: string,
): Promise<string[]> {
  // 1. If targetConceptId is supplied, validate drill membership & question sufficiency
  let targetConceptQuestions: string[] = [];
  if (targetConceptId) {
    const conceptRow = await db
      .select({ id: concepts.id, drillId: concepts.drillId })
      .from(concepts)
      .where(eq(concepts.id, targetConceptId))
      .limit(1);

    if (conceptRow.length === 0 || conceptRow[0].drillId !== drillId) {
      throw new ConceptContentError(
        "Target concept does not belong to the requested drill",
        "TARGET_CONCEPT_DRILL_MISMATCH",
      );
    }

    const approvedConceptQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(
          eq(questions.drillId, drillId),
          eq(questions.level, level),
          eq(questions.reviewStatus, "approved"),
          sql`${targetConceptId} = ANY(${questions.conceptIds})`,
        ),
      )
      .orderBy(sql`random()`);

    if (approvedConceptQuestions.length < 2) {
      throw new ConceptContentError(
        "Not enough approved questions available for the requested concept at this difficulty tier",
        "INSUFFICIENT_CONCEPT_CONTENT",
      );
    }

    targetConceptQuestions = approvedConceptQuestions.map((q) => q.id);
  }

  // 2. Get all concepts for this drill
  const drillConcepts = await db
    .select({ id: concepts.id, slug: concepts.slug })
    .from(concepts)
    .where(eq(concepts.drillId, drillId));

  if (drillConcepts.length === 0) {
    return targetConceptQuestions.slice(0, 2);
  }

  // 3. Fetch mastery for user
  const masteryRows = await db
    .select({
      conceptId: userConceptMastery.conceptId,
      mastery: userConceptMastery.mastery,
      nextDue: userConceptMastery.nextDue,
    })
    .from(userConceptMastery)
    .where(eq(userConceptMastery.userId, userId));

  const masteryMap = new Map<string, { mastery: number; nextDue: Date | null }>();
  for (const m of masteryRows) {
    masteryMap.set(m.conceptId, {
      mastery: m.mastery,
      nextDue: m.nextDue ? new Date(m.nextDue) : null,
    });
  }

  const now = new Date();

  // 4. Score & rank concepts: overdue first, then lowest mastery, then unseen (0.0)
  const rankedConcepts = [...drillConcepts].sort((a, b) => {
    const aData = masteryMap.get(a.id);
    const bData = masteryMap.get(b.id);

    const aOverdue = aData?.nextDue ? aData.nextDue.getTime() <= now.getTime() : false;
    const bOverdue = bData?.nextDue ? bData.nextDue.getTime() <= now.getTime() : false;

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    const aMastery = aData ? aData.mastery : 0.0;
    const bMastery = bData ? bData.mastery : 0.0;

    return aMastery - bMastery;
  });

  // Exclude targetConceptId from ranked list if already prioritized
  const filteredRanked = targetConceptId
    ? rankedConcepts.filter((c) => c.id !== targetConceptId)
    : rankedConcepts;
  const targetConcepts = filteredRanked.slice(0, 5);

  // 5. Find questions answered in user's last 3 sessions for this drill
  const recentSessions = await db
    .select({ id: drillSessions.id })
    .from(drillSessions)
    .where(and(eq(drillSessions.userId, userId), eq(drillSessions.drillId, drillId)))
    .orderBy(sql`${drillSessions.startedAt} DESC`)
    .limit(3);

  const recentSessionIds = recentSessions.map((s) => s.id);
  const excludedQuestionIds = new Set<string>();

  if (recentSessionIds.length > 0) {
    const recentAnswers = await db
      .select({ questionId: sessionAnswers.questionId })
      .from(sessionAnswers)
      .where(sql`${sessionAnswers.sessionId} IN (${sql.join(recentSessionIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const a of recentAnswers) {
      excludedQuestionIds.add(a.questionId);
    }
  }

  // 6. Assemble prioritized prefix
  let prioritizedPrefix: string[] = [];
  if (targetConceptQuestions.length >= 2) {
    const freshTarget = targetConceptQuestions.filter((id) => !excludedQuestionIds.has(id));
    const chosenTarget = freshTarget.length >= 2 ? freshTarget.slice(0, 2) : targetConceptQuestions.slice(0, 2);
    prioritizedPrefix = chosenTarget;
  }

  // 7. Select questions for remaining target concepts
  const supplementalQuestionIds: string[] = [];

  for (const c of targetConcepts) {
    const candidateQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(
          eq(questions.drillId, drillId),
          eq(questions.level, level),
          eq(questions.reviewStatus, "approved"),
          sql`${c.id} = ANY(${questions.conceptIds})`,
        ),
      )
      .orderBy(sql`random()`);

    const fresh = candidateQuestions.filter((q) => !excludedQuestionIds.has(q.id) && !prioritizedPrefix.includes(q.id));
    const picked = fresh.length > 0
      ? fresh.slice(0, 2)
      : candidateQuestions.filter((q) => !prioritizedPrefix.includes(q.id)).slice(0, 2);

    for (const p of picked) {
      if (!supplementalQuestionIds.includes(p.id)) {
        supplementalQuestionIds.push(p.id);
      }
    }
  }

  // 8. Supplement if fewer than 10
  const needed = 10 - (prioritizedPrefix.length + supplementalQuestionIds.length);
  if (needed > 0) {
    const alreadySelected = new Set([...prioritizedPrefix, ...supplementalQuestionIds]);
    const supplement = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(
          eq(questions.drillId, drillId),
          eq(questions.level, level),
          eq(questions.reviewStatus, "approved"),
        ),
      )
      .orderBy(sql`random()`)
      .limit(30);

    for (const s of supplement) {
      if (!alreadySelected.has(s.id)) {
        supplementalQuestionIds.push(s.id);
        alreadySelected.add(s.id);
      }
      if (prioritizedPrefix.length + supplementalQuestionIds.length >= 10) break;
    }
  }

  // If target concept was specified:
  // Prioritized prefix MUST remain at indices 0 and 1!
  if (prioritizedPrefix.length > 0) {
    const shuffledSupplement = supplementalQuestionIds.sort(() => Math.random() - 0.5);
    return [...prioritizedPrefix, ...shuffledSupplement];
  }

  return supplementalQuestionIds.sort(() => Math.random() - 0.5);
}
