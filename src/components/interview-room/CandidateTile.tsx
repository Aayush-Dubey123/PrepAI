"use client";

import React, { useState } from "react";
import { User, CameraOff, FlipHorizontal, AlertCircle, Mic } from "lucide-react";
import { AudioVisualizer } from "@/src/components/ui/AudioVisualizer";
import { Badge } from "@/src/components/ui/Badge";

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
    <div className="relative h-full w-full rounded-2xl border border-white/[0.08] bg-black overflow-hidden flex flex-col items-center justify-center shadow-2xl group">
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
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-[#121317]">
          <div className="w-20 h-20 rounded-full bg-neutral-800/80 border border-white/10 flex items-center justify-center text-neutral-400 shadow-inner">
            <User className="w-10 h-10" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <CameraOff className="w-3.5 h-3.5" />
            <span>Camera stream active (preview muted)</span>
          </div>
        </div>
      )}

      {/* Top Left: Candidate Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-semibold text-white shadow-lg">
          <User className="w-3 h-3 text-emerald-400" />
          <span className="truncate max-w-[140px]">{candidateName || "Candidate"}</span>
        </div>
      </div>

      {/* Top Right: Mirror Toggle & Live Mic Indicator */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {isListening && (
          <Badge variant="success" pulse className="gap-1 text-xs shadow-lg">
            <Mic className="w-3 h-3" />
            <span>Listening</span>
          </Badge>
        )}

        <button
          type="button"
          onClick={() => setIsMirrored((m) => !m)}
          title="Toggle mirror view"
          className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer shadow-md"
        >
          <FlipHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Silence Nudge Toast / Banner (12s Inactivity Invariant) */}
      {showSilenceHint && (
        <div className="absolute top-16 inset-x-4 z-20 flex justify-center animate-in fade-in duration-300">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-950/90 border border-purple-500/40 text-purple-200 text-xs shadow-2xl backdrop-blur-md max-w-md text-center">
            <AlertCircle className="w-4 h-4 text-purple-400 shrink-0" />
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
            barColor="rgba(255, 255, 255, 0.15)"
          />
        </div>

        <span className="text-[10px] font-mono text-neutral-400 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
          Live Candidate Feed
        </span>
      </div>
    </div>
  );
}
