"use client";

import { useState, useRef, useCallback } from "react";

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

  // Stop all active AI speech immediately (Barge-in / Interruption Invariant)
  const stopAiSpeech = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    activeObjectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    activeObjectUrlsRef.current.clear();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsAiSpeaking(false);
  }, []);

  const speakWithSarvam = useCallback(
    async (text: string, onAudioStart?: () => void) => {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speaker: "ritu" }),
      });

      if (!response.ok) {
        throw new Error(`TTS proxy endpoint returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.fallback || !data.audios || data.audios.length === 0) {
        throw new Error(data.reason || "TTS proxy requested fallback to browser TTS");
      }

      // Sequentially play audio chunks with barge-in support
      let chunkIdx = 0;
      for (const audioBase64 of data.audios) {
        const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const audioBlob = new Blob([audioBytes], { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        activeObjectUrlsRef.current.add(audioUrl);

        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            activeObjectUrlsRef.current.delete(audioUrl);
            if (activeAudioRef.current === audio) {
              activeAudioRef.current = null;
            }
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            activeObjectUrlsRef.current.delete(audioUrl);
            if (activeAudioRef.current === audio) {
              activeAudioRef.current = null;
            }
            reject(new Error("Audio playback failed"));
          };
          audio.oncanplaythrough = () => {
            if (activeAudioRef.current === audio) {
              if (chunkIdx === 0 && onAudioStart) {
                onAudioStart();
              }
              onLatencyLog?.("audio_playback_start");
              audio.play().catch(reject);
            }
          };
        });
        chunkIdx++;
      }
    },
    [onLatencyLog]
  );

  const speakWithBrowserTTS = useCallback(
    async (text: string, onAudioStart?: () => void) => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
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
            }, 1000);
          });
        }

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

        await new Promise<void>((resolve, reject) => {
          utterance.onstart = () => {
            if (onAudioStart) onAudioStart();
          };
          utterance.onend = () => resolve();
          utterance.onerror = () => reject(new Error("Browser TTS failed"));
          window.speechSynthesis.speak(utterance);
        });
      } else {
        throw new Error("Browser TTS not supported");
      }
    },
    []
  );

  const speakText = useCallback(
    async (text: string, onAudioStart?: () => void) => {
      if (!text || text.trim().length === 0) return;

      setIsAiSpeaking(true);
      try {
        if (ttsProvider === "sarvam") {
          try {
            await speakWithSarvam(text, onAudioStart);
            return;
          } catch (err) {
            console.warn("[AUDIO PLAYBACK] Sarvam TTS failed, falling back to browser TTS:", err);
            setTtsProvider("browser");
          }
        }
        await speakWithBrowserTTS(text, onAudioStart);
      } finally {
        setIsAiSpeaking(false);
      }
    },
    [ttsProvider, speakWithSarvam, speakWithBrowserTTS]
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
