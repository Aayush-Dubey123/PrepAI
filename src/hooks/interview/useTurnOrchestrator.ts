"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface CandidateProfile {
  fullName: string;
  topSkills: string[];
  yearsOfExperience: number;
  coreProjects: Array<{ title: string; description: string }>;
}

export interface TranscriptEntry {
  id: string;
  speaker: "ai" | "user";
  text: string;
  timestamp: Date;
}

export interface TranscriptChunkRecord {
  id: string;
  interviewId: string;
  content: string;
  speaker: "user" | "ai";
  createdAt: string | Date | null;
}

export interface InterviewRecord {
  id: string;
  jobRole: string;
  status: string;
  currentPhase: string;
  feedback: {
    candidateProfile?: CandidateProfile;
  };
}

export interface TurnResponse {
  say: string;
  phase: "intro" | "warmup" | "core" | "wrapup" | "closing";
  isComplete: boolean;
  _dev?: {
    evaluation?: Record<string, unknown>;
    decision?: Record<string, unknown>;
    provider: string;
    latencyMs: number;
    action: string;
  };
}

export type TurnState = "idle" | "ai_speaking" | "user_turn" | "processing";

export interface UseTurnOrchestratorOptions {
  interviewId: string;
  onAiSpeakRequested: (say: string, onAudioStart?: () => void) => Promise<void>;
  onStopAiSpeech: () => void;
  mediaStream: MediaStream | null;
}

const TURN_TIMEOUT_MS = 45_000;

function mapChunkToEntry(chunk: TranscriptChunkRecord): TranscriptEntry {
  return {
    id: chunk.id,
    speaker: chunk.speaker,
    text: chunk.content,
    timestamp: chunk.createdAt ? new Date(chunk.createdAt) : new Date(),
  };
}

export function useTurnOrchestrator({
  interviewId,
  onAiSpeakRequested,
  onStopAiSpeech,
  mediaStream,
}: UseTurnOrchestratorOptions) {
  const router = useRouter();

  const [turnState, setTurnState] = useState<TurnState>("idle");
  const [currentPhase, setCurrentPhase] = useState<string>("intro");
  const [jobRole, setJobRole] = useState<string>("Software Developer");
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [userInput, setUserInput] = useState<string>("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isAttemptingOrchestratorRef = useRef(false);
  const hasPlayedInitialGreetingRef = useRef(false);
  const isEndingRef = useRef(false);
  // Answer saves still in flight; endSession waits for them before starting feedback.
  const pendingSavesRef = useRef<Set<Promise<unknown>>>(new Set());
  // The last answer whose save or /turn failed, so "Retry" re-sends it with the same ids
  // instead of creating a new answer.
  const pendingRetryRef = useRef<{ text: string; answerId: string; transcript: TranscriptEntry[] } | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  // Latency telemetry
  const sendClientLatencyLog = useCallback(
    (stage: "candidate_speech_end" | "audio_playback_start", turnNum?: number) => {
      if (process.env.NEXT_PUBLIC_RESEARCH_MODE !== "true") return;
      const ts = Date.now();
      console.log(`[EVAL_LATENCY] stage=${stage} ts=${ts}`);
      fetch("/api/eval/latency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          turnId: turnNum ?? transcript.length + 1,
          stage,
          ts,
        }),
      }).catch(() => {});
    },
    [interviewId, transcript.length]
  );

  // Append a transcript chunk. The chunk id is generated on the client, so a retry with the
  // same id returns the already-saved row instead of inserting a duplicate. Transient
  // failures (network, 5xx) are retried with backoff.
  const appendTranscript = useCallback(
    async (content: string, speaker: "user" | "ai", id: string = crypto.randomUUID()): Promise<TranscriptEntry> => {
      if (!interviewId) {
        throw new Error("Missing interview session id");
      }

      const payload = { id, interviewId, content, speaker };
      const delays = [0, 400, 1200];
      let lastError: Error = new Error("Failed to persist transcript");

      for (const delay of delays) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        let response: Response;
        try {
          response = await fetch("/api/interviews/transcript/append", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          continue; // network error → retry
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          lastError = new Error(typeof data.error === "string" ? data.error : "Failed to persist transcript");
          if (response.status >= 500) continue; // transient → retry
          throw lastError; // 4xx won't succeed on retry
        }

        const entry = mapChunkToEntry(data as TranscriptChunkRecord);
        setTranscript((prev) => (prev.some((e) => e.id === entry.id) ? prev : [...prev, entry]));
        return entry;
      }
      throw lastError;
    },
    [interviewId]
  );

  const trackSave = useCallback(<T,>(p: Promise<T>): Promise<T> => {
    pendingSavesRef.current.add(p);
    p.finally(() => pendingSavesRef.current.delete(p)).catch(() => {});
    return p;
  }, []);

  // End interview session gracefully (exact to commit 10e50d9)
  const endSession = useCallback(
    async (reason: "manual" | "natural" | "integrity" | "cap_reached" = "natural") => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;
      console.log(`[END_SESSION] Terminating interview session (${reason}) for ${interviewId}`);

      onStopAiSpeech();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      setTurnState("processing");
      setCurrentPhase("closed");

      // Feedback must not start before every answer is committed.
      await Promise.allSettled([...pendingSavesRef.current]);

      // The server answers 409 NOT_READY while a /turn is still saving state; retry briefly.
      // If it still isn't ready, the feedback page generates the report itself.
      void (async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const res = await fetch(`/api/interviews/${interviewId}/feedback/generate`, { method: "POST" });
            if (res.status !== 409) return;
          } catch (e) {
            console.warn("[END_SESSION] Feedback trigger error:", e);
            return;
          }
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      })();

      router.push(`/interview/${interviewId}/feedback`);
    },
    [interviewId, mediaStream, onStopAiSpeech, router]
  );

  // speakAiQuestion (exact to commit 10e50d9): Synchronizes audio playback with transcript display
  const speakAiQuestion = useCallback(
    async (questionText: string) => {
      console.log("[SPEAK AI] Question text:", questionText);
      if (!questionText || questionText.trim().length === 0) {
        console.error("[SPEAK AI] Empty question text provided");
        return;
      }

      setTurnState("ai_speaking");
      let textAppended = false;

      const triggerTextDisplay = async () => {
        if (!textAppended) {
          textAppended = true;
          setIsAiThinking(false);
          await appendTranscript(questionText, "ai");
        }
      };

      // Show the question right away; waiting for TTS audio to start added seconds of
      // "Thinking" on every turn. Speech plays alongside the already-visible text.
      const display = triggerTextDisplay().catch((err) => {
        console.warn("[SPEAK AI] Failed to save AI line:", err);
      });

      try {
        await onAiSpeakRequested(questionText);
        await display;
      } catch (error) {
        console.warn("[SPEAK AI] Audio playback error, text is already displayed:", error);
        await display;
      } finally {
        setTurnState("user_turn");
      }
    },
    [appendTranscript, onAiSpeakRequested]
  );

  // Execute turn (exact to commit 10e50d9)
  const callTurn = useCallback(
    async (
      userUtterance: string,
      updatedTranscript: TranscriptEntry[],
      customRequestId?: string,
      // Save of this answer, started in parallel with /turn. The follow-up isn't spoken or
      // shown until it resolves; if it fails, the answer is offered for retry.
      answerSave?: Promise<unknown>,
      retryInfo?: { text: string; answerId: string; transcript: TranscriptEntry[] }
    ) => {
      if (!interviewId) return;
      if (isAttemptingOrchestratorRef.current) {
        console.log("[TURN] Already in flight, skipping duplicate");
        return;
      }

      isAttemptingOrchestratorRef.current = true;
      setIsAiThinking(true);

      const h = userUtterance
        .split("")
        .reduce((acc, c) => (Math.imul(31, acc) + c.charCodeAt(0)) | 0, 0)
        .toString(36)
        .replace("-", "")
        .slice(-6);
      const clientRequestId =
        customRequestId || `${interviewId}_t${updatedTranscript.length}_${h}`;

      const recentTranscript = updatedTranscript.slice(-12).map((e) => ({
        speaker: e.speaker,
        content: e.text,
      }));

      const payload = { userUtterance, recentTranscript, clientRequestId };
      console.log("[TURN] Calling /turn, reqId:", clientRequestId, "utterance:", userUtterance.slice(0, 80));

      // A hung request must never leave the room stuck on "Evaluating": give up after
      // TURN_TIMEOUT_MS and offer Retry (same request id, so nothing is duplicated).
      const attemptFetch = async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);
        try {
          return await fetch(`/api/interviews/${interviewId}/turn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      };

      try {
        let response = await attemptFetch();
        console.log("[TURN] Response status:", response.status);

        if (response.status === 429) {
          const data = (await response.json().catch(() => ({}))) as {
            retryAfterSec?: number;
          };
          const waitSec = data.retryAfterSec ?? 5;
          console.warn(`[TURN] 429 — retrying in ${waitSec}s (answer preserved)`);
          setTranscriptError(`One moment — retrying in ${waitSec}s…`);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          setTranscriptError(null);
          response = await attemptFetch();
          console.log("[TURN] Retry response status:", response.status);
        }

        if (response.status === 409) {
          console.log("[TURN] Interview already ended on server (409). Navigating to feedback report.");
          setIsAiThinking(false);
          setCurrentPhase("closing");
          await endSession("natural");
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Turn failed: ${response.status} — ${errorText}`);
        }

        const turnResp = (await response.json()) as TurnResponse;
        console.log("[TURN] Response:", turnResp);

        // Don't move on until the answer this follow-up responds to is durably saved.
        if (answerSave) {
          try {
            await answerSave;
          } catch (saveErr) {
            console.error("[TURN] Answer save failed; holding the follow-up:", saveErr);
            setIsAiThinking(false);
            if (retryInfo) {
              pendingRetryRef.current = retryInfo;
              setCanRetry(true);
            }
            setTranscriptError("Your answer couldn't be saved. Check your connection and tap Retry.");
            setTurnState("user_turn");
            return;
          }
        }

        pendingRetryRef.current = null;
        setCanRetry(false);
        setCurrentPhase(turnResp.phase);
        if (turnResp._dev?.provider) setAiProvider(turnResp._dev.provider);

        setIsAiThinking(false);

        if (turnResp.isComplete) {
          await endSession("natural");
        } else {
          await speakAiQuestion(turnResp.say);
        }
      } catch (error) {
        console.error("[TURN] Error:", error);
        setIsAiThinking(false);
        // Retrying re-sends the same answer id and request id: the save is idempotent and
        // /turn returns the reply it already generated, so nothing is duplicated.
        if (retryInfo) {
          pendingRetryRef.current = retryInfo;
          setCanRetry(true);
        }
        const saved = answerSave ? await answerSave.then(() => true, () => false) : true;
        setTranscriptError(
          saved
            ? "Couldn't reach the AI — your answer was saved. Tap Retry."
            : "Couldn't send your answer. Check your connection and tap Retry."
        );
        setTurnState("user_turn");
      } finally {
        isAttemptingOrchestratorRef.current = false;
      }
    },
    [interviewId, endSession, speakAiQuestion]
  );

  // Send one answer: save it and start /turn in parallel under a single answer id.
  const sendAnswer = useCallback(
    async (text: string, answerId: string, baseTranscript: TranscriptEntry[]) => {
      const localEntry: TranscriptEntry = { id: answerId, speaker: "user", text, timestamp: new Date() };
      const updatedTranscript = [...baseTranscript, localEntry];
      const answerSave = trackSave(appendTranscript(text, "user", answerId));
      await callTurn(text, updatedTranscript, `${interviewId}_a_${answerId}`, answerSave, {
        text,
        answerId,
        transcript: baseTranscript,
      });
    },
    [appendTranscript, callTurn, interviewId, trackSave]
  );

  const submitAnswer = useCallback(
    async (text?: string) => {
      const finalText = (text || userInput).trim();
      if (!finalText || (turnState !== "user_turn" && turnState !== "ai_speaking")) return;
      // One submission at a time: a second click or a late speech result is ignored.
      if (isAttemptingOrchestratorRef.current) return;

      onStopAiSpeech?.();
      sendClientLatencyLog("candidate_speech_end");
      setUserInput("");
      setTranscriptError(null);
      setTurnState("processing");
      pendingRetryRef.current = null;
      setCanRetry(false);

      await sendAnswer(finalText, crypto.randomUUID(), transcript);
    },
    [userInput, turnState, onStopAiSpeech, sendClientLatencyLog, sendAnswer, transcript]
  );

  // Re-send the last failed answer with the same ids (no duplicate answer, no second follow-up).
  const retryLastAnswer = useCallback(async () => {
    const pending = pendingRetryRef.current;
    if (!pending || isAttemptingOrchestratorRef.current) return;
    setTranscriptError(null);
    setCanRetry(false);
    setTurnState("processing");
    await sendAnswer(pending.text, pending.answerId, pending.transcript);
  }, [sendAnswer]);

  // The load effect below must run once per interview. These callbacks change identity during
  // the session (TTS provider fallback, camera stream arriving), and re-running the load used
  // to reset the room to "processing" mid-turn, leaving the mic button stuck on "Evaluating".
  const loadDepsRef = useRef({ onAiSpeakRequested, callTurn, speakAiQuestion });
  useEffect(() => {
    loadDepsRef.current = { onAiSpeakRequested, callTurn, speakAiQuestion };
  }, [onAiSpeakRequested, callTurn, speakAiQuestion]);

  // Load session on mount (exact to commit 10e50d9)
  useEffect(() => {
    if (!interviewId) return;
    const { onAiSpeakRequested, callTurn, speakAiQuestion } = loadDepsRef.current;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(interviewId)) {
      setTimeout(() => {
        setTranscriptError("Invalid interview ID. Please start a new interview.");
        setTurnState("idle");
        router.push("/");
      }, 0);
      return;
    }

    let cancelled = false;

    async function loadSession() {
      setTurnState("processing");
      setTranscriptError(null);

      console.log("[LOAD SESSION] Loading interview:", interviewId);

      try {
        // Never sit on "Thinking" if the load hangs (cold start, DB pool): time out each
        // attempt and retry once before showing an error.
        const loadOnce = async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12_000);
          try {
            return await fetch(`/api/interviews/transcript?interviewId=${interviewId}`, {
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timer);
          }
        };
        let response: Response;
        try {
          response = await loadOnce();
        } catch {
          if (cancelled) return;
          response = await loadOnce();
        }

        console.log("[LOAD SESSION] Response status:", response.status);

        if (response.status === 404) {
          throw new Error("Interview not found. Please start a new interview.");
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Failed to load session"
          );
        }

        if (cancelled) return;

        const interview = data.interview as InterviewRecord;
        const chunks = (data.chunks ?? []) as TranscriptChunkRecord[];

        console.log("[LOAD SESSION] Loaded interview:", interview.id, "Phase:", interview.currentPhase);

        setJobRole(interview?.jobRole ?? "Software Developer");
        setCurrentPhase(interview?.currentPhase || "intro");
        setCandidateProfile(interview?.feedback?.candidateProfile || null);

        const entries = chunks.map(mapChunkToEntry);
        setTranscript(entries);

        // Derive state strictly from saved transcript data (exact commit 10e50d9)
        if (entries.length === 0) {
          const firstName =
            interview?.feedback?.candidateProfile?.fullName?.split(" ")[0] || "there";
          const defaultGreeting = `Hi ${firstName}, welcome! Can you hear me clearly?`;
          if (!hasPlayedInitialGreetingRef.current) {
            hasPlayedInitialGreetingRef.current = true;
            await speakAiQuestion(defaultGreeting);
          } else {
            setTurnState("user_turn");
          }
          return;
        }

        const lastEntry = entries[entries.length - 1];
        if (lastEntry.speaker === "ai") {
          setTurnState("user_turn");
          if (entries.length === 1 && !hasPlayedInitialGreetingRef.current) {
            hasPlayedInitialGreetingRef.current = true;
            setTurnState("ai_speaking");
            try {
              await onAiSpeakRequested(lastEntry.text);
            } finally {
              setTurnState("user_turn");
            }
          }
        } else {
          setTurnState("processing");
          const lastUserUtterance = lastEntry.text;
          const resumeReqId = `${interviewId}_resume_${entries.length}`;
          void callTurn(lastUserUtterance, entries, resumeReqId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[LOAD SESSION] Error:", error);
          setTranscriptError(
            error instanceof Error
              ? `Failed to load interview session: ${error.message}.`
              : "Failed to load interview session."
          );
          setTurnState("idle");
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [interviewId, router]);

  // Session duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentPhase !== "closed") {
        setElapsedSeconds((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentPhase]);

  return {
    turnState,
    setTurnState,
    currentPhase,
    setCurrentPhase,
    jobRole,
    candidateProfile,
    transcript,
    setTranscript,
    userInput,
    setUserInput,
    isAiThinking,
    transcriptError,
    setTranscriptError,
    aiProvider,
    elapsedSeconds,
    submitAnswer,
    retryLastAnswer,
    canRetry,
    endSession,
    appendTranscript,
    sendClientLatencyLog,
  };
}
