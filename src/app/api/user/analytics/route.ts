import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/src/db/index";
import { interviews } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";
import { computeUserAnalytics } from "@/src/lib/analytics/user";

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

    // Strictly fetch only rows belonging to this authenticated user
    const userInterviews = await db
      .select()
      .from(interviews)
      .where(eq(interviews.userId, userId))
      .orderBy(desc(interviews.createdAt));

    const analyticsData = computeUserAnalytics(userInterviews);

    return NextResponse.json(
      {
        success: true,
        data: analyticsData,
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
