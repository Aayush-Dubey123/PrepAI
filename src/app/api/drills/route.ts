import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { drills, drillSessions, concepts, userConceptMastery } from "@/src/db/schema";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const allDrills = await db.select().from(drills).orderBy(drills.slug);

    // Fetch user sessions summary per drill
    const sessionStats = await db
      .select({
        drillId: drillSessions.drillId,
        attempts: sql<number>`count(*) FILTER (WHERE ${drillSessions.status} = 'completed')`,
        bestScore: sql<number | null>`max(${drillSessions.score}) FILTER (WHERE ${drillSessions.status} = 'completed')`,
        lastPracticed: sql<string | null>`max(${drillSessions.finishedAt}) FILTER (WHERE ${drillSessions.status} = 'completed')`,
      })
      .from(drillSessions)
      .where(eq(drillSessions.userId, userId))
      .groupBy(drillSessions.drillId);

    const statsMap = new Map<string, { attempts: number; bestScore: number | null; lastPracticed: string | null }>();
    for (const stat of sessionStats) {
      statsMap.set(stat.drillId, {
        attempts: Number(stat.attempts) || 0,
        bestScore: stat.bestScore !== null ? Number(stat.bestScore) : null,
        lastPracticed: stat.lastPracticed ? new Date(stat.lastPracticed).toISOString() : null,
      });
    }

    // Fetch user concept mastery per drill
    const conceptMasteryRows = await db
      .select({
        drillId: concepts.drillId,
        avgMastery: sql<number>`avg(${userConceptMastery.mastery})`,
      })
      .from(userConceptMastery)
      .innerJoin(concepts, eq(concepts.id, userConceptMastery.conceptId))
      .where(eq(userConceptMastery.userId, userId))
      .groupBy(concepts.drillId);

    const masteryMap = new Map<string, number>();
    for (const row of conceptMasteryRows) {
      if (row.avgMastery !== null) {
        masteryMap.set(row.drillId, Math.round(Number(row.avgMastery) * 100) / 100);
      }
    }

    const results = allDrills.map((d) => {
      const stat = statsMap.get(d.id);
      const mastery = masteryMap.get(d.id);

      return {
        id: d.id,
        slug: d.slug,
        title: d.title,
        category: d.category,
        description: d.description,
        icon: d.icon,
        color: d.color,
        defaultDifficulty: d.defaultDifficulty,
        timeLimitSeconds: d.timeLimitSeconds,
        attempts: stat?.attempts ?? 0,
        bestScore: stat?.bestScore ?? null,
        lastPracticed: stat?.lastPracticed ?? null,
        conceptMastery: mastery ?? null,
      };
    });

    return NextResponse.json({ drills: results }, { status: 200 });
  } catch (error) {
    console.error("[GET_DRILLS_ERROR]", error);
    return NextResponse.json({ error: "Failed to list drills" }, { status: 500 });
  }
}
