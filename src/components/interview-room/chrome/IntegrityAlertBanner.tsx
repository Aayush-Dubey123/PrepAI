"use client";

import React from "react";
import {
  ShieldAlert,
  AlertTriangle,
  EyeOff,
  Users,
  ExternalLink,
  Maximize2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

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

export interface IntegrityAlertBannerProps {
  warning: string | null;
  guidance?: GuidanceNotice | null;
  isTerminated: boolean;
  onRestoreFullscreen?: () => void;
}

export function IntegrityAlertBanner({
  warning,
  guidance,
  isTerminated,
  onRestoreFullscreen,
}: IntegrityAlertBannerProps) {
  if (!isTerminated && !warning && !guidance) return null;

  // 1. Critical: Session Terminated (3 strikes)
  if (isTerminated) {
    return (
      <div className="fixed top-16 inset-x-4 z-50 flex justify-center animate-in slide-in-from-top-4 duration-200 pointer-events-none">
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl backdrop-blur-xl max-w-lg pointer-events-auto bg-rose-50 border-rose-300 text-rose-950">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-rose-900">
              Interview Terminated due to Repeated Integrity Violations
            </div>
            <p className="text-[11px] leading-relaxed text-rose-800">
              Session limit reached (3 strikes). Directing to final evaluation report in 3 seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Layer 2: Verified Server Strike Warning
  if (warning) {
    return (
      <div className="fixed top-16 inset-x-4 z-50 flex justify-center animate-in slide-in-from-top-4 duration-200 pointer-events-none">
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-xl backdrop-blur-xl max-w-lg pointer-events-auto bg-rose-50 border-rose-200 text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 animate-pulse" />
          <div className="space-y-0.5">
            <div className="text-xs font-semibold">Proctoring Integrity Strike Assessed</div>
            <p className="text-[11px] leading-relaxed opacity-95">{warning}</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Layer 1: Real-Time Human-Centric Guidance Nudge
  if (!guidance) return null;

  const isRestored = guidance.type === "face_restored";
  const isFullscreenExit = guidance.type === "fullscreen_exit";
  const isNoFace = guidance.type === "no_face";
  const isMultiFace = guidance.type === "multiple_faces";
  const isTabSwitch = guidance.type === "tab_switch";

  let icon = <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />;
  let title = "Attention Reminder";
  let bannerClass = "bg-amber-50 border-amber-200 text-amber-900";

  if (isRestored) {
    icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
    title = "Visual Feed Restored";
    bannerClass = "bg-emerald-50 border-emerald-200 text-emerald-900";
  } else if (isFullscreenExit) {
    icon = <Maximize2 className="w-5 h-5 text-amber-600 shrink-0" />;
    title = "Fullscreen Focus Reminder";
  } else if (isNoFace) {
    icon = <EyeOff className="w-5 h-5 text-amber-600 shrink-0" />;
    title = "Camera Check";
  } else if (isMultiFace) {
    icon = <Users className="w-5 h-5 text-amber-600 shrink-0" />;
    title = "Room Proctoring Notice";
  } else if (isTabSwitch) {
    icon = <ExternalLink className="w-5 h-5 text-amber-600 shrink-0" />;
    title = "Browser Window Notice";
  }

  return (
    <div className="fixed top-16 inset-x-4 z-50 flex justify-center animate-in slide-in-from-top-4 duration-200 pointer-events-none">
      <div
        className={`flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border shadow-xl backdrop-blur-xl max-w-lg w-full pointer-events-auto ${bannerClass}`}
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="space-y-0.5">
            <div className="text-xs font-semibold">{title}</div>
            <p className="text-[11px] leading-relaxed opacity-95">{guidance.message}</p>
          </div>
        </div>

        {isFullscreenExit && onRestoreFullscreen && (
          <button
            type="button"
            onClick={onRestoreFullscreen}
            className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-xs transition-colors cursor-pointer"
          >
            Restore Fullscreen
          </button>
        )}
      </div>
    </div>
  );
}
