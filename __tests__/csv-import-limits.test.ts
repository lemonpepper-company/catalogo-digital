import { describe, it, expect } from "vitest";
import { parseProductCsv } from "@/lib/csv-produtos";
import { getPlanLimits } from "@/lib/plan-limits";

describe("regra de corte por limite de produtos (mesma lógica usada em importProductsCsv)", () => {
  it("com 2 produtos já existentes e limite Free de 8, processa as próximas 6 linhas e erra a 7ª em diante", () => {
    const csv =
      "nome,preco\n" + Array.from({ length: 7 }, (_, i) => `Produto ${i + 1},10`).join("\n");
    const { rows } = parseProductCsv(csv);
    const limits = getPlanLimits("free", null);

    let currentCount = 2;
    const outcomes = rows.map((row) => {
      if (!row.ok) return "erro-parsing";
      if (currentCount >= limits.maxProducts) return "erro-limite";
      currentCount++;
      return "criado";
    });

    expect(outcomes).toEqual([
      "criado",
      "criado",
      "criado",
      "criado",
      "criado",
      "criado",
      "erro-limite",
    ]);
    expect(currentCount).toBe(8);
  });
});
