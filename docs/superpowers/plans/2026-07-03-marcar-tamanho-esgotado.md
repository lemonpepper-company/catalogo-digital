# Marcar Tamanho Como Esgotado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao lojista um jeito de marcar/desmarcar um tamanho de produto como esgotado direto no formulário do painel (`/painel/produtos`), reaproveitando o campo `soldSizes` que já existe no estado do formulário e já é persistido pelo backend.

**Architecture:** Mudança isolada em um único arquivo, `app/painel/produtos/ProdutoFormClient.tsx`. O componente `ChipEditor` (hoje só usado para a lista de "Tamanhos") ganha duas props opcionais — `soldItems` e `onToggleSold` — e passa a renderizar cada chip com duas áreas de clique independentes: o texto do tamanho alterna esgotado/disponível, o botão X continua removendo o item. Nenhuma mudança de backend, schema, ou server action — tudo isso já existe.

**Tech Stack:** Next.js App Router, React (client component, `"use client"`), Tailwind CSS, TypeScript. Sem dependências novas.

## Global Constraints

- Nenhuma mudança de backend/persistência — `soldSizes`/`sold_sizes` já é lido e gravado por `app/actions/produtos.ts` e pelo hook `use-produto-form.ts`.
- O modelo de disponibilidade continua binário (esgotado/disponível) — não introduzir quantidade numérica por tamanho.
- Estilo do chip esgotado deve reaproveitar o idioma visual já usado no catálogo público (`line-through`, `text-inactive`), não inventar um novo padrão visual.
- Sem testes automatizados novos (decisão do spec: é uma mudança de wiring de UI, sem lógica de negócio nova — a leitura/gravação de `soldSizes` já está coberta pelos testes existentes do backend). A verificação desta rodada é manual, via navegador, no painel e no catálogo público.

---

### Task 1: `ChipEditor` suporta alternar item como esgotado

**Files:**
- Modify: `app/painel/produtos/ProdutoFormClient.tsx:297-332` (componente `ChipEditor`)

**Interfaces:**
- Consumes: nada de tasks anteriores (primeira task).
- Produces: `ChipEditor` aceita as props `soldItems?: string[]` e `onToggleSold?: (item: string) => void`, usadas pela Task 2.

- [ ] **Step 1: Ler o estado atual do componente para confirmar o texto exato a substituir**

O componente atual (linhas 296-332):

```tsx
/* ─── Chip editor (tamanhos) ─── */
function ChipEditor({
  title,
  items,
  setItems,
}: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
}) {
  return (
    <div className="py-1 pb-4">
      <div className="font-body font-medium text-[13px] text-obsidian mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-pill bg-linen border border-sand font-body text-[13px] text-obsidian"
          >
            {it}
            <button
              type="button"
              onClick={() => setItems(items.filter((x) => x !== it))}
              aria-label={`Remover ${it}`}
              className="w-5 h-5 rounded-full text-graphite hover:text-obsidian flex items-center justify-center transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <ChipInput onAdd={(v) => !items.includes(v) && setItems([...items, v])} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Substituir pelo componente com suporte a `soldItems`/`onToggleSold`**

```tsx
/* ─── Chip editor (tamanhos) ─── */
function ChipEditor({
  title,
  items,
  setItems,
  soldItems,
  onToggleSold,
}: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
  soldItems?: string[];
  onToggleSold?: (item: string) => void;
}) {
  return (
    <div className="py-1 pb-4">
      <div className="font-body font-medium text-[13px] text-obsidian mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {items.map((it) => {
          const isSold = soldItems?.includes(it) ?? false;
          return (
            <span
              key={it}
              className={[
                "inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-pill border font-body text-[13px]",
                isSold
                  ? "bg-linen border-sand text-inactive line-through"
                  : "bg-linen border-sand text-obsidian",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onToggleSold?.(it)}
                disabled={!onToggleSold}
                aria-label={
                  isSold ? `Marcar ${it} como disponível` : `Marcar ${it} como esgotado`
                }
                className="disabled:cursor-default"
              >
                {it}
              </button>
              <button
                type="button"
                onClick={() => setItems(items.filter((x) => x !== it))}
                aria-label={`Remover ${it}`}
                className="w-5 h-5 rounded-full text-graphite hover:text-obsidian flex items-center justify-center transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <ChipInput onAdd={(v) => !items.includes(v) && setItems([...items, v])} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rodar o type-check para confirmar que o arquivo compila**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `ProdutoFormClient.tsx` (o chamador ainda não passa as novas props — isso é esperado e resolvido na Task 2; props opcionais não quebram a chamada existente).

- [ ] **Step 4: Commit**

```bash
git add app/painel/produtos/ProdutoFormClient.tsx
git commit -m "feat: ChipEditor suporta alternar item como esgotado"
```

---

### Task 2: Ligar o toggle de esgotado aos tamanhos do formulário

**Files:**
- Modify: `app/painel/produtos/ProdutoFormClient.tsx:182` (chamada do `ChipEditor` para "Tamanhos")

**Interfaces:**
- Consumes: `ChipEditor` com props `soldItems`/`onToggleSold` (Task 1). `f.sizes: string[]`, `f.setSizes: (items: string[]) => void`, `f.soldSizes: string[]`, `f.setSoldSizes: (items: string[]) => void` — já existentes em `use-produto-form.ts:27-28,136-138`.
- Produces: comportamento final visível ao usuário — nada consome isso depois (última task).

- [ ] **Step 1: Substituir a chamada atual do `ChipEditor` para tamanhos**

Linha 182 hoje:

```tsx
<ChipEditor title="Tamanhos" items={f.sizes} setItems={f.setSizes} />
```

Substituir por:

```tsx
<ChipEditor
  title="Tamanhos"
  items={f.sizes}
  setItems={(items) => {
    f.setSizes(items);
    f.setSoldSizes(f.soldSizes.filter((s) => items.includes(s)));
  }}
  soldItems={f.soldSizes}
  onToggleSold={(size) =>
    f.setSoldSizes(
      f.soldSizes.includes(size)
        ? f.soldSizes.filter((s) => s !== size)
        : [...f.soldSizes, size]
    )
  }
/>
```

- [ ] **Step 2: Rodar o type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação manual no painel (navegador)**

1. Rodar o servidor de dev (`npm run dev` ou preview tool equivalente) e abrir `/painel/produtos/novo` (ou editar um produto existente com tamanhos cadastrados).
2. Na seção "Variações" → "Tamanhos": cadastrar/confirmar tamanhos como `PP, P, M, G`.
3. Clicar no **texto** de um tamanho (ex: `M`) → o chip deve ficar riscado (`line-through`) e acinzentado (`text-inactive`), sem remover o tamanho da lista.
4. Clicar novamente no texto do mesmo tamanho → volta ao estilo normal (disponível).
5. Clicar no **X** de um tamanho marcado como esgotado → o tamanho some da lista (comportamento de remoção inalterado).
6. Salvar o produto, recarregar a página de edição → o tamanho marcado como esgotado deve continuar riscado (confirma que `soldSizes` foi persistido e recarregado corretamente).

Expected: todos os passos acima se comportam como descrito, sem erros no console do navegador.

- [ ] **Step 4: Verificação manual no catálogo público (navegador)**

1. Abrir a página pública do produto editado (`/[slug]`, tela de detalhe do produto).
2. Confirmar que o tamanho marcado como esgotado no painel aparece riscado e desabilitado para o cliente (mesmo comportamento já existente em `ProductDetail.tsx:207-217`, agora alimentado por um dado configurável pelo lojista).

Expected: tamanho esgotado bloqueado para seleção/compra; demais tamanhos normais.

- [ ] **Step 5: Commit**

```bash
git add app/painel/produtos/ProdutoFormClient.tsx
git commit -m "feat: liga toggle de tamanho esgotado ao formulario de produto"
```
