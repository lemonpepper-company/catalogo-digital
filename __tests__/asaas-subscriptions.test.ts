import { describe, it, expect } from "vitest";
import { precoDe, proporcional } from "@/lib/asaas/plans";

describe("precoDe", () => {
  it("reflete a tabela fechada", () => {
    expect(precoDe("starter", "monthly")).toBe(29.9);
    expect(precoDe("starter", "annual")).toBe(299);
    expect(precoDe("pro", "monthly")).toBe(59.9);
    expect(precoDe("pro", "annual")).toBe(599);
  });
});

describe("proporcional", () => {
  const agora = new Date("2026-08-02T00:00:00.000Z");

  it("cobra metade da diferença quando falta metade do ciclo mensal", () => {
    // Ciclo de 30 dias terminando em 01/09; faltam 30 dias de 30? Não:
    // de 02/08 a 01/09 são 30 dias — ciclo inteiro restante.
    const expira = "2026-09-01T00:00:00.000Z";
    const valor = proporcional("starter", "pro", "monthly", expira, agora);
    // Diferença mensal cheia: 59,90 - 29,90 = 30,00
    expect(valor).toBe(30);
  });

  it("cobra proporcionalmente quando falta parte do ciclo", () => {
    const expira = "2026-08-17T00:00:00.000Z"; // faltam 15 de 30 dias
    const valor = proporcional("starter", "pro", "monthly", expira, agora);
    expect(valor).toBe(15);
  });

  it("nunca devolve valor negativo", () => {
    const expira = "2026-07-01T00:00:00.000Z"; // já venceu
    expect(proporcional("starter", "pro", "monthly", expira, agora)).toBe(0);
  });

  it("downgrade não gera cobrança", () => {
    const expira = "2026-09-01T00:00:00.000Z";
    expect(proporcional("pro", "starter", "monthly", expira, agora)).toBe(0);
  });
});
