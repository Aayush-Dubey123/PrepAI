import React from "react";
import { AppSidebar } from "@/src/components/sidebar/app-sidebar";

export default function DashboardLoading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] md:h-screen w-full md:w-screen overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-[#f4f6fa] text-[#0f172a] select-none">
      {/* 1. Left Sidebar */}
      <AppSidebar />

      {/* 2. Main Dashboard Content Skeleton */}
      <main className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] md:h-screen overflow-y-auto md:overflow-hidden flex flex-col justify-start md:justify-between p-3 sm:p-4 md:p-6 gap-3 animate-in fade-in duration-150">
        {/* Top Header Bar Skeleton */}
        <div className="shrink-0 flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center gap-3">
            <div className="h-7 w-64 bg-slate-200/80 rounded-lg animate-pulse" />
            <div className="h-5 w-28 bg-indigo-100/80 rounded-full animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </div>

        {/* Metrics Row Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 flex items-center justify-between shadow-xs animate-pulse"
            >
              <div className="space-y-1.5">
                <div className="h-3 w-24 bg-slate-100 rounded" />
                <div className="h-6 w-12 bg-slate-200 rounded" />
                <div className="h-2.5 w-20 bg-slate-100 rounded" />
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>

        {/* Two-Column Stage Skeleton */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:min-h-0 items-stretch">
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs animate-pulse space-y-4">
            <div className="h-5 w-36 bg-slate-200 rounded" />
            <div className="h-36 bg-slate-50 rounded-xl" />
            <div className="h-10 bg-indigo-100 rounded-xl" />
          </div>
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs animate-pulse space-y-3">
            <div className="h-5 w-40 bg-slate-200 rounded" />
            <div className="h-10 bg-slate-50 rounded-xl" />
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-50 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

