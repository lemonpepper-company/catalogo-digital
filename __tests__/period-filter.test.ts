import { describe, it, expect } from "vitest";
import {
  resolvePeriodRange,
  activePeriodToken,
  PERIOD_PRESETS,
} from "@/lib/period-filter";

const NOW = new Date("2026-07-15T18:45:00.000Z"); // 15:45 em São Paulo

describe("resolvePeriodRange — presets", () => {
  it('"hoje" cobre desde a meia-noite de São Paulo até agora', () => {
    const range = resolvePeriodRange({ periodo: "hoje" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-15T03:00:00.000Z"), to: NOW });
  });

  it('"7d" cobre os últimos 7 dias corridos (hoje + 6 dias atrás) até agora', () => {
    const range = resolvePeriodRange({ periodo: "7d" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-09T03:00:00.000Z"), to: NOW });
  });

  it('"mes" cobre desde o dia 1 do mês corrente (fuso São Paulo) até agora', () => {
    const range = resolvePeriodRange({ periodo: "mes" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it('"tudo" não filtra por data (range null)', () => {
    const range = resolvePeriodRange({ periodo: "tudo" }, NOW);
    expect(range).toBeNull();
  });

  it("sem periodo informado usa o default (mes)", () => {
    const range = resolvePeriodRange({}, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it("preset desconhecido cai no default (mes)", () => {
    const range = resolvePeriodRange({ periodo: "ano" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });
});

describe("resolvePeriodRange — range customizado", () => {
  it("de/ate válidos geram range do início do dia De até o fim do dia Até, fuso São Paulo", () => {
    const range = resolvePeriodRange({ de: "2026-07-01", ate: "2026-07-10" }, NOW);
    expect(range).toEqual({
      from: new Date("2026-07-01T03:00:00.000Z"),
      to: new Date("2026-07-11T02:59:59.999Z"),
    });
  });

  it("de/ate têm prioridade sobre periodo quando os dois vêm juntos", () => {
    const range = resolvePeriodRange(
      { periodo: "hoje", de: "2026-07-01", ate: "2026-07-10" },
      NOW
    );
    expect(range).toEqual({
      from: new Date("2026-07-01T03:00:00.000Z"),
      to: new Date("2026-07-11T02:59:59.999Z"),
    });
  });

  it("de sem ate ignora o range customizado e usa o preset (ou default)", () => {
    const range = resolvePeriodRange({ de: "2026-07-01" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it("data malformada ignora o range customizado e cai no default (mes)", () => {
    const range = resolvePeriodRange({ de: "01-07-2026", ate: "2026-07-10" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it("data inexistente (ex: 30 de fevereiro) ignora o range customizado", () => {
    const range = resolvePeriodRange({ de: "2026-02-30", ate: "2026-03-01" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it("ate anterior a de ignora o range customizado e cai no default (mes)", () => {
    const range = resolvePeriodRange({ de: "2026-07-10", ate: "2026-07-01" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });
});

describe("activePeriodToken", () => {
  it("devolve o preset informado", () => {
    expect(activePeriodToken({ periodo: "hoje" })).toBe("hoje");
    expect(activePeriodToken({ periodo: "7d" })).toBe("7d");
    expect(activePeriodToken({ periodo: "tudo" })).toBe("tudo");
  });

  it("devolve mes quando nenhum periodo é informado", () => {
    expect(activePeriodToken({})).toBe("mes");
  });

  it('devolve "custom" quando de/ate válidos estão presentes', () => {
    expect(activePeriodToken({ de: "2026-07-01", ate: "2026-07-10" })).toBe("custom");
  });

  it("ignora de/ate inválidos e devolve o preset (ou default)", () => {
    expect(activePeriodToken({ de: "2026-07-10", ate: "2026-07-01" })).toBe("mes");
  });
});

describe("PERIOD_PRESETS", () => {
  it("lista os quatro presets na ordem esperada pela UI", () => {
    expect(PERIOD_PRESETS).toEqual(["hoje", "7d", "mes", "tudo"]);
  });
});
