import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/src/db";
import { drillSessions, questions, sessionAnswers } from "@/src/db/schema";
import {
  SubmitAnswerSchema,
  SelfAssessmentSchema,
  type Rubric,
  type QuestionPayload,
} from "@/src/schemas/drills";
import { checkDrillAnswer } from "@/src/lib/rate-limit";
import { gradeAnswer } from "@/src/lib/drills/grading";
import { computeSessionScore } from "@/src/lib/drills/scoring";
import { updateConceptMastery } from "@/src/lib/drills/mastery";

class ConcurrentSubmissionError extends Error {}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
    if (!isValidUuid) {
      return NextResponse.json({ error: "Invalid session ID", code: "INVALID_SESSION_ID" }, { status: 400 });
    }
    // Rate limit
    const rl = checkDrillAnswer(userId);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Answer submission rate limit exceeded. Please wait a moment.",
          code: "RATE_LIMITED",
          retryAfterSec: rl.retryAfterSec ?? 5,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 5) } },
      );
    }

    // Load session
    const sessionRows = await db.select().from(drillSessions).where(eq(drillSessions.id, sessionId)).limit(1);
    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 404 });
    }
    const session = sessionRows[0];

    // Ownership check
    if (session.userId !== userId) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    // Active session check
    if (session.status !== "active") {
      return NextResponse.json({ error: "Session ended", code: "SESSION_ENDED" }, { status: 409 });
    }

    // Timed expiry check
    const now = new Date();
    if (session.expiresAt && new Date(session.expiresAt) < now) {
      const answers = await db.select().from(sessionAnswers).where(eq(sessionAnswers.sessionId, sessionId));
      const finalScore = computeSessionScore(answers);
      await db
        .update(drillSessions)
        .set({ status: "completed", finishedAt: now, score: finalScore })
        .where(eq(drillSessions.id, sessionId));

      return NextResponse.json({ error: "Session timed out", code: "SESSION_EXPIRED" }, { status: 409 });
    }

    // Validate body
    const bodyJson = await req.json();
    const body = SubmitAnswerSchema.parse(bodyJson);

    // Validate question index
    const expectedQuestionId = session.questionIds[session.currentIndex];
    if (body.questionId !== expectedQuestionId) {
      return NextResponse.json(
        { error: "Question not at current index or out of order", code: "WRONG_INDEX" },
        { status: 400 },
      );
    }

    // Check idempotency on answer
    const existingAnswer = await db
      .select()
      .from(sessionAnswers)
      .where(and(eq(sessionAnswers.sessionId, sessionId), eq(sessionAnswers.questionId, body.questionId)))
      .limit(1);

    if (existingAnswer.length > 0) {
      const cached = existingAnswer[0];
      if (session.mode === "timed") {
        return NextResponse.json({ score: cached.score, isCorrect: cached.isCorrect }, { status: 200 });
      }

      const qRows = await db.select().from(questions).where(eq(questions.id, body.questionId)).limit(1);
      const explanation = qRows[0]?.explanation ?? "";
      const modelAnswer = qRows[0]?.modelAnswer ?? "";

      return NextResponse.json(
        {
          score: cached.score,
          isCorrect: cached.isCorrect,
          gradingResult: cached.gradingResult,
          explanation,
          modelAnswer,
        },
        { status: 200 },
      );
    }

    // Load question for grading
    const questionRows = await db.select().from(questions).where(eq(questions.id, body.questionId)).limit(1);
    if (questionRows.length === 0) {
      return NextResponse.json({ error: "Question not found", code: "QUESTION_NOT_FOUND" }, { status: 404 });
    }
    const question = questionRows[0];

    // Grade answer
    const grading = await gradeAnswer({
      questionId: question.id,
      type: question.type,
      payload: question.payload as QuestionPayload,
      rubric: question.rubric as Rubric,
      modelAnswer: question.modelAnswer,
      explanation: question.explanation,
      userAnswer: body.answer,
    });

    const answerScore = grading.requiresSelfAssessment ? null : grading.score;
    const isCorrect = grading.requiresSelfAssessment ? null : grading.isCorrect;
    const expectedIndex = session.currentIndex;

    let answerId = "";

    // Optimistic Concurrency Transaction
    try {
      await db.transaction(async (tx) => {
        const [insertedAnswer] = await tx
          .insert(sessionAnswers)
          .values({
            sessionId,
            questionId: body.questionId,
            answer: body.answer,
            isCorrect,
            score: answerScore,
            gradingResult: grading.gradingResult ?? null,
            gradingMethod: grading.gradingMethod,
            confidence: grading.confidence,
            timeTakenMs: body.timeTakenMs ?? null,
          })
          .returning();

        answerId = insertedAnswer.id;

        const updateResult = await tx
          .update(drillSessions)
          .set({ currentIndex: sql`${drillSessions.currentIndex} + 1` })
          .where(
            and(
              eq(drillSessions.id, sessionId),
              eq(drillSessions.currentIndex, expectedIndex),
            ),
          )
          .returning();

        if (updateResult.length === 0) {
          throw new ConcurrentSubmissionError("Current index already advanced by concurrent request");
        }
      });
    } catch (txErr) {
      if (txErr instanceof ConcurrentSubmissionError) {
        return NextResponse.json(
          { error: "Question already answered by a concurrent request", code: "CONCURRENT_ANSWER" },
          { status: 409 },
        );
      }
      throw txErr;
    }

    // Mastery update in background via after()
    if (!grading.requiresSelfAssessment && answerScore !== null) {
      const isGradedEligible =
        grading.gradingMethod === "deterministic" ||
        (grading.gradingMethod === "llm" && (grading.confidence ?? 1.0) >= 0.5);

      if (isGradedEligible) {
        after(async () => {
          try {
            await updateConceptMastery(userId, question.conceptIds, answerId, answerScore, new Date());
          } catch (mErr) {
            console.error("[BACKGROUND_MASTERY_ERROR]", mErr);
          }
        });
      }
    }

    // Return response by mode
    if (grading.requiresSelfAssessment) {
      return NextResponse.json(
        {
          requiresSelfAssessment: true,
          modelAnswer: question.modelAnswer,
        },
        { status: 200 },
      );
    }

    if (session.mode === "timed") {
      return NextResponse.json({ score: answerScore, isCorrect }, { status: 200 });
    }

    return NextResponse.json(
      {
        score: answerScore,
        isCorrect,
        gradingResult: grading.gradingResult,
        explanation: question.explanation,
        modelAnswer: question.modelAnswer,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.flatten() }, { status: 422 });
    }
    console.error("[DRILL_ANSWER_ERROR]", error);
    return NextResponse.json({ error: "Failed to submit answer" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    const sessionRows = await db.select().from(drillSessions).where(eq(drillSessions.id, sessionId)).limit(1);
    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 404 });
    }
    const session = sessionRows[0];

    if (session.userId !== userId) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    if (session.status !== "active") {
      return NextResponse.json({ error: "Session ended", code: "SESSION_ENDED" }, { status: 409 });
    }

    const bodyJson = await req.json();
    const body = SelfAssessmentSchema.parse(bodyJson);

    const answerRows = await db
      .select()
      .from(sessionAnswers)
      .where(and(eq(sessionAnswers.sessionId, sessionId), eq(sessionAnswers.questionId, body.questionId)))
      .limit(1);

    if (answerRows.length === 0) {
      return NextResponse.json({ error: "No answer found to self-assess", code: "ANSWER_NOT_FOUND" }, { status: 404 });
    }

    const existingAnswer = answerRows[0];
    if (existingAnswer.gradingMethod !== "self_assessment") {
      return NextResponse.json(
        { error: "Cannot self-assess an already graded answer", code: "CANNOT_SELF_ASSESS" },
        { status: 400 },
      );
    }

    // Map 1-5 to 0.0 - 1.0
    const score = (body.selfRating - 1) / 4.0;
    const isCorrect = score >= 0.6;

    await db
      .update(sessionAnswers)
      .set({ score, isCorrect })
      .where(eq(sessionAnswers.id, existingAnswer.id));

    // Also update mastery via after()
    const qRows = await db.select({ conceptIds: questions.conceptIds }).from(questions).where(eq(questions.id, body.questionId)).limit(1);
    const conceptIds = qRows[0]?.conceptIds ?? [];

    if (conceptIds.length > 0) {
      after(async () => {
        try {
          await updateConceptMastery(userId, conceptIds, existingAnswer.id, score, new Date());
        } catch (mErr) {
          console.error("[BACKGROUND_MASTERY_SELF_ASSESS_ERROR]", mErr);
        }
      });
    }

    return NextResponse.json({ score, isCorrect }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.flatten() }, { status: 422 });
    }
    console.error("[DRILL_SELF_ASSESS_ERROR]", error);
    return NextResponse.json({ error: "Failed to self-assess answer" }, { status: 500 });
  }
}
