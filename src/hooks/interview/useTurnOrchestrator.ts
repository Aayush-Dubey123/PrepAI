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
  onAiSpeakRequested: (say: string) => Promise<void>;
  onStopAiSpeech: () => void;
  mediaStream: MediaStream | null;
}

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

  // Append transcript chunk
  const appendTranscript = useCallback(
    async (content: string, speaker: "user" | "ai"): Promise<TranscriptEntry> => {
      if (!interviewId) {
        throw new Error("Missing interview session id");
      }

      const payload = { interviewId, content, speaker };
      const response = await fetch("/api/interviews/transcript/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to append transcript"
        );
      }

      const entry: TranscriptEntry = {
        id: data.chunk?.id || `${Date.now()}`,
        speaker,
        text: content,
        timestamp: new Date(),
      };

      setTranscript((prev) => {
        const optimisticIndex = prev.findIndex(
          (e) => (e.id.startsWith("u-") || e.id.startsWith("ai-")) && e.speaker === speaker && e.text === content
        );
        if (optimisticIndex !== -1) {
          const next = [...prev];
          next[optimisticIndex] = entry;
          return next;
        }
        return [...prev, entry];
      });
      return entry;
    },
    [interviewId]
  );

  // End interview session gracefully
  const endSession = useCallback(
    async (reason: "manual" | "natural" | "integrity" | "cap_reached" = "natural") => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;

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

      try {
        await fetch(`/api/interviews/${interviewId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
      } catch (err) {
        console.warn("[END_SESSION] Feedback generate call failed:", err);
      }

      router.push(`/interview/${interviewId}/feedback`);
    },
    [interviewId, mediaStream, onStopAiSpeech, router]
  );

  // Execute turn
  const callTurn = useCallback(
    async (
      userUtterance: string,
      updatedTranscript: TranscriptEntry[],
      customRequestId?: string
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
      const attemptFetch = async () =>
        fetch(`/api/interviews/${interviewId}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

      try {
        let response = await attemptFetch();

        if (response.status === 429) {
          const data = (await response.json().catch(() => ({}))) as {
            retryAfterSec?: number;
          };
          const waitSec = data.retryAfterSec ?? 5;
          setTranscriptError(`One moment — retrying in ${waitSec}s…`);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          setTranscriptError(null);
          response = await attemptFetch();
        }

        if (response.status === 409) {
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
        setCurrentPhase(turnResp.phase);
        if (turnResp._dev?.provider) setAiProvider(turnResp._dev.provider);

        setIsAiThinking(false);

        const aiEntry: TranscriptEntry = {
          id: `ai-${Date.now()}`,
          speaker: "ai",
          text: turnResp.say,
          timestamp: new Date(),
        };
        setTranscript((prev) => [...prev, aiEntry]);
        void appendTranscript(turnResp.say, "ai").catch((e) =>
          console.warn("[TRANSCRIPT] AI append failed:", e)
        );

        if (turnResp.isComplete) {
          await endSession("natural");
        } else {
          setTurnState("ai_speaking");
          try {
            await onAiSpeakRequested(turnResp.say);
          } finally {
            setTurnState("user_turn");
          }
        }
      } catch (error) {
        console.error("[TURN] Error:", error);
        setIsAiThinking(false);
        setTranscriptError("Couldn't reach the AI — your answer was saved. Tap to retry.");
        setTurnState("user_turn");
      } finally {
        isAttemptingOrchestratorRef.current = false;
      }
    },
    [interviewId, onAiSpeakRequested, endSession, appendTranscript]
  );

  // Submit candidate answer
  const submitAnswer = useCallback(
    async (text?: string) => {
      const finalText = (text || userInput).trim();
      if (!finalText || (turnState !== "user_turn" && turnState !== "ai_speaking")) return;

      onStopAiSpeech?.();
      sendClientLatencyLog("candidate_speech_end");
      setUserInput("");
      setTranscriptError(null);
      setTurnState("processing");

      const localUserEntry: TranscriptEntry = {
        id: `u-${Date.now()}`,
        speaker: "user",
        text: finalText,
        timestamp: new Date(),
      };
      setTranscript((prev) => [...prev, localUserEntry]);
      void appendTranscript(finalText, "user").catch((e) =>
        console.warn("[TRANSCRIPT] user append failed:", e)
      );

      try {
        await callTurn(finalText, [...transcript, localUserEntry]);
      } catch (error) {
        setTranscriptError(
          error instanceof Error
            ? `Failed to send your response: ${error.message}. Please try again or use text input.`
            : "Failed to send your response. Please try again or use text input."
        );
        setTurnState("user_turn");
      }
    },
    [userInput, turnState, onStopAiSpeech, sendClientLatencyLog, appendTranscript, transcript, callTurn]
  );

  // Load session on mount
  useEffect(() => {
    if (!interviewId) return;

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

      try {
        const response = await fetch(
          `/api/interviews/transcript?interviewId=${interviewId}`
        );

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

        setJobRole(interview?.jobRole ?? "Software Developer");
        setCurrentPhase(interview?.currentPhase || "intro");
        setCandidateProfile(interview?.feedback?.candidateProfile || null);

        const entries = chunks.map(mapChunkToEntry);
        setTranscript(entries);

        if (entries.length === 0) {
          const firstName =
            interview?.feedback?.candidateProfile?.fullName?.split(" ")[0] || "there";
          const role = interview?.jobRole || "Software Developer";
          const defaultGreeting = `Hi ${firstName}, welcome! I'm glad you could make it today for your ${role} interview. To get started, could you briefly introduce yourself and share a bit about your technical background and recent projects?`;
          hasPlayedInitialGreetingRef.current = true;
          const entry: TranscriptEntry = {
            id: `${Date.now()}`,
            speaker: "ai",
            text: defaultGreeting,
            timestamp: new Date(),
          };
          setTranscript([entry]);
          void appendTranscript(defaultGreeting, "ai");
          setTurnState("ai_speaking");
          try {
            await onAiSpeakRequested(defaultGreeting);
          } finally {
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
          const resumeReqId = `${interviewId}_resume_${entries.length}`;
          void callTurn(lastEntry.text, entries, resumeReqId);
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
  }, [interviewId, router, onAiSpeakRequested, callTurn]);

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
    endSession,
    appendTranscript,
    sendClientLatencyLog,
  };
}
