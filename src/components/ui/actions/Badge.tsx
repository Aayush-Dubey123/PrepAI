"use client";

import React, { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/src/lib/core/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "warning" | "error" | "purple" | "cyan";
  pulse?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = "neutral",
      pulse = false,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      neutral: "bg-[#f1f5f9] text-[#334155] border-[#e2e8f0]",
      success: "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]",
      warning: "bg-[#fef3c7] text-[#b45309] border-[#fde68a]",
      error: "bg-[#ffe4e6] text-[#be123c] border-[#fecdd3]",
      purple: "bg-[#e0e7ff] text-[#4338ca] border-[#c7d2fe]",
      cyan: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]",
    };

    const dotColors = {
      neutral: "bg-slate-400",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
      error: "bg-rose-500",
      purple: "bg-indigo-600",
      cyan: "bg-sky-500",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                dotColors[variant]
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                dotColors[variant]
              )}
            />
          </span>
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
