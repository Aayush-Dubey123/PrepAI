import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { drillSessions, sessionAnswers, questions } from "@/src/db/schema";
import { computeSessionScore } from "@/src/lib/drills/scoring";

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

    // Single Atomic DB Transaction
    const txResult = await db.transaction(async (tx) => {
      const sessionRows = await tx
        .select()
        .from(drillSessions)
        .where(and(eq(drillSessions.id, sessionId), eq(drillSessions.userId, userId)))
        .for("update");

      if (sessionRows.length === 0) {
        return { status: 404, error: "Session not found", code: "NOT_FOUND" as const };
      }

      const session = sessionRows[0];

      if (session.status === "completed") {
        const answers = await tx
          .select()
          .from(sessionAnswers)
          .where(eq(sessionAnswers.sessionId, sessionId));
        return { status: 200, session, answers, cached: true };
      }

      if (session.status === "abandoned") {
        return { status: 409, error: "Session was abandoned", code: "SESSION_ABANDONED" as const };
      }

      const answers = await tx
        .select()
        .from(sessionAnswers)
        .where(eq(sessionAnswers.sessionId, sessionId));

      const finalScore = computeSessionScore(answers);
      const finishedAt = new Date();

      const [updatedSession] = await tx
        .update(drillSessions)
        .set({
          status: "completed",
          finishedAt,
          score: finalScore,
        })
        .where(eq(drillSessions.id, sessionId))
        .returning();

      return { status: 200, session: updatedSession, answers, cached: false };
    });

    if (txResult.status !== 200 || !txResult.session || !txResult.answers) {
      return NextResponse.json({ error: txResult.error, code: txResult.code }, { status: txResult.status });
    }

    const session = txResult.session;
    const answers = txResult.answers;
    // Assemble per-question feedback
    const questionIds = session.questionIds;
    const questionMap = new Map<string, { stem: string; type: string; explanation: string; modelAnswer: string }>();

    if (questionIds.length > 0) {
      const qRows = await db
        .select({
          id: questions.id,
          type: questions.type,
          payload: questions.payload,
          explanation: questions.explanation,
          modelAnswer: questions.modelAnswer,
        })
        .from(questions)
        .where(sql`${questions.id} IN (${sql.join(questionIds.map((id) => sql`${id}`), sql`, `)})`);

      for (const q of qRows) {
        const stem = (q.payload as { stem?: string }).stem ?? "";
        questionMap.set(q.id, {
          stem,
          type: q.type,
          explanation: q.explanation,
          modelAnswer: q.modelAnswer,
        });
      }
    }

    const answerMap = new Map<string, (typeof answers)[number]>();
    for (const a of answers) {
      answerMap.set(a.questionId, a);
    }
    let correctCount = 0;
    const perQuestion = questionIds.map((qid, idx) => {
      const ans = answerMap.get(qid);
      const qInfo = questionMap.get(qid);
      const isCorrect = ans?.isCorrect ?? false;
      if (isCorrect) correctCount++;

      return {
        index: idx,
        questionId: qid,
        type: qInfo?.type ?? "unknown",
        stem: qInfo?.stem ?? "",
        userAnswer: ans?.answer ?? null,
        score: ans?.score ?? 0,
        isCorrect,
        gradingMethod: ans?.gradingMethod ?? null,
        gradingResult: ans?.gradingResult ?? null,
        explanation: qInfo?.explanation ?? "",
        modelAnswer: qInfo?.modelAnswer ?? "",
        timeTakenMs: ans?.timeTakenMs ?? null,
      };
    });

    const startTime = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const endTime = session.finishedAt ? new Date(session.finishedAt).getTime() : Date.now();
    const timeElapsed = Math.max(0, Math.round((endTime - startTime) / 1000));

    return NextResponse.json(
      {
        score: session.score ?? 0,
        totalQuestions: session.questionIds.length,
        answeredCount: answers.length,
        correctCount,
        timeElapsed,
        perQuestion,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[DRILL_FINISH_ERROR]", error);
    return NextResponse.json({ error: "Failed to finish drill session" }, { status: 500 });
  }
}
