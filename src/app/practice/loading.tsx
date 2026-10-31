import React from "react";
import { Flame } from "lucide-react";

export default function PracticeLoading() {
  return (
    <div className="min-h-full h-auto lg:h-full w-full max-w-7xl mx-auto p-4 sm:p-5 lg:px-6 lg:py-4 flex flex-col justify-start lg:justify-between animate-in fade-in duration-150">
      {/* Header Skeleton */}
      <div className="shrink-0 flex items-center justify-between border-b border-[#e2e8f0] pb-2.5">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-2xs shrink-0">
            <Flame className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-44 bg-slate-200/80 rounded-lg animate-pulse" />
            <div className="h-4 w-24 bg-purple-100 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="hidden md:block h-3.5 w-72 bg-slate-200/60 rounded animate-pulse" />
      </div>

      {/* Review Due Banner Skeleton */}
      <div className="h-14 w-full bg-slate-100/80 border border-slate-200/60 rounded-2xl animate-pulse my-1 shrink-0" />

      {/* 3-Column Responsive Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-3 sm:gap-3.5 lg:gap-4 flex-1 my-2 lg:min-h-0 items-stretch">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs overflow-hidden flex flex-col justify-between"
          >
            {/* Top Bar Skeleton */}
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-slate-200 animate-pulse" />
                <div className="w-20 h-3 bg-slate-200 animate-pulse rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-3.5 bg-slate-200 animate-pulse rounded" />
                <div className="w-8 h-3.5 bg-slate-200 animate-pulse rounded" />
              </div>
            </div>

            {/* Body Skeleton */}
            <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="w-3/4 h-4 bg-slate-200 animate-pulse rounded" />
                <div className="w-full h-3 bg-slate-100 animate-pulse rounded" />
                <div className="w-5/6 h-3 bg-slate-100 animate-pulse rounded" />
              </div>

              {/* Tags Skeleton */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="w-14 h-4 bg-slate-100 animate-pulse rounded-md" />
                <div className="w-16 h-4 bg-slate-100 animate-pulse rounded-md" />
                <div className="w-12 h-4 bg-slate-100 animate-pulse rounded-md" />
              </div>
            </div>

            {/* Footer Skeleton */}
            <div className="px-3.5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <div className="w-24 h-3 bg-slate-200 animate-pulse rounded" />
              <div className="w-16 h-3 bg-indigo-200 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

