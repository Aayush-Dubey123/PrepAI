"use client";

import { useState } from "react";
import { AppSidebar } from "@/src/components/app-sidebar";
import { ResumeUploadFlow } from "@/src/components/resume-upload-flow";
import { InterviewHistory, type InterviewSummary } from "@/src/components/interview-history";
import { DashboardMetrics } from "@/src/components/dashboard/DashboardMetrics";
import { Search, Bell, Sparkles } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

export default function Dashboard() {
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#f4f6fa] text-[#0f172a] select-none">
      {/* 1. Fixed Left Sidebar matching Image #1 */}
      <AppSidebar />

      {/* 2. Main Dashboard Content matching Image #1 */}
      <main className="flex-1 min-w-0 h-screen overflow-hidden flex flex-col justify-between p-4 sm:p-6 gap-3">
        {/* Top Header Bar from Image #1 */}
        <div className="shrink-0 flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a]">
              Technical Assessment Portal
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5]" />
              Candidate Cockpit
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-[#64748b]">
              <Sparkles className="w-3.5 h-3.5 text-[#4f46e5]" />
              <span>Autonomous Evaluation</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-8 h-8 rounded-full border border-[#e2e8f0] bg-white flex items-center justify-center text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer shadow-xs"
                title="Search assessments"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-full border border-[#e2e8f0] bg-white flex items-center justify-center text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer shadow-xs"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <UserButton />
            </div>
          </div>
        </div>

        {/* 4 Performance Metrics Cards from Image #1 */}
        <div className="shrink-0">
          <DashboardMetrics interviews={interviews} />
        </div>

        {/* Two-Column Equal-Height Containers from Image #1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 items-stretch overflow-hidden">
          {/* Left Container: LAUNCH NEW SESSION */}
          <div className="h-full flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-1 mb-1.5">
              <h2 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider font-mono">
                LAUNCH NEW SESSION
              </h2>
              <span className="text-[11px] text-[#94a3b8]">Step-by-step setup</span>
            </div>
            <div className="flex-1 min-h-0">
              <ResumeUploadFlow />
            </div>
          </div>

          {/* Right Container: RECENT EVALUATIONS */}
          <div className="h-full flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-1 mb-1.5">
              <h2 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider font-mono">
                RECENT EVALUATIONS
              </h2>
              <span className="text-[11px] text-[#94a3b8]">Verified scores</span>
            </div>
            <div className="flex-1 min-h-0">
              <InterviewHistory onLoaded={setInterviews} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
