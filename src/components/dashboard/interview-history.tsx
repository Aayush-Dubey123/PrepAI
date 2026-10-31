"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  ArrowRight,
  History,
  Search,
  FileText,
  Trash2,
  RotateCw,
  Award,
  Activity,
  X,
} from "lucide-react";
import { Card } from "@/src/components/ui/containers/Card";
import { useToast } from "@/src/components/ui/feedback/ToastProvider";

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

let globalHistoryCache: InterviewSummary[] | null = null;

export function InterviewHistory({ onLoaded }: InterviewHistoryProps) {
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<InterviewSummary[]>(globalHistoryCache ?? []);
  const [loading, setLoading] = useState(!globalHistoryCache);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "ongoing">("all");

  // Deletion states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/interviews");
      const data = await res.json();
      if (Array.isArray(data.interviews)) {
        globalHistoryCache = data.interviews;
        setInterviews(data.interviews);
        onLoaded?.(data.interviews);
      }
    } catch (err) {
      console.warn("[INTERVIEW_HISTORY] Could not load history:", err);
    }
  };

  useEffect(() => {
    if (globalHistoryCache) {
      onLoaded?.(globalHistoryCache);
    }
    fetchRecords().finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRecords();
    setIsRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/interviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        const nextList = interviews.filter((i) => i.id !== id);
        setInterviews(nextList);
        onLoaded?.(nextList);
        toast("Interview record deleted", { type: "info" });
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || "Could not delete record", { type: "error" });
      }
    } catch {
      toast("Delete request failed", { type: "error" });
    } finally {
      setIsDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const handleClearCompleted = async () => {
    setIsClearingAll(true);
    try {
      const res = await fetch("/api/interviews?clearCompleted=true", { method: "DELETE" });
      if (res.ok) {
        const nextList = interviews.filter((i) => {
          const score = i.feedback?.overallScore ?? i.score;
          return i.status !== "completed" && i.currentPhase !== "closed" && score === null;
        });
        setInterviews(nextList);
        onLoaded?.(nextList);
        toast("Completed interview records cleared", { type: "success" });
      } else {
        toast("Could not clear completed records", { type: "error" });
      }
    } catch {
      toast("Clear request failed", { type: "error" });
    } finally {
      setIsClearingAll(false);
      setConfirmClearAll(false);
    }
  };



  const completedCount = interviews.filter((item) => {
    const score = item.feedback?.overallScore ?? item.score;
    return item.status === "completed" || item.currentPhase === "closed" || score !== null;
  }).length;

  const ongoingCount = interviews.length - completedCount;

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
    <Card className="h-auto lg:h-full min-h-[380px] lg:min-h-0 w-full flex flex-col overflow-hidden p-4 sm:p-5 bg-white border border-[#e2e8f0] shadow-xs">
      {/* 1. Header: Complete One-Line Layout Across Full Width */}
      <div className="w-full shrink-0 pb-3 flex items-center justify-between gap-3 border-b border-[#f1f5f9]">
        {/* Left: Icon, Title, Count Badge, and Description all in ONE clean line */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#6366f1] shrink-0 shadow-2xs">
            <History className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 className="text-sm font-bold text-[#0f172a] tracking-tight whitespace-nowrap">
              Interview Records
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#f1f5f9] text-[#64748b] font-medium border border-[#e2e8f0]">
              {interviews.length}
            </span>
            <span className="text-slate-300 hidden md:inline">•</span>
            <span className="text-[11px] text-[#94a3b8] truncate hidden sm:inline">
              Verified sessions &amp; evaluations
            </span>
          </div>
        </div>

        {/* Right: Refresh button and Clear Completed action on the EXACT SAME line */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh records list"
            className="p-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#4f46e5]" : ""}`} />
          </button>

          {completedCount > 0 && (
            confirmClearAll ? (
              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  disabled={isClearingAll}
                  className="font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded transition-colors cursor-pointer"
                >
                  {isClearingAll ? "Clearing..." : "Delete All Completed"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="text-[#64748b] hover:text-[#0f172a] px-1 py-0.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                title="Clear all completed records to free space"
                className="flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                <span>Clear Completed</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 2. Sub-Header Toolbar: Side-by-Side Search and Segmented Filters */}
      <div className="w-full shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 my-2.5">
        {/* Search Input on the left */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="interview-history-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records by role..."
            className="w-full bg-white border border-[#e2e8f0] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Segmented Control on the right */}
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0] text-[11px] shrink-0 max-w-full overflow-x-auto scrollbar-none self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-white text-[#0f172a] font-semibold shadow-2xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            All ({interviews.length})
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === "completed"
                ? "bg-white text-[#0f172a] font-semibold shadow-2xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setStatusFilter("ongoing")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === "ongoing"
                ? "bg-white text-[#0f172a] font-semibold shadow-2xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            In Progress ({ongoingCount})
          </button>
        </div>
      </div>

      {/* 3. Middle Content List: Even 3-Zone Row Layout */}
      <div className="w-full flex-1 min-h-0 overflow-y-auto pr-1.5 my-1 space-y-2">
        {loading ? (
          <div className="space-y-2.5 p-1 animate-pulse">
            <div className="h-14 bg-slate-50 rounded-xl border border-slate-100" />
            <div className="h-14 bg-slate-50 rounded-xl border border-slate-100" />
            <div className="h-14 bg-slate-50 rounded-xl border border-slate-100" />
          </div>
        ) : interviews.length === 0 ? (
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
                className="w-full bg-white border border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-xs rounded-xl p-3 sm:px-4 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all group"
              >
                {/* Zone 1: Role, Status, and Timestamp */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-[13px] font-bold text-[#0f172a] truncate">
                      {item.jobRole}
                    </h3>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        isCompleted
                          ? "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]"
                          : "bg-[#fef3c7] text-[#b45309] border-[#fde68a]"
                      }`}
                    >
                      {isCompleted ? "Completed" : "In Progress"}
                    </span>

                    {rec && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ffe4e6] text-[#be123c] border border-[#fecdd3] shrink-0">
                        {rec.replace(/_/g, " ").toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
                    <span className="flex items-center gap-1 text-[#94a3b8]">
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
                    {item.totalTurns ? (
                      <>
                        <span className="text-[#cbd5e1]">•</span>
                        <span className="text-[10px] text-[#64748b]">{item.totalTurns} turns</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Zone 2: Middle Progress & Metric Indicator */}
                <div className="w-full md:w-auto shrink-0 flex items-center justify-between md:justify-end gap-2 sm:gap-3 pt-2 md:pt-0 border-t border-slate-100 md:border-t-0">
                  {score !== null && score !== undefined ? (
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                      <Award className="w-3.5 h-3.5 text-[#4f46e5]" />
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-[#94a3b8] font-bold leading-none">
                          Score
                        </div>
                        <div className="text-xs font-bold text-[#0f172a] leading-none mt-0.5">
                          {score}/100
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#64748b] px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
                      <Activity className="w-3 h-3 text-amber-500" />
                      <span className="capitalize">
                        {item.currentPhase ? `${item.currentPhase} phase` : "Active session"}
                      </span>
                    </div>
                  )}

                  {/* Zone 3: Action Buttons (Resume/Report + Delete) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={
                        isCompleted
                          ? `/interview/${item.id}/feedback`
                          : `/interview/${item.id}`
                      }
                    >
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer active:scale-95 ${
                          isCompleted
                            ? "bg-[#1e293b] hover:bg-[#0f172a] text-white"
                            : "bg-[#4f46e5] hover:bg-[#4338ca] text-white"
                        }`}
                      >
                        <span>{isCompleted ? "Report" : "Resume"}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </Link>

                    {/* Delete Action with 2-Step Inline Confirmation */}
                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDelete(item.id)}
                          className="text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          {isDeleting ? "..." : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[10px] font-medium text-[#64748b] hover:text-[#0f172a] px-1.5 py-1 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        title="Delete interview record"
                        className="p-1.5 rounded-lg border border-[#e2e8f0] hover:border-rose-200 text-[#94a3b8] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
