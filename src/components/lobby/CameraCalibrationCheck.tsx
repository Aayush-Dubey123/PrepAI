"use client";

import React from "react";
import { Camera, CameraOff, CheckCircle2, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";

export interface CameraCalibrationCheckProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isCameraOn: boolean;
  cameraPermission: "granted" | "denied" | "pending";
  onToggleCamera: () => void;
  onRunCalibration: () => void;
  isCalibrating: boolean;
  isCalibrated: boolean;
  calibrationProgress: number;
  calibrationFeedback: string | null;
}

export function CameraCalibrationCheck({
  videoRef,
  canvasRef,
  isCameraOn,
  cameraPermission,
  onToggleCamera,
  onRunCalibration,
  isCalibrating,
  isCalibrated,
  calibrationProgress,
  calibrationFeedback,
}: CameraCalibrationCheckProps) {
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#eef2ff] border border-[#e0e7ff] flex items-center justify-center text-[#4f46e5]">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">4. Camera & Centering Alignment</h3>
            <p className="text-xs text-[#64748b]">Align face inside the oval and calibrate baseline gaze</p>
          </div>
        </div>

        <Badge variant={isCalibrated ? "success" : isCameraOn ? "purple" : "neutral"}>
          {isCalibrated ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Calibrated
            </span>
          ) : isCameraOn ? (
            "Camera Live"
          ) : (
            "Camera Off"
          )}
        </Badge>
      </div>

      {/* Video Preview Frame */}
      <div className="relative h-32 sm:h-36 w-full rounded-xl overflow-hidden bg-[#0d0e12] border border-white/10">
        {/* Actual Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover -scale-x-100 transition-opacity duration-300 ${
            isCameraOn ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* MediaPipe Annotation Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100"
        />

        {/* Centering Oval Guide */}
        {isCameraOn && (
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed rounded-full max-w-[160px] max-h-[190px] mx-auto my-auto transition-colors ${
              isCalibrated
                ? "border-emerald-500/50 bg-emerald-500/[0.03]"
                : isCalibrating
                ? "border-purple-500/80 bg-purple-500/[0.08] animate-pulse"
                : "border-white/20 bg-white/[0.02]"
            }`}
          >
            <span className="text-[10px] text-white/50 font-mono tracking-wider">
              {isCalibrated ? "ALIGNED" : "CENTER FACE HERE"}
            </span>
          </div>
        )}

        {/* Fallback when camera is off - Centered */}
        {!isCameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1.5 text-neutral-500 text-center pointer-events-none">
            <CameraOff className="w-8 h-8 stroke-[1.5]" />
            <span className="text-xs">Camera preview is inactive</span>
          </div>
        )}
      </div>

      {/* Calibration feedback / progress */}
      {isCalibrating && (
        <div className="space-y-2 pt-1 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-400 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              Registering baseline orientation (3s)...
            </span>
            <span className="text-neutral-400 font-mono">{calibrationProgress}%</span>
          </div>
          <ProgressBar value={calibrationProgress} variant="default" size="sm" />
        </div>
      )}

      {calibrationFeedback && !isCalibrating && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{calibrationFeedback}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          variant={isCameraOn ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleCamera}
          className="text-xs gap-1.5"
        >
          {isCameraOn ? (
            <>
              <CameraOff className="w-3.5 h-3.5 text-neutral-400" />
              <span>Turn Off Camera</span>
            </>
          ) : (
            <>
              <Camera className="w-3.5 h-3.5 text-purple-400" />
              <span>{cameraPermission === "granted" ? "Turn On Camera" : "Enable Camera"}</span>
            </>
          )}
        </Button>

        {isCameraOn && (
          <Button
            variant={isCalibrated ? "outline" : "glow"}
            size="sm"
            onClick={onRunCalibration}
            isLoading={isCalibrating}
            className="text-xs gap-1.5 font-medium"
          >
            {isCalibrated ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                <span>Recalibrate (3s)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>Calibrate Baseline (3s)</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
