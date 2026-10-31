"use client";

import React, { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/src/lib/core/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "glow";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 active:scale-[0.98]";

    const variantStyles = {
      primary:
        "bg-[#1e293b] text-white hover:bg-[#0f172a] shadow-sm",
      secondary:
        "bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0] border border-[#e2e8f0]",
      outline:
        "border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] hover:text-[#0f172a]",
      ghost:
        "text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]",
      danger:
        "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100",
      glow:
        "bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-sm shadow-indigo-500/20",
    };

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 h-8 gap-1.5",
      md: "text-sm px-4 py-2.5 h-10 gap-2",
      lg: "text-base px-6 py-3.5 h-12 gap-2.5 font-semibold",
      icon: "h-10 w-10 p-0 items-center justify-center rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
