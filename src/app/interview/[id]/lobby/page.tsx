"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { IntegrityDetector } from "@/src/lib/integrity/detector";
import { MicCheck } from "@/src/components/lobby/MicCheck";
import { SpeakerCheck } from "@/src/components/lobby/SpeakerCheck";
import { SpeechCheck } from "@/src/components/lobby/SpeechCheck";
import { CameraCalibrationCheck } from "@/src/components/lobby/CameraCalibrationCheck";
import { ReadinessBar } from "@/src/components/lobby/ReadinessBar";
import { Sparkles, AlertCircle } from "lucide-react";

export default function InterviewLobbyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const interviewId = params.id;

  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "pending">("pending");
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "pending">("pending");
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Checks completion flags
  const [speakerWorks, setSpeakerWorks] = useState(false);
  const [speechRecognized, setSpeechRecognized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  // Integrity Calibration
  const [integrityConsent, setIntegrityConsent] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(() => {
    if (typeof window === "undefined" || !interviewId) return false;
    try {
      const stored = localStorage.getItem(`integrity_calibration_${interviewId}`);
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      return parsed.baselineYaw !== undefined && parsed.baselinePitch !== undefined;
    } catch {
      return false;
    }
  });
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationFeedback, setCalibrationFeedback] = useState<string | null>(null);

  // Research mode
  const isResearchMode = process.env.NEXT_PUBLIC_RESEARCH_MODE === "true";
  const [researchConsent, setResearchConsent] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<IntegrityDetector | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastAudioUpdateRef = useRef<number>(0);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  // Validation on mount + prewarming
  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!interviewId || !uuidRegex.test(interviewId)) {
      setTimeout(() => {
        setError("Invalid interview ID. Redirecting to home...");
        router.push("/");
      }, 0);
      return;
    }

    const validateInterview = async () => {
      try {
        const response = await fetch(`/api/interviews/transcript?interviewId=${interviewId}`);
        if (response.status === 404) {
          setError("Interview not found. Redirecting to home...");
          setTimeout(() => router.push("/"), 2000);
          return;
        }
        if (!response.ok) {
          setError("Failed to validate interview. Please try again.");
          return;
        }
        setIsValidating(false);

        // Prewarm interview topics and provider pool
        fetch(`/api/interviews/${interviewId}/prewarm`, { method: "POST" }).catch((e) => {
          console.warn("[LOBBY] Background prewarm triggered (non-blocking):", e);
        });
      } catch (err) {
        console.error("[LOBBY] Validation error:", err);
        setError("Failed to validate interview session.");
      }
    };

    void validateInterview();

    if (typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ||
        ("webkitAudioContext" in window
          ? (window.webkitAudioContext as typeof AudioContext)
          : undefined);
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (microphoneRef.current) {
        microphoneRef.current.getTracks().forEach((track) => track.stop());
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (detectorRef.current) {
        detectorRef.current.stop();
        detectorRef.current.close();
        detectorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [interviewId, router]);

  // Video element attach
  useEffect(() => {
    if (videoRef.current && cameraStream && isCameraOn) {
      videoRef.current.srcObject = cameraStream;

      let active = true;
      const setupDetector = async () => {
        if (!detectorRef.current) {
          const detector = new IntegrityDetector({
            onViolation: () => {},
          });
          const ok = await detector.initialize();
          if (!active) {
            detector.close();
            return;
          }
          if (ok && videoRef.current) {
            detector.start(videoRef.current);
            if (canvasRef.current) {
              detector.attachCanvas(canvasRef.current, "Candidate");
            }
            detectorRef.current = detector;
          }
        }
      };

      void setupDetector();

      return () => {
        active = false;
      };
    }
  }, [cameraStream, isCameraOn]);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const update = (time: number) => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      // Throttle React state updates to ~15fps (every 66ms) instead of 60fps
      if (time - lastAudioUpdateRef.current > 66) {
        lastAudioUpdateRef.current = time;
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average);
      }

      if (microphoneRef.current) {
        animFrameRef.current = requestAnimationFrame(update);
      }
    };

    animFrameRef.current = requestAnimationFrame(update);
  }, []);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneRef.current = stream;
      setMicPermission("granted");
      setIsMicOn(true);
      setError(null);

      if (audioContextRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        updateAudioLevel();
      }
    } catch (err) {
      console.warn("Mic permission denied:", err);
      setMicPermission("denied");
      setIsMicOn(false);
      setError("Microphone permission denied. You can continue with text input.");
    }
  };

  const toggleMic = async () => {
    if (isMicOn && microphoneRef.current) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      microphoneRef.current.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      setIsMicOn(false);
      setAudioLevel(0);
    } else {
      await startMic();
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setCameraPermission("granted");
      setError(null);
    } catch (err) {
      console.warn("Camera permission denied:", err);
      setCameraPermission("denied");
      setIsCameraOn(false);
      setError("Camera permission denied or camera unavailable.");
    }
  };

  const toggleCamera = async () => {
    if (isCameraOn && cameraStream) {
      if (detectorRef.current) {
        detectorRef.current.stop();
        detectorRef.current.close();
        detectorRef.current = null;
      }
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraStream(null);
    } else {
      await startCamera();
    }
  };

  const run3sCalibration = async () => {
    if (!isCameraOn || cameraPermission !== "granted" || !videoRef.current) {
      setError("Please enable camera before starting alignment calibration.");
      return;
    }

    setIsCalibrating(true);
    setCalibrationProgress(0);
    setCalibrationFeedback(null);
    setError(null);

    try {
      let detector = detectorRef.current;
      if (!detector) {
        detector = new IntegrityDetector({ onViolation: () => {} });
        await detector.initialize();
        detector.start(videoRef.current);
        if (canvasRef.current) {
          detector.attachCanvas(canvasRef.current, "Candidate");
        }
        detectorRef.current = detector;
      }

      const calData = await detector.calibrateWindow(
        videoRef.current,
        3000,
        (progressPercent, feedbackMsg) => {
          setCalibrationProgress(progressPercent);
          if (feedbackMsg) {
            setCalibrationFeedback(feedbackMsg);
          }
        }
      );

      setIsCalibrated(true);
      setIsCalibrating(false);
      setCalibrationFeedback(null);
      localStorage.setItem(`integrity_calibration_${interviewId}`, JSON.stringify(calData));
    } catch (err: unknown) {
      console.warn("[LOBBY] Alignment calibration failed:", err);
      setIsCalibrated(false);
      setIsCalibrating(false);
      setCalibrationProgress(0);
      const feedbackMsg =
        err instanceof Error ? err.message : "Move to center & look at camera";
      setCalibrationFeedback(feedbackMsg);
    }
  };

  // Compute completed checks count
  const isMicCheckComplete = micPermission === "granted";
  const isSpeakerCheckComplete = speakerWorks;
  const isSpeechCheckComplete = speechRecognized;
  const isCameraCheckComplete = isCalibrated || (isCameraOn && cameraPermission === "granted");

  const completedChecksCount = [
    isMicCheckComplete,
    isSpeakerCheckComplete,
    isSpeechCheckComplete,
    isCameraCheckComplete,
  ].filter(Boolean).length;

  const canEnter =
    !isValidating &&
    integrityConsent &&
    (!isResearchMode || researchConsent) &&
    completedChecksCount >= 2; // generous minimum for accessibility, with full readiness highlighted

  const handleEnterStage = () => {
    router.push(`/interview/${interviewId}`);
  };

  const handleSkip = () => {
    router.push(`/interview/${interviewId}`);
  };

  return (
    <main className="h-[calc(100dvh-3.5rem)] bg-[#f4f6fa] text-[#0f172a] p-2.5 sm:p-3 md:p-4 flex flex-col justify-between overflow-y-auto relative select-none">
      <div className="relative z-10 max-w-5xl xl:max-w-6xl mx-auto w-full flex-1 flex flex-col justify-between gap-2 sm:gap-2.5 min-h-0">
        {/* Header Ribbon */}
        <div className="text-center sm:text-left space-y-0.5 shrink-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#c7d2fe] bg-[#e0e7ff] px-2.5 py-0.5 text-[11px] font-mono text-[#4338ca]">
            <Sparkles className="w-3 h-3 text-[#4f46e5]" />
            <span>PRE-FLIGHT HARDWARE CALIBRATION</span>
          </div>
          <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-[#0f172a]">
            Audio, Voice & Camera Calibration
          </h1>
          <p className="text-[11px] sm:text-xs text-[#64748b]">
            Verify microphone responsiveness, audio playback, speech recognition, and face orientation before entering your live interview.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Asymmetric 2-Column Hardware Verification Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0 items-stretch">
          {/* Left Column: 3 Audio & Voice Checks Stacked */}
          <div className="md:col-span-5 lg:col-span-5 flex flex-col gap-2 sm:gap-2.5 justify-between min-h-0">
            <MicCheck
              isMicOn={isMicOn}
              audioLevel={audioLevel}
              onToggleMic={toggleMic}
              isGranted={micPermission === "granted"}
            />

            <SpeakerCheck
              onConfirmed={() => setSpeakerWorks(true)}
              isConfirmed={speakerWorks}
            />

            <SpeechCheck
              onSuccess={() => setSpeechRecognized(true)}
              isPassed={speechRecognized}
            />
          </div>

          {/* Right Column: Camera & Face Alignment Card (Spans Full Height) */}
          <div className="md:col-span-7 lg:col-span-7 flex flex-col min-h-0">
            <CameraCalibrationCheck
              videoRef={videoRef}
              canvasRef={canvasRef}
              isCameraOn={isCameraOn}
              cameraPermission={cameraPermission}
              onToggleCamera={toggleCamera}
              onRunCalibration={run3sCalibration}
              isCalibrating={isCalibrating}
              isCalibrated={isCalibrated}
              calibrationProgress={calibrationProgress}
              calibrationFeedback={calibrationFeedback}
            />
          </div>
        </div>

        {/* Readiness Bar & Stage Entry Action */}
        <ReadinessBar
          completedCount={completedChecksCount}
          totalChecks={4}
          canEnter={canEnter}
          onEnter={handleEnterStage}
          onSkip={handleSkip}
          integrityConsent={integrityConsent}
          onToggleIntegrityConsent={setIntegrityConsent}
          isResearchMode={isResearchMode}
          researchConsent={researchConsent}
          onToggleResearchConsent={setResearchConsent}
        />
      </div>
    </main>
  );
}
