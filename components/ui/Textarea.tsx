"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="font-body font-medium text-[13px] text-obsidian"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "w-full rounded-input border border-sand bg-white",
            "font-body text-[14px] text-obsidian leading-relaxed",
            "px-3 py-2.5 transition-all duration-200",
            "placeholder:text-inactive resize-none",
            "focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2",
            "disabled:bg-linen disabled:text-inactive disabled:cursor-not-allowed",
            error && "border-error focus:border-error focus:ring-error",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="font-body text-[12px] text-graphite">{hint}</p>
        )}
        {error && (
          <p className="font-body text-[12px] text-error">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
