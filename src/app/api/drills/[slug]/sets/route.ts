import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { drills, practiceSets, drillSessions } from "@/src/db/schema";

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

    const sets = await db
      .select({
        id: practiceSets.id,
        title: practiceSets.title,
        slug: practiceSets.slug,
        level: practiceSets.level,
        questionCount: sql<number>`cardinality(${practiceSets.questionIds})`,
        sortOrder: practiceSets.sortOrder,
      })
      .from(practiceSets)
      .where(eq(practiceSets.drillId, drill.id))
      .orderBy(practiceSets.sortOrder, practiceSets.slug);

    // Fetch user stats per set
    const userSetStats = await db
      .select({
        practiceSetId: drillSessions.practiceSetId,
        completedCount: sql<number>`count(*) FILTER (WHERE ${drillSessions.status} = 'completed')`,
        bestScore: sql<number | null>`max(${drillSessions.score}) FILTER (WHERE ${drillSessions.status} = 'completed')`,
      })
      .from(drillSessions)
      .where(and(eq(drillSessions.userId, userId), eq(drillSessions.drillId, drill.id)))
      .groupBy(drillSessions.practiceSetId);

    const statsMap = new Map<string, { completedCount: number; bestScore: number | null }>();
    for (const s of userSetStats) {
      if (s.practiceSetId) {
        statsMap.set(s.practiceSetId, {
          completedCount: Number(s.completedCount) || 0,
          bestScore: s.bestScore !== null ? Number(s.bestScore) : null,
        });
      }
    }

    const setsWithStats = sets.map((s) => {
      const stat = statsMap.get(s.id);
      return {
        ...s,
        completedCount: stat?.completedCount ?? 0,
        bestScore: stat?.bestScore ?? null,
      };
    });

    const setsByLevel: Record<string, typeof setsWithStats> = {
      foundational: [],
      mid: [],
      senior: [],
      staff: [],
    };

    for (const s of setsWithStats) {
      if (setsByLevel[s.level]) {
        setsByLevel[s.level].push(s);
      }
    }

    return NextResponse.json({ drill, setsByLevel }, { status: 200 });
  } catch (error) {
    console.error("[GET_PRACTICE_SETS_ERROR]", error);
    return NextResponse.json({ error: "Failed to list practice sets" }, { status: 500 });
  }
}
