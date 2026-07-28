"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span className={cn("relative inline-flex group", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2",
          "whitespace-nowrap rounded-btn bg-obsidian px-2.5 py-1.5 font-body text-[12px] text-white",
          "opacity-0 scale-95 transition-all duration-150 z-50",
          "group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
        )}
      >
        {label}
      </span>
    </span>
  );
}
