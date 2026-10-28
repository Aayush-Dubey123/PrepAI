/**
 * GET /api/interviews
 *
 * Retrieves full interview history for the authenticated user and session cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/src/db/index";
import { interviews } from "@/src/db/schema";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    // Retrieve interview IDs tracked in cookie
    const cookieHeader = req.cookies.get("prepai_interview_ids")?.value ?? req.cookies.get("intervia_interview_ids")?.value ?? "";
    const cookieInterviewIds = cookieHeader
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const conditions = [];

    if (userId) {
      conditions.push(eq(interviews.userId, userId));
    }

    if (cookieInterviewIds.length > 0) {
      conditions.push(inArray(interviews.id, cookieInterviewIds));
    }

    let userInterviews: Array<{
      id: string;
      jobRole: string;
      status: string | null;
      score: number | null;
      currentPhase: string | null;
      totalTurns: number | null;
      feedback: unknown;
      createdAt: Date | null;
    }> = [];

    if (conditions.length > 0) {
      userInterviews = await db
        .select({
          id: interviews.id,
          jobRole: interviews.jobRole,
          status: interviews.status,
          score: interviews.score,
          currentPhase: interviews.currentPhase,
          totalTurns: interviews.totalTurns,
          feedback: interviews.feedback,
          createdAt: interviews.createdAt,
        })
        .from(interviews)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .orderBy(desc(interviews.createdAt))
        .limit(50);
    } else if (process.env.NODE_ENV !== "production" && process.env.DEV_MOCK_ALL_INTERVIEWS === "true") {
      userInterviews = await db
        .select({
          id: interviews.id,
          jobRole: interviews.jobRole,
          status: interviews.status,
          score: interviews.score,
          currentPhase: interviews.currentPhase,
          totalTurns: interviews.totalTurns,
          feedback: interviews.feedback,
          createdAt: interviews.createdAt,
        })
        .from(interviews)
        .orderBy(desc(interviews.createdAt))
        .limit(50);
    }

    return NextResponse.json({
      success: true,
      interviews: userInterviews,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET_INTERVIEWS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch interview history", message: errorMessage },
      { status: 500 },
    );
  }
}
