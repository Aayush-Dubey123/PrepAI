"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/src/lib/core/utils";

export interface AudioVisualizerProps {
  stream?: MediaStream | null;
  analyser?: AnalyserNode | null;
  isSpeaking?: boolean;
  volume?: number;
  barCount?: number;
  barColor?: string;
  activeColor?: string;
  className?: string;
  height?: number;
}

export function AudioVisualizer({
  stream,
  analyser: externalAnalyser,
  isSpeaking = false,
  volume = 0,
  barCount = 20,
  barColor = "rgba(168, 85, 247, 0.4)",
  activeColor = "rgba(168, 85, 247, 0.9)",
  className,
  height = 36,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Setup Web Audio when stream is provided and no external analyser is present
  useEffect(() => {
    if (externalAnalyser) {
      analyserRef.current = externalAnalyser;
      return;
    }

    if (!stream) {
      analyserRef.current = null;
      return;
    }


    try {
      const AudioCtx =
        window.AudioContext ||
        ("webkitAudioContext" in window
          ? (window.webkitAudioContext as typeof AudioContext)
          : undefined);
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Check if stream has audio tracks
      if (stream.getAudioTracks().length > 0) {
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;
      }
      // AudioContext may fail if permissions or unsupported
    } catch {
      // AudioContext may fail if permissions or unsupported
    }

    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
        sourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch {}
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [stream, externalAnalyser]);

  // Main 60fps render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      const count = barCount;
      const barWidth = Math.max(2, (width / count) * 0.55);
      const gap = (width - count * barWidth) / (count - 1 || 1);

      const analyser = analyserRef.current;
      const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < count; i++) {
        let barHeightRatio = 0.15;

        if (dataArray && dataArray.length > 0) {
          const sampleIndex = Math.floor((i / count) * (dataArray.length / 2));
          const val = dataArray[sampleIndex] || 0;
          barHeightRatio = Math.max(0.1, val / 255);
        } else if (isSpeaking) {
          // Synthetic dynamic wave when isSpeaking is active
          const wave = Math.sin(phase + (i / count) * Math.PI * 2) * 0.4 + 0.5;
          barHeightRatio = Math.max(0.15, wave * 0.85);
        } else if (volume > 0) {
          // Static or prop-driven volume wave
          const normVol = Math.min(1, Math.max(0, volume > 1 ? volume / 100 : volume));
          const variance = Math.sin((i / count) * Math.PI) * 0.4 + 0.6;
          barHeightRatio = Math.max(0.1, normVol * variance);
        }

        const barH = Math.max(3, barHeightRatio * (h - 4));
        const x = i * (barWidth + gap);
        const y = (h - barH) / 2;

        // Draw rounded pill bar
        ctx.fillStyle = isSpeaking || barHeightRatio > 0.25 ? activeColor : barColor;
        ctx.beginPath();
        const radius = barWidth / 2;
        ctx.roundRect(x, y, barWidth, barH, radius);
        ctx.fill();
      }

      phase += 0.08;
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [barCount, barColor, activeColor, isSpeaking, volume]);

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        width={barCount * 8}
        height={height}
        className="speech-visualizer-canvas"
      />
    </div>
  );
}
