"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { activePeriodToken, type PeriodPreset } from "@/lib/period-filter";

const PRESET_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  mes: "Este mês",
  tudo: "Todo período",
};

const PRESET_ORDER: PeriodPreset[] = ["hoje", "7d", "mes", "tudo"];

interface PeriodoFiltroProps {
  basePath: string;
  periodo?: string;
  de?: string;
  ate?: string;
  extraParams?: Record<string, string>;
}

export function PeriodoFiltro({
  basePath,
  periodo,
  de,
  ate,
  extraParams = {},
}: PeriodoFiltroProps) {
  const router = useRouter();
  const active = activePeriodToken({ periodo, de, ate });
  const [showCustom, setShowCustom] = useState(active === "custom");
  const [customDe, setCustomDe] = useState(de ?? "");
  const [customAte, setCustomAte] = useState(ate ?? "");

  const navigate = (params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...extraParams, ...params }).toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  const selectPreset = (preset: PeriodPreset) => {
    setShowCustom(false);
    navigate(preset === "mes" ? {} : { periodo: preset });
  };

  const applyCustomRange = () => {
    if (!customDe || !customAte) return;
    navigate({ de: customDe, ate: customAte });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por período">
        {PRESET_ORDER.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => selectPreset(preset)}
            aria-pressed={active === preset}
            className={cn(
              "h-9 px-3.5 rounded-pill border font-body text-[13px] transition-colors",
              active === preset
                ? "bg-obsidian border-obsidian text-white"
                : "bg-transparent border-sand text-obsidian hover:bg-surface-hover"
            )}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((value) => !value)}
          aria-pressed={active === "custom"}
          className={cn(
            "h-9 px-3.5 rounded-pill border font-body text-[13px] transition-colors",
            active === "custom"
              ? "bg-obsidian border-obsidian text-white"
              : "bg-transparent border-sand text-obsidian hover:bg-surface-hover"
          )}
        >
          Personalizado
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="w-40">
            <Input
              type="date"
              label="De"
              value={customDe}
              onChange={(e) => setCustomDe(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              type="date"
              label="Até"
              value={customAte}
              onChange={(e) => setCustomAte(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={applyCustomRange}
            disabled={!customDe || !customAte}
            className="h-11 px-4 rounded-btn bg-obsidian text-white font-body font-medium text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
