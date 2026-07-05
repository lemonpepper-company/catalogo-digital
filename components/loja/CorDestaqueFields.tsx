"use client";

import { ACCENT_COLOR_OPTIONS } from "@/lib/data";

interface CorDestaqueFieldsProps {
  accent: string;
  onAccentChange: (color: string) => void;
}

export function CorDestaqueFields({ accent, onAccentChange }: CorDestaqueFieldsProps) {
  return (
    <>
      <div className="flex gap-3 flex-wrap mb-5">
        {ACCENT_COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onAccentChange(c)}
            aria-label={c}
            className="w-10 h-10 rounded-full transition-all duration-200"
            style={{
              background: c,
              border:
                accent === c
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
              outline: accent === c ? "2px solid var(--color-bg)" : "none",
              outlineOffset: accent === c ? "-4px" : "0",
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
      <div className="flex items-center flex-wrap gap-3">
        <span
          className="inline-flex min-h-11 items-center px-[22px] py-2.5 rounded-btn font-display font-medium text-[15px] text-white"
          style={{ background: accent }}
        >
          Comprar via WhatsApp
        </span>
        <span className="font-body text-[13px] text-graphite">
          Pré-visualização do CTA
        </span>
      </div>
    </>
  );
}
