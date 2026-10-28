"use client";

import { useState, useEffect, useRef } from "react";
import { IntegrityDetector } from "@/src/lib/integrity/detector";
import { INTEGRITY_CONFIG } from "@/src/lib/integrity/config";
import type { IntegrityEvent } from "@/src/schemas/integrity";

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
  const [isTerminated, setIsTerminated] = useState(false);
  const [integrityDebug, setIntegrityDebug] = useState<Record<string, unknown> | null>(null);

  const detectorRef = useRef<IntegrityDetector | null>(null);
  const onTerminateRef = useRef(onTerminate);

  useEffect(() => {
    onTerminateRef.current = onTerminate;
  }, [onTerminate]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !mediaStream || !interviewId) return;
    let detector: IntegrityDetector | null = null;

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
                  `⚠️ Integrity Warning: Sustained ${event.type
                    .replace("_", " ")
                    .toUpperCase()} detected (${data.strikeNumber}/${
                    INTEGRITY_CONFIG.maxStrikes
                  } strikes)`
                );

                // Only speak if session is actively ongoing and not closing/terminated
                if (
                  turnState !== "closed" &&
                  !data.isTerminated &&
                  typeof window !== "undefined" &&
                  "speechSynthesis" in window
                ) {
                  const warnAudio = new SpeechSynthesisUtterance(
                    "Notice: Please keep your eyes on the screen during the interview."
                  );
                  window.speechSynthesis.speak(warnAudio);
                }

                if (data.isTerminated) {
                  setIsTerminated(true);
                  setTimeout(() => {
                    onTerminateRef.current();
                  }, 3000);
                } else {
                  setTimeout(() => {
                    setWarning(null);
                  }, 6000);
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
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, [interviewId, mediaStream, videoRef, turnState]);
  useEffect(() => {
    detectorRef.current?.setAiSpeaking(turnState === "ai_speaking");
  }, [turnState]);

  return {
    strikes,
    warning,
    isTerminated,
    detectorRef,
    integrityDebug,
  };
}
