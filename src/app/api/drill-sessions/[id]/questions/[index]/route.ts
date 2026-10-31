import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { drillSessions, questions, sessionAnswers } from "@/src/db/schema";
import { ClientQuestionPayloadSchema } from "@/src/schemas/drills";
import { computeSessionScore } from "@/src/lib/drills/scoring";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { id: sessionId, index: indexStr } = await params;

    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
    if (!isValidUuid) {
      return NextResponse.json({ error: "Invalid session ID", code: "INVALID_SESSION_ID" }, { status: 400 });
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
      // Auto-finish session
      const answers = await db.select().from(sessionAnswers).where(eq(sessionAnswers.sessionId, sessionId));
      const finalScore = computeSessionScore(answers);
      await db
        .update(drillSessions)
        .set({ status: "completed", finishedAt: now, score: finalScore })
        .where(eq(drillSessions.id, sessionId));

      return NextResponse.json({ error: "Session timed out", code: "SESSION_EXPIRED" }, { status: 409 });
    }

    // Index validation
    const parsedIndex = parseInt(indexStr, 10);
    if (isNaN(parsedIndex) || parsedIndex < 0) {
      return NextResponse.json(
        { error: "Invalid question index: must be a non-negative integer", code: "INVALID_INDEX" },
        { status: 400 },
      );
    }
    if (parsedIndex >= session.questionIds.length) {
      return NextResponse.json(
        {
          error: `Question index out of range: session has only ${session.questionIds.length} questions`,
          code: "INDEX_OUT_OF_RANGE",
        },
        { status: 404 },
      );
    }
    if (parsedIndex > session.currentIndex) {
      return NextResponse.json({ error: "Cannot skip ahead", code: "INDEX_AHEAD" }, { status: 403 });
    }

    // Load question
    const questionId = session.questionIds[parsedIndex];
    const questionRows = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
    if (questionRows.length === 0) {
      return NextResponse.json({ error: "Question not found", code: "QUESTION_NOT_FOUND" }, { status: 404 });
    }
    const question = questionRows[0];

    // Strip secrets: parse through ClientQuestionPayloadSchema
    const safePayload = ClientQuestionPayloadSchema.parse(question.payload);

    // Check if already answered
    const existingAnswer = await db
      .select({ id: sessionAnswers.id, score: sessionAnswers.score, isCorrect: sessionAnswers.isCorrect })
      .from(sessionAnswers)
      .where(and(eq(sessionAnswers.sessionId, sessionId), eq(sessionAnswers.questionId, questionId)))
      .limit(1);

    const alreadyAnswered = existingAnswer.length > 0;
    const previousScore = alreadyAnswered ? existingAnswer[0].score : undefined;

    return NextResponse.json({
      index: parsedIndex,
      questionId: question.id,
      type: question.type,
      payload: safePayload,
      totalQuestions: session.questionIds.length,
      alreadyAnswered,
      previousScore,
    });
  } catch (error) {
    console.error("[DRILL_FETCH_QUESTION_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 });
  }
}
