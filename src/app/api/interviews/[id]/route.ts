/**
 * GET & DELETE /api/interviews/[id]
 *
 * Provides single interview inspection and secure cascade deletion.
 * Validates ownership against Clerk authenticated userId or session tracking cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/index";
import { interviews, transcriptChunks, auditEvents } from "@/src/db/schema";
import { checkIsAdmin } from "@/src/lib/auth/admin";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await context.params;

  if (!interviewId) {
    return NextResponse.json({ error: "Missing interview ID" }, { status: 400 });
  }

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
      const adminCheck = await checkIsAdmin(req);
      if (!adminCheck.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, interview });
  } catch (err: unknown) {
    console.error("[GET_INTERVIEW_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to fetch interview", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await context.params;

  if (!interviewId) {
    return NextResponse.json({ error: "Missing interview ID" }, { status: 400 });
  }

  try {
    const { userId } = await auth();

    const [interview] = await db
      .select({
        id: interviews.id,
        userId: interviews.userId,
      })
      .from(interviews)
      .where(eq(interviews.id, interviewId))
      .limit(1);

    if (!interview) {
      return NextResponse.json({ error: "Interview record not found" }, { status: 404 });
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
      const adminCheck = await checkIsAdmin(req);
      if (!adminCheck.isAdmin) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to delete this record" },
          { status: 403 }
        );
      }
    }

    // Explicit cascade deletion of dependent records
    await db.delete(transcriptChunks).where(eq(transcriptChunks.interviewId, interviewId));
    await db.delete(auditEvents).where(eq(auditEvents.interviewId, interviewId));
    await db.delete(interviews).where(eq(interviews.id, interviewId));

    console.log(`[DELETE_INTERVIEW] Record deleted id=${interviewId} user=${userId || "anonymous"}`);

    const updatedCookieIds = cookieIds.filter((cid) => cid !== interviewId);
    const res = NextResponse.json({
      success: true,
      message: "Interview record and transcript deleted successfully",
      deletedId: interviewId,
    });

    res.cookies.set("prepai_interview_ids", updatedCookieIds.join(","), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    return res;
  } catch (err: unknown) {
    console.error("[DELETE_INTERVIEW_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to delete interview record", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
