"use client";

import React from "react";
import { Mic, MicOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";

export interface MicCheckProps {
  isMicOn: boolean;
  audioLevel: number;
  onToggleMic: () => void;
  isGranted: boolean;
}

export function MicCheck({
  isMicOn,
  audioLevel,
  onToggleMic,
  isGranted,
}: MicCheckProps) {
  // Normalize 0-255 audioLevel to 0-100
  const normalizedLevel = Math.min(100, Math.round((audioLevel / 128) * 100));
  const hasAudioActivity = normalizedLevel > 15;

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#4f46e5]">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">1. Microphone Input</h3>
            <p className="text-xs text-[#64748b]">Speak to verify input sensitivity</p>
          </div>
        </div>

        <Badge variant={isGranted && (isMicOn || hasAudioActivity) ? "success" : "neutral"}>
          {isGranted && hasAudioActivity ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Audible
            </span>
          ) : isGranted ? (
            "Connected"
          ) : (
            "Not Connected"
          )}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-[#64748b]">
          <span>Audio Level</span>
          <span className="font-mono text-[11px] font-semibold text-[#0f172a]">{normalizedLevel}%</span>
        </div>
        <ProgressBar
          value={normalizedLevel}
          variant={hasAudioActivity ? "success" : "default"}
          size="sm"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          variant={isMicOn ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleMic}
          className="text-xs gap-1.5"
        >
          {isMicOn ? (
            <>
              <MicOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Mute Mic</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-purple-400" />
              <span>{isGranted ? "Unmute Mic" : "Allow Microphone"}</span>
            </>
          )}
        </Button>
        <span className="text-[11px] text-[#94a3b8]">
          {hasAudioActivity ? "Mic working great" : "Say something into mic..."}
        </span>
      </div>
    </div>
  );
}
