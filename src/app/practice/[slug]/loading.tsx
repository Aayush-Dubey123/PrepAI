import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DrillDetailLoading() {
  return (
    <div className="min-h-full h-auto lg:h-full w-full max-w-7xl mx-auto p-3 sm:p-5 lg:px-6 lg:py-4 flex flex-col justify-start lg:justify-between animate-in fade-in duration-150">
      {/* Top Drill Hero Banner Skeleton */}
      <div className="shrink-0 rounded-2xl p-4 bg-slate-100 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-pulse">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-24 bg-slate-200 rounded-lg" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </div>
          <div className="h-7 w-64 bg-slate-300 rounded-lg" />
          <div className="h-4 w-96 max-w-full bg-slate-200 rounded" />
        </div>
        <div className="h-10 w-36 bg-slate-200 rounded-xl" />
      </div>

      {/* Main Two-Column Stage Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1 my-2 lg:min-h-0 items-stretch">
        {/* Left Column (8 cols): Mode selector & Sets */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-3 h-full">
          <div className="h-14 bg-white border border-[#e2e8f0] rounded-2xl p-3 flex items-center justify-between animate-pulse">
            <div className="h-8 w-48 bg-slate-100 rounded-xl" />
            <div className="h-8 w-32 bg-slate-100 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 bg-white border border-[#e2e8f0] rounded-2xl p-4 flex flex-col justify-between animate-pulse"
              >
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-3 w-40 bg-slate-100 rounded" />
                </div>
                <div className="h-8 w-24 bg-indigo-100 rounded-xl" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (4 cols): Analytics & Past Sessions */}
        <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-2xl p-4 flex flex-col justify-between animate-pulse">
          <div className="space-y-4">
            <div className="h-5 w-32 bg-slate-200 rounded" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-16 bg-slate-50 rounded-xl" />
              <div className="h-16 bg-slate-50 rounded-xl" />
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-slate-50 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

