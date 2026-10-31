"use client";

import React from "react";
import { Trophy, Bookmark, Sparkles } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent } from "@/src/components/ui/Card";

export interface InterviewMetricItem {
  id: string;
  jobRole: string;
  status: string;
  score: number | null;
  feedback?: {
    overallScore?: number;
    hiringRecommendation?: string;
  };
}

export interface DashboardMetricsProps {
  interviews: InterviewMetricItem[];
}

export function DashboardMetrics({ interviews }: DashboardMetricsProps) {
  const completed = interviews.filter(
    (i) => i.status === "completed" || (i.feedback?.overallScore ?? i.score) !== null
  );

  const totalCompleted = completed.length;

  const validScores = completed
    .map((i) => i.feedback?.overallScore ?? i.score)
    .filter((s): s is number => typeof s === "number" && !isNaN(s));

  const averageScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((acc, curr) => acc + curr, 0) / validScores.length)
      : 0;

  // Readiness badge calculation
  let readinessLabel = "Needs Practice";
  let readinessVariant: "neutral" | "success" | "warning" | "error" | "purple" | "cyan" = "warning";

  if (totalCompleted === 0) {
    readinessLabel = "Ready to Assess";
    readinessVariant = "purple";
  } else if (averageScore >= 80) {
    readinessLabel = "Tier-1 Ready";
    readinessVariant = "success";
  } else if (averageScore >= 60) {
    readinessLabel = "Interview Ready";
    readinessVariant = "purple";
  } else {
    readinessLabel = "Needs Practice";
    readinessVariant = "warning";
  }

  // Top evaluated role
  const topRole = interviews[0]?.jobRole || "Software Developer";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {/* 1. Interviews Completed */}
      <Card className="relative overflow-hidden bg-white border border-[#e2e8f0] shadow-xs">
        <CardContent className="p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-[#64748b]">Interviews Completed</span>
            <div className="text-2xl font-bold text-[#0f172a] tracking-tight">
              {totalCompleted}
            </div>
            <span className="text-[11px] text-[#94a3b8] block">Autonomous sessions</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#6366f1] shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Average Score with Circular Ring */}
      <Card className="relative overflow-hidden bg-white border border-[#e2e8f0] shadow-xs">
        <CardContent className="p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-[#64748b]">Average Score</span>
            <div className="text-2xl font-bold text-[#0f172a] tracking-tight">
              {averageScore}%
            </div>
            <span className="text-[11px] text-[#94a3b8] block">Weighted evaluation</span>
          </div>
          {/* Circular Percentage Ring */}
          <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-[#f1f5f9]"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#6366f1]"
                strokeDasharray={`${averageScore}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[9px] font-bold text-[#475569]">
              {averageScore}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Readiness Status */}
      <Card className="relative overflow-hidden bg-white border border-[#e2e8f0] shadow-xs">
        <CardContent className="p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-[#64748b]">Readiness Status</span>
            <div className="pt-0.5">
              <Badge variant={readinessVariant} pulse={totalCompleted > 0} className="text-xs font-semibold py-0.5 px-2.5">
                {readinessLabel}
              </Badge>
            </div>
            <span className="text-[11px] text-[#94a3b8] block pt-0.5">K-Score benchmark</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#6366f1] shrink-0">
            <Bookmark className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Target Competencies */}
      <Card className="relative overflow-hidden bg-white border border-[#e2e8f0] shadow-xs">
        <CardContent className="p-3.5 flex items-center justify-between">
          <div className="space-y-0.5 w-full">
            <span className="text-xs font-medium text-[#64748b]">Target Competencies</span>
            <div className="pt-0.5">
              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe] truncate max-w-[130px]">
                {topRole}
              </span>
            </div>
            <span className="text-[11px] text-[#94a3b8] block pt-0.5">Adaptive topics</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center text-[#64748b] shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
