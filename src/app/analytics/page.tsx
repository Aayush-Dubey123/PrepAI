"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/src/components/app-sidebar";
import { UserButton } from "@clerk/nextjs";
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
import { DUMMY_RESUME_ID } from "@/src/lib/default-interview-plan";

type TabKey = "feedback" | "practice-sets" | "curriculum";

interface PracticeSetPreset {
  id: string;
  title: string;
  category: string;
  duration: string;
  difficulty: "Foundational" | "Mid-Level" | "Senior" | "Staff";
  description: string;
  focusTopics: string[];
  roleTitle: string;
  icon: "system-design" | "algo" | "behavioral" | "frontend" | "database" | "rapid";
  color: string;
}

const PRACTICE_SETS: PracticeSetPreset[] = [
  {
    id: "system-design",
    title: "System Design & Distributed Scalability",
    category: "Architecture",
    duration: "15 mins",
    difficulty: "Staff",
    description:
      "Deep architectural probe on microservices, caching topologies, eventual consistency, and high-throughput event processing.",
    focusTopics: ["Distributed Systems", "PostgreSQL", "Redis", "Partitioning", "CAP Theorem"],
    roleTitle: "System Design & Architecture Specialist",
    icon: "system-design",
    color: "from-blue-500/10 to-indigo-500/10 border-indigo-200 text-indigo-700",
  },
  {
    id: "algo-logic",
    title: "Algorithmic Logic & Edge-Case Blitz",
    category: "Coding & Logic",
    duration: "10 mins",
    difficulty: "Senior",
    description:
      "Targeted technical interrogation testing time/space complexity analysis, memory boundaries, and tricky edge-case invariants.",
    focusTopics: ["Algorithms", "Data Structures", "Space-Time Tradeoffs", "Boundary Conditions"],
    roleTitle: "Algorithmic Systems Engineer",
    icon: "algo",
    color: "from-purple-500/10 to-pink-500/10 border-purple-200 text-purple-700",
  },
  {
    id: "behavioral-star",
    title: "Behavioral & Executive STAR Simulator",
    category: "Leadership",
    duration: "10 mins",
    difficulty: "Mid-Level",
    description:
      "Structured behavioral evaluation assessing conflict resolution, cross-functional ownership, engineering ethics, and delivery under pressure.",
    focusTopics: ["STAR Framework", "Cross-Functional Influence", "Conflict Resolution", "Ownership"],
    roleTitle: "Engineering Lead & Behavioral Candidate",
    icon: "behavioral",
    color: "from-amber-500/10 to-orange-500/10 border-amber-200 text-amber-700",
  },
  {
    id: "frontend-arch",
    title: "Frontend Architecture & Web Systems",
    category: "Web & UI",
    duration: "15 mins",
    difficulty: "Senior",
    description:
      "Rigorous probe into component composition, re-render lifecycles, CSS containment, state machines, and Core Web Vitals.",
    focusTopics: ["React 19", "State Management", "DOM Reconciliation", "Web Performance"],
    roleTitle: "Senior Frontend Architect",
    icon: "frontend",
    color: "from-cyan-500/10 to-blue-500/10 border-cyan-200 text-cyan-700",
  },
  {
    id: "database-concurrency",
    title: "Database Internals & Concurrency Deep-Dive",
    category: "Persistence",
    duration: "15 mins",
    difficulty: "Staff",
    description:
      "Focuses on transaction isolation (ACID, MVCC), index internals (B-Tree vs Hash), deadlocks, and connection pooling.",
    focusTopics: ["PostgreSQL", "MVCC Isolation", "B-Trees", "Deadlock Mitigation", "WAL"],
    roleTitle: "Database & Storage Systems Specialist",
    icon: "database",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-700",
  },
  {
    id: "rapid-screen",
    title: "Rapid-Fire Technical Screening (5-Min Blitz)",
    category: "Speed Drills",
    duration: "5 mins",
    difficulty: "Foundational",
    description:
      "Fast-paced foundational triage covering HTTP/3, memory management, REST vs gRPC, and fundamental terminology.",
    focusTopics: ["Computer Science Fundamentals", "Networking", "APIs", "Concurrency"],
    roleTitle: "Fullstack Technical Screening",
    icon: "rapid",
    color: "from-rose-500/10 to-amber-500/10 border-rose-200 text-rose-700",
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
  const [launchingDrillId, setLaunchingDrillId] = useState<string | null>(null);
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

  // Handle immediate 1-click launch of targeted practice set
  const handleLaunchPracticeSet = async (preset: PracticeSetPreset) => {
    try {
      setLaunchingDrillId(preset.id);
      const response = await fetch("/api/interviews/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobRole: preset.roleTitle,
          resumeId: DUMMY_RESUME_ID,
          customCandidateProfile: {
            fullName: "Targeted Drill Candidate",
            topSkills: preset.focusTopics,
            yearsOfExperience: 4,
            coreProjects: [
              {
                title: `${preset.title} Practice Run`,
                techStack: preset.focusTopics,
                bulletPoints: [preset.description],
              },
            ],
          },
        }),
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.error || "Failed to initialize practice set");
      }

      router.push(`/interview/${resJson.id}/lobby`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to launch drill session";
      alert(`Could not launch drill: ${msg}`);
      setLaunchingDrillId(null);
    }
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
    <div className="h-screen w-screen overflow-hidden flex bg-[#f4f6fa] text-[#0f172a] select-none">
      {/* 1. Left Navigation */}
      <AppSidebar />

      {/* 2. Main Viewport */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Top Header Bar */}
        <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between border-b border-[#e2e8f0] pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a]">
                Feedback Diagnostic & Practice Gym
              </h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#fdf4ff] text-[#a21caf] border border-[#f5d0fe]">
                <Sparkles className="w-3.5 h-3.5 text-[#c026d3]" />
                Targeted AI Training Lab
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#64748b] mt-1">
              Deep evaluation feedback analysis, blindspot triage, and modular technical practice drills
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
                      Welcome to your Diagnostic Feedback & Practice Gym!
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
                  <span>Explore Practice Sets</span>
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
                  <span>Modular Practice Sets (6 Drills)</span>
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

            {/* TAB 2: Modular Practice Sets (All Practice Set Types) */}
            {activeTab === "practice-sets" && (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#4f46e5]">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-[#0f172a]">
                      Targeted Modular Practice Gym
                    </h3>
                  </div>
                  <p className="text-xs text-[#64748b] leading-relaxed">
                    Skip full resume upload flows and jump straight into specialized drills designed to isolate and eliminate technical weak spots. Each drill calibrates depth dynamically in real-time.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {PRACTICE_SETS.map((preset) => {
                    const isLaunching = launchingDrillId === preset.id;

                    return (
                      <div
                        key={preset.id}
                        className="rounded-2xl bg-white border border-[#e2e8f0] shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-5 space-y-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe]">
                              {preset.category}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
                              <Clock className="w-3.5 h-3.5 text-[#94a3b8]" />
                              <span>{preset.duration}</span>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-[#0f172a] leading-snug">
                              {preset.title}
                            </h4>
                            <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                              {preset.description}
                            </p>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                              Focus Concepts
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {preset.focusTopics.map((topic, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]"
                                >
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-[#64748b]">
                            Level: <strong className="text-[#0f172a]">{preset.difficulty}</strong>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleLaunchPracticeSet(preset)}
                            disabled={isLaunching || launchingDrillId !== null}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#4f46e5] text-white text-xs font-semibold hover:bg-[#4338ca] active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isLaunching ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Pre-warming...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current" />
                                <span>Launch Drill</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
