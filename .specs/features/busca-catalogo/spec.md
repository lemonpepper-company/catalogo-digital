# Busca no Catálogo — Specification

## Problem Statement

O catálogo público (`app/[slug]/`) tem um ícone de lupa no header (`StoreHeader.tsx:41`) que é **decorativo**: não tem `onClick`, não existe campo de busca, não há estado de busca em `use-catalogo.ts`, e `filteredProducts` filtra **apenas por categoria**. O usuário reportou que "a busca não funciona" — de fato ela nunca foi implementada (estava explicitamente marcada como Out of Scope no V1 do catálogo público, ver AD/`catalogo-publico`). Este ciclo liga a busca de produtos por nome.

## Goals

- [ ] Cliente final consegue buscar produtos por nome dentro do catálogo da loja
- [ ] O ícone de lupa passa a abrir/fechar um campo de busca funcional
- [ ] A busca combina com o filtro de categoria já existente (interseção)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Busca por categoria / descrição | Decisão do usuário: **name only** neste ciclo |
| Busca com debounce / fetch server-side | Todos os produtos visíveis já estão no client; filtro é em memória |
| Histórico de busca / sugestões / autocomplete | Fora do escopo do fix |
| Persistência do termo de busca (URL / localStorage) | Estado efêmero no client, como o filtro de categoria atual |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| UX da busca | Ícone de lupa **alterna** (toggle) a exibição de um campo de input; fechar/limpar oculta e zera o termo | Escolha do usuário ("Toggle input"). Mantém o header mobile-first limpo | y |
| Campos pesquisados | **Somente `product.name`** | Escolha do usuário ("Name only") | y |
| Sensibilidade | Case-insensitive **e** accent-insensitive; substring match | Loja BR (acentos comuns). Reutiliza padrão de normalização de `lib/auth/slugify.ts` (`normalize('NFD')`) | n (assumido) |
| Combinação com categoria | Interseção: produto precisa casar categoria ativa **e** termo de busca | Comportamento previsível; não sobrescreve o filtro de pill | n (assumido) |
| Termo vazio / só espaços | Trata como "sem busca" (mostra todos da categoria) | Evita grid vazio acidental | n (assumido) |
| Estado vazio da busca | Reusa o bloco "Nenhuma peça disponível" já existente em `CatalogoClient.tsx` | Sem novo componente; menor risco | n (assumido) |

**Open questions:** nenhuma bloqueante.

---

## User Story

### P1: Buscar produto por nome ⭐ MVP

**User Story**: Como cliente final navegando o catálogo de uma loja, quero digitar parte do nome de uma peça e ver o grid filtrado, para encontrar rápido o que procuro.

**Acceptance Criteria**:

1. **CAT-B01** — WHEN o visitante clica no ícone de lupa THEN o sistema SHALL exibir um campo de busca (input) focável no catálogo.
2. **CAT-B02** — WHEN o visitante digita um termo THEN o grid SHALL exibir apenas produtos cujo `name` contém o termo (substring), ignorando maiúsculas/minúsculas e acentos.
3. **CAT-B03** — WHEN há uma categoria ativa (pill diferente de "Todos") **e** um termo de busca THEN o grid SHALL exibir apenas produtos que satisfazem **ambos** (interseção categoria ∩ nome).
4. **CAT-B04** — WHEN o termo de busca está vazio ou contém só espaços THEN o sistema SHALL comportar-se como sem busca (todos os produtos da categoria ativa).
5. **CAT-B05** — WHEN nenhum produto casa o termo (com a categoria ativa) THEN o sistema SHALL exibir o estado vazio "Nenhuma peça disponível".
6. **CAT-B06** — WHEN o visitante fecha a busca (clica na lupa novamente / limpa) THEN o sistema SHALL ocultar o campo e restaurar o grid sem filtro de nome.

---

## Impacted Files

| Arquivo | Mudança |
| ------- | ------- |
| `app/[slug]/use-catalogo.ts` | Novo estado `searchOpen` + `searchQuery`; helper de normalização; `filteredProducts` passa a aplicar categoria ∩ nome |
| `components/catalogo/StoreHeader.tsx` | Lupa recebe `onClick` (toggle) + renderiza input controlado quando aberta |
| `app/[slug]/CatalogoClient.tsx` | Repassa props de busca (`searchOpen`, `searchQuery`, setters) ao `StoreHeader` |
| `__tests__/*` | Testes unitários da lógica de filtro (AC CAT-B02..B05) + toggle do header (CAT-B01/B06) |

## Verification (test intent — derivado dos ACs, não da implementação)

- Filtro por nome: "vest" casa "Vestido Longo"; "VEST" casa (case); "vestido" casa "Véstido" e "vést" casa "Vestido" (acento). → CAT-B02
- Interseção: categoria "Blusas" + termo "seda" só retorna blusas de seda, não vestidos de seda. → CAT-B03
- Termo "   " (espaços) → retorna todos da categoria. → CAT-B04
- Termo sem correspondência → lista vazia (dispara estado vazio no client). → CAT-B05
- Header: clicar na lupa exibe input; clicar de novo oculta e limpa. → CAT-B01/B06
