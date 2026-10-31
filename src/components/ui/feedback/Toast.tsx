"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/src/lib/core/utils";

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
      icon: <Info className="w-4 h-4 text-[#0284c7] shrink-0" />,
      border: "border-blue-200",
      bg: "bg-blue-50/70",
    },
    success: {
      icon: <CheckCircle2 className="w-4 h-4 text-[#15803d] shrink-0" />,
      border: "border-emerald-200",
      bg: "bg-emerald-50/70",
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-[#b45309] shrink-0" />,
      border: "border-amber-200",
      bg: "bg-amber-50/70",
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-[#be123c] shrink-0" />,
      border: "border-rose-200",
      bg: "bg-rose-50/70",
    },
  };

  const currentType = toast.type || "info";
  const { icon, border, bg } = typeConfig[currentType];

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 pointer-events-auto max-w-sm w-full bg-white/95 text-[#0f172a]",
        border,
        bg,
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-2 scale-95"
      )}
    >
      {icon}
      <p className="text-xs text-[#0f172a] font-medium flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onDismiss(toast.id), 200);
        }}
        className="text-[#64748b] hover:text-[#0f172a] p-1 rounded-md transition-colors cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
