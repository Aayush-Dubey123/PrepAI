import { auth } from "@clerk/nextjs/server";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/src/db";
import { drills, practiceSets, drillSessions, questions } from "@/src/db/schema";
import { DrillSessionCreateSchema } from "@/src/schemas/drills";
import { checkDrillSessionCreate } from "@/src/lib/rate-limit";
import { generateSmartSet, ConceptContentError } from "@/src/lib/drills/smart-set";
import { isTechnicalPracticeEnabled } from "@/src/lib/config";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    if (!isTechnicalPracticeEnabled()) {
      return NextResponse.json(
        { error: "Technical Practice is currently disabled", code: "FEATURE_DISABLED" },
        { status: 403 },
      );
    }

    const { slug } = await params;

    // Rate limit
    const rl = checkDrillSessionCreate(userId);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Session creation rate limit exceeded. Please try again shortly.",
          code: "RATE_LIMITED",
          retryAfterSec: rl.retryAfterSec ?? 60,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
      );
    }

    // Validate body
    const bodyJson = await req.json();
    const body = DrillSessionCreateSchema.parse(bodyJson);

    // Resolve drill
    const drillRows = await db.select().from(drills).where(eq(drills.slug, slug)).limit(1);
    if (drillRows.length === 0) {
      return NextResponse.json({ error: "Drill not found", code: "DRILL_NOT_FOUND" }, { status: 404 });
    }
    const drill = drillRows[0];

    // Idempotency check with clientRequestId scoped to user
    if (body.clientRequestId) {
      const existingReq = await db
        .select()
        .from(drillSessions)
        .where(
          and(
            eq(drillSessions.userId, userId),
            eq(drillSessions.clientRequestId, body.clientRequestId),
          ),
        )
        .limit(1);

      if (existingReq.length > 0) {
        const s = existingReq[0];
        return NextResponse.json(
          {
            id: s.id,
            questionCount: s.questionIds.length,
            timeLimit: s.timeLimitSeconds,
            mode: s.mode,
            expiresAt: s.expiresAt,
            resumed: true,
          },
          { status: 200 },
        );
      }
    }

    // Active session check
    const existingActive = await db
      .select()
      .from(drillSessions)
      .where(
        and(
          eq(drillSessions.userId, userId),
          eq(drillSessions.drillId, drill.id),
          eq(drillSessions.status, "active"),
        ),
      )
      .limit(1);

    if (existingActive.length > 0) {
      const active = existingActive[0];
      const now = new Date();
      if (!active.expiresAt || new Date(active.expiresAt) > now) {
        return NextResponse.json(
          {
            id: active.id,
            questionCount: active.questionIds.length,
            timeLimit: active.timeLimitSeconds,
            mode: active.mode,
            expiresAt: active.expiresAt,
            resumed: true,
          },
          { status: 200 },
        );
      } else {
        // Expired active session -> auto finish
        await db
          .update(drillSessions)
          .set({ status: "completed", finishedAt: now })
          .where(eq(drillSessions.id, active.id));
      }
    }

    // Explicit Question Selection Paths
    let resolvedQuestionIds: string[] = [];
    let practiceSetId: string | null = null;

    if (body.targetConceptId || body.isSmartSet) {
      // Path B: Adaptive Smart Set (Targeted or Weak-Concept)
      resolvedQuestionIds = await generateSmartSet(userId, drill.id, body.level, body.targetConceptId);
      if (resolvedQuestionIds.length < 4) {
        const needed = 4 - resolvedQuestionIds.length;
        const supplement = await db
          .select({ id: questions.id })
          .from(questions)
          .where(
            and(
              eq(questions.drillId, drill.id),
              eq(questions.level, body.level),
              eq(questions.reviewStatus, "approved"),
              resolvedQuestionIds.length > 0 ? notInArray(questions.id, resolvedQuestionIds) : sql`true`,
            ),
          )
          .orderBy(sql`random()`)
          .limit(needed);

        resolvedQuestionIds = [...resolvedQuestionIds, ...supplement.map((q) => q.id)];

        if (resolvedQuestionIds.length < 4) {
          const anyRemaining = await db
            .select({ id: questions.id })
            .from(questions)
            .where(
              and(
                eq(questions.drillId, drill.id),
                eq(questions.reviewStatus, "approved"),
                resolvedQuestionIds.length > 0 ? notInArray(questions.id, resolvedQuestionIds) : sql`true`,
              ),
            )
            .orderBy(sql`random()`)
            .limit(4 - resolvedQuestionIds.length);
          resolvedQuestionIds = [...resolvedQuestionIds, ...anyRemaining.map((q) => q.id)];
        }

        if (resolvedQuestionIds.length < 4) {
          return NextResponse.json(
            { error: "Not enough approved questions available for smart set", code: "INSUFFICIENT_CONTENT" },
            { status: 409 },
          );
        }
      }
    } else if (body.practiceSetId) {
      // Path A: Standard Practice Set
      const setRows = await db.select().from(practiceSets).where(eq(practiceSets.id, body.practiceSetId)).limit(1);
      if (setRows.length === 0) {
        return NextResponse.json({ error: "Practice set not found", code: "PRACTICE_SET_NOT_FOUND" }, { status: 404 });
      }
      const set = setRows[0];
      if (set.drillId !== drill.id) {
        return NextResponse.json(
          { error: "Practice set does not belong to the requested drill", code: "PRACTICE_SET_DRILL_MISMATCH" },
          { status: 400 },
        );
      }
      if (set.level !== body.level) {
        return NextResponse.json(
          { error: "Practice set difficulty does not match requested level", code: "PRACTICE_SET_LEVEL_MISMATCH" },
          { status: 400 },
        );
      }

      // Verify approved questions
      const approvedQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.drillId, drill.id),
            eq(questions.reviewStatus, "approved"),
            sql`${questions.id} IN (${sql.join(set.questionIds.map((id) => sql`${id}`), sql`, `)})`,
          ),
        );

      if (approvedQuestions.length < 4) {
        return NextResponse.json(
          { error: "Practice set does not have enough approved questions", code: "INSUFFICIENT_APPROVED_QUESTIONS" },
          { status: 409 },
        );
      }

      resolvedQuestionIds = approvedQuestions.map((q) => q.id);
      practiceSetId = set.id;
    } else {
      // Path C: Random Ad-hoc Drill
      const targetCount = slug === "rapid-screen" ? 20 : 10;
      let candidateQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.drillId, drill.id),
            eq(questions.level, body.level),
            eq(questions.reviewStatus, "approved"),
          ),
        )
        .orderBy(sql`random()`)
        .limit(targetCount);

      if (candidateQuestions.length < 4) {
        const existingIds = candidateQuestions.map((q) => q.id);
        const fallbackQuestions = await db
          .select({ id: questions.id })
          .from(questions)
          .where(
            and(
              eq(questions.drillId, drill.id),
              eq(questions.reviewStatus, "approved"),
              existingIds.length > 0 ? notInArray(questions.id, existingIds) : sql`true`,
            ),
          )
          .orderBy(sql`random()`)
          .limit(targetCount - candidateQuestions.length);

        candidateQuestions = [...candidateQuestions, ...fallbackQuestions];
      }

      if (candidateQuestions.length < 4) {
        return NextResponse.json(
          { error: "Not enough approved questions available for this drill and level", code: "INSUFFICIENT_CONTENT" },
          { status: 409 },
        );
      }

      resolvedQuestionIds = candidateQuestions.map((q) => q.id);
    }

    // Timed mode deadline
    const timeLimitSeconds = body.mode === "timed" ? drill.timeLimitSeconds : null;
    const expiresAt = timeLimitSeconds ? new Date(Date.now() + timeLimitSeconds * 1000) : null;

    // Create session
    const [newSession] = await db
      .insert(drillSessions)
      .values({
        userId,
        drillId: drill.id,
        practiceSetId,
        status: "active",
        mode: body.mode,
        level: body.level,
        questionIds: resolvedQuestionIds,
        currentIndex: 0,
        timeLimitSeconds,
        expiresAt,
        clientRequestId: body.clientRequestId ?? null,
      })
      .returning();

    console.log(`[DRILL_SESSION] userId=${userId} drill=${slug} mode=${body.mode} level=${body.level}`);

    return NextResponse.json(
      {
        id: newSession.id,
        questionCount: resolvedQuestionIds.length,
        timeLimit: timeLimitSeconds,
        mode: body.mode,
        expiresAt,
        resumed: false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ConceptContentError) {
      const status = error.code === "TARGET_CONCEPT_DRILL_MISMATCH" ? 400 : 409;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.flatten() }, { status: 422 });
    }
    console.error("[DRILL_SESSION_CREATE_ERROR]", error);
    return NextResponse.json({ error: "Failed to create drill session" }, { status: 500 });
  }
}
