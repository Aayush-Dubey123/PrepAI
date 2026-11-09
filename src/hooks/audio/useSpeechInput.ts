"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Continuous speech input with an explicit listening state.
 *
 * - Recognition runs in continuous mode and builds up a draft answer. Nothing is submitted
 *   automatically, whether on silence, on a final result or when Chrome ends the session.
 *   The page submits explicitly via `takeDraft()` ("Finished answer").
 * - Chrome ends recognition on its own (silence, ~60 s limit, network). While the user still
 *   wants to listen, the hook restarts it with backoff, and gives up with an error after
 *   repeated failures in a short window.
 * - Final results are stored by result index per recognition session, so a result Chrome
 *   re-delivers never gets appended twice.
 * - Permission, missing-mic and network errors each get their own message; permission errors
 *   are never retried.
 */

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

export type ListenState =
  | "idle"                  // never started
  | "requesting_permission" // start() called, waiting for onstart (browser may show a permission prompt)
  | "listening"
  | "restarting"            // Chrome ended the session; restarting with backoff
  | "stopped"               // user stopped; draft is kept
  | "error";                // gave up; see transcriptError

export interface UseSpeechInputOptions {
  onBargeIn?: () => void;
  enabled?: boolean;
}

interface ActiveRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const RESTART_DELAYS_MS = [250, 500, 1000, 2000];
const MAX_RESTARTS_IN_WINDOW = 6;
const RESTART_WINDOW_MS = 30_000;

export function useSpeechInput({ onBargeIn, enabled = true }: UseSpeechInputOptions = {}) {
  const [listenState, setListenState] = useState<ListenState>("idle");
  const [draft, setDraft] = useState("");
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [supportsSpeechRecognition, setSupportsSpeechRecognition] = useState<boolean>(false);

  const onBargeInRef = useRef(onBargeIn);
  useEffect(() => {
    onBargeInRef.current = onBargeIn;
  }, [onBargeIn]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSupportsSpeechRecognition(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    }
  }, []);

  const recognitionRef = useRef<ActiveRecognition | null>(null);
  const wantListeningRef = useRef(false);          // user intent
  const fatalErrorRef = useRef(false);             // permission / no mic: don't restart
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimesRef = useRef<number[]>([]);
  const restartAttemptRef = useRef(0);

  // Draft = text committed in earlier recognition sessions + this session's finals + interim.
  const committedRef = useRef("");
  const sessionFinalsRef = useRef<string[]>([]);
  const interimRef = useRef("");

  const renderDraft = useCallback(() => {
    const parts = [committedRef.current, sessionFinalsRef.current.filter(Boolean).join(" "), interimRef.current];
    setDraft(parts.map((p) => p.trim()).filter(Boolean).join(" "));
  }, []);

  /** Moves this session's finals (and any leftover interim) into the committed text. */
  const commitSession = useCallback(() => {
    const sessionText = [sessionFinalsRef.current.filter(Boolean).join(" "), interimRef.current]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(" ");
    if (sessionText) {
      committedRef.current = [committedRef.current.trim(), sessionText].filter(Boolean).join(" ");
    }
    sessionFinalsRef.current = [];
    interimRef.current = "";
  }, []);

  const clearRestartTimer = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const teardown = useCallback(() => {
    clearRestartTimer();
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
      try {
        rec.abort();
      } catch {}
    }
  }, []);

  const startSessionRef = useRef<() => void>(() => {});

  const scheduleRestart = useCallback(() => {
    const now = Date.now();
    restartTimesRef.current = restartTimesRef.current.filter((t) => now - t < RESTART_WINDOW_MS);
    if (restartTimesRef.current.length >= MAX_RESTARTS_IN_WINDOW) {
      wantListeningRef.current = false;
      setListenState("error");
      setTranscriptError(
        "Speech recognition keeps stopping (the speech service may be unreachable). Your words so far are kept; you can type the rest."
      );
      return;
    }
    restartTimesRef.current.push(now);
    const delay = RESTART_DELAYS_MS[Math.min(restartAttemptRef.current, RESTART_DELAYS_MS.length - 1)];
    restartAttemptRef.current++;
    setListenState("restarting");
    clearRestartTimer();
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (wantListeningRef.current) startSessionRef.current();
    }, delay);
  }, []);

  const startSession = useCallback(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    teardown();
    const recognition = new SpeechRecognitionClass() as unknown as ActiveRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setListenState("listening");
      setTranscriptError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      restartAttemptRef.current = 0; // healthy session → reset backoff
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) {
          // Keyed by index: a re-delivered final overwrites instead of appending again.
          sessionFinalsRef.current[i] = text.trim();
        } else {
          interim += text;
        }
      }
      interimRef.current = interim.trim();
      if (interimRef.current.length > 0) onBargeInRef.current?.();
      renderDraft();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      console.warn("[SPEECH INPUT] Error:", event.error);
      switch (event.error) {
        case "no-speech":
        case "aborted":
          return; // normal pauses; onend restarts quietly while listening
        case "not-allowed":
        case "service-not-allowed":
          fatalErrorRef.current = true;
          wantListeningRef.current = false;
          setListenState("error");
          setTranscriptError(
            "Microphone permission is blocked. Click the camera/mic icon in the address bar, allow the microphone, then press the mic button again."
          );
          return;
        case "audio-capture":
          fatalErrorRef.current = true;
          wantListeningRef.current = false;
          setListenState("error");
          setTranscriptError("No microphone detected. Check your mic in the hardware check, or type your answer.");
          return;
        case "network":
          setTranscriptError("Speech service connection dropped — reconnecting…");
          return; // onend follows; scheduleRestart backs off and eventually gives up
        default:
          setTranscriptError(`Speech recognition notice: ${event.error}. You can also type your response.`);
      }
    };

    recognition.onend = () => {
      commitSession();
      renderDraft();
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (wantListeningRef.current && !fatalErrorRef.current) {
        scheduleRestart();
      } else if (!fatalErrorRef.current) {
        setListenState("stopped");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("[SPEECH INPUT] start failed:", e);
      recognitionRef.current = null;
      if (wantListeningRef.current) scheduleRestart();
    }
  }, [teardown, commitSession, renderDraft, scheduleRestart]);

  useEffect(() => {
    startSessionRef.current = startSession;
  }, [startSession]);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setTranscriptError("Speech recognition isn't supported in this browser. Please type your answer in the transcript drawer.");
      setListenState("error");
      return;
    }
    if (wantListeningRef.current && recognitionRef.current) return;

    onBargeInRef.current?.();
    wantListeningRef.current = true;
    fatalErrorRef.current = false;
    restartAttemptRef.current = 0;
    restartTimesRef.current = [];
    setTranscriptError(null);
    setListenState("requesting_permission");
    startSession();
  }, [startSession]);

  /** Stops listening. The draft is kept until takeDraft() or discardDraft(). */
  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    clearRestartTimer();
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop(); // onend commits the session and sets "stopped"
      } catch {
        teardown();
        commitSession();
        renderDraft();
        setListenState("stopped");
      }
    } else {
      commitSession();
      renderDraft();
      setListenState((s) => (s === "error" ? s : "stopped"));
    }
  }, [teardown, commitSession, renderDraft]);

  /** Returns the full draft (including in-progress words) and clears it. */
  const takeDraft = useCallback((): string => {
    commitSession();
    const text = committedRef.current.trim();
    committedRef.current = "";
    setDraft("");
    return text;
  }, [commitSession]);

  const discardDraft = useCallback(() => {
    committedRef.current = "";
    sessionFinalsRef.current = [];
    interimRef.current = "";
    setDraft("");
  }, []);

  // Stop when input is disabled (e.g. while the answer is being processed).
  useEffect(() => {
    if (!enabled && wantListeningRef.current) stopListening();
  }, [enabled, stopListening]);

  useEffect(() => () => teardown(), [teardown]);

  const isListening = listenState === "listening" || listenState === "restarting" || listenState === "requesting_permission";

  return {
    listenState,
    isListening,
    /** Draft answer so far (finals + in-progress words). Kept name for existing UI. */
    interimTranscript: draft,
    startListening,
    stopListening,
    takeDraft,
    discardDraft,
    supportsSpeechRecognition,
    transcriptError,
    setTranscriptError,
  };
}
