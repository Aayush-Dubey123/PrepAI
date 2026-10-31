"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/src/components/ui/actions/Button";
import { Badge } from "@/src/components/ui/actions/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/containers/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/overlays/Tabs";
import { useToast } from "@/src/components/ui/feedback/ToastProvider";
import {
  ArrowLeft,
  Clock,
  Sparkles,
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Volume2,
  ShieldCheck,
  Award,
  Sliders,
  BarChart3,
  TrendingUp,
  Target,
} from "lucide-react";
export interface DrillDetailProps {
  drill: {
    id: string;
    slug: string;
    title: string;
    category: string;
    description: string;
    icon: string;
    color: string;
    defaultDifficulty: "foundational" | "mid" | "senior" | "staff";
    timeLimitSeconds: number;
  };
  practiceSets: Array<{
    id: string;
    title: string;
    slug: string;
    level: "foundational" | "mid" | "senior" | "staff";
    questionCount: number;
    sortOrder: number;
  }>;
  history: Array<{
    id: string;
    status: string;
    mode: string;
    level: string;
    score: number | null;
    startedAt: string | null;
    finishedAt: string | null;
    durationSeconds: number | null;
    questionCount: number;
    practiceSetTitle: string;
  }>;
  initialAutoReview?: boolean;
}

export function DrillDetailClient({ drill, practiceSets, history, initialAutoReview }: DrillDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [level, setLevel] = useState<string>(drill.defaultDifficulty);
  const [mode, setMode] = useState<"practice" | "timed" | "voice">("practice");
  const [loadingSetId, setLoadingSetId] = useState<string | null>(null);
  const [loadingSmart, setLoadingSmart] = useState(false);
  const hasAutoRunRef = useRef(false);

  const completed = history.filter((h) => h.score !== null);
  const completedCount = completed.length;
  const bestScore = completed.length > 0 ? Math.max(...completed.map((h) => h.score || 0)) : null;
  const avgScore = completed.length > 0 ? Math.round(completed.reduce((acc, h) => acc + (h.score || 0), 0) / completed.length) : null;

  const setsForLevel = practiceSets.filter((s) => s.level === level);

  const startSession = async (practiceSetId?: string, isSmartSet: boolean = false) => {
    try {
      if (isSmartSet) setLoadingSmart(true);
      else if (practiceSetId) setLoadingSetId(practiceSetId);
      else setLoadingSetId("ad-hoc");

      const clientRequestId = `gym-${drill.slug}-${Date.now()}`;
      const res = await fetch(`/api/drills/${drill.slug}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          mode,
          practiceSetId: isSmartSet ? undefined : practiceSetId,
          isSmartSet,
          clientRequestId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start session");
      }

      if (data.resumed) {
        toast("Session Resumed: Resuming your existing in-progress session.", { type: "info" });
      }

      router.push(`/practice/${drill.slug}/play?sessionId=${data.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Could Not Start Drill: ${msg}`, { type: "error" });
      setLoadingSetId(null);
      setLoadingSmart(false);
    }
  };

  useEffect(() => {
    if (initialAutoReview && !hasAutoRunRef.current) {
      hasAutoRunRef.current = true;
      startSession(undefined, true);
    }
  }, [initialAutoReview]);

  return (
    <div className="min-h-full h-auto lg:h-full w-full max-w-7xl mx-auto p-3 sm:p-5 lg:px-6 lg:py-4 flex flex-col justify-start lg:justify-between overflow-visible lg:overflow-hidden">
      {/* Top Drill Hero Banner — Compact, high-density, single-line alignment */}
      <div className={`shrink-0 rounded-2xl p-3.5 sm:p-4 bg-gradient-to-r ${drill.color} border border-inherit/40 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3`}>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href="/practice"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748b] hover:text-[#0f172a] bg-white/90 hover:bg-white border border-[#e2e8f0] px-2 py-0.5 rounded-lg transition-colors shadow-2xs shrink-0"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Drills</span>
            </Link>
            <Badge variant="neutral" className="bg-white/90 font-semibold text-[10px] shrink-0">
              {drill.category}
            </Badge>
            <span className="text-[10.5px] font-medium text-[#64748b] flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              {Math.round(drill.timeLimitSeconds / 60)}m Session Limit
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-bold text-[#0f172a] tracking-tight truncate">
            {drill.title}
          </h1>

          <p className="text-[11px] text-[#475569] leading-tight line-clamp-1 max-w-3xl">
            {drill.description}
          </p>
        </div>

        {/* Adaptive Weak-Concept Drill Action CTA */}
        <div className="shrink-0 flex items-center gap-2">
          <Button
            onClick={() => startSession(undefined, true)}
            disabled={loadingSmart || loadingSetId !== null}
            variant="primary"
            className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl shadow-xs flex items-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{loadingSmart ? "Preparing..." : "Adaptive Weak-Concept Drill"}</span>
          </Button>
        </div>
      </div>

      {/* Two-Column Equal-Height Balanced Cockpit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 lg:min-h-0 items-stretch my-2.5 overflow-visible lg:overflow-hidden">
        {/* Left Column: SESSION CONFIGURATION & CURATED SETS */}
        <div className="h-auto lg:h-full flex flex-col lg:min-h-0 overflow-visible lg:overflow-hidden bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-4.5 shadow-2xs">
          {/* Column Header */}
          <div className="shrink-0 flex items-center justify-between pb-2.5 border-b border-[#f1f5f9] mb-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider font-mono">
                CONFIGURATION & PRACTICE SETS
              </h2>
            </div>
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {setsForLevel.length} set{setsForLevel.length === 1 ? "" : "s"} available
            </span>
          </div>

          {/* Unified Compact Controls Group */}
          <div className="shrink-0 space-y-2.5 p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] mb-2.5">
            {/* Difficulty Tier */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#475569] uppercase font-mono tracking-wider">
                  Difficulty Tier
                </span>
                <span className="text-[10px] text-[#94a3b8] capitalize">
                  Active: <strong className="text-indigo-600">{level}</strong>
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 p-1 bg-white rounded-xl border border-[#e2e8f0]">
                {(["foundational", "mid", "senior", "staff"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    className={`py-1.5 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                      level === lvl
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Practice Mode */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#475569] uppercase font-mono tracking-wider">
                  Practice Mode
                </span>
                <span className="text-[10px] text-[#94a3b8] capitalize">
                  Mode: <strong className="text-indigo-600">{mode}</strong>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode("practice")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    mode === "practice"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                      : "bg-white border-[#e2e8f0] text-[#64748b] hover:bg-slate-50"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Practice</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("timed")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    mode === "timed"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                      : "bg-white border-[#e2e8f0] text-[#64748b] hover:bg-slate-50"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Timed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("voice")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    mode === "voice"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                      : "bg-white border-[#e2e8f0] text-[#64748b] hover:bg-slate-50"
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Voice</span>
                </button>
              </div>
            </div>
          </div>

          {/* Curated Sets List (Fills remaining height) */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between pb-1.5 mb-1">
              <span className="text-[10.5px] font-bold text-[#0f172a] uppercase font-mono tracking-wider">
                Curated Sets — {level.toUpperCase()} Tier
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {setsForLevel.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-[#f8fafc] rounded-2xl border border-dashed border-[#cbd5e1] text-[#94a3b8] text-xs">
                  <Sparkles className="w-6 h-6 text-indigo-400 mb-2" />
                  <p className="font-semibold text-[#475569]">No curated sets published for this tier yet.</p>
                  <p className="text-[11px] text-[#94a3b8] mt-1 max-w-xs mb-3">
                    Start a quick ad-hoc practice session with algorithmically selected questions for this tier.
                  </p>
                  <Button
                    onClick={() => startSession(undefined, false)}
                    disabled={loadingSetId !== null || loadingSmart}
                    variant="primary"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{loadingSetId === "ad-hoc" ? "Starting..." : "Start Quick Practice"}</span>
                  </Button>
                </div>
              ) : (
                setsForLevel.map((set) => (
                  <div
                    key={set.id}
                    className="p-3 rounded-xl border border-[#e2e8f0] bg-white hover:border-indigo-300 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="text-xs font-bold text-[#0f172a] truncate">{set.title}</h3>
                      <div className="flex items-center gap-2 text-[10.5px] text-[#64748b]">
                        <span className="font-medium">{set.questionCount} Questions</span>
                        <span>•</span>
                        <span className="capitalize">{level} Level</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => startSession(set.id, false)}
                      disabled={loadingSetId !== null || loadingSmart}
                      variant="primary"
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{loadingSetId === set.id ? "Loading..." : "Start Set"}</span>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: DRILL MASTERY & SESSION HISTORY */}
        <div className="h-auto lg:h-full flex flex-col lg:min-h-0 overflow-visible lg:overflow-hidden bg-white rounded-2xl border border-[#e2e8f0] p-4 sm:p-4.5 shadow-2xs">
          {/* Column Header */}
          <div className="shrink-0 flex items-center justify-between pb-2.5 border-b border-[#f1f5f9] mb-2.5">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              <h2 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider font-mono">
                PERFORMANCE & RECENT SESSIONS
              </h2>
            </div>
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
              {completedCount} completed
            </span>
          </div>

          {/* 3 Metrics Cards */}
          <div className="shrink-0 grid grid-cols-3 gap-2 mb-2.5">
            <div className="p-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center">
              <span className="text-[9.5px] font-semibold text-[#64748b] uppercase tracking-wider block">Sessions</span>
              <span className="text-base font-black text-[#0f172a]">{completedCount}</span>
            </div>
            <div className="p-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center">
              <span className="text-[9.5px] font-semibold text-[#64748b] uppercase tracking-wider block">Best Score</span>
              <span className="text-base font-black text-emerald-600">{bestScore !== null ? `${bestScore}%` : "—"}</span>
            </div>
            <div className="p-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-center">
              <span className="text-[9.5px] font-semibold text-[#64748b] uppercase tracking-wider block">Average</span>
              <span className="text-base font-black text-indigo-600">{avgScore !== null ? `${avgScore}%` : "—"}</span>
            </div>
          </div>

          {/* Session History (Fills remaining height) */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between pb-1.5 mb-1">
              <span className="text-[10.5px] font-bold text-[#0f172a] uppercase font-mono tracking-wider">
                Recorded Sessions
              </span>
              <span className="text-[10px] text-[#94a3b8]">Newest first</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-[#f8fafc] rounded-2xl border border-dashed border-[#cbd5e1] text-[#94a3b8] text-xs">
                  <CheckCircle2 className="w-6 h-6 text-purple-400 mb-2" />
                  <p className="font-semibold text-[#475569]">No completed sessions yet.</p>
                  <p className="text-[11px] text-[#94a3b8] mt-1 max-w-xs">
                    Complete your first drill set on the left to calibrate concept mastery.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0] text-[10px]">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Date</th>
                        <th className="py-2 px-3 font-semibold">Set / Target</th>
                        <th className="py-2 px-3 font-semibold">Tier</th>
                        <th className="py-2 px-3 font-semibold">Mode</th>
                        <th className="py-2 px-3 font-semibold text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9] text-[#334155] text-[10.5px]">
                      {history.map((h) => (
                        <tr key={h.id} className="hover:bg-[#fafbfc] transition-colors">
                          <td className="py-2 px-3 text-[#64748b] whitespace-nowrap">
                            {h.startedAt ? new Date(h.startedAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2 px-3 font-medium text-[#0f172a] truncate max-w-[140px]">
                            {h.practiceSetTitle}
                          </td>
                          <td className="py-2 px-3 capitalize text-[10px]">{h.level}</td>
                          <td className="py-2 px-3">
                            <span className="bg-[#f1f5f9] text-[#475569] px-1.5 py-0.5 rounded text-[9px] font-semibold capitalize">
                              {h.mode}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {h.score !== null ? (
                              <span
                                className={`font-bold px-2 py-0.5 rounded-full text-[9.5px] ${
                                  h.score >= 80
                                    ? "bg-emerald-100 text-emerald-800"
                                    : h.score >= 60
                                    ? "bg-indigo-100 text-indigo-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {h.score}%
                              </span>
                            ) : (
                              <span className="text-[#94a3b8] italic text-[10px]">Incomplete</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
