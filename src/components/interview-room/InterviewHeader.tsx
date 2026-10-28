"use client";

import React from "react";
import { Clock, ShieldAlert, PhoneOff, Sparkles, Brain } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";

export interface InterviewHeaderProps {
  jobRole: string;
  currentPhase: string;
  elapsedSeconds: number;
  strikes: number;
  maxStrikes?: number;
  onEndCall: () => void;
  aiProvider?: string | null;
}

const PHASE_CONFIG: Record<string, { label: string; variant: "neutral" | "purple" | "cyan" | "success" | "warning" }> = {
  intro: { label: "Getting Started", variant: "neutral" },
  warmup: { label: "Warmup & Rapport", variant: "cyan" },
  core: { label: "Technical Probing", variant: "purple" },
  wrapup: { label: "Wrapping Up", variant: "warning" },
  closing: { label: "Evaluation", variant: "success" },
  // legacy aliases
  greeting: { label: "Getting Started", variant: "neutral" },
  rapport: { label: "Warmup", variant: "cyan" },
  technical: { label: "Technical Probing", variant: "purple" },
  closed: { label: "Complete", variant: "success" },
};

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function InterviewHeader({
  jobRole,
  currentPhase,
  elapsedSeconds,
  strikes,
  maxStrikes = 3,
  onEndCall,
  aiProvider,
}: InterviewHeaderProps) {
  const phaseInfo = PHASE_CONFIG[currentPhase] || { label: currentPhase, variant: "purple" };

  return (
    <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-white/[0.08] bg-[#09090b]/90 backdrop-blur-md flex items-center justify-between z-20">
      {/* Left: Role & Phase */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2.5">
          <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate max-w-[180px] sm:max-w-xs">
            {jobRole}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={phaseInfo.variant} pulse className="text-[10px] py-0 px-2">
              {phaseInfo.label}
            </Badge>
            {aiProvider && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-neutral-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                {aiProvider}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Timer, Proctoring strikes, End call */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Timer */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-neutral-300">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span>{formatTimer(elapsedSeconds)}</span>
        </div>

        {/* Proctoring Strikes */}
        {strikes > 0 ? (
          <Badge variant="error" pulse className="gap-1 text-xs">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              {strikes}/{maxStrikes} Strikes
            </span>
          </Badge>
        ) : (
          <Badge variant="purple" className="hidden sm:inline-flex gap-1 text-[11px]">
            <span>Proctored</span>
          </Badge>
        )}

        {/* End Interview */}
        <Button
          variant="danger"
          size="sm"
          onClick={onEndCall}
          className="gap-1.5 text-xs font-semibold h-8"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">End Interview</span>
        </Button>
      </div>
    </header>
  );
}
