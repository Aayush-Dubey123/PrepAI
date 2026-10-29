"use client";

import React from "react";
import { Clock, ShieldAlert, PhoneOff, Sparkles, Brain, Maximize2, Minimize2, Lock } from "lucide-react";
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
  isFullscreen?: boolean;
  isFullscreenSupported?: boolean;
  onToggleFullscreen?: () => void;
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
  isFullscreen = false,
  isFullscreenSupported = true,
  onToggleFullscreen,
}: InterviewHeaderProps) {
  const phaseInfo = PHASE_CONFIG[currentPhase] || { label: currentPhase, variant: "purple" };

  return (
    <header className="h-14 shrink-0 px-4 sm:px-6 border-b border-[#e2e8f0] bg-white/90 backdrop-blur-md flex items-center justify-between z-20 text-[#0f172a]">
      {/* Left: Role & Phase */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] shrink-0">
          <Brain className="w-4 h-4" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2.5">
          <h1 className="text-xs sm:text-sm font-semibold text-[#0f172a] tracking-tight truncate max-w-[180px] sm:max-w-xs">
            {jobRole}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={phaseInfo.variant} pulse className="text-[10px] py-0 px-2">
              {phaseInfo.label}
            </Badge>
            {aiProvider && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-[#64748b] bg-[#f8fafc] px-2 py-0.5 rounded border border-[#e2e8f0]">
                <Sparkles className="w-2.5 h-2.5 text-[#4f46e5]" />
                {aiProvider}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Timer, Proctoring strikes, End call */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Timer */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f1f5f9] border border-[#e2e8f0] font-mono text-xs text-[#0f172a]">
          <Clock className="w-3.5 h-3.5 text-[#64748b]" />
          <span>{formatTimer(elapsedSeconds)}</span>
        </div>

        {/* Fullscreen Proctoring Mode Toggle */}
        {isFullscreenSupported ? (
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen Proctoring Mode"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              isFullscreen
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                : "bg-white border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] hover:bg-slate-50"
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden md:inline">Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#4f46e5]" />
                <span className="hidden md:inline">Fullscreen</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                alert(
                  "Fullscreen Mode Unavailable: Your browser window or iframe policy does not permit fullscreen switching. Your session continues normally without it."
                );
              }
            }}
            title="Fullscreen is unavailable in this browser environment or iframe. You can continue your interview normally."
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#e2e8f0] bg-slate-50 text-[#94a3b8] text-xs font-medium cursor-help opacity-85 hover:opacity-100"
          >
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Fullscreen Locked</span>
          </button>
        )}
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
          className="gap-1.5 text-xs font-semibold h-8 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">End Call</span>
        </Button>
      </div>
    </header>
  );
}
