import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { drillSessions, drills } from "@/src/db/schema";

export async function GET(
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
    const sessionRows = await db
      .select({
        id: drillSessions.id,
        drillId: drillSessions.drillId,
        practiceSetId: drillSessions.practiceSetId,
        userId: drillSessions.userId,
        status: drillSessions.status,
        mode: drillSessions.mode,
        level: drillSessions.level,
        currentIndex: drillSessions.currentIndex,
        score: drillSessions.score,
        startedAt: drillSessions.startedAt,
        finishedAt: drillSessions.finishedAt,
        timeLimitSeconds: drillSessions.timeLimitSeconds,
        expiresAt: drillSessions.expiresAt,
        questionCount: sql<number>`cardinality(${drillSessions.questionIds})`,
        drillSlug: drills.slug,
        drillTitle: drills.title,
      })
      .from(drillSessions)
      .innerJoin(drills, eq(drills.id, drillSessions.drillId))
      .where(eq(drillSessions.id, sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session not found", code: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    const s = sessionRows[0];
    if (s.userId !== userId) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    return NextResponse.json({ session: s }, { status: 200 });
  } catch (error) {
    console.error("[GET_DRILL_SESSION_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
