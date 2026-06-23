"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "cta" | "destructive";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-obsidian text-white border-obsidian hover:bg-[#1f1f1f] disabled:bg-inactive disabled:border-inactive disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-obsidian border-sand hover:bg-surface-hover disabled:text-inactive disabled:cursor-not-allowed",
  cta: "bg-gold text-white border-gold hover:bg-gold-hover disabled:bg-inactive disabled:border-inactive disabled:cursor-not-allowed",
  destructive:
    "bg-error-surface text-error border-error-surface hover:bg-[#f5d0cc] disabled:opacity-50 disabled:cursor-not-allowed",
};

const sizeStyles: Record<Size, string> = {
  md: "h-11 px-6 text-[15px]",
  sm: "h-9 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  children,
  className,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center gap-2",
        "rounded-btn border font-display font-medium",
        "transition-all duration-200 ease whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-2",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
