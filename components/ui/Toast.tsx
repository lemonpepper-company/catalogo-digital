"use client";

import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";
import type { ToastTone } from "@/lib/types";

interface ToastProps {
  msg: string;
  tone?: ToastTone;
  position?: "bottom-center" | "bottom-right";
}

export function Toast({ msg, tone = "success", position = "bottom-right" }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-50 flex items-center gap-2.5 px-[18px] py-3.5",
        "rounded-btn font-body text-[15px] font-medium text-white",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
        tone === "error" ? "bg-error" : "bg-obsidian",
        position === "bottom-right"
          ? "right-8 bottom-8"
          : "left-1/2 bottom-8 -translate-x-1/2"
      )}
    >
      {tone === "error" ? (
        <AlertCircle size={16} className="text-white flex-shrink-0" />
      ) : (
        <Check size={16} className="text-gold flex-shrink-0" />
      )}
      {msg}
    </div>
  );
}
