"use client";

import React, { useState } from "react";
import { User, CameraOff, FlipHorizontal, AlertCircle, Mic } from "lucide-react";
import { AudioVisualizer } from "@/src/components/ui/loaders/AudioVisualizer";
import { Badge } from "@/src/components/ui/actions/Badge";

export interface CandidateTileProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  candidateName: string;
  isCameraOn: boolean;
  isListening: boolean;
  showSilenceHint: boolean;
  mediaStream: MediaStream | null;
}

export function CandidateTile({
  videoRef,
  candidateName,
  isCameraOn,
  isListening,
  showSilenceHint,
  mediaStream,
}: CandidateTileProps) {
  const [isMirrored, setIsMirrored] = useState(true);

  return (
    <div className="relative min-h-[220px] md:min-h-0 aspect-video md:aspect-auto h-auto md:h-full w-full rounded-2xl border border-[#e2e8f0] bg-slate-900 overflow-hidden flex flex-col items-center justify-center shadow-sm group">
      {/* Video element - keeps stream active regardless of isCameraOn */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          isMirrored ? "-scale-x-100" : "scale-x-100"
        } ${isCameraOn ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      {/* Fallback Candidate Avatar when Camera is Visually Hidden */}
      {!isCameraOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-slate-900">
          <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-inner">
            <User className="w-10 h-10" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <CameraOff className="w-3.5 h-3.5" />
            <span>Camera stream active (preview muted)</span>
          </div>
        </div>
      )}

      {/* Top Left: Candidate Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#e2e8f0] text-xs font-semibold text-[#0f172a] shadow-xs">
          <User className="w-3 h-3 text-[#15803d]" />
          <span className="truncate max-w-[140px]">{candidateName || "Candidate"}</span>
        </div>
      </div>

      {/* Top Right: Mirror Toggle & Live Mic Indicator */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {isListening && (
          <Badge variant="success" pulse className="gap-1 text-xs shadow-xs">
            <Mic className="w-3 h-3" />
            <span>Listening</span>
          </Badge>
        )}

        <button
          type="button"
          onClick={() => setIsMirrored((m) => !m)}
          title="Toggle mirror view"
          className="p-1.5 rounded-full bg-white/90 backdrop-blur-md border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer shadow-xs"
        >
          <FlipHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Silence Nudge Toast / Banner (12s Inactivity Invariant) */}
      {showSilenceHint && (
        <div className="absolute top-16 inset-x-4 z-20 flex justify-center animate-in fade-in duration-300">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-md backdrop-blur-md max-w-md text-center">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Listening... Take your time! Feel free to answer or ask for a hint.</span>
          </div>
        </div>
      )}

      {/* Bottom Bar: Live Candidate Audio Visualizer */}
      <div className="absolute bottom-4 inset-x-6 z-10 flex items-center justify-between pointer-events-none">
        <div className="w-32 h-6">
          <AudioVisualizer
            stream={mediaStream}
            barCount={16}
            height={20}
            activeColor="rgba(16, 185, 129, 0.9)"
            barColor="rgba(255, 255, 255, 0.2)"
          />
        </div>

        <span className="text-[10px] font-mono text-[#64748b] bg-white/90 border border-[#e2e8f0] px-2 py-0.5 rounded shadow-2xs backdrop-blur-sm">
          Live Candidate Feed
        </span>
      </div>
    </div>
  );
}
