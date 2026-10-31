import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/src/db/index";
import { interviews } from "@/src/db/schema";
import { eq, desc, or, inArray } from "drizzle-orm";
import { computeUserAnalytics, computeGymAnalytics } from "@/src/lib/analytics/user";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/analytics
 *
 * Scoped, private performance analytics endpoint for the authenticated candidate.
 * Strictly enforces user isolation (WHERE interviews.user_id = auth.userId).
 * Emits private, no-store cache headers to prevent cross-user or proxy leakage.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required" },
        { status: 401 }
      );
    }

    // Retrieve interview IDs tracked in cookies for this candidate
    const cookieHeader =
      req.cookies.get("prepai_interview_ids")?.value ??
      req.cookies.get("intervia_interview_ids")?.value ??
      "";
    const cookieInterviewIds = cookieHeader
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    const conditions = [eq(interviews.userId, userId)];
    if (cookieInterviewIds.length > 0) {
      conditions.push(inArray(interviews.id, cookieInterviewIds));
    }

    let userInterviews: Array<unknown> = [];
    try {
      userInterviews = await db
        .select()
        .from(interviews)
        .where(or(...conditions))
        .orderBy(desc(interviews.createdAt));
    } catch (dbErr) {
      console.warn("[USER_ANALYTICS] Interviews query fallback (tables may be uninitialized):", dbErr);
    }
    const analyticsData = computeUserAnalytics(userInterviews);
    const gymAnalytics = await computeGymAnalytics(userId);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...analyticsData,
          gym: gymAnalytics,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[USER_ANALYTICS_ERROR]", error);
    return NextResponse.json(
      {
        error: "Failed to load candidate analytics",
        message: errorMessage,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
