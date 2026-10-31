"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/src/components/app-sidebar";
import { UserButton } from "@clerk/nextjs";
import { Badge } from "@/src/components/ui/Badge";
import { useToast } from "@/src/components/ui/ToastProvider";
import {
  TrendingUp,
  Award,
  CheckCircle2,
  Sparkles,
  RefreshCcw,
  Clock,
  ArrowRight,
  Brain,
  Shield,
  Layers,
  HelpCircle,
  AlertCircle,
  Target,
  BookOpen,
  ChevronRight,
  Flame,
  Activity,
  Zap,
  Cpu,
  Database,
  Network,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Terminal,
  Compass,
  AlertTriangle,
  Play,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type {
  UserAnalyticsData,
  UserAnalyticsTrajectoryItem,
  DetailedEvaluationSession,
  EvaluatedQuestionFeedback,
  TopBlindspot,
} from "@/src/lib/analytics/user";
type TabKey = "feedback" | "practice-sets" | "curriculum";

const VALID_DRILL_SLUGS: Record<string, true> = {
  "system-design": true,
  "algo-logic": true,
  "behavioral-star": true,
  "frontend-arch": true,
  "database-concurrency": true,
  "rapid-screen": true,
};
interface RoadmapStage {
  stage: number;
  title: string;
  slug: string;
  level: "foundational" | "mid" | "senior" | "staff";
  description: string;
  topics: string[];
  duration: string;
  icon: "cpu" | "terminal" | "database" | "layers";
}

const ROADMAP_STAGES: RoadmapStage[] = [
  {
    stage: 1,
    title: "Foundational Technical Triage",
    slug: "rapid-screen",
    level: "foundational",
    description: "Core computer science, networking protocols, HTTP status codes, and baseline API triage.",
    topics: ["Networking", "APIs", "Operating Systems", "Data Structures"],
    duration: "5 mins",
    icon: "cpu",
  },
  {
    stage: 2,
    title: "Algorithmic Logic & Invariants",
    slug: "algo-logic",
    level: "mid",
    description: "Space-time complexity analysis, boundary conditions, state transitions, and tricky edge-case invariants.",
    topics: ["Complexity", "Pointers", "Recursion", "Invariants"],
    duration: "10 mins",
    icon: "terminal",
  },
  {
    stage: 3,
    title: "Systems & Storage Internals",
    slug: "database-concurrency",
    level: "senior",
    description: "Multi-version concurrency control (MVCC), isolation levels, lock contention, and connection topologies.",
    topics: ["PostgreSQL", "MVCC", "Deadlocks", "ACID Guarantees"],
    duration: "15 mins",
    icon: "database",
  },
  {
    stage: 4,
    title: "Enterprise Distributed Scalability",
    slug: "system-design",
    level: "staff",
    description: "Distributed consensus, eventual consistency, CAP theorem tradeoffs, and high-throughput event processing.",
    topics: ["CAP Theorem", "Kafka / Event Mesh", "Partitioning", "Cache Topologies"],
    duration: "15 mins",
    icon: "layers",
  },
];

export default function CandidateAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<UserAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("feedback");
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const [resolvedPracticeSet, setResolvedPracticeSet] = useState<{
    id: string;
    title: string;
    drillSlug: string;
    level: string;
  } | null>(null);
  const [resolvingSet, setResolvingSet] = useState(false);
  const [launchingSession, setLaunchingSession] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAnalytics = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setError(null);
      const res = await fetch("/api/user/analytics", {
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.status === 401) {
        setError("Please sign in to view your candidate analytics.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch analytics (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || "Malformed analytics response");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load analytics";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(false);
  }, []);

  const resolveRecommendedSet = useCallback(async (rawSlug: string, targetLevel: string) => {
    const drillSlug = VALID_DRILL_SLUGS[rawSlug] ? rawSlug : "rapid-screen";
    try {
      setResolvingSet(true);
      const res = await fetch(`/api/drills/${drillSlug}/sets`);
      if (!res.ok) return;
      const json = await res.json();
      const setsByLevel = json.setsByLevel;
      if (!setsByLevel) return;

      const levelSets = setsByLevel[targetLevel] || [];
      const match = levelSets[0] || Object.values(setsByLevel).flat()[0];
      if (match) {
        setResolvedPracticeSet({
          id: (match as { id: string }).id,
          title: (match as { title: string }).title,
          drillSlug,
          level: targetLevel,
        });
      }
    } catch {
      // Graceful fallback
    } finally {
      setResolvingSet(false);
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    const rawSlug = data.topBlindspots?.[0]?.recommendedDrill || "rapid-screen";
    const targetSlug = VALID_DRILL_SLUGS[rawSlug] ? rawSlug : "rapid-screen";
    const targetLevel = (data.summary?.totalInterviews ?? 0) > 0 ? "senior" : "foundational";
    resolveRecommendedSet(targetSlug, targetLevel);
  }, [data, resolveRecommendedSet]);

  const handleLaunchRecommendedSet = async () => {
    if (!data) return;
    setLaunchingSession(true);
    const rawSlug = resolvedPracticeSet?.drillSlug || data.topBlindspots?.[0]?.recommendedDrill || "rapid-screen";
    const targetSlug = VALID_DRILL_SLUGS[rawSlug] ? rawSlug : "rapid-screen";
    const targetLevel = resolvedPracticeSet?.level || ((data.summary?.totalInterviews ?? 0) > 0 ? "senior" : "foundational");

    try {
      const payload: Record<string, unknown> = {
        level: targetLevel,
        mode: "practice",
      };

      if (resolvedPracticeSet?.id) {
        payload.practiceSetId = resolvedPracticeSet.id;
        payload.isSmartSet = false;
      } else {
        payload.isSmartSet = true;
      }

      const res = await fetch(`/api/drills/${targetSlug}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to start recommended set");
      }

      router.push(`/practice/${targetSlug}/play?sessionId=${resJson.id}`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to launch session", { type: "error" });
      setLaunchingSession(false);
    }
  };

  const handleLaunchDirectDrill = async (
    rawSlug: string,
    level: string = "senior",
    targetConceptId?: string,
  ) => {
    const drillSlug = VALID_DRILL_SLUGS[rawSlug] ? rawSlug : "rapid-screen";
    try {
      setLaunchingSession(true);
      const res = await fetch(`/api/drills/${drillSlug}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          mode: "practice",
          isSmartSet: true,
          targetConceptId,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to launch drill session");
      }
      router.push(`/practice/${drillSlug}/play?sessionId=${resJson.id}`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to launch drill", { type: "error" });
      setLaunchingSession(false);
    }
  };

  const handleLaunchReviewSession = async () => {
    await handleLaunchDirectDrill("system-design", "senior");
  };
  const summary = data?.summary;
  const avgScore = summary?.averageScore ?? null;
  const topBlindspot = data?.topBlindspots?.[0];
  const latestEvaluation = data?.recentEvaluations?.[0];

  // Calculate composite Diagnostic Health Score (0-100)
  let healthScore = 0;
  if (avgScore !== null && avgScore > 0) {
    const qCount = summary?.totalQuestionsAnswered || 1;
    const excellenceRatio = (data?.answerQuality.excellent || 0) / qCount;
    healthScore = Math.min(100, Math.round(avgScore * 0.75 + excellenceRatio * 25));
  }

  // Calculate Hiring Signal percentage
  const totalHires =
    (data?.hiringDistribution.strong_hire || 0) +
    (data?.hiringDistribution.hire || 0) +
    (data?.hiringDistribution.consider || 0) +
    (data?.hiringDistribution.do_not_hire || 0);

  const hireRate =
    totalHires > 0
      ? Math.round(
          (((data?.hiringDistribution.strong_hire || 0) + (data?.hiringDistribution.hire || 0)) /
            totalHires) *
            100
        )
      : null;

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] md:h-screen w-full md:w-screen overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-[#f4f6fa] text-[#0f172a] select-none">
      {/* 1. Left Navigation */}
      <AppSidebar />

      {/* 2. Main Viewport */}
      <main className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] md:h-screen overflow-y-auto p-3 sm:p-4 md:p-5 space-y-4">
        {/* Top Header Bar */}
        <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between border-b border-[#e2e8f0] pb-2.5 gap-2.5">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[#0f172a]">
                Feedback Diagnostic & Technical Practice
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fdf4ff] text-[#a21caf] border border-[#f5d0fe]">
                <Sparkles className="w-3 h-3 text-[#c026d3]" />
                Targeted AI Training Lab
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5 truncate">
              Deep evaluation feedback analysis, blindspot triage, and modular technical practice roadmaps
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e2e8f0] bg-white text-xs font-medium text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#4f46e5]" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#e2e8f0] bg-white text-[#0f172a] text-xs font-semibold hover:bg-[#f8fafc] transition-all shadow-xs"
            >
              <Compass className="w-3.5 h-3.5 text-[#4f46e5]" />
              <span>Resume Portal</span>
            </Link>

            <div className="h-5 w-px bg-[#e2e8f0] mx-0.5" />
            <UserButton />
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-8 h-8 border-2 border-[#4f46e5] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-[#64748b]">Synthesizing technical feedback & drills...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-6 rounded-2xl bg-white border border-rose-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">Failed to Load Feedback Telemetry</h3>
            </div>
            <p className="text-xs text-[#64748b]">{error}</p>
            <button
              onClick={() => fetchAnalytics(true)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && data && (
          <>
            {/* Top Unique Diagnostic Ribbon (Feedback-Driven, Zero duplication with Dashboard!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Diagnostic Health Score */}
              <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b]">Technical Mastery Index</span>
                  <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#0f172a]">
                      {healthScore > 0 ? `${healthScore}/100` : "—"}
                    </span>
                    {avgScore !== null && (
                      <span className="text-xs text-emerald-600 font-semibold">
                        Avg: {avgScore}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-[#64748b]">
                    Weighted score across depth & rigor
                  </div>
                </div>
              </div>

              {/* Card 2: Primary Blindspot Alert */}
              <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b]">Primary Blindspot</span>
                  <div className="w-8 h-8 rounded-xl bg-[#fff1f2] border border-[#fecdd3] flex items-center justify-center text-[#e11d48]">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  {topBlindspot ? (
                    <div>
                      <div className="text-xs font-bold text-[#e11d48] truncate">
                        {topBlindspot.area}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#64748b]">
                        <span className="font-semibold text-rose-600">
                          {topBlindspot.frequency} {topBlindspot.frequency === 1 ? "flag" : "flags"}
                        </span>
                        <span>• Tap Drills tab to practice</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-bold text-emerald-700">No Critical Gaps</div>
                      <div className="mt-1 text-[11px] text-[#64748b]">Solid baseline demonstrated</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Highest Verified Competency */}
              <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b]">Strongest Asset</span>
                  <div className="w-8 h-8 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] flex items-center justify-center text-[#059669]">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  {data.demonstratedStrengths.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold text-[#059669] truncate">
                        {data.demonstratedStrengths[0].strength}
                      </div>
                      <div className="mt-1 text-[11px] text-[#64748b]">
                        Verified across {data.demonstratedStrengths[0].frequency} evaluations
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-bold text-[#64748b]">Uncalibrated</div>
                      <div className="mt-1 text-[11px] text-[#64748b]">Complete a probe to detect</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Hiring Signal Confidence */}
              <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b]">Hiring Signal Rate</span>
                  <div className="w-8 h-8 rounded-xl bg-[#faf5ff] border border-[#e9d5ff] flex items-center justify-center text-[#9333ea]">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-[#0f172a]">
                    {hireRate !== null ? `${hireRate}%` : "—"}
                  </div>
                  <div className="mt-1 text-[11px] text-[#64748b]">
                    {hireRate !== null
                      ? `${(data.hiringDistribution.strong_hire || 0) + (data.hiringDistribution.hire || 0)}/${totalHires} recommendations favorable`
                      : "Awaiting completed sessions"}
                  </div>
                </div>
              </div>
            </div>

            {/* Zero-Interview Onboarding Banner if 0 interviews */}
            {summary?.totalInterviews === 0 && (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border border-indigo-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[#4f46e5]">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="text-sm font-bold text-[#0f172a]">
                      Welcome to Technical Practice & Diagnostic Feedback!
                    </h3>
                  </div>
                  <p className="text-xs text-[#64748b] max-w-xl leading-relaxed">
                    You haven’t completed any technical interviews yet. Dive into one of the 6 targeted practice drills below to calibrate your skills, or upload your resume in the dashboard for a full technical interview.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("practice-sets")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4f46e5] text-white text-xs font-semibold hover:bg-[#4338ca] transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <span>Explore Diagnostic Practice</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Tabs Header */}
            <div className="border-b border-[#e2e8f0]">
              <nav className="flex space-x-6 text-xs font-semibold" aria-label="Analytical Console Tabs">
                <button
                  type="button"
                  onClick={() => setActiveTab("feedback")}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === "feedback"
                      ? "border-[#4f46e5] text-[#4f46e5]"
                      : "border-transparent text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Evaluation Feedback & Blindspots</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("practice-sets")}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === "practice-sets"
                      ? "border-[#4f46e5] text-[#4f46e5]"
                      : "border-transparent text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>Personalized Roadmap & Practice</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("curriculum")}
                  className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === "curriculum"
                      ? "border-[#4f46e5] text-[#4f46e5]"
                      : "border-transparent text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Action Plan & Score Trajectory</span>
                </button>
              </nav>
            </div>

            {/* TAB 1: Evaluation Feedback & Blindspots */}
            {activeTab === "feedback" && (
              <div className="space-y-6">
                {/* 5-Dimensional Competency Ratings Meter */}
                <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#0f172a]">5-Dimensional Competency Index</h3>
                      <p className="text-xs text-[#64748b]">Synthesized across technical architecture, logic, edge cases, communication, and stack fluency</p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#4f46e5] bg-[#eef2ff] px-2.5 py-1 rounded-lg border border-[#c7d2fe] self-start sm:self-center">
                      AI Rubric Calibration
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-1">
                    {/* Dimension 1: System Design */}
                    <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f172a]">System Design</span>
                        <span className="text-xs font-bold text-indigo-600">
                          {data.dimensionRatings.systemDesign}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${data.dimensionRatings.systemDesign}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#64748b]">Scalability, cache, persistence</p>
                    </div>

                    {/* Dimension 2: Code Logic */}
                    <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f172a]">Algorithms & Logic</span>
                        <span className="text-xs font-bold text-purple-600">
                          {data.dimensionRatings.codeLogic}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full transition-all"
                          style={{ width: `${data.dimensionRatings.codeLogic}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#64748b]">Complexity, invariants, structures</p>
                    </div>

                    {/* Dimension 3: Edge Cases */}
                    <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f172a]">Edge Case Rigor</span>
                        <span className="text-xs font-bold text-amber-600">
                          {data.dimensionRatings.edgeCases}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${data.dimensionRatings.edgeCases}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#64748b]">Boundaries, error handling, retries</p>
                    </div>

                    {/* Dimension 4: Communication */}
                    <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f172a]">Communication</span>
                        <span className="text-xs font-bold text-emerald-600">
                          {data.dimensionRatings.communication}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all"
                          style={{ width: `${data.dimensionRatings.communication}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#64748b]">STAR structure, precision, clarity</p>
                    </div>

                    {/* Dimension 5: Domain Expertise */}
                    <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f172a]">Stack Fluency</span>
                        <span className="text-xs font-bold text-blue-600">
                          {data.dimensionRatings.domainExpertise}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${data.dimensionRatings.domainExpertise}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#64748b]">Idiomatic APIs, tools, runtime</p>
                    </div>
                  </div>
                </div>

                {/* AI Executive Feedback Summary Card */}
                {latestEvaluation && (
                  <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5]">
                          <Brain className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#0f172a]">
                            Latest AI Evaluator Synthesis ({latestEvaluation.jobRole})
                          </h3>
                          <p className="text-xs text-[#64748b]">
                            Conducted {new Date(latestEvaluation.createdAt).toLocaleDateString()} • Score: {latestEvaluation.overallScore}%
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/interview/${latestEvaluation.id}/feedback`}
                        className="text-xs font-semibold text-[#4f46e5] hover:underline flex items-center gap-1"
                      >
                        <span>Full Assessment Report</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {latestEvaluation.summary && (
                      <p className="text-xs text-[#334155] bg-[#f8fafc] p-3.5 rounded-xl border border-[#e2e8f0] leading-relaxed">
                        &ldquo;{latestEvaluation.summary}&rdquo;
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {/* Observed Strengths */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>What Stood Out</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-[#475569]">
                          {latestEvaluation.strengths.slice(0, 3).map((s, idx) => (
                            <li key={idx} className="flex items-start gap-2 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                              <span className="text-emerald-600 font-bold">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Constructive Gaps */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>Areas for Immediate Polish</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-[#475569]">
                          {latestEvaluation.areasForImprovement.slice(0, 3).map((g, idx) => (
                            <li key={idx} className="flex items-start gap-2 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                              <span className="text-amber-600 font-bold">•</span>
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Question-by-Question Evaluator Feedback Explorer */}
                <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#0f172a]">
                        Evaluated Question Explorer & Suggested Improvements
                      </h3>
                      <p className="text-xs text-[#64748b]">
                        Inspect real dialogue questions asked, answer quality ratings, and model coaching tips
                      </p>
                    </div>
                  </div>

                  {data.recentEvaluations.flatMap((e) => e.questionFeedback).length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#64748b]">
                      No evaluated question records found yet. Complete an interview to generate probe-by-probe critique.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.recentEvaluations
                        .flatMap((e, eIdx) =>
                          e.questionFeedback.map((qf, qIdx) => ({
                            ...qf,
                            key: `${e.id}-${qIdx}`,
                            jobRole: e.jobRole,
                          }))
                        )
                        .slice(0, 8)
                        .map((q) => {
                          const isExpanded = expandedQuestion === q.key;
                          const qualityColor =
                            q.answerQuality === "excellent"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : q.answerQuality === "good"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : q.answerQuality === "fair"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200";

                          return (
                            <div
                              key={q.key}
                              className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] overflow-hidden transition-all"
                            >
                              <div
                                onClick={() => setExpandedQuestion(isExpanded ? null : q.key)}
                                className="p-3.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-100/70"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] bg-white px-2 py-0.5 rounded border border-[#e2e8f0]">
                                      {q.focusArea || "Technical Probe"}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${qualityColor}`}>
                                      {q.answerQuality.toUpperCase()}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-bold text-[#0f172a] leading-snug">
                                    {q.question}
                                  </h4>
                                </div>
                                <div className="text-[#64748b] shrink-0 mt-1">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="p-3.5 bg-white border-t border-[#e2e8f0] space-y-3 text-xs">
                                  {q.suggestedImprovement && (
                                    <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-100 text-[#312e81]">
                                      <span className="font-bold text-[11px] block text-indigo-900 mb-0.5">
                                        💡 AI Model Suggested Improvement:
                                      </span>
                                      <p className="text-[11px] leading-relaxed">{q.suggestedImprovement}</p>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                                    {q.strengths.length > 0 && (
                                      <div className="space-y-1">
                                        <span className="font-bold text-emerald-800">What went well:</span>
                                        <ul className="list-disc list-inside text-emerald-700 space-y-0.5">
                                          {q.strengths.map((str, sIdx) => (
                                            <li key={sIdx}>{str}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {q.gaps.length > 0 && (
                                      <div className="space-y-1">
                                        <span className="font-bold text-amber-800">Missed concepts:</span>
                                        <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                                          {q.gaps.map((gap, gIdx) => (
                                            <li key={gIdx}>{gap}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Diagnostic Practice & Learning Roadmap */}
            {activeTab === "practice-sets" && (
              <div className="space-y-6">
                {/* 1. Precise 3-State User Experience */}
                {(() => {
                  const hasInterviews = (summary?.totalInterviews ?? 0) > 0;
                  const hasPractice =
                    (data.gym?.drillStats?.some((d) => d.attempts > 0) ?? false) ||
                    ((data.gym?.streak ?? 0) > 0);

                  // STATE 1: Pure Onboarding
                  if (!hasInterviews && !hasPractice) {
                    return (
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/70 border border-indigo-100 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[#4f46e5]">
                              <Sparkles className="w-5 h-5 text-[#4f46e5]" />
                              <h3 className="text-sm font-bold text-[#0f172a]">
                                Welcome to Technical Practice
                              </h3>
                            </div>
                            <p className="text-xs text-[#64748b] max-w-2xl leading-relaxed">
                              Technical Practice delivers rapid, rubric-backed modular calibration across 6 core engineering domains.
                              Unlike full interviews that require resume context, practice sets run standalone in 5–15 minutes with instant feedback.
                            </p>
                          </div>
                          <Badge variant="purple" className="self-start sm:self-auto text-xs font-semibold px-3 py-1">
                            Diagnostic Calibration
                          </Badge>
                        </div>

                        {/* Initial Diagnostic Recommendation Card */}
                        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                Recommended Calibration
                              </span>
                              <span className="text-xs text-[#64748b]">5-Minute Foundational Assessment</span>
                            </div>
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              Zero Prerequisites
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-[#0f172a]">
                              {resolvedPracticeSet?.title || "Rapid-Fire Technical Screening Set"}
                            </h4>
                            <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                              Benchmark core computer science, networking protocols, HTTP status codes, and baseline API triage.
                              Completing this drill calibrates your initial readiness score and unlocks targeted difficulty suggestions.
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-[11px] text-[#64748b]">
                              Level: <strong className="text-[#0f172a] capitalize">{resolvedPracticeSet?.level || "Foundational"}</strong> • Mode: Practice
                            </span>

                            <button
                              type="button"
                              onClick={handleLaunchRecommendedSet}
                              disabled={resolvingSet || launchingSession}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#4f46e5] text-white text-xs font-semibold hover:bg-[#4338ca] active:scale-95 disabled:opacity-60 transition-all shadow-xs cursor-pointer"
                            >
                              {launchingSession || resolvingSet ? (
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                              <span>
                                {resolvingSet
                                  ? "Resolving Recommended Set..."
                                  : launchingSession
                                  ? "Launching Interactive Session..."
                                  : `Start Recommended Set: ${resolvedPracticeSet?.title || "Rapid-Fire Screening"}`}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // STATE 2: Active Practice Candidate (Practice sessions, but 0 full mock interviews)
                  if (!hasInterviews && hasPractice) {
                    const totalAttempts = data.gym?.drillStats?.reduce((acc, d) => acc + d.attempts, 0) ?? 0;
                    return (
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-50/80 via-white to-indigo-50/60 border border-orange-200 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[#4f46e5]">
                              <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                              <h3 className="text-sm font-bold text-[#0f172a]">
                                Practice Momentum Active
                              </h3>
                            </div>
                            <p className="text-xs text-[#64748b] max-w-2xl leading-relaxed">
                              Great work establishing consistency! You have completed {totalAttempts} practice drill session{totalAttempts === 1 ? "" : "s"} across technical disciplines.
                              To unlock automated blindspot diagnostic triage and hiring signal calibration, run a full mock interview in Dashboard.
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-100/70 border border-orange-300 rounded-full text-orange-900 text-xs font-bold">
                              <Flame className="w-4 h-4 text-orange-600 fill-orange-500" />
                              <span>{data.gym?.streak ?? 0} Day Streak</span>
                            </div>
                            <Link
                              href="/dashboard"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#e2e8f0] text-xs font-semibold text-[#0f172a] hover:bg-slate-50 transition-all shadow-xs"
                            >
                              <span>Run Full Interview</span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#4f46e5]" />
                            </Link>
                          </div>
                        </div>

                        {/* Next Level Recommendation */}
                        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              Next Recommended Progression
                            </span>
                            <span className="text-xs text-[#64748b]">Level: Senior</span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-[#0f172a]">
                              {resolvedPracticeSet?.title || "Algorithmic Invariants & Distributed Systems"}
                            </h4>
                            <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                              Progress from foundational triage to advanced edge-case invariants and distributed concurrency.
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-[11px] text-[#64748b]">Direct interactive launch with rubric feedback</span>
                            <button
                              type="button"
                              onClick={handleLaunchRecommendedSet}
                              disabled={resolvingSet || launchingSession}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#4f46e5] text-white text-xs font-semibold hover:bg-[#4338ca] active:scale-95 disabled:opacity-60 transition-all shadow-xs cursor-pointer"
                            >
                              {launchingSession || resolvingSet ? (
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                              <span>
                                {resolvingSet
                                  ? "Resolving..."
                                  : launchingSession
                                  ? "Launching..."
                                  : `Start Recommended Set: ${resolvedPracticeSet?.title || "Next Practice Set"}`}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // STATE 3: Calibrated Assessment (Has completed mock interviews)
                  return (
                    <div className="space-y-6">
                      {/* Diagnostic Hero Card */}
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border border-indigo-200 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[#4f46e5]">
                              <Target className="w-5 h-5 text-[#4f46e5]" />
                              <h3 className="text-sm font-bold text-[#0f172a]">
                                Personalized Learning Diagnostic & Targeted Remediation
                              </h3>
                            </div>
                            <p className="text-xs text-[#64748b] max-w-2xl leading-relaxed">
                              Calibrated from your latest evaluation feedback and identified blindspots. Launching the recommended set directly opens an interactive session targeting verified gaps.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 bg-orange-50 border border-orange-200 rounded-full text-orange-800 text-xs font-bold shadow-2xs">
                            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                            <span>{data.gym?.streak ?? 0} Day Streak</span>
                          </div>
                        </div>

                        {/* Targeted Recommendation Box with Guaranteed Pre-Resolved Set */}
                        <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs space-y-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="purple" className="text-[10px] uppercase font-bold">
                                Priority Remediation Set
                              </Badge>
                              {topBlindspot && (
                                <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  {topBlindspot.area} ({topBlindspot.severity})
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#64748b]">
                              Level: <strong className="text-[#0f172a] capitalize">{resolvedPracticeSet?.level || "Senior"}</strong>
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-[#0f172a]">
                              {resolvedPracticeSet?.title || (topBlindspot ? `Targeted Remediation: ${topBlindspot.area}` : "Adaptive Technical Practice Set")}
                            </h4>
                            <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                              {topBlindspot?.suggestedAction ||
                                "Targeted practice session calibrated to address identified blindspots from your recent technical mock evaluations."}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-[11px] text-[#64748b]">
                              Zero dead clicks: launches interactive session directly into question player.
                            </span>

                            <button
                              type="button"
                              onClick={handleLaunchRecommendedSet}
                              disabled={resolvingSet || launchingSession}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#4f46e5] text-white text-xs font-semibold hover:bg-[#4338ca] active:scale-95 disabled:opacity-60 transition-all shadow-xs cursor-pointer"
                            >
                              {launchingSession || resolvingSet ? (
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                              <span>
                                {resolvingSet
                                  ? "Resolving Set..."
                                  : launchingSession
                                  ? "Launching Interactive Session..."
                                  : `Start Recommended Set: ${resolvedPracticeSet?.title || "Targeted Drill"}`}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Verified Weak Areas & Blindspot Remediation Cards */}
                      {data.topBlindspots && data.topBlindspots.length > 0 && (
                        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                                Verified Candidate Blindspots
                              </h4>
                              <p className="text-[11px] text-[#64748b]">
                                Specific technical gaps flagged by AI evaluators across your interview transcripts
                              </p>
                            </div>
                            <span className="text-[10px] text-rose-700 bg-rose-50 font-semibold px-2 py-0.5 rounded border border-rose-200">
                              {data.topBlindspots.length} Blindspots
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.topBlindspots.map((b, idx) => (
                              <div
                                key={idx}
                                 className="p-4 rounded-xl border border-[#e2e8f0] bg-slate-50/50 flex flex-col justify-between space-y-3"
                               >
                                 <div className="space-y-1.5">
                                   <div className="flex items-center justify-between">
                                     <span className="text-xs font-bold text-[#0f172a]">{b.area}</span>
                                     <Badge
                                       variant={b.severity === "critical" ? "error" : "warning"}
                                       className="text-[9px] uppercase font-bold"
                                     >
                                       {b.severity}
                                     </Badge>
                                   </div>
                                   <p className="text-xs text-[#64748b] leading-relaxed">
                                     {b.suggestedAction}
                                   </p>
                                 </div>

                                 <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                                   <span className="text-[10px] text-[#94a3b8]">
                                     Flagged {b.frequency} time{b.frequency === 1 ? "" : "s"}
                                   </span>
                                   <button
                                     type="button"
                                     onClick={() => handleLaunchDirectDrill(b.recommendedDrill || "system-design", "senior")}
                                     disabled={launchingSession}
                                     className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[11px] font-semibold hover:bg-[#4338ca] active:scale-95 disabled:opacity-60 transition-all shadow-2xs cursor-pointer"
                                   >
                                     <Play className="w-3 h-3 fill-current" />
                                     <span>Start Targeted Drill</span>
                                   </button>
                                 </div>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })()}

                 {/* 2. Structured 4-Stage Learning Roadmap */}
                 <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-4">
                   <div className="flex items-center justify-between">
                     <div>
                       <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                         Structured Technical Readiness Roadmap
                       </h4>
                       <p className="text-[11px] text-[#64748b]">
                         Progressive step-by-step technical progression from foundational triage to staff-level scalability
                       </p>
                     </div>
                     <span className="text-[10px] text-indigo-700 bg-indigo-50 font-semibold px-2 py-0.5 rounded border border-indigo-200">
                       4 Stages
                     </span>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {ROADMAP_STAGES.map((st) => {
                       const stat = data.gym?.drillStats?.find((ds) => ds.slug === st.slug);
                       const hasAttempts = (stat?.attempts ?? 0) > 0;

                       return (
                         <div
                           key={st.stage}
                           className="p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-indigo-200 transition-all shadow-2xs flex flex-col justify-between space-y-3"
                         >
                           <div className="space-y-2">
                             <div className="flex items-center justify-between">
                               <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                 Stage {st.stage} • {st.level.toUpperCase()}
                               </span>
                               <div className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
                                 <Clock className="w-3.5 h-3.5 text-[#94a3b8]" />
                                 <span>{st.duration}</span>
                               </div>
                             </div>

                             <div>
                               <h5 className="text-sm font-bold text-[#0f172a]">{st.title}</h5>
                               <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
                                 {st.description}
                               </p>
                             </div>

                             <div className="flex flex-wrap gap-1 pt-1">
                               {st.topics.map((t, idx) => (
                                 <span
                                   key={idx}
                                   className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                                 >
                                   {t}
                                 </span>
                               ))}
                             </div>
                           </div>

                           <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between">
                             {hasAttempts ? (
                               <div className="flex items-center gap-2 text-[11px]">
                                 <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                   Avg: {stat?.avgScore}%
                                 </span>
                                 <span className="text-[#64748b]">{stat?.attempts} attempt{stat?.attempts === 1 ? "" : "s"}</span>
                               </div>
                             ) : (
                               <span className="text-[11px] text-[#94a3b8] italic">Not yet attempted</span>
                             )}

                             <button
                               type="button"
                               onClick={() => handleLaunchDirectDrill(st.slug, st.level)}
                               disabled={launchingSession}
                               className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#4f46e5] text-white text-xs font-semibold hover:bg-[#4338ca] active:scale-95 disabled:opacity-60 transition-all shadow-xs cursor-pointer"
                             >
                               <Play className="w-3 h-3 fill-current" />
                               <span>Launch Stage {st.stage}</span>
                             </button>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>

                 {/* 3. Spaced Repetition & Retention Section (if conceptMastery exists) */}
                 {data.gym?.conceptMastery && data.gym.conceptMastery.length > 0 && (
                   <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-4">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                       <div>
                         <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                           Concept Retention & Mastery Index
                         </h4>
                         <p className="text-[11px] text-[#64748b]">
                           Strengthen concepts approaching retention decay to preserve long-term engineering mastery
                         </p>
                       </div>

                       <button
                         type="button"
                         onClick={handleLaunchReviewSession}
                         disabled={launchingSession}
                         className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold active:scale-95 disabled:opacity-60 transition-all shadow-xs shrink-0 cursor-pointer"
                       >
                         <RefreshCcw className="w-3.5 h-3.5" />
                         <span>Launch Review Session</span>
                       </button>
                     </div>

                     <div className="flex flex-wrap gap-2 pt-1">
                       {data.gym.conceptMastery.map((cm) => {
                         const variant = cm.mastery >= 0.7 ? "success" : cm.mastery >= 0.4 ? "warning" : "error";
                         return (
                           <div
                             key={cm.conceptId}
                             className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/60"
                           >
                             <Badge variant={variant} className="text-[10px] font-bold">
                               {Math.round(cm.mastery * 100)}%
                             </Badge>
                             <span className="text-xs font-medium text-slate-700">{cm.label}</span>
                             {cm.mastery < 0.6 && (
                               <button
                                 type="button"
                                 onClick={() => handleLaunchDirectDrill(cm.drillSlug || "system-design", "senior", cm.conceptId)}
                                 disabled={launchingSession}
                                 className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                               >
                                 Target →
                               </button>
                             )}
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* 4. Score Progression Trend (if >=2 sessions) */}
                 {data.gym?.scoreTrend && data.gym.scoreTrend.length >= 2 && mounted && (
                   <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-3">
                     <div className="flex items-center justify-between">
                       <div>
                         <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                           Practice Score Progression
                         </h4>
                         <p className="text-[11px] text-[#64748b]">Performance across recent completed drill sessions</p>
                       </div>
                       <span className="text-[10px] text-indigo-700 bg-indigo-50 font-semibold px-2 py-0.5 rounded border border-indigo-200">
                         {data.gym.scoreTrend.length} Sessions
                       </span>
                     </div>
                     <div className="h-48 w-full pt-2">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={data.gym.scoreTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                           <defs>
                             <linearGradient id="gymScoreColor" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                               <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                             </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                           <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} tickLine={false} />
                           <Tooltip
                             contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                             formatter={(value) => [`${value}%`, "Score"]}
                           />
                           <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#gymScoreColor)" />
                         </AreaChart>
                       </ResponsiveContainer>
                     </div>
                   </div>
                 )}

                 {/* 5. Navigation to Standalone Practice Hub Banner */}
                 <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="space-y-1">
                     <div className="flex items-center gap-2">
                       <Flame className="w-5 h-5 text-amber-400" />
                       <h4 className="text-sm font-bold text-white">
                         Looking to explore all 6 drills and customize difficulty tiers?
                       </h4>
                     </div>
                     <p className="text-xs text-slate-300">
                       Access the full Technical Practice catalog with timed countdown blitzes, speech recognition voice mode, and complete session history.
                     </p>
                   </div>

                   <Link
                     href="/practice"
                     className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-all shadow-xs shrink-0"
                   >
                     <span>Go to Technical Practice Hub</span>
                     <ArrowRight className="w-4 h-4 text-indigo-600" />
                   </Link>
                 </div>
               </div>
             )}

            {/* TAB 3: Action Plan & Score Trajectory */}
            {activeTab === "curriculum" && (
              <div className="space-y-6">
                {/* Score Progression Chart Card */}
                <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#0f172a]">Technical Score Trajectory</h3>
                      <p className="text-xs text-[#64748b]">Chronological progression across completed assessments</p>
                    </div>
                    {data.trajectory.length > 0 && (
                      <span className="text-[11px] font-medium text-[#4f46e5] bg-[#eef2ff] px-2.5 py-1 rounded-lg border border-[#c7d2fe]">
                        {data.trajectory.length} {data.trajectory.length === 1 ? "Session" : "Sessions"} Plotted
                      </span>
                    )}
                  </div>

                  {data.trajectory.length >= 2 && mounted ? (
                    <div className="h-64 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.trajectory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            axisLine={{ stroke: "#e2e8f0" }}
                            tickLine={false}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            axisLine={{ stroke: "#e2e8f0" }}
                            tickLine={false}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const item = payload[0].payload as UserAnalyticsTrajectoryItem;
                                return (
                                  <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 shadow-lg text-xs space-y-1">
                                    <div className="font-bold text-[#0f172a]">{item.jobRole}</div>
                                    <div className="text-[#64748b]">{item.date}</div>
                                    <div className="font-semibold text-[#4f46e5]">Score: {item.score}%</div>
                                    <div className="text-[10px] text-[#94a3b8]">{item.turns} turns</div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="score"
                            stroke="#4f46e5"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#scoreColor)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-8 px-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col items-center justify-center text-center space-y-2">
                      <Clock className="w-8 h-8 text-[#94a3b8]" />
                      <p className="text-xs font-semibold text-[#0f172a]">Chronological Trajectory Awaiting 2+ Sessions</p>
                      <p className="text-[11px] text-[#64748b] max-w-sm">
                        Complete multiple mock evaluations or practice sets to observe your score acceleration trend.
                      </p>
                    </div>
                  )}
                </div>

                {/* Personalized Action Plan */}
                <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Targeted Growth Curriculum</h3>
                    <p className="text-xs text-[#64748b]">
                      Prioritized technical milestones formulated from your recurring evaluation blindspots
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.practiceRecommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe]">
                              Milestone 0{idx + 1}
                            </span>
                            <span className="text-[10px] font-mono text-[#94a3b8]">{rec.category}</span>
                          </div>
                          <h4 className="text-xs font-bold text-[#0f172a] leading-snug">
                            {rec.title}
                          </h4>
                          <p className="text-[11px] text-[#64748b] leading-relaxed">
                            {rec.reason}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#e2e8f0]/60 space-y-2">
                          <div className="text-[10px] font-semibold text-[#0f172a] uppercase tracking-wider">
                            Recommended Drill
                          </div>
                          <p className="text-[11px] text-[#334155] leading-relaxed">
                            {rec.suggestedAction}
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("practice-sets")}
                            className="mt-2 text-xs font-semibold text-[#4f46e5] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Start Targeted Drill</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
