import React from "react";
import { AppSidebar } from "@/src/components/sidebar/app-sidebar";

export default function AnalyticsLoading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] md:h-screen w-full md:w-screen overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-[#f4f6fa] text-[#0f172a] select-none">
      <AppSidebar />
      <main className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] md:h-screen overflow-y-auto md:overflow-hidden flex flex-col justify-start md:justify-between p-3 sm:p-4 md:p-6 gap-3 animate-in fade-in duration-150">
        <div className="shrink-0 flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="h-7 w-48 bg-slate-200/80 rounded-lg animate-pulse" />
          <div className="h-8 w-24 bg-slate-200/80 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-[#e2e8f0] rounded-2xl p-4 animate-pulse" />
          ))}
        </div>
        <div className="flex-1 bg-white border border-[#e2e8f0] rounded-2xl p-5 animate-pulse min-h-[280px]" />
      </main>
    </div>
  );
}

