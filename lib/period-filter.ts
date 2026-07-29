import {
  dayEndInSaoPaulo,
  dayStartInSaoPaulo,
  daysAgoStartInSaoPaulo,
  monthStartInSaoPaulo,
} from "@/lib/timezone-sp";

export type PeriodPreset = "hoje" | "7d" | "mes" | "tudo";

export const PERIOD_PRESETS: PeriodPreset[] = ["hoje", "7d", "mes", "tudo"];

export interface PeriodRange {
  from: Date;
  to: Date;
}

export interface PeriodParams {
  periodo?: string;
  de?: string;
  ate?: string;
}

function isPeriodPreset(value: string | undefined): value is PeriodPreset {
  return (PERIOD_PRESETS as string[]).includes(value ?? "");
}

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Meio-dia UTC do dia informado — evita ambiguidade de fuso ao validar o calendário. */
function parseDateInputAsUtcNoon(value: string): Date | null {
  if (!DATE_INPUT_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function resolveCustomRange(de?: string, ate?: string): PeriodRange | null {
  if (!de || !ate) return null;
  const deDate = parseDateInputAsUtcNoon(de);
  const ateDate = parseDateInputAsUtcNoon(ate);
  if (!deDate || !ateDate) return null;
  const from = dayStartInSaoPaulo(deDate);
  const to = dayEndInSaoPaulo(ateDate);
  if (from.getTime() > to.getTime()) return null;
  return { from, to };
}

/**
 * `null` = "tudo" (sem filtro de data). Range customizado (`de`/`ate` válidos)
 * tem prioridade sobre `periodo`. Combinações inválidas (preset desconhecido,
 * datas malformadas, `ate` antes de `de`) caem no default "mes" — nunca lança,
 * nunca vira "tudo" por engano.
 */
export function resolvePeriodRange(
  params: PeriodParams,
  now: Date = new Date()
): PeriodRange | null {
  const customRange = resolveCustomRange(params.de, params.ate);
  if (customRange) return customRange;

  const preset = isPeriodPreset(params.periodo) ? (params.periodo as PeriodPreset) : "mes";
  if (preset === "tudo") return null;
  if (preset === "hoje") return { from: dayStartInSaoPaulo(now), to: now };
  if (preset === "7d") return { from: daysAgoStartInSaoPaulo(now, 6), to: now };
  return { from: monthStartInSaoPaulo(now), to: now };
}

/** Preset ou "custom" atualmente ativo, para destacar o botão certo na UI. */
export function activePeriodToken(params: PeriodParams): PeriodPreset | "custom" {
  if (resolveCustomRange(params.de, params.ate)) return "custom";
  return isPeriodPreset(params.periodo) ? (params.periodo as PeriodPreset) : "mes";
}
