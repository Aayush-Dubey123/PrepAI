"use client";

import { useState, useRef, useEffect } from "react";
import { AppSidebar } from "@/src/components/app-sidebar";
import { ResumeUploadFlow } from "@/src/components/resume-upload-flow";
import { InterviewHistory, type InterviewSummary } from "@/src/components/interview-history";
import { DashboardMetrics } from "@/src/components/dashboard/DashboardMetrics";
import { Search, Bell, Sparkles, CheckCircle2, Info, X } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

export default function Dashboard() {
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleSearchClick = () => {
    const searchInput = document.getElementById("interview-history-search-input");
    if (searchInput) {
      searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
      searchInput.focus();
      // Visual highlight
      searchInput.classList.add("ring-2", "ring-[#6366f1]");
      setTimeout(() => {
        searchInput.classList.remove("ring-2", "ring-[#6366f1]");
      }, 1500);
    }
  };

  // Click outside to close notifications
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] md:h-screen w-full md:w-screen overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-[#f4f6fa] text-[#0f172a] select-none">
      {/* 1. Fixed Left Sidebar */}
      <AppSidebar />

      {/* 2. Main Dashboard Content */}
      <main className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] md:h-screen overflow-y-auto md:overflow-hidden flex flex-col justify-start md:justify-between p-3 sm:p-4 md:p-6 gap-3">
        {/* Top Header Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-[#0f172a]">
              Technical Assessment Portal
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5]" />
              Candidate Cockpit
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-[#64748b]">
              <Sparkles className="w-3.5 h-3.5 text-[#4f46e5]" />
              <span>Autonomous Evaluation</span>
            </div>

            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={handleSearchClick}
                className="w-8 h-8 rounded-full border border-[#e2e8f0] bg-white flex items-center justify-center text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer shadow-xs"
                title="Search assessments"
              >
                <Search className="w-4 h-4" />
              </button>

              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className={`w-8 h-8 rounded-full border border-[#e2e8f0] bg-white flex items-center justify-center transition-colors cursor-pointer shadow-xs ${
                    showNotifications
                      ? "bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe]"
                      : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]"
                  }`}
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2.5 mb-2.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[#0f172a]">
                        <Bell className="w-3.5 h-3.5 text-[#4f46e5]" />
                        <span>Notifications</span>
                      </div>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-[#64748b] hover:text-[#0f172a] p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                        <CheckCircle2 className="w-4 h-4 text-[#15803d] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[#0f172a]">System Operational</div>
                          <div className="text-[11px] text-[#64748b]">
                            AI turn orchestration engine is ready for interviews.
                          </div>
                        </div>
                      </div>

                      {interviews.length > 0 ? (
                        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                          <Info className="w-4 h-4 text-[#0284c7] shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-[#0f172a]">Recent Sessions Available</div>
                            <div className="text-[11px] text-[#64748b]">
                              You have {interviews.length} recorded interview sessions in your history.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 text-center text-[11px] text-[#64748b]">
                          No unread alerts. Ready to start your first session.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <UserButton />
            </div>
          </div>
        </div>
        {/* 4 Performance Metrics Cards from Image #1 */}
        <div className="shrink-0">
          <DashboardMetrics interviews={interviews} />
        </div>

        {/* Two-Column Equal-Height Containers from Image #1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 lg:min-h-0 items-stretch overflow-visible lg:overflow-hidden">
          {/* Left Container: LAUNCH NEW SESSION */}
          <div className="h-auto lg:h-full flex flex-col lg:min-h-0 overflow-visible lg:overflow-hidden">
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
          <div className="h-auto lg:h-full flex flex-col lg:min-h-0 overflow-visible lg:overflow-hidden">
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
