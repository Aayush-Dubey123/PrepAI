import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/src/db";
import { drills, drillSessions, concepts, userConceptMastery } from "@/src/db/schema";
import { Card } from "@/src/components/ui/containers/Card";
import { Badge } from "@/src/components/ui/actions/Badge";
import { ProgressBar } from "@/src/components/ui/containers/ProgressBar";
import {
  Flame,
  Clock,
  Layers,
  Cpu,
  Database,
  Terminal,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  RotateCcw,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Technical Practice — PrepAI",
  description: "Targeted modular drills across 6 engineering disciplines. Calibrate depth, practice timed blitzes, and build durable mastery.",
};

const DRILL_ICONS: Record<string, React.ReactNode> = {
  "system-design": <Layers className="w-5 h-5 text-indigo-600" />,
  "algo-logic": <Terminal className="w-5 h-5 text-purple-600" />,
  "behavioral-star": <Users className="w-5 h-5 text-amber-600" />,
  "frontend-arch": <Compass className="w-5 h-5 text-cyan-600" />,
  "database-concurrency": <Database className="w-5 h-5 text-emerald-600" />,
  "rapid-screen": <Cpu className="w-5 h-5 text-rose-600" />,
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default async function TechnicalPracticePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let allDrills: (typeof drills.$inferSelect)[] = [];
  const statsMap = new Map<string, { attempts: number; bestScore: number | null; lastPracticed: string | null }>();
  const masteryMap = new Map<string, number>();
  let overdueCount = 0;
  let overdueDrillSlug = "system-design";
  const conceptTagsMap = new Map<string, string[]>();

  try {
    // Parallelize all independent database queries for instant execution
    const [
      drillList,
      sessionStats,
      masteryStats,
      overdueDrillRows,
      rootConcepts,
    ] = await Promise.all([
      db.select().from(drills).orderBy(drills.slug),
      db
        .select({
          drillId: drillSessions.drillId,
          attempts: sql<number>`count(*) FILTER (WHERE ${drillSessions.status} = 'completed')`,
          bestScore: sql<number | null>`max(${drillSessions.score}) FILTER (WHERE ${drillSessions.status} = 'completed')`,
          lastPracticed: sql<string | null>`max(${drillSessions.finishedAt}) FILTER (WHERE ${drillSessions.status} = 'completed')`,
        })
        .from(drillSessions)
        .where(eq(drillSessions.userId, userId))
        .groupBy(drillSessions.drillId),
      db
        .select({
          drillId: concepts.drillId,
          avgMastery: sql<number>`avg(${userConceptMastery.mastery})`,
        })
        .from(userConceptMastery)
        .innerJoin(concepts, eq(concepts.id, userConceptMastery.conceptId))
        .where(eq(userConceptMastery.userId, userId))
        .groupBy(concepts.drillId),
      db
        .select({
          drillSlug: drills.slug,
          totalOverdue: sql<number>`count(*) over()`,
        })
        .from(userConceptMastery)
        .innerJoin(concepts, eq(concepts.id, userConceptMastery.conceptId))
        .innerJoin(drills, eq(drills.id, concepts.drillId))
        .where(sql`${userConceptMastery.userId} = ${userId} AND ${userConceptMastery.nextDue} <= now()`)
        .limit(1),
      db
        .select({
          drillId: concepts.drillId,
          label: concepts.label,
        })
        .from(concepts)
        .where(sql`${concepts.parentId} IS NULL`)
        .orderBy(concepts.sortOrder),
    ]);

    allDrills = drillList;

    for (const s of sessionStats) {
      statsMap.set(s.drillId, {
        attempts: Number(s.attempts) || 0,
        bestScore: s.bestScore !== null ? Number(s.bestScore) : null,
        lastPracticed: s.lastPracticed ? new Date(s.lastPracticed).toISOString() : null,
      });
    }

    for (const m of masteryStats) {
      if (m.avgMastery !== null) {
        masteryMap.set(m.drillId, Math.round(Number(m.avgMastery) * 100));
      }
    }

    if (overdueDrillRows.length > 0) {
      overdueCount = Number(overdueDrillRows[0].totalOverdue) || 0;
      overdueDrillSlug = overdueDrillRows[0].drillSlug ?? "system-design";
    }

    for (const c of rootConcepts) {
      const arr = conceptTagsMap.get(c.drillId) || [];
      arr.push(c.label);
      conceptTagsMap.set(c.drillId, arr);
    }
  } catch (err) {
    console.error("[PRACTICE_PAGE_FETCH_ERROR] Database query failed or uninitialized tables:", err);
  }

  if (allDrills.length === 0) {
    return (
      <div className="h-full w-full max-w-7xl mx-auto p-4 sm:p-5 lg:px-6 lg:py-4 flex flex-col justify-between">
        <div className="shrink-0 flex items-center justify-between border-b border-[#e2e8f0] pb-2.5">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-2xs shrink-0">
              <Flame className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-[#0f172a] tracking-tight whitespace-nowrap">Technical Practice</h1>
              <Badge variant="purple" className="text-[9px] uppercase font-semibold shrink-0">Modular Drills</Badge>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-[#e2e8f0] shadow-sm text-center max-w-md mx-auto my-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-[#0f172a]">Practice Library Initializing</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Drill tracks and question banks have not been populated in the database yet. Run the seed command to activate all 6 practice tracks.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-left w-full font-mono text-[11px] text-[#475569] space-y-1">
            <p className="font-semibold text-slate-700">Database Seed Command:</p>
            <code className="block bg-slate-100 p-2 rounded text-indigo-700 select-all">npm run seed:drills</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full h-auto lg:h-full w-full max-w-7xl mx-auto p-4 sm:p-5 lg:px-6 lg:py-4 flex flex-col justify-start lg:justify-between">
      {/* Header - Single line clean alignment without trailing wraps */}
      <div className="shrink-0 flex items-center justify-between border-b border-[#e2e8f0] pb-2.5">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-2xs shrink-0">
            <Flame className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-[#0f172a] tracking-tight whitespace-nowrap">Technical Practice</h1>
            <Badge variant="purple" className="text-[9px] uppercase font-semibold shrink-0">Modular Drills</Badge>
          </div>
        </div>
        <p className="text-xs text-[#64748b] leading-tight whitespace-nowrap text-right hidden md:block">
          Targeted modular drills across 6 engineering disciplines. Calibrate depth, practice timed blitzes, and build durable mastery.
        </p>
      </div>

      {/* Review Due Today Banner */}
      {overdueCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-200/80 rounded-2xl py-2 px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs shrink-0 my-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-700 rounded-xl shrink-0">
              <RotateCcw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0f172a]">Spaced Repetition Active</span>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {overdueCount} concepts due
                </span>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Strengthen concepts approaching retention decay to preserve long-term engineering mastery.
              </p>
            </div>
          </div>
          <Link
            href={`/practice/${overdueDrillSlug}?autoReview=true`}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Start Review Session</span>
          </Link>
        </div>
      )}

      {/* 3-Column Responsive Grid of Drills - Equal Height Grid Rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-3 sm:gap-3.5 lg:gap-4 flex-1 my-2 lg:min-h-0 items-stretch">
        {allDrills.map((drill) => {
          const stats = statsMap.get(drill.id);
          const masteryPct = masteryMap.get(drill.id) ?? 0;
          const tags = conceptTagsMap.get(drill.id) || [];
          const hasAttempts = (stats?.attempts ?? 0) > 0;

          return (
            <Link key={drill.id} href={`/practice/${drill.slug}`} prefetch={true} className="group flex flex-col h-full focus:outline-hidden">
              <Card className="h-full flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden border-[#e2e8f0]">
                {/* Top Bar with category & difficulty */}
                <div className={`px-3.5 py-2 bg-gradient-to-r ${drill.color} border-b border-inherit/40 flex items-center justify-between shrink-0`}>
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-white/90 rounded-md shadow-2xs">
                      {DRILL_ICONS[drill.slug] ?? <Flame className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <span className="text-[10px] font-bold tracking-tight">{drill.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="neutral" className="text-[9px] bg-white/80 font-medium py-0 px-1.5">
                      {drill.defaultDifficulty[0].toUpperCase() + drill.defaultDifficulty.slice(1)}
                    </Badge>
                    <span className="text-[10px] text-[#64748b] font-medium flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {Math.round(drill.timeLimitSeconds / 60)}m
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-3.5 flex-1 flex flex-col justify-between min-h-0">
                  <div className="space-y-1">
                    <h2 className="text-xs sm:text-sm font-bold text-[#0f172a] group-hover:text-indigo-600 transition-colors">
                      {drill.title}
                    </h2>
                    <p className="text-[10.5px] text-[#64748b] line-clamp-2 leading-relaxed">
                      {drill.description}
                    </p>
                  </div>

                  {/* Focus Topic Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1.5">
                      {tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="bg-[#f1f5f9] text-[#475569] text-[9.5px] px-1.5 py-0.5 rounded font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length > 4 && (
                        <span className="text-[9.5px] text-[#94a3b8] font-medium px-1 py-0.5">
                          +{tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer with Stats & Mastery */}
                <div className="px-3.5 py-2 border-t border-[#f1f5f9] shrink-0 bg-[#fafbfc]">
                  {hasAttempts ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#64748b] font-medium">Concept Mastery</span>
                        <span className="font-bold text-[#0f172a]">{masteryPct}%</span>
                      </div>
                      <ProgressBar value={masteryPct} size="sm" variant={masteryPct >= 70 ? "success" : masteryPct >= 40 ? "default" : "warning"} />

                      <div className="flex items-center justify-between text-[9.5px] text-[#64748b] pt-0.5">
                        <span>{stats?.attempts} session{stats?.attempts === 1 ? "" : "s"}</span>
                        <span>Best: <strong className="text-[#0f172a] font-semibold">{stats?.bestScore ?? 0}%</strong></span>
                        <span>{formatRelativeTime(stats?.lastPracticed ?? null)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-1 text-center text-[#94a3b8] text-[10.5px] flex items-center justify-between">
                      <span className="font-medium italic">Not yet attempted</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                        Start Practice Drill <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
