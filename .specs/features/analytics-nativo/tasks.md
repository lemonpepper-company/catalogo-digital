# Analytics Nativo — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/analytics-nativo/design.md`
**Status**: ✅ **Executada** (2026-07-30) — T1–T13 concluídas, 12 commits atômicos na branch `feature/analytics-nativo`. Suíte: 82 arquivos / 928 testes (baseline 837). Lint: 19 = baseline real da `main` (o número 17 registrado aqui estava desatualizado — `use-catalogo.ts` e `SlugInput.tsx` já erravam na main).

**Pré-requisito de execução**: criar branch `feature/analytics-nativo` a partir de `main`. Supabase local rodando (`npx supabase start`) para T1–T3 e T13. Baseline da suíte: **77 arquivos / 837 testes verdes** (2026-07-30, pós-merge dos PRs #70/#71). Lint: baseline pré-existente de 17 erros — nenhum erro novo.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md` (cuidados de grants/CI), `docs/CONVENTIONS.md` ("Vitest + Testing Library para testes unitários"), `vitest.config.ts` (jsdom, sem threshold de coverage).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Lib pura (`lib/catalog-metrics.ts`, `lib/analytics-client.ts`, `lib/validation/evento.ts`) | unit | Todos os branches; 1:1 com ACs da spec; todo edge case listado | `__tests__/<nome>.test.ts` | `npx vitest run __tests__/<alvo>` |
| Server Action / lib server (`app/actions/eventos.ts`, `lib/server/analytics.ts`) | unit (Supabase mockado) | 1:1 com ACs; caminhos de erro todos cobertos (padrão `registrar-pedido.test.ts` / `server-pedidos.test.ts`) | `__tests__/*.test.ts` | `npx vitest run __tests__/<alvo>` |
| Hooks / Components / Pages (`use-catalogo`, `use-dashboard`, `DashboardClient`, `DashboardPage`, `CatalogoClient`) | unit (Testing Library, jsdom) | Happy + edge + estados bloqueado/vazio/erro (padrão `DashboardPage.test.tsx`) | `__tests__/*.test.tsx` | `npx vitest run __tests__/<alvo>` |
| Migrations SQL / workflow CI | none | Gate = migration aplicada no Supabase local + asserts SQL de privilégio (comandos no Done when) + passo de CI estendido | `supabase/migrations/`, `.github/workflows/` | ver Done when das tasks T1–T3 |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (vitest) | Yes | Isolamento por arquivo (workers do vitest); Supabase sempre mockado; `localStorage`/`sessionStorage` por ambiente jsdom com limpeza em `beforeEach` | `__tests__/registrar-pedido.test.ts` (mock de `lib/supabase/admin`), `__tests__/Analytics.test.tsx` (`localStorage.clear()` em `beforeEach`) |
| SQL/manual (migrations) | No | Banco Supabase local único compartilhado | `supabase/config.toml` — uma instância |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após task com testes unit do próprio alvo | `npx vitest run __tests__/<arquivo-alvo>` |
| Full | Após task que toca arquivos com testes existentes (hooks/pages) | `npx vitest run` (≥ 837 testes, zero falha) |
| Build | Fim de fase e tasks só-SQL/config | `npx vitest run && npm run build` (lint não pode passar de 17 erros pré-existentes) |

---

## Execution Plan

```
Phase 1 (Sequencial — fundação SQL):
  T1 ──→ T2 ──→ T3

Phase 2 (após T1 — captura):
  T4 ──→ T5 ──→ T6 ──→ T7

Phase 3 (após T2 — leitura e dashboard):
  T8 ──→ T9 ──→ T11 ──→ T12
  (T9 depende de T8 e T2; T10 foi REMOVIDA — supersedida pelo PR #71)

Phase 4 (Sequencial — integração final):
  T13 (depende de T7 e T12)
```

> 4 fases → na ativação do Execute, oferecer a delegação de um sub-agente por fase (offer-then-confirm), conforme a skill.

---

## Task Breakdown

### T1: Migration `catalog_events` (tabela + RLS + grants) — ✅ Concluída (`3f768a7`)

**What**: Criar `supabase/migrations/<timestamp>_catalog_events.sql` com a DDL exata do design (tabela, 3 índices, RLS + policy own-store para `authenticated`, revokes, `grant select to authenticated`, `grant select, insert to service_role`). Timestamp mais novo que toda migration existente (guard de ordem do CI).
**Where**: `supabase/migrations/`
**Depends on**: None
**Reuses**: `supabase/migrations/20260727000000_orders.sql` (estrutura), `20260728000000_orders_service_role_grants.sql` (grants)
**Requirement**: ANL-10, ANL-17 (policy), ANL-11 (grants)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `npx supabase migration up` aplica sem erro no banco local
- [x] `select has_table_privilege('service_role','public.catalog_events','insert') and has_table_privilege('service_role','public.catalog_events','select');` → `true`
- [x] `select count(*) from information_schema.role_table_grants where table_name='catalog_events' and grantee='anon';` → `0` e mesma consulta em `column_privileges` → `0`
- [x] Insert com `event_type` fora do check → erro; insert válido via psql (role postgres) → ok; linha de teste removida (rollback)
- [x] Gate: `npx vitest run && npm run build` (837 testes verdes, build ok)

**Tests**: none (matriz: camada SQL) · **Gate**: build

**Commit**: `feat(analytics): cria tabela catalog_events com RLS e grants`

---

### T2: Migration funções de leitura (`get_catalog_metrics`, `get_top_viewed_products`) — ✅ Concluída (`58d2552`)

**What**: Criar migration com as duas funções `language sql stable` **security invoker** conforme assinaturas do design — `p_from`/`p_to` **anuláveis** (`(p_from is null or occurred_at >= p_from) and (p_to is null or occurred_at <= p_to)`, cobrindo presets, range customizado e "tudo") — com `revoke execute ... from public, anon` e `grant execute ... to authenticated, service_role`.
**Where**: `supabase/migrations/<timestamp>_catalog_metrics_functions.sql`
**Depends on**: T1
**Reuses**: assinaturas e agregações do design (Data Models); semântica de range de `lib/period-filter.ts` (`null` = tudo)
**Requirement**: ANL-12 (agregação), ANL-17, ANL-22

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Migration aplica sem erro
- [x] Seed SQL temporário (2 lojas, eventos dos 4 tipos, visitantes repetidos entre dias) → `get_catalog_metrics` devolve visits/únicos/buy_clicks/bag_visitors esperados (únicos SEM supercontagem entre dias) em 3 recortes: from+to, só from e `null`/`null` ("tudo"); `get_top_viewed_products` ordena por views desc e respeita `p_limit`; seed removido
- [x] `select has_function_privilege('anon','public.get_catalog_metrics(uuid,timestamptz,timestamptz)','execute');` → `false` (idem `get_top_viewed_products(uuid,timestamptz,timestamptz,integer)`)
- [x] Gate: `npx vitest run && npm run build`

**Tests**: none (camada SQL) · **Gate**: build

**Commit**: `feat(analytics): funções SQL de métricas do catálogo (security invoker)`

---

### T3: Estender guard de privilégios no CI — ✅ Concluída

**What**: No passo `Check table privileges` de `.github/workflows/supabase-migrations-check.yml`, adicionar: `service_role` com `select`+`insert` em `catalog_events`; `anon` com zero privilégio de tabela E de coluna em `catalog_events` (mesma técnica de `information_schema.column_privileges` usada para `orders`); `has_function_privilege('anon', …)` = false para `get_catalog_metrics(uuid,timestamptz,timestamptz)` e `get_top_viewed_products(uuid,timestamptz,timestamptz,integer)`.
**Where**: `.github/workflows/supabase-migrations-check.yml`
**Depends on**: T2
**Reuses**: SQL existente do próprio passo (`:119-177`)
**Requirement**: ANL-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Passo do CI extraído do YAML e executado como o CI faria contra o banco local migrado → exit 0
- [x] Testes negativos (3): `revoke insert ... from service_role`, `grant select (visitor_id) ... to anon` e `grant execute ... to anon` → cada um faz o passo falhar com exit 3 e mensagem específica; privilégios restaurados e passo volta a exit 0
- [x] YAML válido (parseado com js-yaml; passo extraído programaticamente)
- [x] Gate: `npx vitest run && npm run build`

**Tests**: none (workflow) · **Gate**: build

**Commit**: `ci(analytics): guarda de privilégios cobre catalog_events e funções de métricas`

---

### T4: Schema de validação do payload de evento — ✅ Concluída (`4880182`)

**What**: Criar `lib/validation/evento.ts` com `eventPayloadSchema` (slug, visitorId uuid, eventType enum 4 valores, productId uuid|null) + regra cruzada: `product_view`/`add_to_bag` exigem `productId`; `catalog_visit`/`buy_click` exigem `productId` nulo/ausente. Testes 1:1 com ANL-08 (cada campo inválido + as 4 combinações da regra cruzada, válidas e inválidas).
**Where**: `lib/validation/evento.ts` + `__tests__/evento-validation.test.ts`
**Depends on**: None
**Reuses**: `lib/validation/pedido.ts` (estilo zod), `__tests__/pedido-validation.test.ts` (estilo de teste)
**Requirement**: ANL-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Payloads válidos dos 4 tipos passam; inválidos falham com issue identificável
- [ ] Gate: `npx vitest run __tests__/evento-validation.test.ts`
- [ ] Test count: suíte total ≥ 837 + novos (sem deleção silenciosa)

**Tests**: unit · **Gate**: quick

**Commit**: `feat(analytics): schema de validação do payload de evento`

---

### T5: Server Action `registrarEvento` — ✅ Concluída (`bffe6ff`)

**What**: Criar `app/actions/eventos.ts` com `registrarEvento(payload: unknown): Promise<{ok: boolean}>` seguindo o fluxo do design: zod → loja por slug com `is_active=true` → se `productId`, posse via `products.id+store_id` (sem exigir `is_active`) → insert via `createAdminClient()`. Nunca lança; `console.error` em toda falha; sem consulta de plano; sem rate-limit (AD-013). Testes com admin client mockado: sucesso dos 4 tipos, payload inválido, loja inexistente/inativa, produto de outra loja, erro de insert, exceção inesperada — nada gravado nos casos de falha.
**Where**: `app/actions/eventos.ts` + `__tests__/registrar-evento.test.ts`
**Depends on**: T4 (schema; T1 só no runtime real)
**Reuses**: `app/actions/pedidos.ts` (`registrarPedido`, esqueleto completo), `__tests__/registrar-pedido.test.ts` (mocks)
**Requirement**: ANL-07, ANL-08, ANL-09, ANL-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Todos os caminhos de erro retornam `{ok:false}` sem lançar; sucesso insere com colunas corretas (`store_id`, `event_type`, `product_id`, `visitor_id`)
- [ ] Teste explícito: plano `free` não é consultado (nenhuma chamada a plano/limits)
- [ ] Gate: `npx vitest run __tests__/registrar-evento.test.ts`
- [ ] Test count: suíte total verde, ≥ anterior

**Tests**: unit · **Gate**: quick

**Commit**: `feat(analytics): server action registrarEvento via service role`

---

### T6: Client de analytics (`lib/analytics-client.ts`) — ✅ Concluída (`2ea8c07`)

**What**: Criar `getVisitorId()` (persistência em `localStorage["cd_visitor_id"]`; consent `"rejected"` na chave `cookie-consent` → UUID efêmero de módulo; sem storage → efêmero), `shouldTrackVisit(slug)` (dedup `sessionStorage["cd_visited_"+slug]`, fallback memória) e `trackEvent(slug, type, productId?): void` (fire-and-forget, `void ...catch(()=>{})`, **retorno `void`, nunca Promise**). Testes: persistência/reuso do id, consent rejected → id muda entre "páginas" (novo import/módulo) e não grava em localStorage, dedup por slug, storage indisponível não lança, trackEvent não propaga rejeição.
**Where**: `lib/analytics-client.ts` + `__tests__/analytics-client.test.ts`
**Depends on**: T5 (importa `registrarEvento`)
**Reuses**: `components/analytics/use-cookie-consent.ts` (chave/valores de consent), `__tests__/Analytics.test.tsx` (limpeza de storage em `beforeEach`)
**Requirement**: ANL-01, ANL-02, ANL-06, ANL-21

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] ANL-06: nenhum campo além de slug/visitorId/eventType/productId no payload
- [ ] ANL-21: com `cookie-consent="rejected"`, `localStorage` não recebe `cd_visitor_id` e eventos ainda disparam
- [ ] Gate: `npx vitest run __tests__/analytics-client.test.ts`
- [ ] Test count: suíte total verde, ≥ anterior

**Tests**: unit · **Gate**: quick

**Commit**: `feat(analytics): identidade anônima e disparo fire-and-forget no client`

---

### T7: Instrumentação do catálogo (`use-catalogo.ts` + `CatalogoClient`) — ✅ Concluída (`9bc776f`)

**What**: Ligar os 4 disparos: `useEffect` de montagem com `shouldTrackVisit` (visita); novo `handleOpenProduct(product)` substituindo `setOpenProduct` direto no `CatalogoClient` (product_view); track em `handleAdd` (add_to_bag); track em `handleCheckout` logo após o guard de WhatsApp, **antes de `window.open` e fora do `Promise.race`** (buy_click). Atualizar testes de `use-catalogo` e `CatalogoClient`.
**Where**: `app/[slug]/use-catalogo.ts`, `app/[slug]/CatalogoClient.tsx` + `__tests__/use-catalogo.test.ts`, `__tests__/CatalogoClient.test.tsx`
**Depends on**: T6
**Reuses**: contrato existente dos componentes (AD-006 — nenhuma prop de componente de catálogo muda)
**Requirement**: ANL-01, ANL-02, ANL-03, ANL-04, ANL-05, ANL-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Cada AC ANL-01..05 tem teste: montar → 1 visita; remount na mesma sessão → 0; abrir produto → product_view com id; add → add_to_bag; checkout válido → buy_click
- [ ] ANL-07/edge: com `trackEvent` lançando/rejeitando, o WhatsApp abre e `registrarPedido` segue o fluxo normal (testes existentes de checkout permanecem verdes sem enfraquecer)
- [ ] buy_click disparado mesmo quando `registrarPedido` falha (edge da spec)
- [ ] Gate: `npx vitest run` (arquivos tocados têm testes pré-existentes)
- [ ] Test count: ≥ anterior, zero falha

**Tests**: unit · **Gate**: full

**Commit**: `feat(analytics): instrumenta visita, view, sacola e checkout no catálogo`

---

### T8: Métricas puras (`lib/catalog-metrics.ts`) — ✅ Concluída (`567d75b`)

**What**: Criar tipos do design (`CatalogEventMetrics`, `TopViewedProduct`) + `computeConversionPct(ordersInPeriod, bagVisitors)`: % com 1 casa, `null` quando `bagVisitors===0`, sem cap (>100% permitido). Testes 1:1: zeros, divisor zero → null, >100%, arredondamento.
**Where**: `lib/catalog-metrics.ts` + `__tests__/catalog-metrics.test.ts`
**Depends on**: None
**Reuses**: `lib/order-metrics.ts` (padrão puro), `__tests__/order-metrics.test.ts`
**Requirement**: ANL-12, ANL-16

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Edge cases da spec cobertos (conversão "—" via null; >100% sem cap)
- [ ] Gate: `npx vitest run __tests__/catalog-metrics.test.ts`
- [ ] Test count: suíte total verde, ≥ anterior

**Tests**: unit · **Gate**: quick

**Commit**: `feat(analytics): view-model puro de métricas do catálogo`

---

### T9: Leitura server-side (`lib/server/analytics.ts`) — ✅ Concluída (`194c4af`)

**What**: Criar `getCatalogAnalytics(storeId, range: PeriodRange | null)` com `import "server-only"`: `Promise.all` das duas RPCs com `p_from`/`p_to` do range (`range === null` → ambos `null`, preset "tudo"); erro → `fail()` (nunca vira zero silencioso). **Sem query de `orders`** — numerador da conversão vem do `getOrderMetrics` já chamado pela page. Testes com client mockado: args das RPCs para range com from/to e para `null`, mapeamento do retorno, cada fonte de erro lança.
**Where**: `lib/server/analytics.ts` + `__tests__/server-analytics.test.ts`
**Depends on**: T8, T2 (nomes/assinaturas das funções SQL)
**Reuses**: `lib/server/pedidos.ts` (`fail()`, padrão), `lib/period-filter.ts` (`PeriodRange`), `__tests__/server-pedidos.test.ts` (mocks)
**Requirement**: ANL-12, ANL-13, ANL-17, ANL-22

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `range: null` propaga `p_from`/`p_to` nulos (teste explícito — ANL-22)
- [ ] Erro de qualquer RPC lança com contexto (`fail`) — 2 testes
- [ ] Gate: `npx vitest run __tests__/server-analytics.test.ts`
- [ ] Test count: suíte total verde, ≥ anterior

**Tests**: unit · **Gate**: quick

**Commit**: `feat(analytics): leitura server-side das métricas com RLS`

---

### ~~T10: Capability `hasAnalytics`~~ — REMOVIDA

**Supersedida pelo PR #71** (dashboard inteiro exclusivo de plano pago, early-return em `app/painel/page.tsx:21` antes de qualquer I/O). ANL-20 marcado como Superseded na spec; nenhuma capability nova é criada. Numeração das demais tasks mantida para estabilidade de referências.

---

### T11: Dashboard page — fetch de analytics com o range existente — ✅ Concluída (`939bf20`)

**What**: Em `app/painel/page.tsx`: extrair `resolvePeriodRange(params)` para uma variável (hoje é chamado inline no `getOrderMetrics`) e alimentar **ambos** `getOrderMetrics` e `getCatalogAnalytics` com o mesmo range (ANL-14/15); `getCatalogAnalytics` em try/catch (erro → loga e passa `analytics: null`, página não cai). Free já retorna antes (PR #71) — analytics entra depois do early-return (ANL-18). Passar `analytics` ao `DashboardClient`. Atualizar `__tests__/DashboardPage.test.tsx`: free não chama a lib; pago chama com o range resolvido dos mesmos params; erro de fetch → página renderiza com `analytics: null` e `metrics` intactos.
**Where**: `app/painel/page.tsx` + `__tests__/DashboardPage.test.tsx`
**Depends on**: T9
**Reuses**: gate de página do PR #71, `resolvePeriodRange` (PR #70), gate `hasOrderHistory` existente (ORD-29)
**Requirement**: ANL-14, ANL-15, ANL-18, ANL-19

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] ANL-18: com free, `getCatalogAnalytics` não é invocada (assert no mock)
- [ ] ANL-15: `getOrderMetrics` e `getCatalogAnalytics` recebem o MESMO objeto de range (assert)
- [ ] Edge: fetch lançando → página renderiza com `analytics: null`, sem quebrar pedidos
- [ ] Gate: `npx vitest run __tests__/DashboardPage.test.tsx`
- [ ] Test count: suíte total verde, ≥ anterior

**Tests**: unit · **Gate**: quick

**Commit**: `feat(analytics): dashboard busca métricas da vitrine com o período do filtro`

---

### T12: Dashboard UI — seção de analytics sob o filtro existente — ✅ Concluída (`14647cf`)

**What**: Em `use-dashboard.ts` + `DashboardClient.tsx`: seção "Sua vitrine em números" com `StatCard`s (visitas, únicos, cliques em comprar, conversão — `computeConversionPct(metrics.ordersThisMonth, analytics.bagVisitors)`, "—" quando null), lista top 5 mais vistos (cruzando `TopViewedProduct[]` com `products` das props; deletados filtrados); **mover o `PeriodoFiltro` do header de "Vendas pela vitrine" para acima das duas seções** (governa ambas — nenhum seletor novo); `analytics: null` → "—" + nota de indisponível. Atualizar `__tests__/DashboardClient.test.tsx`.
**Where**: `app/painel/use-dashboard.ts`, `app/painel/DashboardClient.tsx` + `__tests__/DashboardClient.test.tsx`
**Depends on**: T11
**Reuses**: `StatCard`, `PeriodoFiltro` (PR #70, apenas realocado), seção `orderStats` existente (layout de grid), `computeConversionPct` (T8)
**Requirement**: ANL-12, ANL-13, ANL-14, ANL-15, ANL-16

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Estados testados: com dados; zeros + conversão "—"; `analytics: null` (indisponível); top 5 filtra produto deletado e ordena por views
- [ ] `PeriodoFiltro` renderizado uma única vez, acima das seções de pedidos e analytics (testes existentes do filtro ajustados sem enfraquecer)
- [ ] Conversão exibida usa `ordersThisMonth` das `metrics` já presentes (sem fetch novo)
- [ ] Gate: `npx vitest run` (DashboardClient tem testes pré-existentes; conferir suíte inteira)
- [ ] Test count: ≥ anterior, zero falha

**Tests**: unit · **Gate**: full

**Commit**: `feat(analytics): seção de métricas da vitrine no dashboard`

---

### T13: Verificação integrada local (smoke E2E) — ✅ Concluída (sem fix, sem commit de código)

**What**: Com Supabase + `npm run dev` locais: fluxo real na vitrine (abrir catálogo, recarregar, abrir produto, adicionar à sacola, finalizar) → conferir via SQL as linhas de `catalog_events` (4 tipos; visita única após reload); logar no painel como a loja de teste (Starter/Pro) → conferir números alternando presets do `PeriodoFiltro` (7d/mês/tudo + um range customizado); simular consent rejected → `cd_visitor_id` ausente do localStorage e eventos ainda gravando; limpar dados de teste ao final (`delete from catalog_events where store_id = …`).
**Where**: — (verificação; nenhum código novo além de eventuais fixes)
**Depends on**: T7, T12
**Reuses**: roteiro do Independent Test das 3 stories da spec
**Requirement**: ANL-01..21 (integração)

**Tools**: MCP: `Claude_Browser` (preview + navegação) · Skill: NONE

**Done when**:

- [x] Evidência SQL colada no relatório (pré-teste 0 → 4 tipos gravados no fluxo real → 0 após limpeza)
- [x] Dashboard exibindo números reais em 4 recortes (mês 4/3/1, tudo 6/5/2, 7d 4/3/1, range customizado 2/2/1) — screenshots capturados; cada número conferido contra a mesma consulta em SQL
- [x] RLS own-store verificada sob role `authenticated`: loja alheia → zeros; `anon` → `permission denied` na função
- [x] ANL-21 verificado no navegador: consent `rejected` → `cd_visitor_id` ausente do localStorage, evento gravado mesmo assim
- [x] Dados de teste removidos (`catalog_events` = 0, pedido de teste removido, pedidos preexistentes intactos)
- [x] Gate: `npx vitest run && npm run build` (928 testes verdes, build ok)

**Tests**: none (verificação manual guiada) · **Gate**: build

**Commit**: `chore(analytics): ajustes da verificação integrada` (somente se houver fix; sem fix, não há commit)

---

## Parallel Execution Map

```
Phase 1: T1 ──→ T2 ──→ T3            (sequencial: banco local único)
Phase 2: T4 ──→ T5 ──→ T6 ──→ T7     (cadeia de imports)
Phase 3: T8 ──→ T9 (T8+T2) ──→ T11 ──→ T12    (T10 removida — PR #71)
Phase 4: T13 (T7 + T12)
```

**Parallelism constraint**: com a remoção de T10, a Phase 3 virou cadeia — nenhuma task `[P]` restante. Tasks SQL (T1–T3) nunca são `[P]` — banco compartilhado.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 migration | ✅ Granular |
| T2 | 1 migration (2 funções coesas do mesmo domínio) | ✅ OK |
| T3 | 1 passo de workflow | ✅ Granular |
| T4 | 1 schema + testes | ✅ Granular |
| T5 | 1 server action + testes | ✅ Granular |
| T6 | 1 lib client + testes | ✅ Granular |
| T7 | 1 hook + 1 wiring de componente (coesos: mesma instrumentação) + testes | ✅ OK |
| T8 | 1 lib pura + testes | ✅ Granular |
| T9 | 1 lib server + testes | ✅ Granular |
| T10 | — removida (PR #71) | — |
| T11 | 1 page + testes | ✅ Granular |
| T12 | 1 hook + 1 componente (mesma seção de UI, inclui realocação do `PeriodoFiltro`) + testes | ✅ OK |
| T13 | verificação integrada | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início da Phase 1 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | None | início da Phase 2 (Phase 2 "após T1" = runtime, não import) | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | None | início da Phase 3 | ✅ Match |
| T9 | T8, T2 | T8 → T9 (e Phase 3 "após T2") | ✅ Match |
| T10 | — removida | ausente do diagrama | ✅ Match |
| T11 | T9 | T9 → T11 | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T7, T12 | T7, T12 → T13 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Migration SQL | none (gate SQL manual + CI) | none | ✅ OK |
| T2 | Migration SQL | none (gate SQL manual + CI) | none | ✅ OK |
| T3 | Workflow CI | none (teste negativo manual) | none | ✅ OK |
| T4 | Lib pura (validation) | unit | unit | ✅ OK |
| T5 | Server Action | unit | unit | ✅ OK |
| T6 | Lib pura (client) | unit | unit | ✅ OK |
| T7 | Hook + Component | unit | unit | ✅ OK |
| T8 | Lib pura | unit | unit | ✅ OK |
| T9 | Lib server | unit | unit | ✅ OK |
| T10 | — removida | — | — | — |
| T11 | Page | unit | unit | ✅ OK |
| T12 | Hook + Component | unit | unit | ✅ OK |
| T13 | Verificação integrada | none (manual guiada) | none | ✅ OK |

---

## Requirement Coverage (spec ↔ tasks)

ANL-01/02 → T6, T7, T13 · ANL-03/04/05 → T7 · ANL-06 → T6 · ANL-07 → T5, T7 · ANL-08 → T4, T5 · ANL-09 → T5 · ANL-10 → T1, T5 · ANL-11 → T1, T3 · ANL-12 → T2, T8, T9, T12 · ANL-13 → T9, T12 · ANL-14 → T11, T12 · ANL-15 → T11, T12 · ANL-16 → T8, T12 · ANL-17 → T1, T2, T9 · ANL-18 → T11 · ANL-19 → T11 · ANL-20 → **Superseded (PR #71)**, sem task · ANL-21 → T6, T13 · ANL-22 → T2, T9, T13. **Coverage: 22 total — 21 ativos mapeados, 1 superseded, 0 unmapped ✅**
