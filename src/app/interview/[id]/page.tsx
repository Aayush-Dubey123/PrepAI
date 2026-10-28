"use client";

import { useState, useCallback } from "react";
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

  // 1. Audio Playback Controller (Barge-in + Sarvam/Browser TTS)
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
    enabled: orchestrator.turnState === "user_turn",
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

  const { strikes, warning, isTerminated } = useIntegrityMonitor({
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
      startListening();
    }
  };

  const handleToggleCamera = () => {
    // Invariant: Modifies visibility only; underlying MediaStream tracks remain active for MediaPipe
    setIsCameraOn((prev) => !prev);
  };

  const handleQuickPrompt = (promptText: string) => {
    stopAiSpeech();
    void orchestrator.submitAnswer(promptText);
  };

  const handleConfirmEndInterview = async () => {
    setIsEndingSession(true);
    await orchestrator.endSession("manual");
  };

  const candidateName =
    orchestrator.candidateProfile?.fullName?.split(" ")[0] || "Candidate";

  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col bg-[#09090b] text-[#fafafa] font-sans select-none relative">
      {/* 1. Header Ribbon */}
      <InterviewHeader
        jobRole={orchestrator.jobRole}
        currentPhase={orchestrator.currentPhase}
        elapsedSeconds={orchestrator.elapsedSeconds}
        strikes={strikes}
        maxStrikes={3}
        onEndCall={() => setShowEndModal(true)}
        aiProvider={orchestrator.aiProvider}
      />

      {/* 2. Integrity Strike Alert Banner */}
      <IntegrityAlertBanner warning={warning} isTerminated={isTerminated} />

      {/* 3. Main Stage: Twin Tile Layout */}
      <main className="flex-1 min-h-0 p-3 sm:p-6 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch min-h-0 mb-4">
          {/* Left Tile: AI Interviewer */}
          <InterviewerTile
            turnState={orchestrator.turnState}
            isAiThinking={orchestrator.isAiThinking}
            aiProvider={orchestrator.aiProvider}
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
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onToggleTranscript={() => setIsTranscriptOpen((prev) => !prev)}
            isTranscriptOpen={isTranscriptOpen}
            onQuickPrompt={handleQuickPrompt}
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
