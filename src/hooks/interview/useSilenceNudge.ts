"use client";

import { useState, useEffect, useRef } from "react";

export interface UseSilenceNudgeOptions {
  turnState: string;
  userInput: string;
  timeoutMs?: number;
}

export function useSilenceNudge({
  turnState,
  userInput,
  timeoutMs = 12000,
}: UseSilenceNudgeOptions) {
  const [showSilenceHint, setShowSilenceHint] = useState(false);
  const silenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (turnState === "user_turn") {
      silenceTimerRef.current = window.setTimeout(() => {
        console.log(`[SILENCE DETECT] Candidate silent for > ${timeoutMs / 1000}s, showing nudge hint`);
        setShowSilenceHint(true);
      }, timeoutMs);
    }

    return () => {
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [turnState, userInput, timeoutMs]);

  return {
    showSilenceHint: turnState === "user_turn" && showSilenceHint,
    setShowSilenceHint,
  };
}
