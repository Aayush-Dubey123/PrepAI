"use client";

import React from "react";
import { ShieldAlert, AlertTriangle } from "lucide-react";

export interface IntegrityAlertBannerProps {
  warning: string | null;
  isTerminated: boolean;
}

export function IntegrityAlertBanner({
  warning,
  isTerminated,
}: IntegrityAlertBannerProps) {
  if (!warning && !isTerminated) return null;

  return (
    <div className="fixed top-16 inset-x-4 z-50 flex justify-center animate-in slide-in-from-top-4 duration-200 pointer-events-none">
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl max-w-lg pointer-events-auto ${
          isTerminated
            ? "bg-rose-950/90 border-rose-500/50 text-rose-100"
            : "bg-amber-950/90 border-amber-500/50 text-amber-100"
        }`}
      >
        {isTerminated ? (
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        )}
        <div className="space-y-0.5">
          <div className="text-xs font-semibold">
            {isTerminated
              ? "Interview Terminated due to Repeated Integrity Violations"
              : "Integrity Compliance Warning"}
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            {isTerminated
              ? "Session limit reached (3 strikes). Directing to final report in 3 seconds."
              : warning}
          </p>
        </div>
      </div>
    </div>
  );
}
