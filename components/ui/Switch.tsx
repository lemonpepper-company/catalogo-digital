"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  accent?: boolean;
  disabled?: boolean;
}

export function Switch({ checked, onChange, accent, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] flex-shrink-0 rounded-pill",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        checked
          ? accent
            ? "bg-gold"
            : "bg-obsidian"
          : "bg-sand"
      )}
    >
      <span
        className={cn(
          "inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm",
          "absolute top-[2px] transition-transform duration-200",
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}

interface ToggleRowProps {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  accent?: boolean;
}

export function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  accent,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-t border-sand first:border-t-0">
      <div className="flex-1 min-w-0">
        <div className="font-body font-medium text-[14px] text-obsidian">
          {label}
        </div>
        {desc && (
          <div className="font-body text-[13px] text-graphite mt-0.5">
            {desc}
          </div>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} accent={accent} />
    </div>
  );
}
