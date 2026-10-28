"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ArrowRight, History, Search, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/src/components/ui/Card";

export interface InterviewSummary {
  id: string;
  jobRole: string;
  status: "ongoing" | "completed" | "failed" | string;
  score: number | null;
  currentPhase: string;
  totalTurns: number | null;
  createdAt: string;
  feedback?: {
    overallScore?: number;
    hiringRecommendation?: string;
    summary?: string;
  };
}

export interface InterviewHistoryProps {
  onLoaded?: (interviews: InterviewSummary[]) => void;
}

export function InterviewHistory({ onLoaded }: InterviewHistoryProps) {
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "ongoing">("all");

  useEffect(() => {
    fetch("/api/interviews")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.interviews)) {
          setInterviews(data.interviews);
          onLoaded?.(data.interviews);
        }
      })
      .catch((err) => {
        console.warn("[INTERVIEW_HISTORY] Could not load history:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [onLoaded]);

  if (loading) {
    return (
      <Card className="h-full flex flex-col justify-between p-5 bg-white border border-[#e2e8f0] animate-pulse">
        <div className="h-5 w-48 bg-slate-100 rounded-lg mb-4" />
        <div className="space-y-3 flex-1">
          <div className="h-16 bg-slate-50 rounded-xl border border-slate-100" />
          <div className="h-16 bg-slate-50 rounded-xl border border-slate-100" />
        </div>
      </Card>
    );
  }

  const filteredInterviews = interviews.filter((item) => {
    const matchesQuery = item.jobRole
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const score = item.feedback?.overallScore ?? item.score;
    const isCompleted =
      item.status === "completed" || item.currentPhase === "closed" || score !== null;

    if (statusFilter === "completed") return matchesQuery && isCompleted;
    if (statusFilter === "ongoing") return matchesQuery && !isCompleted;
    return matchesQuery;
  });

  return (
    <Card className="h-full flex flex-col justify-between overflow-hidden p-4 sm:p-5 bg-white border border-[#e2e8f0] shadow-xs">
      {/* Top Header from Image #1 */}
      <CardHeader className="shrink-0 p-0 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#6366f1] shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-[#0f172a]">Interview Records</CardTitle>
            <p className="text-[11px] text-[#94a3b8]">Past sessions & reports</p>
          </div>
        </div>

        {/* Filter Pills from Image #1 */}
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0] text-[11px]">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-white text-[#0f172a] font-semibold shadow-xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            All ({interviews.length})
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === "completed"
                ? "bg-white text-[#0f172a] font-semibold shadow-xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter("ongoing")}
            className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === "ongoing"
                ? "bg-white text-[#0f172a] font-semibold shadow-xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            In Progress
          </button>
        </div>
      </CardHeader>

      {/* Search Bar from Image #1 */}
      <div className="shrink-0 relative my-2">
        <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by role..."
          className="w-full bg-white border border-[#e2e8f0] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#6366f1]"
        />
      </div>

      {/* Middle Content List (Internal Scroll matching Image #1) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 my-1 space-y-2">
        {interviews.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 mx-auto flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#0f172a]">No interview records yet</p>
              <p className="text-[11px] text-[#64748b] max-w-xs mx-auto">
                Launch a session using the configurator on the left to start your evaluation journey.
              </p>
            </div>
          </div>
        ) : filteredInterviews.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#64748b]">
            No sessions match &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredInterviews.map((item) => {
            const score = item.feedback?.overallScore ?? item.score;
            const isCompleted =
              item.status === "completed" || item.currentPhase === "closed" || score !== null;
            const rec = item.feedback?.hiringRecommendation;

            return (
              <div
                key={item.id}
                className="bg-white border border-[#e2e8f0] hover:border-[#cbd5e1] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all group shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-xs font-bold text-[#0f172a]">
                      {item.jobRole}
                    </h3>

                    {/* Status Pill matching Image #1 */}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isCompleted
                          ? "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]"
                          : "bg-[#fef3c7] text-[#b45309] border-[#fde68a]"
                      }`}
                    >
                      {isCompleted ? "Completed" : "In Progress"}
                    </span>

                    {rec && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ffe4e6] text-[#be123c] border border-[#fecdd3]">
                        {rec.replace(/_/g, " ").toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#94a3b8]" />
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-[#cbd5e1]">•</span>
                    <span className="text-[10px] font-mono text-[#94a3b8]">
                      #{item.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  {score !== null && score !== undefined && (
                    <div className="text-right">
                      <div className="text-[10px] text-[#94a3b8] font-medium">Score</div>
                      <div className="text-xs font-bold text-[#0f172a]">
                        {score}/100
                      </div>
                    </div>
                  )}

                  {/* Dark action button from Image #1 */}
                  <Link
                    href={
                      isCompleted
                        ? `/interview/${item.id}/feedback`
                        : `/interview/${item.id}`
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 bg-[#1e293b] hover:bg-[#0f172a] text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <span>{isCompleted ? "Report" : "Resume"}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
