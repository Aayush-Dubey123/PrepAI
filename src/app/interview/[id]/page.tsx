"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWebcamStream } from "@/src/hooks/useWebcamStream";
import { useAudioPlayback } from "@/src/hooks/useAudioPlayback";
import { useSpeechInput } from "@/src/hooks/useSpeechInput";
import { useSilenceNudge } from "@/src/hooks/useSilenceNudge";
import { useIntegrityMonitor } from "@/src/hooks/useIntegrityMonitor";
import { useTurnOrchestrator } from "@/src/hooks/useTurnOrchestrator";

import { InterviewHeader } from "@/src/components/interview-room/InterviewHeader";
import { InterviewerTile } from "@/src/components/interview-room/InterviewerTile";
import { CandidateTile } from "@/src/components/interview-room/CandidateTile";
import { InterviewControls } from "@/src/components/interview-room/InterviewControls";
import { TranscriptDrawer } from "@/src/components/interview-room/TranscriptDrawer";
import { IntegrityAlertBanner } from "@/src/components/interview-room/IntegrityAlertBanner";
import { EndInterviewModal } from "@/src/components/interview-room/EndInterviewModal";

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
      const supported = Boolean(
        document.fullscreenEnabled ||
          (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
      );
      setIsFullscreenSupported(supported);

      const handleFullscreenChange = () => {
        setIsFullscreen(Boolean(document.fullscreenElement));
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      };
    }
  }, []);

  const handleToggleFullscreen = async () => {
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
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
    async (say: string) => {
      await speakText(say);
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
  const {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    supportsSpeechRecognition,
  } = useSpeechInput({
    onFinalTranscript: (text) => {
      void orchestrator.submitAnswer(text);
    },
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

  // Controls Handlers
  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      if (isAiSpeaking) {
        stopAiSpeech();
      }
      startListening();
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
    stopAiSpeech();
    void orchestrator.submitAnswer(promptText);
  };

  const handleFinishedAnswer = () => {
    if (isListening) {
      stopListening();
    }
    stopAiSpeech();
    const candidateText = (interimTranscript || orchestrator.userInput || "").trim();
    if (candidateText.length > 0) {
      void orchestrator.submitAnswer(candidateText);
    } else {
      void orchestrator.submitAnswer("I have completed my answer. Let's move to the next part.");
    }
  };
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

      {/* 2. Integrity Strike & Guidance Banner */}
      <IntegrityAlertBanner
        warning={warning}
        guidance={guidance}
        isTerminated={isTerminated}
        onRestoreFullscreen={handleToggleFullscreen}
      />

      {/* 3. Main Stage: Twin Tile Layout */}
      <main className="flex-1 min-h-0 p-3 sm:p-6 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch min-h-0 mb-4">
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
        <div className="shrink-0 z-20">
          <InterviewControls
            isListening={isListening}
            isCameraOn={isCameraOn}
            isAiSpeaking={isAiSpeaking}
            isProcessing={orchestrator.turnState === "processing"}
            onToggleMic={handleToggleMic}
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
          void orchestrator.submitAnswer(text);
        }}
        turnState={orchestrator.turnState}
        isAiThinking={orchestrator.isAiThinking}
        onBargeIn={stopAiSpeech}
        transcriptError={orchestrator.transcriptError}
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
