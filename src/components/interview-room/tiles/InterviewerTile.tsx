"use client";

import React, { useState, useEffect } from "react";
import Orb from "@/src/components/ui/visuals/Orb";
import { AudioVisualizer } from "@/src/components/ui/loaders/AudioVisualizer";
import { Badge } from "@/src/components/ui/actions/Badge";
import { Sparkles, Brain, Bot, Layers } from "lucide-react";

export interface InterviewerTileProps {
  turnState: "idle" | "ai_speaking" | "user_turn" | "processing";
  isAiThinking: boolean;
  aiProvider?: string | null;
  currentPrompt?: string | null;
  currentPhase?: string;
}

function checkWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

interface SafeOrbProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}
interface SafeOrbState {
  hasError: boolean;
}
class SafeOrbWrapper extends React.Component<SafeOrbProps, SafeOrbState> {
  constructor(props: SafeOrbProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[INTERVIEWER_TILE] WebGL Orb error, rendering fallback persona core:", error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function PersonaCore({
  isSpeaking,
  isThinking,
  isListening,
}: {
  isSpeaking: boolean;
  isThinking: boolean;
  isListening: boolean;
}) {
  let ringColor = "border-indigo-400/40 bg-indigo-500/5";
  let emblemGradient = "from-indigo-600 via-indigo-700 to-indigo-900 shadow-indigo-500/25";
  let pulseGlow = "shadow-[0_0_50px_rgba(99,102,241,0.2)]";

  if (isSpeaking) {
    ringColor = "border-indigo-500/50 bg-indigo-500/10";
    emblemGradient = "from-indigo-600 via-indigo-500 to-indigo-800 shadow-indigo-500/35";
    pulseGlow = "shadow-[0_0_70px_rgba(99,102,241,0.35)]";
  } else if (isThinking) {
    ringColor = "border-sky-400/50 bg-sky-500/10";
    emblemGradient = "from-sky-600 via-sky-500 to-cyan-700 shadow-sky-500/35";
    pulseGlow = "shadow-[0_0_60px_rgba(14,165,233,0.35)]";
  } else if (isListening) {
    ringColor = "border-emerald-400/50 bg-emerald-500/10";
    emblemGradient = "from-emerald-600 via-emerald-500 to-teal-700 shadow-emerald-500/35";
    pulseGlow = "shadow-[0_0_60px_rgba(16,185,129,0.3)]";
  }

  return (
    <div className="relative flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 my-auto select-none">
      {/* Concentric Animated Ripple Rings */}
      <div
        className={`absolute inset-0 rounded-full border ${ringColor} animate-persona-ring-1 pointer-events-none`}
      />
      <div
        className={`absolute inset-0 rounded-full border ${ringColor} animate-persona-ring-2 pointer-events-none`}
      />
      <div
        className={`absolute inset-0 rounded-full border ${ringColor} animate-persona-ring-3 pointer-events-none`}
      />

      {/* Ambient background aura */}
      <div
        className={`absolute inset-3 rounded-full transition-all duration-700 ${pulseGlow}`}
      />

      {/* Central AI Evaluator Emblem */}
      <div
        className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-linear-to-tr ${emblemGradient} flex flex-col items-center justify-center shadow-lg transition-transform duration-500 ${
          isSpeaking ? "scale-105" : isThinking ? "scale-100" : "scale-95"
        }`}
      >
        {/* Subtle rotating orbit highlight */}
        <div
          className={`absolute inset-1 rounded-full border border-white/20 border-dashed ${
            isThinking ? "animate-spin [animation-duration:8s]" : ""
          }`}
        />

        <div className="relative z-10 flex flex-col items-center justify-center text-white">
          <Brain
            className={`w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-300 drop-shadow-md ${
              isSpeaking ? "animate-pulse" : ""
            }`}
          />
          <span className="text-[9px] font-semibold tracking-wider uppercase opacity-90 mt-1 font-mono">
            {isSpeaking ? "Speaking" : isThinking ? "Thinking" : isListening ? "Listening" : "Evaluator"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function InterviewerTile({
  turnState,
  isAiThinking,
  aiProvider,
  currentPrompt,
  currentPhase,
}: InterviewerTileProps) {
  const [viewMode, setViewMode] = useState<"avatar" | "orb">("avatar");
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  useEffect(() => {
    const hasWebGl = checkWebGL();
    setWebGlSupported(hasWebGl);
    if (!hasWebGl) {
      setViewMode("avatar");
    }
  }, []);

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

  const personaCoreElement = (
    <PersonaCore
      isSpeaking={isSpeaking}
      isThinking={isThinking}
      isListening={isListening}
    />
  );

  return (
    <div className="relative min-h-[260px] md:min-h-0 h-auto md:h-full w-full rounded-2xl border border-[#e2e8f0] bg-white overflow-hidden flex flex-col items-center justify-between p-3 sm:p-5 shadow-sm group">
      {/* Background radial glow */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          isSpeaking
            ? "bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.12)_0%,_transparent_70%)] opacity-100"
            : isThinking
            ? "bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.12)_0%,_transparent_70%)] opacity-100"
            : "bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.04)_0%,_transparent_70%)] opacity-60"
        }`}
      />

      {/* Top Bar: Speaker Badge on Left, View Mode Toggle & Status Pill on Right */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#e2e8f0] text-xs font-semibold text-[#0f172a] shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#4f46e5]" />
          <span>PrepAI Evaluator</span>
        </div>

        <div className="flex items-center gap-2">
          {webGlSupported && (
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === "avatar" ? "orb" : "avatar"))}
              title={`Switch to ${viewMode === "avatar" ? "Orb" : "Avatar"} visualizer`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#e2e8f0] text-[11px] font-medium text-[#475569] hover:text-[#0f172a] hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <Layers className="w-3 h-3 text-[#4f46e5]" />
              <span className="hidden sm:inline capitalize">{viewMode}</span>
            </button>
          )}

          <Badge variant={statusVariant} pulse={isSpeaking || isThinking || isListening}>
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* Center Visualizer: Either AI Persona Core or Safe Orb */}
      <div className="flex-1 flex items-center justify-center min-h-0 my-auto py-2">
        {viewMode === "orb" && webGlSupported ? (
          <SafeOrbWrapper fallback={personaCoreElement}>
            <div className="relative flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 my-auto">
              <div
                className={`absolute inset-0 rounded-full transition-all duration-700 ${
                  isSpeaking
                    ? "shadow-[0_0_80px_rgba(99,102,241,0.35)] scale-105"
                    : isThinking
                    ? "shadow-[0_0_60px_rgba(14,165,233,0.3)] scale-100 animate-pulse"
                    : "shadow-[0_0_40px_rgba(99,102,241,0.08)] scale-95"
                }`}
              />
              <div className="w-full h-full">
                <Orb
                  hue={isThinking ? 200 : 250}
                  hoverIntensity={isSpeaking ? 0.8 : 0.3}
                  forceHoverState={isSpeaking || isThinking}
                  backgroundColor="#ffffff"
                />
              </div>
            </div>
          </SafeOrbWrapper>
        ) : (
          personaCoreElement
        )}
      </div>

      {/* Bottom Area: Frosted Dialogue Card + Audio Visualizer + Active Engine */}
      <div className="w-full z-10 flex flex-col items-center gap-2.5">
        {/* Interactive Frosted Dialogue Card */}
        <div className="w-full bg-white/85 backdrop-blur-md border border-[#e2e8f0] rounded-xl p-3 shadow-xs transition-all duration-300">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              {isSpeaking ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <span className="flex items-center gap-0.5 mr-0.5">
                    <span className="w-0.5 h-2 bg-indigo-600 animate-pulse" />
                    <span className="w-0.5 h-3 bg-indigo-600 animate-pulse [animation-delay:150ms]" />
                    <span className="w-0.5 h-1.5 bg-indigo-600 animate-pulse [animation-delay:300ms]" />
                  </span>
                  AI Evaluator Speaking
                </span>
              ) : isListening ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse mr-0.5" />
                  Listening to Candidate
                </span>
              ) : isThinking ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                  <span className="flex items-center gap-0.5 mr-0.5">
                    <span className="w-1 h-1 rounded-full bg-sky-600 animate-shimmer-dot-1" />
                    <span className="w-1 h-1 rounded-full bg-sky-600 animate-shimmer-dot-2" />
                    <span className="w-1 h-1 rounded-full bg-sky-600 animate-shimmer-dot-3" />
                  </span>
                  Evaluating Technical Depth
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  <Bot className="w-3 h-3 text-slate-600 mr-0.5" />
                  Evaluator Ready
                </span>
              )}
            </div>

            {currentPhase && (
              <span className="text-[10px] font-mono text-[#64748b] capitalize">
                Phase: {currentPhase}
              </span>
            )}
          </div>

          <div className="text-xs sm:text-[13px] leading-relaxed text-[#0f172a] max-h-24 sm:max-h-28 overflow-y-auto pr-1">
            {isThinking ? (
              <span className="text-[#64748b] italic">
                Analyzing technical signals and calibrating follow-up probe...
              </span>
            ) : isSpeaking ? (
              <span className="font-medium text-[#1e293b]">
                {currentPrompt || "Delivering interview question..."}
              </span>
            ) : isListening ? (
              currentPrompt ? (
                <span className="text-[#334155]">
                  <span className="text-[10px] uppercase font-semibold text-[#64748b] block mb-0.5">
                    Active Question:
                  </span>
                  {currentPrompt}
                </span>
              ) : (
                <span className="text-[#64748b] italic">
                  Listening to your response... Take your time to articulate your thoughts.
                </span>
              )
            ) : (
              <span className="text-[#64748b] italic">
                {currentPrompt ||
                  "Session initialized • Your interviewer will begin with an introductory question shortly."}
              </span>
            )}
          </div>
        </div>

        {/* Audio Visualizer & Provider Tag */}
        <div className="w-full flex items-center justify-between px-1">
          <div className="w-28 sm:w-36 h-5 flex items-center">
            <AudioVisualizer
              isSpeaking={isSpeaking}
              barCount={16}
              height={20}
              activeColor="rgba(79, 70, 229, 0.95)"
              barColor="rgba(226, 232, 240, 0.9)"
            />
          </div>

          {aiProvider && (
            <span className="text-[10px] font-mono text-[#64748b] flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[#4f46e5]" />
              <span>{aiProvider}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
