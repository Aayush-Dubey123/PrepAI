import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/src/db";
import { drillSessions, questionReports, sessionAnswers } from "@/src/db/schema";
import { ReportQuestionSchema } from "@/src/schemas/drills";

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
    const sessionRows = await db.select().from(drillSessions).where(eq(drillSessions.id, sessionId)).limit(1);
    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 404 });
    }
    const session = sessionRows[0];

    if (session.userId !== userId) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    const bodyJson = await req.json();
    const body = ReportQuestionSchema.parse(bodyJson);

    if (!session.questionIds.includes(body.questionId)) {
      return NextResponse.json({ error: "Question does not belong to this session", code: "QUESTION_NOT_IN_SESSION" }, { status: 400 });
    }

    await db
      .insert(questionReports)
      .values({
        sessionId,
        questionId: body.questionId,
        userId,
        reason: body.reason,
        details: body.details ?? null,
        status: "pending",
      })
      .onConflictDoNothing();

    // If an answer already exists, flag it for review
    await db
      .update(sessionAnswers)
      .set({ flaggedForReview: true, reportReason: body.reason })
      .where(and(eq(sessionAnswers.sessionId, sessionId), eq(sessionAnswers.questionId, body.questionId)));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.flatten() }, { status: 422 });
    }
    console.error("[DRILL_REPORT_ERROR]", error);
    return NextResponse.json({ error: "Failed to report question" }, { status: 500 });
  }
}
