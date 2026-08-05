import { describe, it, expect } from "vitest";
import {
  monthStartInSaoPaulo,
  dayStartInSaoPaulo,
  dayEndInSaoPaulo,
  daysAgoStartInSaoPaulo,
  formatarDataSP,
  diasAte,
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

describe("formatarDataSP", () => {
  it("formata uma meia-noite UTC pelo dia que ela representa, não pelo instante", () => {
    expect(formatarDataSP("2026-09-12T00:00:00.000Z")).toBe("12 de setembro de 2026");
  });

  it("não recua um dia por causa do offset de São Paulo (UTC-3)", () => {
    expect(formatarDataSP("2026-08-15T00:00:00.000Z")).toBe("15 de agosto de 2026");
  });

  it("atravessa a virada de ano", () => {
    expect(formatarDataSP("2027-01-01T00:00:00.000Z")).toBe("1 de janeiro de 2027");
  });
});

describe("diasAte", () => {
  const HOJE = new Date("2026-08-05T12:00:00.000Z");

  it("data no futuro devolve dias positivos", () => {
    expect(diasAte("2026-08-08", HOJE)).toBe(3);
  });

  it("data já vencida devolve dias negativos", () => {
    expect(diasAte("2026-08-01", HOJE)).toBe(-4);
  });

  it("hoje devolve zero", () => {
    expect(diasAte("2026-08-05", HOJE)).toBe(0);
  });

  it("não recua um dia por causa do offset de São Paulo (UTC-3), mesmo perto da meia-noite", () => {
    // 21h em SP (00h UTC do dia seguinte) ainda é "hoje" em SP.
    const quaseMeiaNoiteSP = new Date("2026-08-06T00:30:00.000Z");
    expect(diasAte("2026-08-05", quaseMeiaNoiteSP)).toBe(0);
  });
});
