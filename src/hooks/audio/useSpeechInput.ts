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
declare global {
  interface Window {
    SpeechRecognition?: new () => unknown;
    webkitSpeechRecognition?: new () => unknown;
  }
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
  const [supportsSpeechRecognition, setSupportsSpeechRecognition] = useState<boolean>(false);

  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptRef = useRef<string>("");
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onBargeInRef = useRef(onBargeIn);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    onBargeInRef.current = onBargeIn;
  }, [onBargeIn]);

  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSupported = Boolean(
        window.SpeechRecognition || window.webkitSpeechRecognition
      );
      setSupportsSpeechRecognition(isSupported);
    }
  }, []);

  const recognitionRef = useRef<unknown>(null);
  const isListeningRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    const pendingText = lastTranscriptRef.current.trim();
    if (pendingText.length > 0) {
      lastTranscriptRef.current = "";
      setInterimTranscript("");
      onFinalTranscriptRef.current(pendingText);
    }

    if (recognitionRef.current) {
      try {
        (recognitionRef.current as { stop: () => void }).stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setTranscriptError("Speech recognition not supported in this browser. Please use text input in transcript drawer.");
      return;
    }

    if (isListeningRef.current) return;

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    lastTranscriptRef.current = "";

    // Barge-in: Stop active AI speech immediately
    onBargeInRef.current?.();

    // Abort and tear down any stale recognition session to avoid InvalidStateError
    if (recognitionRef.current) {
      try {
        (recognitionRef.current as { abort: () => void }).abort();
      } catch {}
      recognitionRef.current = null;
    }
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
      abort: () => void;
    }

    const recognition = new SpeechRecognitionClass() as unknown as ActiveRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      setInterimTranscript("");
      lastTranscriptRef.current = "";
      setTranscriptError(null);
    };

    let accumulatedFinal = "";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      const { resultIndex, results } = event;
      let interim = "";

      for (let i = resultIndex; i < results.length; i++) {
        const item = results[i];
        if (item?.[0]?.transcript?.trim()) {
          onBargeInRef.current?.();
        }
        if (item?.isFinal) {
          accumulatedFinal += (item[0]?.transcript || "") + " ";
        } else if (item?.[0]) {
          interim += item[0].transcript;
        }
      }

      const fullText = (accumulatedFinal + interim).trim();
      lastTranscriptRef.current = fullText;
      setInterimTranscript(fullText);

      if (fullText.length > 0) {
        silenceTimeoutRef.current = setTimeout(() => {
          const submittedText = lastTranscriptRef.current.trim();
          if (submittedText.length > 0) {
            lastTranscriptRef.current = "";
            setInterimTranscript("");
            stopListeningRef.current();
            onFinalTranscriptRef.current(submittedText);
          }
        }, 1500);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      console.warn("[SPEECH INPUT] Error:", event.error);

      // Transient no-speech pause: user paused thinking; do not kill recognition or show alarming red banner
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }

      setIsListening(false);
      isListeningRef.current = false;

      if (event.error === "not-allowed") {
        setTranscriptError("Microphone permission denied. Click Allow in your browser address bar.");
      } else if (event.error === "audio-capture") {
        setTranscriptError("Microphone not detected. Please verify your hardware connection.");
      } else {
        setTranscriptError(`Speech recognition notice: ${event.error}. You can also type your response.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      const pendingText = lastTranscriptRef.current.trim();
      if (pendingText.length > 0) {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        lastTranscriptRef.current = "";
        setInterimTranscript("");
        onFinalTranscriptRef.current(pendingText);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("[SPEECH INPUT] start failed:", e);
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [onBargeIn]);

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
