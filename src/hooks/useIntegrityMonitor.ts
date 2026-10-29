"use client";

import { useState, useEffect, useRef } from "react";
import { IntegrityDetector } from "@/src/lib/integrity/detector";
import { INTEGRITY_CONFIG } from "@/src/lib/integrity/config";
import type { IntegrityEvent } from "@/src/schemas/integrity";

export interface GuidanceNotice {
  type:
    | "no_face"
    | "multiple_faces"
    | "gaze_away"
    | "tab_switch"
    | "fullscreen_exit"
    | "face_restored"
    | string;
  message: string;
}

export interface UseIntegrityMonitorOptions {
  interviewId?: string;
  mediaStream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  turnState: string;
  onTerminate: () => void;
}

export function useIntegrityMonitor({
  interviewId,
  mediaStream,
  videoRef,
  turnState,
  onTerminate,
}: UseIntegrityMonitorOptions) {
  const [strikes, setStrikes] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<GuidanceNotice | null>(null);
  const [isTerminated, setIsTerminated] = useState(false);
  const [integrityDebug, setIntegrityDebug] = useState<Record<string, unknown> | null>(null);

  const detectorRef = useRef<IntegrityDetector | null>(null);
  const onTerminateRef = useRef(onTerminate);
  const lastGuidanceTimes = useRef<Map<string, number>>(new Map());
  const guidanceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hadFaceAbsence = useRef<boolean>(false);

  useEffect(() => {
    onTerminateRef.current = onTerminate;
  }, [onTerminate]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !mediaStream || !interviewId) return;
    let detector: IntegrityDetector | null = null;

    const triggerGuidance = (notice: GuidanceNotice) => {
      const now = Date.now();
      if (notice.type === "no_face") {
        hadFaceAbsence.current = true;
        const lastTime = lastGuidanceTimes.current.get(notice.type) || 0;
        if (now - lastTime >= 4000) {
          lastGuidanceTimes.current.set(notice.type, now);
          clearTimeout(guidanceTimerRef.current);
          setGuidance(notice);
        }
        return;
      }

      if (notice.type === "face_restored") {
        if (hadFaceAbsence.current) {
          hadFaceAbsence.current = false;
          clearTimeout(guidanceTimerRef.current);
          setGuidance(notice);
          guidanceTimerRef.current = setTimeout(() => {
            setGuidance(null);
          }, 2000);
        }
        return;
      }

      // Transient guidance (tab_switch, fullscreen_exit, gaze_away, multiple_faces): 4s minimum anti-spam
      const lastTime = lastGuidanceTimes.current.get(notice.type) || 0;
      if (now - lastTime < 4000) {
        return;
      }
      lastGuidanceTimes.current.set(notice.type, now);

      clearTimeout(guidanceTimerRef.current);
      setGuidance(notice);
      guidanceTimerRef.current = setTimeout(() => {
        setGuidance(null);
      }, 8000);
    };

    const startDetector = async () => {
      detector = new IntegrityDetector({
        onViolation: async (event: IntegrityEvent) => {
          console.warn("[INTEGRITY_VIOLATION]", event);
          try {
            // Client-side dedup: suppress same event type within 2s
            const dedupKey = `integrity_dedup_${event.type}`;
            const lastSent = parseInt(sessionStorage.getItem(dedupKey) ?? "0", 10);
            if (Date.now() - lastSent < 2000) {
              console.log("[INTEGRITY] Client dedup suppressed:", event.type);
              return;
            }
            sessionStorage.setItem(dedupKey, String(Date.now()));

            // Queue to sessionStorage for resilience across retries
            const queueKey = `integrity_queue_${interviewId}`;
            const queue: IntegrityEvent[] = JSON.parse(
              sessionStorage.getItem(queueKey) ?? "[]"
            );
            queue.push(event);
            sessionStorage.setItem(queueKey, JSON.stringify(queue));

            // Retry loop: up to 3 attempts with exponential backoff
            let res: Response | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {
              if (attempt > 0) {
                await new Promise((r) => setTimeout(r, 1000 * attempt));
              }
              try {
                res = await fetch(`/api/interviews/${interviewId}/integrity`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(event),
                });
                if (res.status === 429) {
                  const rd = (await res.json().catch(() => ({}))) as {
                    retryAfterSec?: number;
                  };
                  const wait = (rd.retryAfterSec ?? 10) * 1000;
                  console.warn(`[INTEGRITY] 429, backing off ${wait}ms`);
                  await new Promise((r) => setTimeout(r, wait));
                  continue;
                }
                break;
              } catch {
                continue; // network error — retry
              }
            }

            if (res?.ok) {
              // Remove from queue on success
              const remaining: IntegrityEvent[] = JSON.parse(
                sessionStorage.getItem(queueKey) ?? "[]"
              ).filter(
                (e: IntegrityEvent) =>
                  !(e.type === event.type && e.timestamp === event.timestamp)
              );
              sessionStorage.setItem(queueKey, JSON.stringify(remaining));

              const data = await res.json();
              if (data.success && !data.deduplicated) {
                setStrikes(data.strikeNumber);
                setWarning(
                  `⚠️ Integrity Strike (${data.strikeNumber}/${
                    INTEGRITY_CONFIG.maxStrikes
                  }): Sustained ${event.type
                    .replace("_", " ")
                    .toUpperCase()} detected`
                );

                // Strictly visual notifications to prevent voice collisions and false barge-in
                if (data.isTerminated) {
                  setIsTerminated(true);
                  setTimeout(() => {
                    onTerminateRef.current();
                  }, 3000);
                } else {
                  setTimeout(() => {
                    setWarning(null);
                  }, 8000);
                }
              }
            } else {
              console.warn(
                "[INTEGRITY] Event queued (will retry on next violation):",
                event.type
              );
            }
          } catch (err) {
            console.error("[INTEGRITY_API_ERROR]", err);
          }
        },
        onFaceDetected: (detected: boolean) => {
          if (detected && hadFaceAbsence.current) {
            triggerGuidance({
              type: "face_restored",
              message: "Face detected • Resumed",
            });
          }
        },
        onGuidanceNudge: (nudge) => {
          triggerGuidance(nudge);
        },
        onDebugFrame: (data) => {
          setIntegrityDebug(data);
        },
      });

      const initialized = await detector.initialize();
      if (initialized && videoElement) {
        const calStr = localStorage.getItem(`integrity_calibration_${interviewId}`);
        if (calStr) {
          try {
            detector.setBaseline(JSON.parse(calStr));
          } catch {}
        }
        detector.start(videoElement);
        detectorRef.current = detector;
      }
    };

    void startDetector();

    return () => {
      detector?.stop();
      detector?.close();
      detectorRef.current = null;
      clearTimeout(guidanceTimerRef.current);
    };
  }, [interviewId, mediaStream, videoRef]);

  useEffect(() => {
    detectorRef.current?.setAiSpeaking(turnState === "ai_speaking");
  }, [turnState]);

  return {
    strikes,
    warning,
    guidance,
    isTerminated,
    detectorRef,
    integrityDebug,
    clearGuidance: () => setGuidance(null),
  };
}
