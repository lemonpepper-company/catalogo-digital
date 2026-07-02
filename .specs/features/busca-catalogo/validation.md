# Validation — Busca no Catálogo

**Verdict: ✅ PASS** (com 1 nota de acompanhamento, não bloqueante)

Diff range: `50bab95` (branch `fix/busca-catalogo`).

## Gate

- Suíte completa: **141/141 testes verdes** (`npx vitest run`).
- Typecheck: `npx tsc --noEmit` limpo.

## Per-AC (evidência)

| AC | Descrição | Evidência | Status |
| -- | --------- | --------- | ------ |
| CAT-B01 | Lupa exibe/oculta campo de busca | `StoreHeader.test.tsx`: input ausente quando fechado / presente quando aberto; clique aciona `onToggleSearch` | ✅ |
| CAT-B02 | Filtra por substring do nome, case/accent-insensitive | `filterCatalog`: "VEST"→[a,c]; "vest"→"Véstido"; `normalizeSearch` | ✅ |
| CAT-B03 | Interseção categoria ∩ nome | `filterCatalog(catalog,"Blusas","seda")`→["b"] | ✅ |
| CAT-B04 | Termo em branco = sem filtro | `filterCatalog(...,"   ")`→todos da categoria | ✅ |
| CAT-B05 | Sem correspondência → vazio (estado vazio no client) | `filterCatalog(...,"sapato")`→[] + copy ciente da busca em `CatalogoClient` | ✅ |
| CAT-B06 | Fechar limpa o termo | `toggleSearch` zera `searchQuery` ao fechar (unit no hook via header toggle) | ✅ |

## Discrimination sensor

3 mutantes injetados em `filterCatalog`, todos mortos:

1. substring → igualdade exata: **3 testes falharam** ✅
2. remover normalização de acento no nome: **1 teste falhou** ✅
3. ignorar categoria (quebra interseção): **2 testes falharam** ✅

## Nota de acompanhamento — RESOLVIDA

- A barra de pills usava `sticky top-[69px]` (altura do header antigo); com a busca aberta o header cresce (122px) e as pills sobrepunham sua base ao rolar. **Corrigido** (commit `72d16bf`): header + pills agora ficam num único container `sticky top-0`, grudando como um bloco independente da altura do header. Verificado no browser: `pillsTop (136.7) >= headerBottom (122.7)` → sem sobreposição.

## Preview (executado)

Stack local de pé (Docker + `supabase start`, loja seed `atelie-mira`, 4 produtos ativos). Verificado em `http://localhost:3000/atelie-mira` (mobile 375×812):

- CAT-B01: clicar na lupa abre o input (autofocus); vira X. ✅
- CAT-B02: "VESTIDO" (caixa alta) → só "Vestido midi linho areia"; "trico" (sem acento) → "Blusa de tricô off-white". ✅
- CAT-B03: "midi" → Vestido + Saia; ao ativar pill "Saias" → só "Saia midi plissada". ✅
- CAT-B05: "sapato" → grid vazio com copy "Nenhuma peça encontrada / Tente buscar por outro nome". ✅
- CAT-B06: fechar (X) remove o input, restaura a lupa e limpa o termo (reabrir mostra campo vazio). ✅
