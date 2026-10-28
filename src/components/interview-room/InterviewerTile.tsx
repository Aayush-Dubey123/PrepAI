"use client";

import React from "react";
import Orb from "@/src/components/ui/Orb";
import { AudioVisualizer } from "@/src/components/ui/AudioVisualizer";
import { Badge } from "@/src/components/ui/Badge";
import { Sparkles } from "lucide-react";

export interface InterviewerTileProps {
  turnState: "idle" | "ai_speaking" | "user_turn" | "processing";
  isAiThinking: boolean;
  aiProvider?: string | null;
}

export function InterviewerTile({
  turnState,
  isAiThinking,
  aiProvider,
}: InterviewerTileProps) {
  const isSpeaking = turnState === "ai_speaking";
  const isThinking = isAiThinking || turnState === "processing";
  const isListening = turnState === "user_turn";

  let statusLabel = "Ready";
  let statusVariant: "neutral" | "purple" | "cyan" | "success" | "warning" = "neutral";

  if (isSpeaking) {
    statusLabel = "AI Speaking";
    statusVariant = "purple";
  } else if (isThinking) {
    statusLabel = "Analyzing Response...";
    statusVariant = "cyan";
  } else if (isListening) {
    statusLabel = "Listening to Candidate";
    statusVariant = "success";
  }

  return (
    <div className="relative h-full w-full rounded-2xl border border-white/[0.08] bg-[#121317] overflow-hidden flex flex-col items-center justify-center p-6 shadow-2xl group">
      {/* Background radial glow */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          isSpeaking
            ? "bg-[radial-gradient(circle_at_center,_rgba(139,92,246,0.18)_0%,_transparent_70%)] opacity-100"
            : isThinking
            ? "bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.14)_0%,_transparent_70%)] opacity-100"
            : "bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.03)_0%,_transparent_70%)] opacity-60"
        }`}
      />

      {/* Top Left: Speaker Label */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-semibold text-white shadow-lg">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span>PrepAI Evaluator</span>
        </div>
      </div>

      {/* Top Right: Status Pill */}
      <div className="absolute top-4 right-4 z-10">
        <Badge variant={statusVariant} pulse={isSpeaking || isThinking || isListening}>
          {statusLabel}
        </Badge>
      </div>

      {/* Center: AI Shader Orb */}
      <div className="relative flex items-center justify-center w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 my-auto">
        <div
          className={`absolute inset-0 rounded-full transition-all duration-700 ${
            isSpeaking
              ? "shadow-[0_0_80px_rgba(139,92,246,0.45)] scale-105"
              : isThinking
              ? "shadow-[0_0_60px_rgba(59,130,246,0.35)] scale-100 animate-pulse"
              : "shadow-[0_0_40px_rgba(255,255,255,0.05)] scale-95"
          }`}
        />
        <div className="w-full h-full">
          <Orb
            hue={isThinking ? 220 : 270}
            hoverIntensity={isSpeaking ? 0.8 : 0.3}
            forceHoverState={isSpeaking || isThinking}
            backgroundColor="#121317"
          />
        </div>
      </div>

      {/* Bottom Bar: Reactive Audio Visualizer */}
      <div className="absolute bottom-4 inset-x-6 z-10 flex flex-col items-center gap-2">
        <div className="w-full max-w-xs h-7 flex items-center justify-center">
          <AudioVisualizer
            isSpeaking={isSpeaking}
            barCount={24}
            height={28}
            activeColor="rgba(168, 85, 247, 0.95)"
            barColor="rgba(255, 255, 255, 0.12)"
          />
        </div>

        {aiProvider && (
          <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-neutral-400" />
            <span>Active Engine: {aiProvider}</span>
          </span>
        )}
      </div>
    </div>
  );
}
