"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultEvent {
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultItem;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResultEvent;
    length: number;
  };
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

export interface UseSpeechInputOptions {
  onFinalTranscript: (text: string) => void;
  onBargeIn?: () => void;
  enabled?: boolean;
}

export function useSpeechInput({
  onFinalTranscript,
  onBargeIn,
  enabled = true,
}: UseSpeechInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [supportsSpeechRecognition] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    }
    return false;
  });

  const recognitionRef = useRef<unknown>(null);
  const isListeningRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (
      recognitionRef.current &&
      typeof recognitionRef.current === "object" &&
      "stop" in recognitionRef.current
    ) {
      try {
        (recognitionRef.current as { stop: () => void }).stop();
      } catch {}
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!supportsSpeechRecognition || isListeningRef.current || !enabled) return;

    // Barge-in: Stop active AI speech immediately
    onBargeIn?.();

    const SpeechRecognition =
      "SpeechRecognition" in window
        ? (window.SpeechRecognition as new () => unknown)
        : "webkitSpeechRecognition" in window
        ? (window.webkitSpeechRecognition as new () => unknown)
        : null;

    if (!SpeechRecognition) return;

    interface ActiveRecognition {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: () => void;
      onresult: (e: SpeechRecognitionEventLike) => void;
      onerror: (e: SpeechRecognitionErrorEventLike) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    }

    const recognition = new SpeechRecognition() as unknown as ActiveRecognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript("");
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const { resultIndex, results } = event;
      const currentResult = results[resultIndex];

      if (currentResult?.isFinal) {
        const finalText = currentResult[0]?.transcript || "";
        setInterimTranscript("");
        setIsListening(false);
        onFinalTranscript(finalText);
      } else if (currentResult?.[0]) {
        setInterimTranscript(currentResult[0].transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      console.error("[SPEECH INPUT] Error:", event.error);
      setIsListening(false);
      setInterimTranscript("");

      switch (event.error) {
        case "not-allowed":
          setTranscriptError("Microphone permission denied. Using text input fallback.");
          break;
        case "no-speech":
          setTranscriptError("No speech detected. Please try again or use text input.");
          break;
        case "aborted":
          break;
        case "network":
          setTranscriptError("Network error during speech recognition. Using text input fallback.");
          break;
        case "audio-capture":
          setTranscriptError("Microphone not available. Using text input fallback.");
          break;
        default:
          setTranscriptError(`Speech recognition error: ${event.error}. Using text input fallback.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("[SPEECH INPUT] start failed:", e);
      setIsListening(false);
    }
  }, [supportsSpeechRecognition, enabled, onBargeIn, onFinalTranscript]);

  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
  }, [startListening, stopListening]);

  // Global [M] keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (isListeningRef.current) {
          stopListeningRef.current();
        } else {
          startListeningRef.current();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    supportsSpeechRecognition,
    transcriptError,
    setTranscriptError,
  };
}
