import { describe, it, expect } from "vitest";
import { parseProductCsv } from "@/lib/csv-produtos";

const HEADER = "nome,preco,categoria,estoque,tamanhos,cores,descricao";

describe("parseProductCsv", () => {
  it("acusa cabeçalho inválido quando faltam colunas obrigatórias", () => {
    const { headerError } = parseProductCsv("a,b\n1,2");
    expect(headerError).toMatch(/nome, preco/);
  });

  it("linha válida vira produto com tamanhos/cores separados por ;", () => {
    const csv = `${HEADER}\nVestido midi,"99,90",Vestidos,5,P;M;G,Preto;Branco,Peça básica`;
    const { rows, headerError } = parseProductCsv(csv);
    expect(headerError).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      ok: true,
      product: {
        name: "Vestido midi",
        priceCents: 9990,
        categoryName: "Vestidos",
        stock: 5,
        sizes: ["P", "M", "G"],
        colors: [
          { label: "Preto", hex: "#1A1A1A" },
          { label: "Branco", hex: "#FFFFFF" },
        ],
        description: "Peça básica",
      },
      line: 2,
    });
  });

  it("nome vazio vira erro apontando a linha (2 = primeira linha de dados)", () => {
    const csv = `${HEADER}\n,"99,90",,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows[0]).toEqual({ ok: false, reason: "Linha 2: nome é obrigatório.", line: 2 });
  });

  it("preço inválido vira erro", () => {
    const csv = `${HEADER}\nVestido,"não é preço",,,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows[0]).toEqual({ ok: false, reason: "Linha 2: preço inválido.", line: 2 });
  });

  it("cor não reconhecida vira erro nomeando a cor", () => {
    const csv = `${HEADER}\nVestido,"99,90",,,,Verde-limão,`;
    const { rows } = parseProductCsv(csv);
    expect(rows[0]).toEqual({
      ok: false,
      reason: 'Linha 2: cor "Verde-limão" não reconhecida.',
      line: 2,
    });
  });

  it("categoria e estoque vazios viram null/0 sem erro", () => {
    const csv = `${HEADER}\nVestido,"99,90",,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows[0]).toEqual({
      ok: true,
      product: {
        name: "Vestido",
        priceCents: 9990,
        categoryName: null,
        stock: 0,
        sizes: [],
        colors: [],
        description: null,
      },
      line: 2,
    });
  });

  it("linhas totalmente vazias no meio do arquivo são ignoradas, sem gerar erro", () => {
    const csv = `${HEADER}\nVestido,"99,90",,,,\n,,,,,,\nBlusa,"49,90",,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it("linha em branco antes de erro: o número da linha reportado reflete a posição no arquivo original", () => {
    const csv = `${HEADER}\n,,,,,,\n,"99,90",,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      ok: false,
      reason: "Linha 3: nome é obrigatório.",
      line: 3,
    });
  });

  it("linha totalmente vazia (sem vírgulas) antes de erro: número da linha continua correto", () => {
    const csv = `${HEADER}\n\n,"99,90",,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      ok: false,
      reason: "Linha 3: nome é obrigatório.",
      line: 3,
    });
  });
});
