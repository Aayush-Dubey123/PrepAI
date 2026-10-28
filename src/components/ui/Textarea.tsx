"use client";

import React, { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, helperText, error, id, disabled, ...props }, ref) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={generatedId}
            className="block text-xs font-medium text-[#334155]"
          >
            {label}
          </label>
        )}
        <textarea
          id={generatedId}
          ref={ref}
          disabled={disabled}
          className={cn(
            "flex min-h-[70px] w-full rounded-xl border bg-white px-3 py-2 text-xs sm:text-sm text-[#0f172a] placeholder:text-[#94a3b8] transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
            error
              ? "border-rose-400 focus-visible:ring-rose-400/20"
              : "border-[#e2e8f0] hover:border-[#cbd5e1] focus-visible:border-[#6366f1] focus-visible:ring-[#6366f1]/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-[#64748b] leading-normal">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
