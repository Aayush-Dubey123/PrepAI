"use client";

import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, []);
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
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-2.5 sm:p-3 space-y-2 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#f0f9ff] border border-[#e0f2fe] flex items-center justify-center text-[#0284c7] shrink-0">
            <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#0f172a]">2. Speaker Output</h3>
            <p className="text-[11px] text-[#64748b]">Play a sample chime and confirm playback</p>
          </div>
        </div>

        <Badge variant={isConfirmed ? "success" : "neutral"}>
          {isConfirmed ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Verified
            </span>
          ) : (
            "Unverified"
          )}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
        <Button
          variant={isPlaying ? "secondary" : "outline"}
          size="sm"
          onClick={playTestAudio}
          isLoading={isPlaying}
          className="text-xs gap-1.5 h-8"
        >
          <Play className="w-3.5 h-3.5 text-[#0284c7]" />
          <span>Play Test Audio</span>
        </Button>

        {hasPlayed && !isConfirmed && (
          <button
            type="button"
            onClick={onConfirmed}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sound is clear</span>
          </button>
        )}

        {isConfirmed && (
          <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmed working
          </span>
        )}
      </div>
    </div>
  );
}
