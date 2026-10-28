"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/src/lib/utils";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);
    const duration = toast.duration || 4000;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(timer);
    };
  }, [toast, onDismiss]);

  const typeConfig = {
    info: {
      icon: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
      border: "border-blue-500/30",
      bg: "bg-[#141417]/90",
    },
    success: {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
      border: "border-emerald-500/30",
      bg: "bg-[#141417]/90",
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
      border: "border-amber-500/30",
      bg: "bg-[#141417]/90",
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />,
      border: "border-rose-500/30",
      bg: "bg-[#141417]/90",
    },
  };

  const currentType = toast.type || "info";
  const { icon, border, bg } = typeConfig[currentType];

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 pointer-events-auto max-w-sm w-full",
        border,
        bg,
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-2 scale-95"
      )}
    >
      {icon}
      <p className="text-xs text-neutral-200 flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onDismiss(toast.id), 200);
        }}
        className="text-neutral-500 hover:text-white p-1 rounded-md transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
