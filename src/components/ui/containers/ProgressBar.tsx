"use client";

import React, { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/src/lib/core/utils";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  showLabel?: boolean;
  label?: string;
  variant?: "default" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      className,
      value = 0,
      max = 100,
      showLabel = false,
      label,
      variant = "default",
      size = "md",
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    const variantGradients = {
      default: "bg-gradient-to-r from-purple-600 to-indigo-500",
      success: "bg-gradient-to-r from-emerald-600 to-teal-400",
      warning: "bg-gradient-to-r from-amber-600 to-yellow-400",
      error: "bg-gradient-to-r from-rose-600 to-red-500",
    };

    const sizeHeights = {
      sm: "h-1.5",
      md: "h-2.5",
      lg: "h-4",
    };

    return (
      <div ref={ref} className={cn("w-full space-y-1.5", className)} {...props}>
        {(showLabel || label) && (
          <div className="flex items-center justify-between text-xs font-medium text-[#475569]">
            {label && <span>{label}</span>}
            {showLabel && <span>{Math.round(percentage)}%</span>}
          </div>
        )}
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          className={cn(
            "w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60",
            sizeHeights[size]
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              variantGradients[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = "ProgressBar";
