"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/Tabs";
import { useToast } from "@/src/components/ui/ToastProvider";
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

  useEffect(() => {
    if (initialAutoReview && !hasAutoRunRef.current) {
      hasAutoRunRef.current = true;
      startSession(undefined, true);
    }
  }, [initialAutoReview]);

  const setsForLevel = practiceSets.filter((s) => s.level === level);
  const startSession = async (practiceSetId?: string, isSmartSet: boolean = false) => {
    try {
      if (isSmartSet) setLoadingSmart(true);
      else if (practiceSetId) setLoadingSetId(practiceSetId);

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

  return (
    <div className="p-4 sm:p-5 lg:px-6 lg:py-4 max-w-6xl mx-auto space-y-4">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/practice"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748b] hover:text-[#0f172a] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Drills</span>
        </Link>
      </div>

      {/* Drill Hero Banner */}
      <div className={`rounded-2xl p-4 sm:p-4.5 bg-gradient-to-r ${drill.color} border border-inherit/40 shadow-xs`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" className="bg-white/80 font-semibold text-[10px]">
                {drill.category}
              </Badge>
              <span className="text-[10.5px] font-medium text-[#64748b] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.round(drill.timeLimitSeconds / 60)}m Session Limit
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">{drill.title}</h1>
            <p className="text-[11px] text-[#475569] max-w-2xl leading-relaxed">{drill.description}</p>
          </div>

          {/* Quick Smart Set Action */}
          <div className="shrink-0">
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
      </div>

      {/* Controls: Mode & Difficulty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white p-3.5 rounded-xl border border-[#e2e8f0] shadow-2xs">
        {/* Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">Practice Mode</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMode("practice")}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                mode === "practice"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                  : "bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:bg-slate-100"
              }`}
            >
              <Zap className="w-4 h-4 mb-1" />
              <span className="text-xs font-bold">Practice</span>
              <span className="text-[10px] text-[#94a3b8]">Instant Feedback</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("timed")}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                mode === "timed"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                  : "bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:bg-slate-100"
              }`}
            >
              <Clock className="w-4 h-4 mb-1" />
              <span className="text-xs font-bold">Timed</span>
              <span className="text-[10px] text-[#94a3b8]">{Math.round(drill.timeLimitSeconds / 60)}m countdown</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("voice")}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                mode === "voice"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                  : "bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:bg-slate-100"
              }`}
            >
              <Volume2 className="w-4 h-4 mb-1" />
              <span className="text-xs font-bold">Voice</span>
              <span className="text-[10px] text-[#94a3b8]">Speech Recognition</span>
            </button>
          </div>
        </div>

        {/* Level Tabs */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">Difficulty Tier</label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-[#f1f5f9] rounded-xl border border-[#e2e8f0]">
            {(["foundational", "mid", "senior", "staff"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevel(lvl)}
                className={`py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
                  level === lvl
                    ? "bg-white text-[#0f172a] shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a]"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Curated Practice Sets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
            Curated Sets — {level[0].toUpperCase() + level.slice(1)} Tier
          </h2>
          <span className="text-[11px] text-[#64748b]">{setsForLevel.length} set(s) available</span>
        </div>

        {setsForLevel.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#cbd5e1] text-[#94a3b8] text-xs">
            No published practice sets available for this level yet. Try the Adaptive Weak-Concept Drill above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {setsForLevel.map((set) => (
              <Card key={set.id} className="p-3.5 flex items-center justify-between gap-4 border-[#e2e8f0] hover:border-indigo-300 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0f172a]">{set.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#64748b]">
                    <span>{set.questionCount} Questions</span>
                    <span>•</span>
                    <span className="capitalize">{level} Level</span>
                  </div>
                </div>

                <Button
                  onClick={() => startSession(set.id, false)}
                  disabled={loadingSetId !== null || loadingSmart}
                  variant="primary"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{loadingSetId === set.id ? "Loading..." : "Start Set"}</span>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent History Table */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">Session History</h2>
        {history.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-[#e2e8f0] text-[#94a3b8] text-xs">
            No completed sessions yet for this drill. Complete your first set above to start tracking mastery!
          </div>
        ) : (
          <div className="overflow-hidden bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-2.5 px-3.5 font-semibold">Date</th>
                  <th className="py-2.5 px-3.5 font-semibold">Set / Target</th>
                  <th className="py-2.5 px-3.5 font-semibold">Tier</th>
                  <th className="py-2.5 px-3.5 font-semibold">Mode</th>
                  <th className="py-2.5 px-3.5 font-semibold">Duration</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-[#334155]">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-[#fafbfc] transition-colors">
                    <td className="py-2.5 px-3.5 text-[#64748b]">
                      {h.startedAt ? new Date(h.startedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-[#0f172a]">{h.practiceSetTitle}</td>
                    <td className="py-2.5 px-3.5 capitalize">{h.level}</td>
                    <td className="py-2.5 px-3.5 capitalize">
                      <span className="bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded text-[10px] font-semibold">
                        {h.mode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-[#64748b]">
                      {h.durationSeconds ? `${Math.round(h.durationSeconds / 60)}m ${h.durationSeconds % 60}s` : "—"}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      {h.score !== null ? (
                        <span
                          className={`font-bold px-2.5 py-1 rounded-full text-[11px] ${
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
                        <span className="text-[#94a3b8] italic">Incomplete</span>
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
  );
}
