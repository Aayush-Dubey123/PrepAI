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

  // Append transcript chunk (exact to commit 10e50d9)
  const appendTranscript = useCallback(
    async (content: string, speaker: "user" | "ai"): Promise<TranscriptEntry> => {
      if (!interviewId) {
        throw new Error("Missing interview session id");
      }

      const payload = { interviewId, content, speaker };
      console.log("[TRANSCRIPT APPEND] Payload:", payload);

      const response = await fetch("/api/interviews/transcript/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("[TRANSCRIPT APPEND] Response:", data);

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to persist transcript"
        );
      }

      const entry = mapChunkToEntry(data as TranscriptChunkRecord);
      setTranscript((prev) => [...prev, entry]);
      return entry;
    },
    [interviewId]
  );

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

      try {
        fetch(`/api/interviews/${interviewId}/feedback/generate`, {
          method: "POST",
        }).catch((e) => console.warn("[END_SESSION] Feedback trigger error:", e));
      } catch {}

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

      try {
        await onAiSpeakRequested(questionText, () => {
          void triggerTextDisplay();
        });
        await triggerTextDisplay();
      } catch (error) {
        console.warn("[SPEAK AI] Audio playback error, falling back to text display:", error);
        await triggerTextDisplay();
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
      console.log("[TURN] Calling /turn, reqId:", clientRequestId, "utterance:", userUtterance.slice(0, 80));

      const attemptFetch = async () =>
        fetch(`/api/interviews/${interviewId}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

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
        setTranscriptError("Couldn't reach the AI — your answer was saved. Tap to retry.");
        setTurnState("user_turn");
      } finally {
        isAttemptingOrchestratorRef.current = false;
      }
    },
    [interviewId, endSession, speakAiQuestion]
  );

  // Submit candidate answer (exact to commit 10e50d9)
  const submitAnswer = useCallback(
    async (text?: string) => {
      const finalText = (text || userInput).trim();
      if (!finalText || (turnState !== "user_turn" && turnState !== "ai_speaking")) return;

      onStopAiSpeech?.();
      sendClientLatencyLog("candidate_speech_end");
      setUserInput("");
      setTranscriptError(null);
      setTurnState("processing");

      try {
        const newEntry = await appendTranscript(finalText, "user");
        const updatedTranscript = [...transcript, newEntry];
        await callTurn(finalText, updatedTranscript);
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

  // Load session on mount (exact to commit 10e50d9)
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

      console.log("[LOAD SESSION] Loading interview:", interviewId);

      try {
        const response = await fetch(
          `/api/interviews/transcript?interviewId=${interviewId}`
        );

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
          const defaultGreeting = `Hi ${firstName}, welcome! I'm glad you could make it today. Before we begin, is there anything you'd like to check on your end — audio, video, anything like that?`;
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
  }, [interviewId, router, onAiSpeakRequested, callTurn, speakAiQuestion]);

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
