"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";

interface SelectProps {
  value: string;
  placeholder?: string;
  options: string[];
  onChange: (value: string) => void;
  footer?: {
    label: string;
    onClick: () => void;
  };
}

export function Select({
  value,
  placeholder = "Selecione…",
  options,
  onChange,
  footer,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-11 w-full rounded-input border bg-white font-body text-[14px] flex items-center justify-between gap-2 cursor-pointer text-left transition-all px-4 ${open ? "border-obsidian" : "border-sand"} ${value ? "text-obsidian" : "text-inactive"}`}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
          {value || placeholder}
        </span>
        <ChevronDown
          size={18}
          className="text-graphite flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-30 bg-white border border-sand rounded-input overflow-hidden"
          style={{ top: "calc(100% + 6px)", maxHeight: 280, overflowY: "auto" }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`flex items-center justify-between gap-2 w-full px-4 py-[11px] border-none text-left font-body text-[14px] text-obsidian transition-colors hover:bg-linen ${opt === value ? "bg-linen" : "bg-transparent"}`}
            >
              <span>{opt}</span>
              {opt === value && (
                <Check size={16} className="text-gold flex-shrink-0" />
              )}
            </button>
          ))}
          {footer && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                footer.onClick();
              }}
              className="flex items-center gap-2 w-full px-4 py-3 border-t border-sand bg-transparent text-left font-display font-medium text-[14px] text-gold transition-colors hover:bg-linen"
            >
              <Plus size={16} /> {footer.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
