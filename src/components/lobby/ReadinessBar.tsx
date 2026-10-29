"use client";

import React from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";

export interface ReadinessBarProps {
  completedCount: number;
  totalChecks: number;
  canEnter: boolean;
  onEnter: () => void;
  onSkip: () => void;
  integrityConsent: boolean;
  onToggleIntegrityConsent: (val: boolean) => void;
  isResearchMode?: boolean;
  researchConsent?: boolean;
  onToggleResearchConsent?: (val: boolean) => void;
}

export function ReadinessBar({
  completedCount,
  totalChecks = 4,
  canEnter,
  onEnter,
  onSkip,
  integrityConsent,
  onToggleIntegrityConsent,
  isResearchMode = false,
  researchConsent = false,
  onToggleResearchConsent,
}: ReadinessBarProps) {
  const percentage = Math.round((completedCount / totalChecks) * 100);
  const allCompleted = completedCount >= totalChecks;

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-2.5 sm:p-3 space-y-2 shadow-xs shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-[#0f172a]">System Readiness</span>
            <Badge variant={allCompleted ? "success" : "purple"} pulse={allCompleted}>
              {completedCount} of {totalChecks} Checks Completed
            </Badge>
          </div>
          <p className="text-[11px] sm:text-xs text-[#64748b]">
            {allCompleted
              ? "All hardware checks verified. You are completely ready for your interview."
              : "Complete the remaining checks above or skip ahead."}
          </p>
        </div>

        <div className="w-full sm:w-48 md:w-56">
          <ProgressBar
            value={percentage}
            variant={allCompleted ? "success" : "default"}
            size="sm"
          />
        </div>
      </div>

      {/* Proctoring & Research Consents */}
      <div className="border-t border-[#f1f5f9] pt-1.5 space-y-1">
        <label className="flex items-center gap-2 text-[11px] sm:text-xs text-[#334155] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={integrityConsent}
            onChange={(e) => onToggleIntegrityConsent(e.target.checked)}
            className="rounded border-[#cbd5e1] text-[#4f46e5] focus:ring-[#6366f1]/40"
          />
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4f46e5] shrink-0" />
          <span>I consent to autonomous video integrity monitoring and active face orientation tracking.</span>
        </label>

        {isResearchMode && onToggleResearchConsent && (
          <label className="flex items-center gap-2 text-[11px] sm:text-xs text-[#334155] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={researchConsent}
              onChange={(e) => onToggleResearchConsent(e.target.checked)}
              className="rounded border-[#cbd5e1] text-[#4f46e5] focus:ring-[#6366f1]/40"
            />
            <span className="text-[#0284c7] font-mono text-[10px] uppercase font-bold">[Research]</span>
            <span>I consent to anonymous latency telemetry collection for academic research evaluation.</span>
          </label>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#f1f5f9]">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer text-center sm:text-left py-0.5"
        >
          Skip checks & enter directly →
        </button>

        <Button
          variant={canEnter ? "glow" : "secondary"}
          size="md"
          disabled={!canEnter}
          onClick={onEnter}
          className="w-full sm:w-auto font-semibold gap-2 shadow-md h-9 sm:h-10 text-xs sm:text-sm"
        >
          <span>Enter Interview Room</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
