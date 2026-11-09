"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useWebcamStream } from "@/src/hooks/proctoring/useWebcamStream";
import { useAudioPlayback } from "@/src/hooks/audio/useAudioPlayback";
import { useSpeechInput } from "@/src/hooks/audio/useSpeechInput";
import { useSilenceNudge } from "@/src/hooks/interview/useSilenceNudge";
import { useIntegrityMonitor } from "@/src/hooks/proctoring/useIntegrityMonitor";
import { useTurnOrchestrator } from "@/src/hooks/interview/useTurnOrchestrator";

import { InterviewHeader } from "@/src/components/interview-room/chrome/InterviewHeader";
import { InterviewerTile } from "@/src/components/interview-room/tiles/InterviewerTile";
import { CandidateTile } from "@/src/components/interview-room/tiles/CandidateTile";
import { InterviewControls } from "@/src/components/interview-room/controls/InterviewControls";
import { TranscriptDrawer } from "@/src/components/interview-room/controls/TranscriptDrawer";
import { IntegrityAlertBanner } from "@/src/components/interview-room/chrome/IntegrityAlertBanner";
import { EndInterviewModal } from "@/src/components/interview-room/modals/EndInterviewModal";

export default function InterviewStagePage() {
  const params = useParams<{ id: string }>();
  const interviewId = params.id;

  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);

  // Fullscreen Proctoring Mode Controller
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(true);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const doc = document as unknown as {
        fullscreenEnabled?: boolean;
        webkitFullscreenEnabled?: boolean;
        mozFullScreenEnabled?: boolean;
        msFullscreenEnabled?: boolean;
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };

      const supported = Boolean(
        doc.fullscreenEnabled ||
        doc.webkitFullscreenEnabled ||
        doc.mozFullScreenEnabled ||
        doc.msFullscreenEnabled
      );
      setIsFullscreenSupported(supported);

      const handleFullscreenChange = () => {
        const docObj = document as unknown as {
          fullscreenElement?: Element;
          webkitFullscreenElement?: Element;
          mozFullScreenElement?: Element;
          msFullscreenElement?: Element;
        };
        setIsFullscreen(Boolean(
          docObj.fullscreenElement ||
          docObj.webkitFullscreenElement ||
          docObj.mozFullScreenElement ||
          docObj.msFullscreenElement
        ));
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.addEventListener("mozfullscreenchange", handleFullscreenChange);
      document.addEventListener("MSFullscreenChange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
        document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      };
    }
  }, []);

  const handleToggleFullscreen = async () => {
    if (typeof document === "undefined") return;
    try {
      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };
      const docEl = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      const isFs = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isFs) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("[FULLSCREEN] Toggle failed or blocked by policy:", err);
    }
  };
  const { isAiSpeaking, speakText, stopAiSpeech } = useAudioPlayback({
    onLatencyLog: (stage) => {
      orchestrator.sendClientLatencyLog(stage);
    },
  });

  // 2. Webcam Stream Controller (Invariant: mediaStream acquired ONCE; toggle alters visibility only)
  const { videoRef, mediaStream, isCameraOn, setIsCameraOn } = useWebcamStream({
    interviewId,
    enableSnapshot: true,
  });

  // Handle AI speech request from orchestrator
  const handleAiSpeakRequested = useCallback(
    async (say: string, onAudioStart?: () => void) => {
      await speakText(say, onAudioStart);
    },
    [speakText]
  );

  // 3. Turn Progression Orchestrator
  const orchestrator = useTurnOrchestrator({
    interviewId,
    onAiSpeakRequested: handleAiSpeakRequested,
    onStopAiSpeech: stopAiSpeech,
    mediaStream,
  });

  // 4. Speech Recognition Controller (Invariant: explicit user initiation via button or [M]; instantaneous barge-in)
  // Speech builds a draft; it is only submitted by an explicit action (Finished answer,
  // Enter in the drawer, quick prompt), never on silence.
  const {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    takeDraft,
    stopAndTakeDraft,
    discardDraft,
    supportsSpeechRecognition,
    transcriptError: speechError,
  } = useSpeechInput({
    onBargeIn: stopAiSpeech,
    enabled: orchestrator.turnState === "user_turn" || orchestrator.turnState === "ai_speaking",
  });

  // 5. Silence Nudge Controller (Invariant: 12-second inactivity hint, NEVER auto-submits)
  const { showSilenceHint } = useSilenceNudge({
    turnState: orchestrator.turnState,
    userInput: orchestrator.userInput,
    timeoutMs: 12000,
  });

  // 6. Integrity Proctoring Controller (Invariant: 3 strikes auto-termination)
  const handleIntegrityTerminate = useCallback(() => {
    void orchestrator.endSession("integrity");
  }, [orchestrator]);

  const { strikes, warning, guidance, isTerminated } = useIntegrityMonitor({
    interviewId,
    mediaStream,
    videoRef,
    turnState: orchestrator.turnState,
    onTerminate: handleIntegrityTerminate,
  });
  // Manual push-to-talk: the mic never turns on by itself. The candidate presses the mic
  // button to start answering and presses it again to stop; stopping sends the answer to
  // the AI, which evaluates it and asks the next question.
  const [isSendingAnswer, setIsSendingAnswer] = useState(false);

  // Controls Handlers
  const handleToggleMic = async () => {
    if (isSendingAnswer || orchestrator.turnState === "processing") return;

    if (!isListening) {
      if (isAiSpeaking) {
        stopAiSpeech();
      }
      startListening();
      return;
    }

    setIsSendingAnswer(true);
    try {
      const spoken = await stopAndTakeDraft();
      const answer = [spoken, orchestrator.userInput.trim()].filter(Boolean).join(" ");
      if (answer.length > 0) {
        orchestrator.setTranscriptError(null);
        void orchestrator.submitAnswer(answer);
      } else {
        orchestrator.setTranscriptError(
          "We didn't catch anything. Press the mic and try again, or type your answer in the transcript."
        );
      }
    } finally {
      setIsSendingAnswer(false);
    }
  };

  const handleToggleCamera = () => {
    // Invariant: Modifies visibility only; underlying MediaStream tracks remain active for MediaPipe
    setIsCameraOn((prev) => !prev);
  };

  const handleQuickPrompt = (promptText: string) => {
    if (isListening) {
      stopListening();
    }
    discardDraft();
    stopAiSpeech();
    void orchestrator.submitAnswer(promptText);
  };

  const handleFinishedAnswer = () => {
    if (isListening) {
      stopListening();
    }
    stopAiSpeech();
    // takeDraft() returns the spoken answer once and clears it, so it can't be sent twice.
    const candidateText = [takeDraft(), orchestrator.userInput.trim()].filter(Boolean).join(" ");
    if (candidateText.length > 0) {
      void orchestrator.submitAnswer(candidateText);
    } else {
      void orchestrator.submitAnswer("I have completed my answer. Let's move to the next part.");
    }
  };

  // Keyboard shortcut for mic (M key) from commit 10e50d9 — uses refs to avoid stale closures
  const isListeningRef = useRef(false);
  const turnStateRef = useRef(orchestrator.turnState);
  const handleToggleMicRef = useRef(handleToggleMic);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    turnStateRef.current = orchestrator.turnState;
  }, [orchestrator.turnState]);

  useEffect(() => {
    handleToggleMicRef.current = handleToggleMic;
  }, [handleToggleMic]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (turnStateRef.current === "processing") {
          return;
        }
        void handleToggleMicRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const handleConfirmEndInterview = async () => {
    setIsEndingSession(true);
    await orchestrator.endSession("manual");
  };

  const candidateName =
    orchestrator.candidateProfile?.fullName?.split(" ")[0] || "Candidate";

  // Extract latest AI message accurately for persistent interviewer dialogue card
  const latestAiEntry = orchestrator.transcript
    .slice()
    .reverse()
    .find((entry) => entry.speaker === "ai");
  const currentPrompt = latestAiEntry ? latestAiEntry.text : null;
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col bg-[#f4f6fa] text-[#0f172a] font-sans select-none relative">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.06) 0%, transparent 70%)",
        }}
      />

      {/* 1. Header Ribbon */}
      <InterviewHeader
        jobRole={orchestrator.jobRole}
        currentPhase={orchestrator.currentPhase}
        elapsedSeconds={orchestrator.elapsedSeconds}
        strikes={strikes}
        maxStrikes={3}
        onEndCall={() => setShowEndModal(true)}
        aiProvider={orchestrator.aiProvider}
        isFullscreen={isFullscreen}
        isFullscreenSupported={isFullscreenSupported}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Fullscreen Focus Prompt Bar (if entered without fullscreen) */}
      {!isFullscreen && isFullscreenSupported && (
        <div className="bg-[#4f46e5] text-white px-3 sm:px-6 py-2 text-xs flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Proctored Session:</span>
            <span className="hidden sm:inline">Please remain in fullscreen mode for continuous proctoring focus.</span>
          </div>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="px-2.5 py-1 rounded-md bg-white text-[#4f46e5] font-semibold text-xs hover:bg-indigo-50 transition-colors cursor-pointer shadow-xs"
          >
            Enter Fullscreen
          </button>
        </div>
      )}

      {/* 2. Integrity Strike & Guidance Banner */}
      <IntegrityAlertBanner
        warning={warning}
        guidance={guidance}
        isTerminated={isTerminated}
        onRestoreFullscreen={handleToggleFullscreen}
      />

      {/* 3. Main Stage: Twin Tile Layout */}
      <main className="flex-1 min-h-0 p-2.5 sm:p-4 md:p-6 flex flex-col md:justify-between overflow-y-auto md:overflow-hidden">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-stretch md:min-h-0 mb-3 md:mb-4">
          {/* Left Tile: AI Interviewer */}
          <InterviewerTile
            turnState={orchestrator.turnState}
            isAiThinking={orchestrator.isAiThinking}
            aiProvider={orchestrator.aiProvider}
            currentPrompt={currentPrompt}
            currentPhase={orchestrator.currentPhase}
          />

          {/* Right Tile: Candidate Camera & Feed */}
          <CandidateTile
            videoRef={videoRef}
            candidateName={candidateName}
            isCameraOn={isCameraOn}
            isListening={isListening}
            showSilenceHint={showSilenceHint}
            mediaStream={mediaStream}
          />
        </div>

        {/* 4. Bottom Controls Dock */}
        <div className="sticky bottom-0 z-30 shrink-0 pointer-events-auto bg-[#f4f6fa]/95 md:bg-white/80 backdrop-blur-md py-1.5 md:py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 md:mx-0 md:px-0">
          <InterviewControls
            isListening={isListening}
            isCameraOn={isCameraOn}
            isAiSpeaking={isAiSpeaking}
            isProcessing={orchestrator.turnState === "processing" || isSendingAnswer}
            onToggleMic={() => void handleToggleMic()}
            onToggleCamera={handleToggleCamera}
            onToggleTranscript={() => setIsTranscriptOpen((prev) => !prev)}
            isTranscriptOpen={isTranscriptOpen}
            onQuickPrompt={handleQuickPrompt}
            onFinishedAnswer={handleFinishedAnswer}
            onEndCall={() => setShowEndModal(true)}
            supportsSpeechRecognition={supportsSpeechRecognition}
          />
        </div>
      </main>

      {/* 5. Slide-Over Transcript Drawer */}
      <TranscriptDrawer
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
        transcript={orchestrator.transcript}
        interimTranscript={interimTranscript}
        userInput={orchestrator.userInput}
        onUserInputChange={orchestrator.setUserInput}
        onSubmit={(text) => {
          stopAiSpeech();
          if (isListening) stopListening();
          const typed = (text ?? orchestrator.userInput).trim();
          const combined = [takeDraft(), typed].filter(Boolean).join(" ");
          if (combined) void orchestrator.submitAnswer(combined);
        }}
        turnState={orchestrator.turnState}
        isAiThinking={orchestrator.isAiThinking}
        onBargeIn={stopAiSpeech}
        transcriptError={orchestrator.transcriptError ?? speechError}
        canRetry={orchestrator.canRetry}
        onRetry={() => void orchestrator.retryLastAnswer()}
      />

      {/* 6. End Interview Confirmation Modal */}
      <EndInterviewModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onConfirm={handleConfirmEndInterview}
        isSubmitting={isEndingSession}
      />
    </div>
  );
}
