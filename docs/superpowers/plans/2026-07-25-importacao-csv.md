# Importação de Produtos via CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar uma loja Pro cadastrar vários produtos de uma vez via upload de planilha CSV (só dados de texto — nome, preço, categoria, estoque, tamanhos, cores), em vez de um por um no formulário.

**Architecture:** Um parser CSV genérico e puro (`lib/csv.ts`), separado de um parser/validador específico do domínio de produtos (`lib/csv-produtos.ts`) que resolve categoria e cores linha a linha. Uma nova server action (`importProductsCsv`) orquestra: ler o arquivo, validar linha a linha, criar categorias que faltam (respeitando o limite do plano), criar produtos até o limite do plano, e devolver um resumo (`created` + lista de erros por linha). Toda a parte de parsing/validação é pura e testável sem Supabase; só a orquestração final (criar categoria/produto de fato) toca o banco.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres), Vitest. Sem biblioteca de CSV nova — parser próprio, consistente com o resto do projeto (sem dependências além de `zod`).

## Global Constraints

- Gating aditivo: recurso exclusivo de Pro (`csvImport` flag em `PlanLimits`).
- Toda validação de plano é feita no servidor (server action), nunca só na UI.
- Escopo desta rodada: **só dados de texto**. Fotos continuam manuais, produto por produto, depois da importação.
- Linha inválida não derruba o arquivo inteiro — processa o que der, reporta o resto (ver Task 4).
- Este plano depende de `products.is_featured` existir **apenas se** `2026-07-25-personalizacao-visual-avancada.md` já tiver sido aplicado — se não tiver, a Task 4 deste plano simplesmente omite `is_featured` do insert (ver nota na Task 4, Step 3). Nenhuma outra dependência cruzada com os outros dois planos.
- Referência de design/spec: `docs/superpowers/specs/2026-07-25-diferenciacao-planos-design.md` (§4, §5.4, §7, §8).

---

## Mapa de arquivos

**Novos:**
- `lib/csv.ts`
- `__tests__/csv.test.ts`
- `lib/csv-produtos.ts`
- `__tests__/csv-produtos.test.ts`
- `public/exemplo-importacao-produtos.csv`
- `components/painel/ImportarProdutosModal.tsx`

**Modificados:**
- `lib/plan-limits.ts`, `__tests__/plan-limits.test.ts`
- `app/actions/produtos.ts`
- `app/painel/produtos/ProdutosClient.tsx`
- `app/landing/data.tsx`

---

### Task 1: Flag `csvImport` em `lib/plan-limits.ts`

**Files:**
- Modify: `lib/plan-limits.ts`
- Modify: `__tests__/plan-limits.test.ts`

**Interfaces:**
- Produces: `PlanLimits.csvImport: boolean` (`true` só no Pro). Consumido pelas Tasks 4 e 6.

- [ ] **Step 1: Escrever o teste que falha primeiro**

Adicionar a `__tests__/plan-limits.test.ts`:

```ts
describe("getPlanLimits — importação CSV", () => {
  it("free e starter não têm importação CSV", () => {
    expect(getPlanLimits("free", null).csvImport).toBe(false);
    expect(getPlanLimits("starter", null).csvImport).toBe(false);
  });

  it("pro tem importação CSV", () => {
    expect(getPlanLimits("pro", null).csvImport).toBe(true);
  });

  it("pro com trial_ends_at expirado perde a importação CSV (cai para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past).csvImport).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: FAIL — `csvImport` é `undefined`.

- [ ] **Step 3: Implementar a flag**

Se `PlanLimits` já foi estendido por outro plano deste pacote (personalização ou domínio), só adicionar `csvImport` aos objetos existentes. Senão, `PlanLimits` ganha (ao lado dos campos já existentes hoje):

```ts
export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
  csvImport: boolean;
}
```

Com `csvImport: false` em `FREE_LIMITS` e `STARTER_LIMITS`, `csvImport: true` em `PRO_LIMITS`.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: PASS em todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-limits.ts __tests__/plan-limits.test.ts
git commit -m "feat: adiciona flag csvImport (Pro) ao PlanLimits"
```

---

### Task 2: Parser CSV genérico (`lib/csv.ts`)

Função pura, sem dependência de domínio (produtos, planos, Supabase) — só transforma texto em linhas de células, lidando com aspas e vírgulas internas.

**Files:**
- Create: `lib/csv.ts`
- Create: `__tests__/csv.test.ts`

**Interfaces:**
- Produces: `parseCsv(text: string): string[][]`. Consumido pela Task 3.

- [ ] **Step 1: Escrever os testes que falham primeiro**

```ts
// __tests__/csv.test.ts
import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("separa linhas e colunas simples por vírgula", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("respeita campos entre aspas contendo vírgula", () => {
    expect(parseCsv('nome,desc\n"Vestido, midi",bonito')).toEqual([
      ["nome", "desc"],
      ["Vestido, midi", "bonito"],
    ]);
  });

  it("resolve aspas duplas escapadas dentro de um campo entre aspas", () => {
    expect(parseCsv('a\n"ela disse ""oi"""')).toEqual([["a"], ['ela disse "oi"']]);
  });

  it("lida com quebras de linha CRLF e remove um BOM inicial", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("ignora linhas totalmente vazias no fim do arquivo", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/csv.test.ts`
Expected: FAIL com `Cannot find module '@/lib/csv'`.

- [ ] **Step 3: Implementar `lib/csv.ts`**

```ts
export function parseCsv(text: string): string[][] {
  const normalized = text
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/csv.test.ts`
Expected: PASS em todos os casos.

- [ ] **Step 5: Commit**

```bash
git add lib/csv.ts __tests__/csv.test.ts
git commit -m "feat: adiciona parser CSV genérico (sem dependência externa)"
```

---

### Task 3: Parser/validador de linhas de produto (`lib/csv-produtos.ts`)

**Files:**
- Create: `lib/csv-produtos.ts`
- Create: `__tests__/csv-produtos.test.ts`

**Interfaces:**
- Consumes: `parseCsv` (Task 2), `parseReaisToCents` (já existe em `lib/utils.ts`), `FASHION_COLORS` (já existe em `lib/data.ts`).
- Produces: `parseProductCsv(text: string): { rows: ProductRowResult[]; headerError?: string }`, tipo `ParsedProductRow`. Consumido pela Task 4.

- [ ] **Step 1: Escrever os testes que falham primeiro**

```ts
// __tests__/csv-produtos.test.ts
import { describe, it, expect } from "vitest";
import { parseProductCsv } from "@/lib/csv-produtos";

const HEADER = "nome,preco,categoria,estoque,tamanhos,cores,descricao";

describe("parseProductCsv", () => {
  it("acusa cabeçalho inválido quando faltam colunas obrigatórias", () => {
    const { headerError } = parseProductCsv("a,b\n1,2");
    expect(headerError).toMatch(/nome, preco/);
  });

  it("linha válida vira produto com tamanhos/cores separados por ;", () => {
    const csv = `${HEADER}\nVestido midi,99,90,Vestidos,5,P;M;G,Preto;Branco,Peça básica`;
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
    });
  });

  it("nome vazio vira erro apontando a linha (2 = primeira linha de dados)", () => {
    const csv = `${HEADER}\n,99,90,,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows[0]).toEqual({ ok: false, reason: "Linha 2: nome é obrigatório." });
  });

  it("preço inválido vira erro", () => {
    const csv = `${HEADER}\nVestido,não é preço,,,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows[0]).toEqual({ ok: false, reason: "Linha 2: preço inválido." });
  });

  it("cor não reconhecida vira erro nomeando a cor", () => {
    const csv = `${HEADER}\nVestido,99,90,,,Verde-limão,`;
    const { rows } = parseProductCsv(csv);
    expect(rows[0]).toEqual({
      ok: false,
      reason: 'Linha 2: cor "Verde-limão" não reconhecida.',
    });
  });

  it("categoria e estoque vazios viram null/0 sem erro", () => {
    const csv = `${HEADER}\nVestido,99,90,,,,`;
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
    });
  });

  it("linhas totalmente vazias no meio do arquivo são ignoradas, sem gerar erro", () => {
    const csv = `${HEADER}\nVestido,99,90,,,,\n,,,,,,\nBlusa,49,90,,,,`;
    const { rows } = parseProductCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ok)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/csv-produtos.test.ts`
Expected: FAIL com `Cannot find module '@/lib/csv-produtos'`.

- [ ] **Step 3: Implementar `lib/csv-produtos.ts`**

```ts
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
  const dataRows = table
    .slice(1)
    .filter((cells) => cells.some((cell) => cell.trim() !== ""));

  const rows = dataRows.map((cells, i) => parseRow(cells, columnIndex, i + 2));
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/csv-produtos.test.ts`
Expected: PASS em todos os casos.

- [ ] **Step 5: Commit**

```bash
git add lib/csv-produtos.ts __tests__/csv-produtos.test.ts
git commit -m "feat: adiciona parser/validador de linhas de produto para importação CSV"
```

---

### Task 4: Server action `importProductsCsv`

**Files:**
- Modify: `app/actions/produtos.ts`

**Interfaces:**
- Consumes: `parseProductCsv` (Task 3), `getPlanLimits` (Task 1).
- Produces: `importProductsCsv(prevState, formData): Promise<ImportCsvState>`. Consumido pela Task 6.

- [ ] **Step 1: Escrever o teste que falha primeiro (parsing + limites, sem Supabase)**

A parte pura já está coberta pela Task 3; esta task adiciona um teste de integração leve, validando só a decisão de "quando parar de criar por limite de plano" de forma isolada, sem acionar rede. Criar `__tests__/csv-import-limits.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar o teste e confirmar que passa (a lógica em si já existe via `getPlanLimits`/`parseProductCsv`)**

Run: `npx vitest run __tests__/csv-import-limits.test.ts`
Expected: PASS — este teste documenta a regra de corte antes de implementá-la dentro da server action, para não escrever a lógica de limite "no escuro".

- [ ] **Step 3: Implementar `importProductsCsv` em `app/actions/produtos.ts`**

Ler o arquivo inteiro antes de editar (já lido nesta sessão — `createProduct`/`createCategory`-equivalentes são o modelo direto de checagem de limite). Adicionar ao final:

```ts
import { parseProductCsv } from "@/lib/csv-produtos";

export type ImportCsvState =
  | { error: string }
  | { ok: true; created: number; errors: { line: number; reason: string }[] }
  | null;

export async function importProductsCsv(
  prevState: ImportCsvState,
  formData: FormData
): Promise<ImportCsvState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const limits = getPlanLimits(store.plan, store.trialEndsAt);
  if (!limits.csvImport) {
    return { error: "Importação em massa disponível apenas no plano Pro. Fale conosco para liberar." };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Selecione um arquivo CSV." };

  const text = await file.text();
  const { rows, headerError } = parseProductCsv(text);
  if (headerError) return { error: headerError };

  const [{ count: productCount }, { data: existingCategories }] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    supabase.from("categories").select("id, name").eq("store_id", store.id),
  ]);

  let currentProductCount = productCount ?? 0;
  let currentCategoryCount = existingCategories?.length ?? 0;
  const categoryIdByName = new Map(
    (existingCategories ?? []).map((c) => [c.name.toLowerCase(), c.id as string])
  );

  let created = 0;
  const errors: { line: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const lineNumber = i + 2;
    const row = rows[i];

    if (!row.ok) {
      errors.push({ line: lineNumber, reason: row.reason });
      continue;
    }

    let categoryId: string | null = null;
    if (row.product.categoryName) {
      const key = row.product.categoryName.toLowerCase();
      const existingId = categoryIdByName.get(key);
      if (existingId) {
        categoryId = existingId;
      } else if (currentCategoryCount >= limits.maxCategories) {
        errors.push({ line: lineNumber, reason: "Limite de categorias do plano atingido." });
        continue;
      } else {
        const { data: newCategory, error: categoryError } = await supabase
          .from("categories")
          .insert({ store_id: store.id, name: row.product.categoryName })
          .select("id")
          .single();
        if (categoryError || !newCategory) {
          errors.push({ line: lineNumber, reason: "Erro ao criar categoria." });
          continue;
        }
        categoryId = newCategory.id;
        categoryIdByName.set(key, categoryId);
        currentCategoryCount++;
      }
    }

    if (currentProductCount >= limits.maxProducts) {
      errors.push({ line: lineNumber, reason: "Limite de produtos do plano atingido." });
      continue;
    }

    const { error: insertError } = await supabase.from("products").insert({
      store_id: store.id,
      name: row.product.name,
      price_cents: row.product.priceCents,
      description: row.product.description,
      category_id: categoryId,
      sizes: row.product.sizes,
      sold_sizes: [],
      colors: row.product.colors,
      images: [],
      stock: row.product.stock,
      is_active: true,
      is_new: false,
      // is_featured: false, — incluir esta linha SÓ SE a migration de
      // "products.is_featured" (plano de personalização visual) já tiver
      // rodado neste banco; senão a coluna não existe e o insert falha.
    });

    if (insertError) {
      errors.push({ line: lineNumber, reason: "Erro ao criar o produto." });
      continue;
    }

    created++;
    currentProductCount++;
  }

  revalidatePath("/painel/produtos");
  revalidatePath("/painel");
  revalidateTag(`catalog-${store.slug}`, { expire: 0 });
  return { ok: true, created, errors };
}
```

- [ ] **Step 4: Verificação manual**

Criar um arquivo `teste.csv` local com 3 linhas válidas e 1 linha com cor inválida, numa loja `plan = 'pro'` com poucos produtos existentes. Chamar a action via a UI (depois da Task 6) ou diretamente via um script de teste manual.
Expected: `created = 3`, `errors` com 1 item apontando a linha da cor inválida; os 3 produtos aparecem em `/painel/produtos` com `is_active = true` e sem fotos.

- [ ] **Step 5: Commit**

```bash
git add app/actions/produtos.ts __tests__/csv-import-limits.test.ts
git commit -m "feat: adiciona importProductsCsv com criação de categoria e corte por limite de plano"
```

---

### Task 5: CSV de exemplo

**Files:**
- Create: `public/exemplo-importacao-produtos.csv`

**Interfaces:**
- Produces: arquivo estático servido em `/exemplo-importacao-produtos.csv`. Consumido pela Task 6 (link de download).

- [ ] **Step 1: Criar o arquivo de exemplo**

```csv
nome,preco,categoria,estoque,tamanhos,cores,descricao
Vestido midi linho areia,289,90,Vestidos,12,P;M;G;GG,Areia;Preto,Vestido midi em linho com caimento fluido
Blusa de tricô off-white,169,90,Blusas,7,PP;P;M;G,Off-white,Tricô leve de algodão com gola redonda
```

- [ ] **Step 2: Verificação manual**

Run: `npm run dev`, abrir `http://localhost:3000/exemplo-importacao-produtos.csv`.
Expected: o navegador baixa/exibe o CSV com as 2 linhas de exemplo.

- [ ] **Step 3: Commit**

```bash
git add public/exemplo-importacao-produtos.csv
git commit -m "feat: adiciona CSV de exemplo para importação de produtos"
```

---

### Task 6: UI — modal de importação em Produtos

**Files:**
- Create: `components/painel/ImportarProdutosModal.tsx`
- Modify: `app/painel/produtos/ProdutosClient.tsx`

**Interfaces:**
- Consumes: `importProductsCsv` (Task 4), `PlanLimits.csvImport` (Task 1).

- [ ] **Step 1: Criar `components/painel/ImportarProdutosModal.tsx`**

```tsx
"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { importProductsCsv, type ImportCsvState } from "@/app/actions/produtos";

interface ImportarProdutosModalProps {
  onClose: () => void;
}

export function ImportarProdutosModal({ onClose }: ImportarProdutosModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [state, formAction, pending] = useActionState<ImportCsvState, FormData>(
    async (_prev, formData) => {
      const res = await importProductsCsv(null, formData);
      if (res && "ok" in res && res.created > 0) router.refresh();
      return res;
    },
    null
  );

  const result = state && "ok" in state ? state : null;

  return (
    <Modal title="Importar produtos" onClose={onClose}>
      {!result ? (
        <form
          action={(formData) => {
            if (file) formData.set("file", file);
            formAction(formData);
          }}
          className="flex flex-col gap-4"
        >
          <a
            href="/exemplo-importacao-produtos.csv"
            className="font-body text-[13px] text-obsidian underline w-fit"
          >
            Baixar planilha de exemplo
          </a>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-body text-[13px]"
          />
          {state && "error" in state && (
            <p className="font-body text-[13px] text-error">{state.error}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={!file || pending}>
              {pending ? "Importando…" : "Importar"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-body text-[14px] text-obsidian">
            <strong>{result.created}</strong> produto(s) importado(s) com sucesso.
          </p>
          {result.errors.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
              <p className="font-body font-medium text-[13px] text-obsidian">
                {result.errors.length} linha(s) com erro:
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="font-body text-[13px] text-graphite">
                  {e.reason}
                </p>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="primary" onClick={onClose}>
              Concluir
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Adicionar o botão "Importar planilha" em `ProdutosClient.tsx`**

Ler o arquivo inteiro antes de editar (já lido nesta sessão). Adicionar estado local `const [importOpen, setImportOpen] = useState(false);` e, ao lado do botão existente de "Novo produto" (topo da tela), um botão condicionado ao plano:

```tsx
{limits.csvImport ? (
  <Button variant="ghost" onClick={() => setImportOpen(true)}>
    Importar planilha
  </Button>
) : (
  <a
    href="https://wa.me/5535999931678?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20importa%C3%A7%C3%A3o%20de%20produtos."
    target="_blank"
    rel="noopener noreferrer"
    className="font-body text-[13px] text-graphite underline self-center"
  >
    Importação em massa — disponível no Pro
  </a>
)}

{importOpen && <ImportarProdutosModal onClose={() => setImportOpen(false)} />}
```

Adicionar `limits: PlanLimits` à interface de props de `ProdutosClient` (`import type { PlanLimits } from "@/lib/plan-limits";`) e importar `ImportarProdutosModal`. A página `app/painel/produtos/page.tsx` precisa calcular `const limits = getPlanLimits(store.plan, store.trialEndsAt);` (se ainda não calcular) e passar como prop `<ProdutosClient ... limits={limits} />`.

- [ ] **Step 3: Verificação manual**

Run: `npm run dev`, abrir `/painel/produtos` com uma loja `plan = 'starter'`.
Expected: aparece só o link "Importação em massa — disponível no Pro", sem botão de importar. Mudar a loja para `plan = 'pro'` no Supabase e recarregar: botão "Importar planilha" abre o modal; selecionar o CSV de exemplo (Task 5) e importar mostra "2 produto(s) importado(s) com sucesso" e a listagem de produtos atualiza com os 2 novos itens.

- [ ] **Step 4: Rodar a suíte completa e o typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS — sem regressões.

- [ ] **Step 5: Commit**

```bash
git add components/painel/ImportarProdutosModal.tsx app/painel/produtos/ProdutosClient.tsx app/painel/produtos/page.tsx
git commit -m "feat: UI de importação de produtos via CSV (Pro)"
```

---

### Task 7: Atualizar a landing page com o novo diferencial

**Files:**
- Modify: `app/landing/data.tsx`

**Interfaces:**
- Nenhuma — só texto estático consumido por `app/page.tsx` (já existente, não muda).

- [ ] **Step 1: Adicionar a linha em `proFeatures`**

Ler `app/landing/data.tsx` linhas 106-122 antes de editar (já lido nesta sessão). Importação em massa é só Pro, então só essa lista ganha a linha nova:

```ts
export const proFeatures = [
  "Produtos ilimitados",
  "Categorias ilimitadas",
  "5 fotos por produto",
  "Importação de produtos por planilha",
];
```

Se outro plano deste pacote (personalização ou domínio) já tiver adicionado uma linha a `proFeatures` antes deste, **adicionar a linha nova junto às existentes**, não sobrescrever o array.

- [ ] **Step 2: Verificação manual**

Run: `npm run dev`, abrir `/` e rolar até a seção "Planos".
Expected: o card Pro lista "Importação de produtos por planilha" como um dos itens.

- [ ] **Step 3: Commit**

```bash
git add app/landing/data.tsx
git commit -m "feat: adiciona importação por planilha às features do plano Pro na landing"
```

---

## Self-Review

**Cobertura da spec (§4, §5.4, §7, §8 de `2026-07-25-diferenciacao-planos-design.md`):**
- §4 (flag `csvImport`) → Task 1.
- §7.1 (formato do CSV: nome, preco, categoria, estoque, tamanhos, cores, descricao) → Task 3.
- §7.2 (regras de processamento: categoria criada respeitando limite, cor não reconhecida = erro, corte exato no limite de produtos, sem verificação de duplicidade, produto nasce ativo/sem destaque/sem fotos) → Task 4.
- §5.4 (CSV de exemplo, upload, resumo pós-importação) → Tasks 5 e 6.
- §8 (validação de plano no servidor, erro isolado por linha) → Task 4.
- Importação de fotos via URL e atualização de produto existente por nome — fora de escopo, conforme §11.2 da spec; nenhuma task implementa nenhum dos dois.
- Atualização da landing page com o novo diferencial → Task 7.

**Checagem de tipos:** `ProductRowResult`/`ParsedProductRow` (Task 3) são os mesmos tipos importados e usados em `importProductsCsv` (Task 4) sem redefinição paralela. `ImportCsvState` (Task 4) é o mesmo tipo consumido por `ImportarProdutosModal` (Task 6) via `useActionState<ImportCsvState, FormData>`.

**Placeholders:** nenhum "TBD" — a nota sobre `is_featured` na Task 4 é uma dependência cruzada explícita e acionável (incluir a linha comentada se a outra migration já rodou), não uma lacuna.

---

Plano completo e salvo em `docs/superpowers/plans/2026-07-25-importacao-csv.md`.
