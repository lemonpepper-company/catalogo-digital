"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  prefix?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, prefix, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="font-body font-medium text-[13px] text-obsidian"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 font-body text-[14px] text-graphite pointer-events-none select-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-11 w-full rounded-input border border-sand bg-white",
              "font-body text-[14px] text-obsidian",
              "transition-all duration-200",
              "placeholder:text-inactive",
              "focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2",
              "disabled:bg-linen disabled:text-inactive disabled:cursor-not-allowed",
              error && "border-error focus:border-error focus:ring-error",
              prefix ? "pl-9 pr-3" : "px-3",
              className
            )}
            {...props}
          />
        </div>
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

Input.displayName = "Input";
