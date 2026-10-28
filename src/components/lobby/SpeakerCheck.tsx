"use client";

import React, { useState } from "react";
import { Volume2, CheckCircle2, Play } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";

export interface SpeakerCheckProps {
  onConfirmed: () => void;
  isConfirmed: boolean;
}

export function SpeakerCheck({ onConfirmed, isConfirmed }: SpeakerCheckProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const playTestAudio = () => {
    if (typeof window === "undefined") return;

    setIsPlaying(true);
    setHasPlayed(true);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        "Welcome to PrepAI. Your audio output is working properly."
      );
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        setIsPlaying(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlaying(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#f0f9ff] border border-[#e0f2fe] flex items-center justify-center text-[#0284c7]">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">2. Speaker Output</h3>
            <p className="text-xs text-[#64748b]">Play a sample chime and confirm playback</p>
          </div>
        </div>

        <Badge variant={isConfirmed ? "success" : "neutral"}>
          {isConfirmed ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Verified
            </span>
          ) : (
            "Unverified"
          )}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          variant={isPlaying ? "secondary" : "outline"}
          size="sm"
          onClick={playTestAudio}
          isLoading={isPlaying}
          className="text-xs gap-1.5"
        >
          <Play className="w-3.5 h-3.5 text-cyan-400" />
          <span>Play Test Audio</span>
        </Button>

        {hasPlayed && !isConfirmed && (
          <button
            type="button"
            onClick={onConfirmed}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sound is clear</span>
          </button>
        )}

        {isConfirmed && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmed working
          </span>
        )}
      </div>
    </div>
  );
}
