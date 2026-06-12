"use client";

import { cn } from "@/lib/utils";

interface PillProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Pill({ active, onClick, children, className }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center h-[34px] px-4 rounded-pill",
        "text-[13px] transition-all duration-200 whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-1",
        active
          ? "bg-obsidian text-white font-display font-medium"
          : "bg-linen text-graphite font-body font-normal hover:bg-surface-hover",
        className
      )}
    >
      {children}
    </button>
  );
}
