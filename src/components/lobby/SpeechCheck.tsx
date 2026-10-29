"use client";

import React, { useState, useRef, useCallback } from "react";
import { MessageSquare, Mic, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";

export interface SpeechCheckProps {
  onSuccess: () => void;
  isPassed: boolean;
}

export function SpeechCheck({ onSuccess, isPassed }: SpeechCheckProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<unknown>(null);

  const startTest = useCallback(() => {
    setError(null);
    setTranscript("");

    const SpeechRecognition =
      "SpeechRecognition" in window
        ? (window.SpeechRecognition as new () => unknown)
        : "webkitSpeechRecognition" in window
        ? (window.webkitSpeechRecognition as new () => unknown)
        : null;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. You can type answers during the interview.");
      return;
    }

    interface RecognitionInstance {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: () => void;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void;
      onerror: (e: { error: string }) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    }

    const recognition = new SpeechRecognition() as unknown as RecognitionInstance;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const resultsArray = Array.from(event.results);
      const text = resultsArray.map((r) => r[0]?.transcript || "").join(" ");
      setTranscript(text);

      const latest = resultsArray[resultsArray.length - 1];
      if (latest?.isFinal && text.trim().length > 0) {
        setIsListening(false);
        onSuccess();
      }
    };

    recognition.onerror = (e) => {
      console.warn("[SPEECH_CHECK] Error:", e.error);
      setIsListening(false);
      if (e.error === "not-allowed") {
        setError("Microphone permission denied for voice recognition.");
      } else if (e.error === "no-speech") {
        setError("No speech detected. Please speak closer to your mic.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcript.trim().length > 3) {
        onSuccess();
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }, [onSuccess, transcript]);

  const stopTest = () => {
    if (
      recognitionRef.current &&
      typeof recognitionRef.current === "object" &&
      "stop" in recognitionRef.current
    ) {
      try {
        (recognitionRef.current as { stop: () => void }).stop();
      } catch {}
    }
    setIsListening(false);
  };

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-2.5 sm:p-3 space-y-2 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#fffbeb] border border-[#fef3c7] flex items-center justify-center text-[#d97706] shrink-0">
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#0f172a]">3. Speech Recognition</h3>
            <p className="text-[11px] text-[#64748b]">
              Say <span className="text-[#b45309] font-medium">&quot;Ready for interview&quot;</span> or introduce yourself
            </p>
          </div>
        </div>

        <Badge variant={isPassed ? "success" : "neutral"}>
          {isPassed ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Transcribed
            </span>
          ) : (
            "Untested"
          )}
        </Badge>
      </div>

      {transcript && (
        <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-[11px] text-[#0f172a] font-mono">
          <span className="text-[#64748b] mr-2">Transcript:</span>
          &quot;{transcript}&quot;
        </div>
      )}

      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="flex items-center justify-between pt-0.5">
        <Button
          variant={isListening ? "danger" : "outline"}
          size="sm"
          onClick={isListening ? stopTest : startTest}
          className="text-xs gap-1.5 h-8"
        >
          {isListening ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span>Listening... (Click to stop)</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-[#d97706]" />
              <span>{isPassed ? "Test Again" : "Start Voice Test"}</span>
            </>
          )}
        </Button>

        {isPassed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startTest}
            className="text-xs text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] gap-1 h-8"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retest</span>
          </Button>
        )}
      </div>
    </div>
  );
}
