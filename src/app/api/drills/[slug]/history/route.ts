import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { drills, drillSessions, practiceSets } from "@/src/db/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { slug } = await params;

    const drillRows = await db.select().from(drills).where(eq(drills.slug, slug)).limit(1);
    if (drillRows.length === 0) {
      return NextResponse.json({ error: "Drill not found", code: "DRILL_NOT_FOUND" }, { status: 404 });
    }
    const drill = drillRows[0];

    const history = await db
      .select({
        id: drillSessions.id,
        status: drillSessions.status,
        mode: drillSessions.mode,
        level: drillSessions.level,
        score: drillSessions.score,
        startedAt: drillSessions.startedAt,
        finishedAt: drillSessions.finishedAt,
        questionCount: sql<number>`cardinality(${drillSessions.questionIds})`,
        practiceSetTitle: practiceSets.title,
      })
      .from(drillSessions)
      .leftJoin(practiceSets, eq(practiceSets.id, drillSessions.practiceSetId))
      .where(and(eq(drillSessions.userId, userId), eq(drillSessions.drillId, drill.id)))
      .orderBy(sql`${drillSessions.startedAt} DESC`)
      .limit(20);

    const formatted = history.map((h) => {
      let durationSeconds: number | null = null;
      if (h.startedAt && h.finishedAt) {
        durationSeconds = Math.max(
          0,
          Math.round((new Date(h.finishedAt).getTime() - new Date(h.startedAt).getTime()) / 1000),
        );
      }

      return {
        id: h.id,
        status: h.status,
        mode: h.mode,
        level: h.level,
        score: h.score,
        startedAt: h.startedAt ? new Date(h.startedAt).toISOString() : null,
        finishedAt: h.finishedAt ? new Date(h.finishedAt).toISOString() : null,
        durationSeconds,
        questionCount: Number(h.questionCount) || 0,
        practiceSetTitle: h.practiceSetTitle ?? "Adaptive Smart Set",
      };
    });

    return NextResponse.json({ history: formatted }, { status: 200 });
  } catch (error) {
    console.error("[GET_DRILL_HISTORY_ERROR]", error);
    return NextResponse.json({ error: "Failed to list drill history" }, { status: 500 });
  }
}
