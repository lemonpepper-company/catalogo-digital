const TIME_ZONE = "America/Sao_Paulo";

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date): ZonedParts {
  const parts: Record<string, number> = {};
  for (const { type, value } of zonedFormatter.formatToParts(date)) {
    if (type !== "literal") parts[type] = Number(value);
  }
  // "24" aparece na meia-noite em algumas implementações de hourCycle.
  if (parts.hour === 24) parts.hour = 0;
  return parts as unknown as ZonedParts;
}

// Quanto o relógio de São Paulo está adiantado/atrasado em relação a UTC no instante dado.
function zoneOffsetMs(date: Date): number {
  const p = zonedParts(date);
  const asIfUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const dateWithoutMs = new Date(Math.floor(date.getTime() / 1000) * 1000);
  return asIfUTC - dateWithoutMs.getTime();
}

function zonedInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  return new Date(naive - zoneOffsetMs(new Date(naive)));
}

/** Instante (em UTC) do dia 1 do mês de `date`, às 00:00, no fuso do lojista brasileiro. */
export function monthStartInSaoPaulo(date: Date): Date {
  const { year, month } = zonedParts(date);
  return zonedInstant(year, month, 1);
}

/** Instante (em UTC) do dia de `date`, às 00:00, no fuso do lojista brasileiro. */
export function dayStartInSaoPaulo(date: Date): Date {
  const { year, month, day } = zonedParts(date);
  return zonedInstant(year, month, day);
}

/** Instante (em UTC) do dia de `date`, às 23:59:59.999, no fuso do lojista brasileiro. */
export function dayEndInSaoPaulo(date: Date): Date {
  const { year, month, day } = zonedParts(date);
  return zonedInstant(year, month, day, 23, 59, 59, 999);
}

/** Meia-noite (fuso São Paulo) de `daysAgo` dias antes do dia de `date`. */
export function daysAgoStartInSaoPaulo(date: Date, daysAgo: number): Date {
  const { year, month, day } = zonedParts(date);
  return zonedInstant(year, month, day - daysAgo);
}
