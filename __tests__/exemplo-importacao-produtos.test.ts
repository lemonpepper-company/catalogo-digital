import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseProductCsv } from "@/lib/csv-produtos";

describe("planilha de exemplo em public/exemplo-importacao-produtos.csv", () => {
  it("importa todas as linhas sem erro, evitando regressão do arquivo de exemplo", () => {
    const csvPath = path.join(
      process.cwd(),
      "public",
      "exemplo-importacao-produtos.csv"
    );
    const text = readFileSync(csvPath, "utf-8");

    const { rows, headerError } = parseProductCsv(text);

    expect(headerError).toBeUndefined();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.ok).toBe(true);
    }
  });
});
