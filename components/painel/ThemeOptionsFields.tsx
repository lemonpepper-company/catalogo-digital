"use client";

import { Fragment } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_PAIRINGS, BACKGROUND_PALETTES, CORNER_STYLES } from "@/lib/theme-options";
import { Tooltip } from "@/components/ui/Tooltip";
import { PLAN_GATE_LABEL } from "@/lib/contact";

interface Option {
  key: string;
  label: string;
}

function OptionRow({
  label,
  options,
  value,
  onChange,
  unlocked,
  renderPreview,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (key: string) => void;
  unlocked: boolean;
  renderPreview?: (key: string) => React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="font-body font-medium text-[13px] text-obsidian mb-2">{label}</div>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => {
          const isDefault = opt.key === "padrao";
          const locked = !unlocked && !isDefault;
          const selected = value === opt.key;
          const button = (
            <button
              type="button"
              disabled={locked}
              onClick={() => !locked && onChange(opt.key)}
              className={cn(
                "flex items-center gap-2 h-11 px-4 rounded-btn border text-[13px]",
                selected
                  ? "border-obsidian bg-obsidian text-white"
                  : "border-sand bg-white text-obsidian hover:bg-surface-hover",
                locked && "opacity-50 cursor-not-allowed hover:bg-white"
              )}
            >
              {locked && <Lock size={14} />}
              {renderPreview?.(opt.key)}
              {opt.label}
            </button>
          );
          return locked ? (
            <Tooltip key={opt.key} label={PLAN_GATE_LABEL.starter}>
              {button}
            </Tooltip>
          ) : (
            <Fragment key={opt.key}>{button}</Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface ThemeOptionsFieldsProps {
  fontPairing: string;
  onFontPairingChange: (key: string) => void;
  backgroundPalette: string;
  onBackgroundPaletteChange: (key: string) => void;
  cornerStyle: string;
  onCornerStyleChange: (key: string) => void;
  unlocked: boolean;
}

export function ThemeOptionsFields({
  fontPairing,
  onFontPairingChange,
  backgroundPalette,
  onBackgroundPaletteChange,
  cornerStyle,
  onCornerStyleChange,
  unlocked,
}: ThemeOptionsFieldsProps) {
  return (
    <>
      <OptionRow
        label="Pareamento de fonte"
        options={FONT_PAIRINGS}
        value={fontPairing}
        onChange={onFontPairingChange}
        unlocked={unlocked}
        renderPreview={(key) => {
          const p = FONT_PAIRINGS.find((f) => f.key === key);
          return p ? (
            <span style={{ fontFamily: `var(${p.fontDisplayVar})` }}>Aa</span>
          ) : null;
        }}
      />
      <OptionRow
        label="Paleta de fundo"
        options={BACKGROUND_PALETTES}
        value={backgroundPalette}
        onChange={onBackgroundPaletteChange}
        unlocked={unlocked}
        renderPreview={(key) => {
          const p = BACKGROUND_PALETTES.find((b) => b.key === key);
          return p ? (
            <span
              className="w-4 h-4 rounded-full border border-sand inline-block"
              style={{ background: p.background }}
            />
          ) : null;
        }}
      />
      <OptionRow
        label="Formato dos cantos"
        options={CORNER_STYLES}
        value={cornerStyle}
        onChange={onCornerStyleChange}
        unlocked={unlocked}
      />
    </>
  );
}
