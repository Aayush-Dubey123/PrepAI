import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  userConceptMastery,
  userConceptMasteryLog,
  masteryRetryQueue,
} from "../../db/schema";

export function computeEmaMastery(currentMastery: number, answerScore: number): number {
  const alpha = 0.3;
  const raw = alpha * answerScore + (1 - alpha) * currentMastery;
  return Math.round(Math.min(1.0, Math.max(0.0, raw)) * 1000) / 1000;
}

export function computeNextDue(mastery: number, baseDate: Date = new Date()): Date {
  const d = new Date(baseDate.getTime());
  if (mastery >= 0.8) {
    d.setDate(d.getDate() + 7);
  } else if (mastery >= 0.6) {
    d.setDate(d.getDate() + 3);
  } else if (mastery >= 0.4) {
    d.setDate(d.getDate() + 1);
  } else {
    d.setHours(d.getHours() + 4);
  }
  return d;
}

export async function processConceptMasteryUpdate(
  userId: string,
  conceptId: string,
  answerId: string,
  answerScore: number,
  answerCreatedAt: Date = new Date(),
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    // 1. Audit Log check: attempt to insert log row or check if exists
    const existingLog = await tx
      .select({ id: userConceptMasteryLog.id })
      .from(userConceptMasteryLog)
      .where(
        and(
          eq(userConceptMasteryLog.userId, userId),
          eq(userConceptMasteryLog.conceptId, conceptId),
          eq(userConceptMasteryLog.answerId, answerId),
        ),
      )
      .limit(1);

    if (existingLog.length > 0) {
      // Already processed idempotently
      return false;
    }

    // 2. Load existing user_concept_mastery
    const existingMasteryRows = await tx
      .select()
      .from(userConceptMastery)
      .where(
        and(
          eq(userConceptMastery.userId, userId),
          eq(userConceptMastery.conceptId, conceptId),
        ),
      )
      .for("update");

    let previousMastery = 0.0;
    let newMastery = 0.0;
    const isPassing = answerScore >= 0.6;

    if (existingMasteryRows.length === 0) {
      // First time user answers a question for this concept
      previousMastery = 0.0;
      newMastery = computeEmaMastery(0.0, answerScore);
      const nextDue = computeNextDue(newMastery, answerCreatedAt);

      await tx.insert(userConceptMastery).values({
        userId,
        conceptId,
        mastery: newMastery,
        attempts: 1,
        correctCount: isPassing ? 1 : 0,
        lastSeen: answerCreatedAt,
        nextDue,
      });
    } else {
      const current = existingMasteryRows[0];
      previousMastery = current.mastery;

      const lastSeen = current.lastSeen ? new Date(current.lastSeen) : null;
      const isOutOfOrder = lastSeen !== null && lastSeen.getTime() > answerCreatedAt.getTime();

      if (isOutOfOrder) {
        // Out-of-order execution: only increment attempts and correctCount, do NOT roll back mastery/nextDue
        newMastery = current.mastery;
        await tx
          .update(userConceptMastery)
          .set({
            attempts: sql`${userConceptMastery.attempts} + 1`,
            correctCount: isPassing
              ? sql`${userConceptMastery.correctCount} + 1`
              : userConceptMastery.correctCount,
            updatedAt: new Date(),
          })
          .where(eq(userConceptMastery.id, current.id));
      } else {
        // Normal in-order update
        newMastery = computeEmaMastery(current.mastery, answerScore);
        const nextDue = computeNextDue(newMastery, answerCreatedAt);

        await tx
          .update(userConceptMastery)
          .set({
            mastery: newMastery,
            attempts: sql`${userConceptMastery.attempts} + 1`,
            correctCount: isPassing
              ? sql`${userConceptMastery.correctCount} + 1`
              : userConceptMastery.correctCount,
            lastSeen: answerCreatedAt,
            nextDue,
            updatedAt: new Date(),
          })
          .where(eq(userConceptMastery.id, current.id));
      }
    }

    // 3. Record permanent audit log
    await tx.insert(userConceptMasteryLog).values({
      userId,
      conceptId,
      answerId,
      score: answerScore,
      previousMastery,
      newMastery,
      createdAt: new Date(),
    });

    return true;
  });
}

export async function updateConceptMastery(
  userId: string,
  conceptIds: string[],
  answerId: string,
  answerScore: number,
  answerCreatedAt: Date = new Date(),
): Promise<void> {
  const retryDelays = [200, 800, 2000];

  for (const conceptId of conceptIds) {
    let success = false;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        await processConceptMasteryUpdate(userId, conceptId, answerId, answerScore, answerCreatedAt);
        success = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retryDelays.length) {
          const delay = retryDelays[attempt];
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    if (!success) {
      console.error(
        `[MASTERY_UPDATE_FAILED] userId=${userId} conceptId=${conceptId} answerId=${answerId} error=${lastError?.message}`,
      );

      try {
        await db.insert(masteryRetryQueue).values({
          userId,
          conceptIds: [conceptId],
          answerId,
          score: answerScore,
          attempts: 3,
          lastError: lastError?.message ?? "Immediate retries exhausted",
          nextRetryAt: new Date(Date.now() + 60_000), // Retry in 1 minute
        });
      } catch (queueErr) {
        console.error(
          `[MASTERY_CRITICAL_FAILURE] answerId=${answerId} userId=${userId} queueErr=${queueErr}`,
        );
      }
    }
  }
}
