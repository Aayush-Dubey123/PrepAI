"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseAudioPlaybackOptions {
  onLatencyLog?: (stage: "audio_playback_start") => void;
  initialProvider?: "sarvam" | "browser";
}

export function useAudioPlayback({
  onLatencyLog,
  initialProvider = "sarvam",
}: UseAudioPlaybackOptions = {}) {
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<"sarvam" | "browser">(initialProvider);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlsRef = useRef<Set<string>>(new Set());

  // Generation counter, abort controller, and chunk promise resolver to eliminate voice overlaps
  const playbackIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentChunkResolverRef = useRef<(() => void) | null>(null);

  // Stop all active AI speech immediately (Barge-in / Interruption Invariant)
  const stopAiSpeech = useCallback(() => {
    // 1. Advance playbackId to invalidate any in-flight async operations
    playbackIdRef.current++;

    // 2. Abort any pending network fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 3. Resolve any waiting chunk promise so loops unblock and terminate immediately
    if (currentChunkResolverRef.current) {
      currentChunkResolverRef.current();
      currentChunkResolverRef.current = null;
    }

    // 4. Pause and release current Audio element
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.removeAttribute("src");
        activeAudioRef.current.load();
      } catch {}
      activeAudioRef.current = null;
    }

    // 5. Revoke all active blob URLs
    activeObjectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    activeObjectUrlsRef.current.clear();

    // 6. Cancel any browser speech synthesis queue
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    setIsAiSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAiSpeech();
    };
  }, [stopAiSpeech]);

  const speakWithSarvam = useCallback(
    async (text: string, playbackId: number, onAudioStart?: () => void) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let response: Response;
      try {
        response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, speaker: "ritu" }),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        throw err;
      }

      if (playbackIdRef.current !== playbackId) return;

      if (!response.ok) {
        throw new Error(`TTS proxy endpoint returned status ${response.status}`);
      }

      const data = await response.json();
      if (playbackIdRef.current !== playbackId) return;

      if (data.fallback || !data.audios || data.audios.length === 0) {
        throw new Error(data.reason || "TTS proxy requested fallback to browser TTS");
      }

      let chunkIdx = 0;
      for (const audioBase64 of data.audios) {
        if (playbackIdRef.current !== playbackId) break;

        const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const audioBlob = new Blob([audioBytes], { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        activeObjectUrlsRef.current.add(audioUrl);

        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;

        await new Promise<void>((resolve) => {
          let isResolved = false;
          const cleanUpAndResolve = () => {
            if (isResolved) return;
            isResolved = true;
            currentChunkResolverRef.current = null;
            URL.revokeObjectURL(audioUrl);
            activeObjectUrlsRef.current.delete(audioUrl);
            if (activeAudioRef.current === audio) {
              activeAudioRef.current = null;
            }
            resolve();
          };

          currentChunkResolverRef.current = cleanUpAndResolve;

          audio.onended = cleanUpAndResolve;
          audio.onerror = cleanUpAndResolve;
          audio.oncanplaythrough = () => {
            if (playbackIdRef.current === playbackId && activeAudioRef.current === audio) {
              if (chunkIdx === 0 && onAudioStart) {
                onAudioStart();
              }
              onLatencyLog?.("audio_playback_start");
              audio.play().catch(() => cleanUpAndResolve());
            } else {
              cleanUpAndResolve();
            }
          };
        });

        chunkIdx++;
      }
    },
    [onLatencyLog]
  );

  const speakWithBrowserTTS = useCallback(
    async (text: string, playbackId: number, onAudioStart?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        throw new Error("Browser TTS not supported");
      }

      // Purge any stale speech queue first to prevent overlaps
      try {
        window.speechSynthesis.cancel();
      } catch {}

      if (playbackIdRef.current !== playbackId) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 0.9;

      let voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        await new Promise<void>((resolve) => {
          const loadVoices = () => {
            voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
              resolve();
            }
          };
          window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
          setTimeout(() => {
            window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
            resolve();
          }, 500);
        });
      }

      if (playbackIdRef.current !== playbackId) return;

      const maleVoice =
        voices.find(
          (voice) =>
            voice.lang.startsWith("en") &&
            (voice.name.toLowerCase().includes("male") ||
              voice.name.toLowerCase().includes("david") ||
              voice.name.toLowerCase().includes("mark") ||
              voice.name.toLowerCase().includes("james") ||
              voice.name.toLowerCase().includes("daniel"))
        ) || voices.find((voice) => voice.lang.startsWith("en"));

      if (maleVoice) {
        utterance.voice = maleVoice;
      }

      await new Promise<void>((resolve) => {
        let isDone = false;
        const finish = () => {
          if (!isDone) {
            isDone = true;
            currentChunkResolverRef.current = null;
            resolve();
          }
        };

        currentChunkResolverRef.current = () => {
          try {
            window.speechSynthesis.cancel();
          } catch {}
          finish();
        };

        utterance.onstart = () => {
          if (playbackIdRef.current !== playbackId) {
            try {
              window.speechSynthesis.cancel();
            } catch {}
            finish();
            return;
          }
          if (onAudioStart) onAudioStart();
        };

        utterance.onend = finish;
        utterance.onerror = finish;

        window.speechSynthesis.speak(utterance);
      });
    },
    []
  );

  const speakText = useCallback(
    async (text: string, onAudioStart?: () => void) => {
      if (!text || text.trim().length === 0) return;

      // Stop any prior speech and increment playback token
      stopAiSpeech();
      const playbackId = playbackIdRef.current;

      setIsAiSpeaking(true);
      try {
        if (ttsProvider === "sarvam") {
          try {
            await speakWithSarvam(text, playbackId, onAudioStart);
            return;
          } catch (err) {
            if (playbackIdRef.current !== playbackId) return;
            console.warn("[AUDIO PLAYBACK] Sarvam TTS failed, falling back to browser TTS:", err);
            setTtsProvider("browser");
          }
        }
        if (playbackIdRef.current === playbackId) {
          await speakWithBrowserTTS(text, playbackId, onAudioStart);
        }
      } finally {
        if (playbackIdRef.current === playbackId) {
          setIsAiSpeaking(false);
        }
      }
    },
    [ttsProvider, speakWithSarvam, speakWithBrowserTTS, stopAiSpeech]
  );

  return {
    isAiSpeaking,
    setIsAiSpeaking,
    speakText,
    stopAiSpeech,
    activeAudioRef,
    ttsProvider,
    setTtsProvider,
    speakWithSarvam,
    speakWithBrowserTTS,
  };
}
