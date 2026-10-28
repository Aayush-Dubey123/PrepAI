"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseWebcamStreamOptions {
  interviewId?: string;
  enableSnapshot?: boolean;
}

export function useWebcamStream({
  interviewId,
  enableSnapshot = true,
}: UseWebcamStreamOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const snapshotCapturedRef = useRef(false);

  // Single getUserMedia call strictly on mount
  useEffect(() => {
    let isMounted = true;
    let acquiredStream: MediaStream | null = null;

    const startWebcam = async () => {
      try {
        setCameraError(null);
        if (!navigator?.mediaDevices?.getUserMedia) {
          setCameraError("Media devices API not supported by this browser.");
          setIsCameraOn(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        acquiredStream = stream;
        setMediaStream(stream);
      } catch (err: unknown) {
        if (!isMounted) return;
        console.warn("[WEBCAM] getUserMedia error:", err);
        const errorName =
          err && typeof err === "object" && "name" in err ? String(err.name) : "";
        let msg = "Camera access denied";
        if (errorName === "NotAllowedError") {
          msg =
            "Camera permission denied. Click the camera icon in your browser's address bar to allow access.";
        } else if (errorName === "NotFoundError") {
          msg = "No camera found. Please connect a camera and refresh.";
        } else if (errorName === "NotReadableError") {
          msg =
            "Camera is in use by another application. Please close it and try again.";
        }
        setCameraError(msg);
        setIsCameraOn(false);
      }
    };

    void startWebcam();

    return () => {
      isMounted = false;
      if (acquiredStream) {
        acquiredStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Snapshot capture function
  const captureCandidateSnapshot = useCallback(() => {
    if (!videoRef.current || !interviewId) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(video.videoWidth, 640);
      canvas.height = Math.min(video.videoHeight, 480);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        fetch(`/api/interviews/${interviewId}/snapshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: dataUrl }),
        }).catch((err) => console.warn("[SNAPSHOT] Upload error:", err));
      }
    } catch (e) {
      console.warn("[SNAPSHOT] Capture failed:", e);
    }
  }, [interviewId]);

  // Attach srcObject when videoRef and mediaStream are ready
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((e) =>
        console.warn("[WEBCAM] play() failed:", e)
      );

      if (enableSnapshot && !snapshotCapturedRef.current) {
        const timer = setTimeout(() => {
          captureCandidateSnapshot();
          snapshotCapturedRef.current = true;
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [mediaStream, captureCandidateSnapshot, enableSnapshot]);

  return {
    videoRef,
    mediaStream,
    isCameraOn,
    setIsCameraOn,
    cameraError,
    captureCandidateSnapshot,
  };
}
