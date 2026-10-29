/**
 * GET /api/interviews
 *
 * Retrieves full interview history for the authenticated user and session cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/src/db/index";
import { interviews, transcriptChunks, auditEvents } from "@/src/db/schema";
import { checkIsAdmin } from "@/src/lib/auth/admin";

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

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    const url = new URL(req.url);
    const targetId = url.searchParams.get("id");
    const clearCompleted = url.searchParams.get("clearCompleted") === "true";

    const cookieHeader =
      req.cookies.get("prepai_interview_ids")?.value ??
      req.cookies.get("intervia_interview_ids")?.value ??
      "";
    const cookieIds = cookieHeader.split(",").map((s) => s.trim()).filter(Boolean);

    if (targetId) {
      const [interview] = await db
        .select({ id: interviews.id, userId: interviews.userId })
        .from(interviews)
        .where(eq(interviews.id, targetId))
        .limit(1);

      if (!interview) {
        return NextResponse.json({ error: "Interview not found" }, { status: 404 });
      }

      const isOwner = Boolean(
        (userId && interview.userId === userId) || cookieIds.includes(targetId)
      );

      if (!isOwner) {
        const adminCheck = await checkIsAdmin(req);
        if (!adminCheck.isAdmin) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      await db.delete(transcriptChunks).where(eq(transcriptChunks.interviewId, targetId));
      await db.delete(auditEvents).where(eq(auditEvents.interviewId, targetId));
      await db.delete(interviews).where(eq(interviews.id, targetId));

      const updatedCookieIds = cookieIds.filter((cid) => cid !== targetId);
      const res = NextResponse.json({ success: true, deletedId: targetId });
      res.cookies.set("prepai_interview_ids", updatedCookieIds.join(","), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
      return res;
    }

    if (clearCompleted) {
      const conditions = [];
      if (userId) {
        conditions.push(eq(interviews.userId, userId));
      }
      if (cookieIds.length > 0) {
        conditions.push(inArray(interviews.id, cookieIds));
      }
      if (conditions.length === 0) {
        return NextResponse.json({ success: true, deletedCount: 0 });
      }

      const userRecords = await db
        .select({ id: interviews.id, status: interviews.status, currentPhase: interviews.currentPhase })
        .from(interviews)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions));

      const completedIds = userRecords
        .filter((r) => r.status === "completed" || r.currentPhase === "closed")
        .map((r) => r.id);

      if (completedIds.length > 0) {
        await db.delete(transcriptChunks).where(inArray(transcriptChunks.interviewId, completedIds));
        await db.delete(auditEvents).where(inArray(auditEvents.interviewId, completedIds));
        await db.delete(interviews).where(inArray(interviews.id, completedIds));
      }

      const remainingCookieIds = cookieIds.filter((id) => !completedIds.includes(id));
      const res = NextResponse.json({ success: true, deletedCount: completedIds.length });
      res.cookies.set("prepai_interview_ids", remainingCookieIds.join(","), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
      return res;
    }

    return NextResponse.json({ error: "Provide ?id=<id> or ?clearCompleted=true" }, { status: 400 });
  } catch (error: unknown) {
    console.error("[DELETE_INTERVIEWS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete interview records", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
