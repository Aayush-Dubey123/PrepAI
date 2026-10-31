/**
 * GET & POST /api/interviews/[id]/feedback
 *
 * Provides the feedback report for a completed or terminated interview.
 * If feedback is not yet generated, it automatically invokes generation.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/index";
import { interviews, transcriptChunks } from "@/src/db/schema";
import { generateFeedbackForInterviewRecord } from "./generate/route";
import { checkIsAdmin } from "@/src/lib/auth/admin";
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: interviewId } = await context.params;

  try {
    const { userId } = await auth();

    const [interview] = await db
      .select()
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1);

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const cookieHeader =
      req.cookies.get("prepai_interview_ids")?.value ??
      req.cookies.get("intervia_interview_ids")?.value ??
      "";
    const cookieIds = cookieHeader.split(",").map((s) => s.trim()).filter(Boolean);

    const isOwner = Boolean(
      (userId && interview.userId === userId) ||
      cookieIds.includes(interviewId)
    );

    if (!isOwner) {
      const adminCheck = userId ? await checkIsAdmin(req) : { isAdmin: false };
      if (!adminCheck.isAdmin) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to view this report" },
          { status: 403 }
        );
      }
    }

    // If feedback is already generated and valid, return it directly
    const feedbackObj = interview.feedback as Record<string, unknown> | null;
    if (feedbackObj && typeof feedbackObj.overallScore === "number") {
      return NextResponse.json({
        success: true,
        interview: {
          id: interview.id,
          jobRole: interview.jobRole,
          status: interview.status,
          createdAt: interview.createdAt,
          score: interview.score,
        },
        feedback: feedbackObj,
      });
    }

    // Feedback not yet generated -> fetch chunks and trigger generate route logic internally
    const chunks = await db
      .select()
      .from(transcriptChunks)
      .where(eq(transcriptChunks.interviewId, interviewId));

    // If empty transcript or brand new interview
    if (!chunks || chunks.length === 0) {
      const earlyExitFeedback = {
        overallScore: 0,
        summary: "Interview ended before any technical questions were answered.",
        strengths: [],
        areasForImprovement: ["Interview was not completed."],
        skillAssessments: [],
        questionFeedback: [],
        recommendedFollowUp: "Reschedule interview session.",
        hiringRecommendation: "do_not_hire",
        interviewDuration: 0,
      };

      await db
        .update(interviews)
        .set({
          status: "completed",
          currentPhase: "closed",
          score: 0,
          feedback: earlyExitFeedback,
        })
        .where(eq(interviews.id, interviewId));

      return NextResponse.json({
        success: true,
        interview: {
          id: interview.id,
          jobRole: interview.jobRole,
          status: "completed",
          createdAt: interview.createdAt,
          score: 0,
        },
        feedback: earlyExitFeedback,
      });
    }

    const generatedFeedback = await generateFeedbackForInterviewRecord(
      interview,
      chunks,
      req,
      { userId: userId ?? undefined, sessionId: null },
    );

    return NextResponse.json({
      success: true,
      interview: {
        id: interview.id,
        jobRole: interview.jobRole,
        status: "completed",
        createdAt: interview.createdAt,
        score: generatedFeedback.overallScore,
      },
      feedback: generatedFeedback,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[FEEDBACK_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to retrieve feedback report", message: errorMessage },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await context.params;

  try {
    const { userId } = await auth();

    const [interview] = await db
      .select()
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1);

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const cookieHeader =
      req.cookies.get("prepai_interview_ids")?.value ??
      req.cookies.get("intervia_interview_ids")?.value ??
      "";
    const cookieIds = cookieHeader.split(",").map((s) => s.trim()).filter(Boolean);

    const isOwner = Boolean(
      (userId && interview.userId === userId) ||
      cookieIds.includes(interviewId)
    );

    if (!isOwner) {
      const adminCheck = userId ? await checkIsAdmin(req) : { isAdmin: false };
      if (!adminCheck.isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Mark interview status as completed if ongoing
    if (interview.status !== "completed") {
      await db
        .update(interviews)
        .set({ status: "completed", currentPhase: "closed" })
        .where(eq(interviews.id, interviewId));
    }

    const chunks = await db
      .select()
      .from(transcriptChunks)
      .where(eq(transcriptChunks.interviewId, interviewId));

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Interview concluded with zero candidate turns",
      });
    }

    const generated = await generateFeedbackForInterviewRecord(
      interview,
      chunks,
      req,
      { userId: userId ?? undefined, sessionId: null }
    );

    return NextResponse.json({
      success: true,
      feedback: generated,
    });
  } catch (error: unknown) {
    console.error("[FEEDBACK_POST_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate feedback report" },
      { status: 500 }
    );
  }
}
