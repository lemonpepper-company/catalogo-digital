import { describe, it, expect } from "vitest";
import {
  monthStartInSaoPaulo,
  dayStartInSaoPaulo,
  dayEndInSaoPaulo,
  daysAgoStartInSaoPaulo,
} from "@/lib/timezone-sp";

describe("monthStartInSaoPaulo", () => {
  it("devolve 1º de janeiro às 00:00 de São Paulo (03:00 UTC)", () => {
    const start = monthStartInSaoPaulo(new Date("2026-01-15T12:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("usa o mês do fuso de São Paulo, não o de UTC, na virada do mês", () => {
    const start = monthStartInSaoPaulo(new Date("2026-08-01T01:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
  });
});

describe("dayStartInSaoPaulo", () => {
  it("devolve meia-noite de São Paulo (03:00 UTC) do dia informado", () => {
    const start = dayStartInSaoPaulo(new Date("2026-07-15T18:45:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-15T03:00:00.000Z");
  });

  it("usa o dia do fuso de São Paulo, não o de UTC, na virada do dia", () => {
    // 01:00 UTC de 16/07 ainda é 22:00 de 15/07 em São Paulo.
    const start = dayStartInSaoPaulo(new Date("2026-07-16T01:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-15T03:00:00.000Z");
  });
});

describe("dayEndInSaoPaulo", () => {
  it("devolve 23:59:59.999 de São Paulo (02:59:59.999 UTC do dia seguinte)", () => {
    const end = dayEndInSaoPaulo(new Date("2026-07-15T12:00:00.000Z"));
    expect(end.toISOString()).toBe("2026-07-16T02:59:59.999Z");
  });
});

describe("daysAgoStartInSaoPaulo", () => {
  it("devolve a meia-noite de São Paulo de N dias antes do dia informado", () => {
    const start = daysAgoStartInSaoPaulo(new Date("2026-07-15T18:45:00.000Z"), 6);
    expect(start.toISOString()).toBe("2026-07-09T03:00:00.000Z");
  });

  it("com 0 dias devolve a meia-noite do próprio dia (mesmo resultado de dayStartInSaoPaulo)", () => {
    const now = new Date("2026-07-15T18:45:00.000Z");
    expect(daysAgoStartInSaoPaulo(now, 0).toISOString()).toBe(
      dayStartInSaoPaulo(now).toISOString()
    );
  });

  it("atravessa a virada de mês corretamente", () => {
    const start = daysAgoStartInSaoPaulo(new Date("2026-07-03T12:00:00.000Z"), 6);
    expect(start.toISOString()).toBe("2026-06-27T03:00:00.000Z");
  });
});
