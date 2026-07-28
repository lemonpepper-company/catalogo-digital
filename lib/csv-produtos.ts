import { parseCsv } from "@/lib/csv";
import { parseReaisToCents } from "@/lib/utils";
import { FASHION_COLORS } from "@/lib/data";
import type { ProductColor } from "@/lib/types";

export interface ParsedProductRow {
  name: string;
  priceCents: number;
  categoryName: string | null;
  stock: number;
  sizes: string[];
  colors: ProductColor[];
  description: string | null;
}

export type ProductRowResult =
  | { ok: true; product: ParsedProductRow }
  | { ok: false; reason: string };

const REQUIRED_COLUMNS = ["nome", "preco"];

export function parseProductCsv(text: string): {
  rows: ProductRowResult[];
  headerError?: string;
} {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], headerError: "Arquivo vazio." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    return {
      rows: [],
      headerError: `Cabeçalho inválido — faltam as colunas: ${missing.join(", ")}.`,
    };
  }

  const columnIndex = (col: string) => header.indexOf(col);
  const rows = table
    .slice(1)
    .map((cells, i) => ({ cells, lineNumber: i + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ""))
    .map(({ cells, lineNumber }) => parseRow(cells, columnIndex, lineNumber));
  return { rows };
}

function parseRow(
  cells: string[],
  columnIndex: (col: string) => number,
  lineNumber: number
): ProductRowResult {
  const get = (col: string) => {
    const i = columnIndex(col);
    return i >= 0 ? (cells[i] ?? "").trim() : "";
  };

  const name = get("nome");
  if (!name) return { ok: false, reason: `Linha ${lineNumber}: nome é obrigatório.` };

  const priceCents = parseReaisToCents(get("preco"));
  if (Number.isNaN(priceCents) || priceCents <= 0) {
    return { ok: false, reason: `Linha ${lineNumber}: preço inválido.` };
  }

  const stockRaw = get("estoque");
  const stock = stockRaw === "" ? 0 : parseInt(stockRaw, 10);
  if (Number.isNaN(stock) || stock < 0) {
    return { ok: false, reason: `Linha ${lineNumber}: estoque inválido.` };
  }

  const sizes = get("tamanhos")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const colorNames = get("cores")
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);

  const colors: ProductColor[] = [];
  for (const colorName of colorNames) {
    const match = FASHION_COLORS.find(
      (c) => c.name.toLowerCase() === colorName.toLowerCase()
    );
    if (!match) {
      return {
        ok: false,
        reason: `Linha ${lineNumber}: cor "${colorName}" não reconhecida.`,
      };
    }
    colors.push({ label: match.name, hex: match.hex });
  }

  return {
    ok: true,
    product: {
      name,
      priceCents,
      categoryName: get("categoria") || null,
      stock,
      sizes,
      colors,
      description: get("descricao") || null,
    },
  };
}
