"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { activePeriodToken, type PeriodPreset } from "@/lib/period-filter";

const PRESET_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  mes: "Este mês",
  tudo: "Todo período",
};

const PRESET_ORDER: PeriodPreset[] = ["hoje", "7d", "mes", "tudo"];
const PRESET_OPTIONS = PRESET_ORDER.map((preset) => PRESET_LABELS[preset]);
const LABEL_TO_PRESET: Record<string, PeriodPreset> = Object.fromEntries(
  PRESET_ORDER.map((preset) => [PRESET_LABELS[preset], preset])
) as Record<string, PeriodPreset>;

const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatDateInputAbbrev(value: string): { day: number; month: string; year: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { day, month: MONTH_ABBR[month - 1], year };
}

function formatCustomRangeLabel(de: string, ate: string): string {
  const from = formatDateInputAbbrev(de);
  const to = formatDateInputAbbrev(ate);
  const fromLabel =
    from.year === to.year
      ? `${from.day} ${from.month}`
      : `${from.day} ${from.month} ${from.year}`;
  const toLabel = `${to.day} ${to.month} ${to.year}`;
  return `${fromLabel} – ${toLabel}`;
}

function periodDisplayLabel(
  active: PeriodPreset | "custom",
  de: string | undefined,
  ate: string | undefined
): string {
  if (active === "custom") {
    return de && ate ? formatCustomRangeLabel(de, ate) : PRESET_LABELS.mes;
  }
  return PRESET_LABELS[active];
}

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
  const [modalOpen, setModalOpen] = useState(false);
  const [customDe, setCustomDe] = useState(de ?? "");
  const [customAte, setCustomAte] = useState(ate ?? "");

  const navigate = (params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...extraParams, ...params }).toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  const selectPreset = (label: string) => {
    const preset = LABEL_TO_PRESET[label];
    if (!preset) return;
    navigate(preset === "mes" ? {} : { periodo: preset });
  };

  const openModal = () => {
    setCustomDe(de ?? "");
    setCustomAte(ate ?? "");
    setModalOpen(true);
  };

  const applyCustomRange = () => {
    if (!customDe || !customAte) return;
    navigate({ de: customDe, ate: customAte });
    setModalOpen(false);
  };

  return (
    <div role="group" aria-label="Filtrar por período">
      <div className="w-full sm:w-64">
        <Select
          value={periodDisplayLabel(active, de, ate)}
          options={PRESET_OPTIONS}
          onChange={selectPreset}
          footer={{ label: "Período personalizado", onClick: openModal }}
        />
      </div>

      {modalOpen && (
        <Modal title="Período personalizado" onClose={() => setModalOpen(false)}>
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
          </div>
          <button
            type="button"
            onClick={applyCustomRange}
            disabled={!customDe || !customAte}
            className="h-11 px-4 rounded-btn bg-obsidian text-white font-body font-medium text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Aplicar
          </button>
        </Modal>
      )}
    </div>
  );
}
