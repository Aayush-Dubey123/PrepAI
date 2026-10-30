import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/src/db";
import { drills, practiceSets, drillSessions } from "@/src/db/schema";
import { DrillDetailClient } from "@/src/components/gym/DrillDetailClient";

export const dynamic = "force-dynamic";

export default async function DrillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ autoReview?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const autoReview = resolvedSearchParams?.autoReview === "true";
  // 1. Fetch drill
  const drillRows = await db.select().from(drills).where(eq(drills.slug, slug)).limit(1);
  if (drillRows.length === 0) {
    notFound();
  }
  const drill = drillRows[0];

  // 2. Fetch practice sets for this drill
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

  // 3. Fetch history for this user
  const historyRows = await db
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
    .limit(10);

  const formattedHistory = historyRows.map((h) => {
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

  return (
    <DrillDetailClient
      drill={{
        id: drill.id,
        slug: drill.slug,
        title: drill.title,
        category: drill.category,
        description: drill.description,
        icon: drill.icon,
        color: drill.color,
        defaultDifficulty: drill.defaultDifficulty,
        timeLimitSeconds: drill.timeLimitSeconds,
      }}
      practiceSets={sets.map((s) => ({
        id: s.id,
        title: s.title,
        slug: s.slug,
        level: s.level,
        questionCount: Number(s.questionCount) || 0,
        sortOrder: s.sortOrder,
      }))}
      history={formattedHistory}
      initialAutoReview={autoReview}
    />
  );
}
