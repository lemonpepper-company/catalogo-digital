# Captura de Pedidos — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/captura-de-pedidos/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada a partir do codebase, das diretrizes do projeto e da spec — confirmar antes do Execute. Diretrizes encontradas: `AGENTS.md` → `docs/CONVENTIONS.md` ("Vitest + Testing Library para testes unitários"; padrões de Server Action e hooks), `vitest.config.ts` (jsdom, globals, alias `@`, sem threshold de coverage), `.github/workflows/supabase-migrations-check.yml` (`supabase start` + `supabase db lint` como gate de migrations).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Módulos puros de domínio (`lib/orders.ts`, `lib/order-metrics.ts`, `lib/plan-limits.ts`) | unit | Todos os branches; 1:1 com as ACs da spec; toda edge case listada | `__tests__/*.test.ts` | `npx vitest run` |
| Schemas zod (`lib/validation/pedido.ts`) | unit | Aceita payload válido + rejeita cada regra (uuid, ≤20 linhas, qty, enums) | `__tests__/*.test.ts` | `npx vitest run` |
| Server Actions (`app/actions/pedidos.ts`) | unit (Supabase mockado, padrão de `__tests__/slug-check-route.test.ts`) | Happy path + cada caminho de erro/rejeição da spec | `__tests__/*.test.ts` | `npx vitest run` |
| Hooks (`use-catalogo`, `use-pedidos`, `use-dashboard`) | unit | Todo comportamento observável das ACs (inclui timeout, falha e pop-up bloqueado) | `__tests__/*.test.ts` | `npx vitest run` |
| Componentes client (`BagDrawer`, `PedidosClient`, `DashboardClient`, `Sidebar`, `MobileTabBar`) | unit (Testing Library) | Render + interação das ACs + estado vazio | `__tests__/*.test.tsx` | `npx vitest run` |
| Dados de conteúdo da landing (`app/landing/data.tsx`) | unit | Presença do card, do FAQ e do bullet nos 3 planos (ACs de ORD-25) | `__tests__/*.test.ts` | `npx vitest run` |
| Acesso a dados fino (`lib/server/pedidos.ts`) | **unit** (Supabase mockado com fake chain, padrão de `__tests__/registrar-pedido.test.ts:36-49`) | Cada cláusula de query que carrega outcome de AC (`eq`/`order`/`range`/`gte`) + happy path + caminho de erro | `__tests__/server-pedidos.test.ts` | `npx vitest run` |
| Migration SQL (`supabase/migrations/*.sql`) | none no vitest — **guard de privilégios no CI** (`has_table_privilege` via `psql` depois de aplicar as migrations) | Gate: migrations aplicam sem erro + `supabase db lint --level warning` + `service_role` com o DML que a captura usa e `anon` sem nenhum privilégio em `orders`/`order_items` | `.github/workflows/supabase-migrations-check.yml` | `npx supabase migration up` |
| Server Components / `page.tsx` / docs / conteúdo estático de página | none | Build gate | — | `npm run build` |

**Correção de 28/07/2026 (F2) — `lib/server/pedidos.ts` era `none` e a decisão estava errada.** A premissa era "camada fina de I/O, a lógica pura vive em `lib/orders.ts`/`lib/order-metrics.ts`". Só que os outcomes de ORD-12 (*apenas* os pedidos da própria loja, *ordenados* por `created_at` desc), ORD-13 (páginas de *20*), ORD-17/ORD-18 (mês corrente no fuso de SP) e ORD-19 (*todos* os pendentes, sem filtro de período) não vivem nos módulos puros — vivem nas cláusulas de query deste arquivo. Como as duas páginas mockam o módulo inteiro, ele nunca era exercido: o Verifier matou 9/9 mutantes fora dele e **0/5 dentro** (M10–M14 em `validation.md` §3). A lição geral: quando a única implementação de uma AC é a forma da query, a query precisa de teste — a extração de lógica pura não cobre o que ficou no builder.

## Parallelism Assessment

> Gerada a partir do codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (vitest, jsdom) | Yes | Vitest isola por arquivo; nenhum teste toca banco, rede ou disco — dependências são mockadas (`vi.mock`) ou os módulos são puros | `vitest.config.ts` (sem `singleThread`/`sequence`), `__tests__/slug-check-route.test.ts` (Supabase mockado), `__tests__/catalog.test.ts` (puro) |
| Migration (`supabase db reset`) | No | Um único Docker/Postgres local compartilhado | `.github/workflows/supabase-migrations-check.yml` sobe uma instância única |

## Gate Check Commands

> Gerada a partir do codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Depois de tasks com testes unitários | `npx vitest run` |
| Full | Igual ao Quick (não há suíte e2e/integração no projeto) + lint sem regressão | `npx vitest run && npm run lint` — ver **baseline de lint** abaixo |
| Build | Fim de fase, tasks de migration/config/docs | `npm run build && npm run lint && npx vitest run` — mesmo baseline de lint |
| Migration | Task da migration SQL | `npx supabase migration up && npx supabase db lint --level warning` (não destrutivo — aplica só as migrations pendentes). `supabase db reset` **apaga os dados locais**: só com autorização explícita do usuário. Se o Docker/stack estiver parado, `npx supabase start` primeiro. |

**Baseline de lint (medido em 27/07/2026, confirmado como pré-existente na `main`):** `npm run lint` termina com **17 erros** em 3 arquivos — `app/[slug]/use-catalogo.ts` (1), `app/painel/configuracoes/ConfiguracoesClient.tsx` (15), `components/ui/SlugInput.tsx` (1). São violações das regras novas `react-hooks/set-state-in-effect` e `react-hooks/refs` do `eslint-config-next` 16, sem relação com esta feature. Consertá-las aqui seria scope creep (mexe em comportamento de render de telas fora do escopo) — ficam como dívida separada.

**Critério do gate, portanto:** `npm run lint` **não pode passar de 17 erros** e **nenhum erro pode estar em arquivo criado ou modificado por esta feature** (exceto o erro pré-existente da linha 46 de `use-catalogo.ts`, que a T9 não deve piorar nem é obrigada a corrigir). Erro novo = gate falhou.

**Ambiente:** `npm install` foi executado em 27/07/2026 — `@vercel/speed-insights` estava declarado em `package.json` mas ausente de `node_modules`, o que fazia `npm run build` falhar. `package-lock.json` não mudou. `npm run build` passa desde então.

**Baseline medido em 27/07/2026 (antes da T1):** `npx vitest run` → **32 arquivos, 323 testes, todos verdes**. A suíte precisa continuar verde e nunca ficar abaixo de 323 testes.

---

## Execution Plan

### Phase 1: Fundação — schema, módulos puros e gate de plano (T1 sequencial, T2–T5/T7/T17 order-free)

```
T1 ──┬→ T2 [P]
     ├→ T3 [P]
     ├→ T4 [P]
     ├→ T5 [P]
     └→ T7 [P]
T17 [P]
```

### Phase 2: Captura no catálogo público

```
T2, T4, T5 ──→ T6 ──→ T9
T7 ──→ T8 ──→ T9
```

### Phase 3: Painel — histórico, status, ROI e gate de plano

```
T2, T3 ──→ T10 ──→ T11 ──→ T12
T10, T17 ──→ T14
T17 ──→ T11
T13 [P]
```

### Phase 4: Comunicação — landing, política e docs

```
T15 [P]
T16 [P]
```

---

## Task Breakdown

### T1: Migration de `orders` e `order_items` com RLS e grants ✅

**What**: criar as duas tabelas, índices, RLS escopada a `authenticated` por dono da loja, `grant select` + `grant update (status)` para `authenticated` e `revoke all` para `anon`.
**Where**: `supabase/migrations/20260727000000_orders.sql`
**Depends on**: None
**Reuses**: DDL de `supabase/migrations/20260616120000_painel_backend.sql`; lição de escopo de policy de `20260713230000_fix_rls_own_store_only_role_scope.sql`
**Requirement**: ORD-24 (schema base de ORD-01..23)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `orders` criada conforme `design.md` (incluindo `unique (store_id, client_order_id)` e `check` de status)
- [x] `order_items` criada com `product_id … on delete set null` e `check (qty between 1 and 99)`
- [x] Índices `orders_store_created_idx`, `orders_store_status_idx`, `order_items_order_id_idx` criados
- [x] RLS habilitada nas duas tabelas; todas as policies criadas com `to authenticated`
- [x] `grant select on orders`, `grant update (status) on orders`, `grant select on order_items` para `authenticated`; nenhum `insert` concedido a `authenticated`/`anon`
- [x] `revoke all on orders from anon` e `revoke all on order_items from anon` presentes
- [x] Gate passa: `npx supabase migration up && npx supabase db lint --level warning` (sem `db reset` — dados locais preservados)

**Tests**: none (gate de migration)
**Gate**: migration

**Commit**: `feat(db): adiciona tabelas orders e order_items com RLS por dono da loja`

**Status**: ✅ Complete — `8b5da6a`. Introspeção pós-gate confirmou: grants de `authenticated` = apenas `SELECT` (+ `UPDATE` na coluna `status`), zero privilégio para `anon`, 3 policies `{authenticated}`, RLS ligada, 3 índices e os `check`/FK esperados. Adição além do SQL de `design.md`: `revoke all … from authenticated` (marcado como `SPEC_DEVIATION` no arquivo) — necessário porque as default privileges do schema `public` concedem tudo em tabelas novas.

---

### T2: Módulo puro `lib/orders.ts` [P] ✅

**What**: constantes, status, sanitização do nome, resolução de itens com preço do banco, mapeamento de linha do banco para `StoreOrder` e gerador de `client_order_id`.
**Where**: `lib/orders.ts` (novo), `lib/types.ts` (adiciona `StoreOrder`/`StoreOrderItem`), `__tests__/orders.test.ts` (novo)
**Depends on**: T1
**Reuses**: estilo de `lib/catalog.ts` (decisão pura, sem I/O); `lib/pagination.ts` como referência de módulo puro testado
**Requirement**: ORD-02, ORD-06, ORD-10, ORD-14, ORD-22

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `ORDER_STATUSES`, `OrderStatus`, `isOrderStatus`, `MAX_ORDER_LINES`, `MAX_QTY`, `CUSTOMER_NAME_MAX` exportados
- [x] `sanitizeCustomerName` — trim, corta em 60, `""`/só-espaços/`null`/`undefined` → `null` (ORD-10)
- [x] `resolveOrderItems` — preço vem sempre da linha de produto; item sem produto correspondente é descartado; `totalCents` = Σ(unit × qty); `itemsCount` = Σ(qty); mesma combinação produto+tamanho+cor gera linhas distintas (ORD-02, ORD-06)
- [x] `mapOrderRow` converte linha do Supabase (snake_case + `order_items` aninhado) em `StoreOrder` (ORD-14)
- [x] `newClientOrderId` retorna uuid v4 válido usando `crypto.randomUUID` e mantém o formato quando `randomUUID` é indisponível
- [x] Gate passa: `npx vitest run`
- [x] Test count: ≥ 14 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `feat(orders): adiciona modulo puro de resolucao e mapeamento de pedidos`

**Status**: ✅ Complete — 23 testes novos (`__tests__/orders.test.ts`). Suíte 329 → 352. Discriminador de ORD-02: o payload do teste `:79` carrega `unitPriceCents: 1` adulterado e a assertion exige `19900` do banco.

---

### T3: Módulo puro `lib/order-metrics.ts` [P] ✅

**What**: corte do mês no fuso `America/Sao_Paulo` e cálculo das três métricas de ROI.
**Where**: `lib/order-metrics.ts` (novo), `__tests__/order-metrics.test.ts` (novo)
**Depends on**: T1
**Reuses**: `lib/orders.ts` só para o tipo `OrderStatus` (sem dependência circular de lógica)
**Requirement**: ORD-17, ORD-18, ORD-19, ORD-20

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `monthStartInSaoPaulo(now)` retorna o instante do dia 1 às 00:00 de São Paulo (verificado em janeiro e em julho, cobrindo o offset -03:00)
- [x] `computeOrderMetrics` — `ordersThisMonth` conta status ≠ `cancelado`; `confirmedCentsThisMonth` soma `total_cents` só de `confirmado`; `pendingCount` vem do total de pendentes recebido (ORD-17, ORD-18, ORD-19)
- [x] Lista vazia → `{ ordersThisMonth: 0, confirmedCentsThisMonth: 0, pendingCount: 0 }`, sem `NaN` (ORD-20)
- [x] Pedido cancelado não conta em nenhuma das duas métricas do mês (ORD-20/AC5 de ROI)
- [x] Gate passa: `npx vitest run`
- [x] Test count: ≥ 8 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `feat(orders): adiciona calculo puro das metricas de ROI do painel`

**Status**: ✅ Complete — 13 testes novos (`__tests__/order-metrics.test.ts`). Suíte 352 → 365. Discriminadores do fuso: `:26` (01/08 01:00 UTC ainda é julho em SP) e `:32` (virada de ano).

---

### T4: Schema zod do payload de captura [P] ✅

**What**: `orderPayloadSchema` validando slug, uuid, nome, pagamento/entrega por enum e itens (1..20, qty 1..99).
**Where**: `lib/validation/pedido.ts` (novo), `__tests__/pedido-validation.test.ts` (novo)
**Depends on**: T1
**Reuses**: estilo de `lib/validation/painel.ts`; valores de `PAYMENT_METHODS`/`DELIVERY_METHODS` em `lib/data.ts`
**Requirement**: ORD-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Payload válido mínimo (1 item, sem nome/pagamento/entrega) é aceito
- [x] Rejeita: `clientOrderId` não-uuid, `productId` não-uuid, 0 itens, 21 itens, `qty` 0, `qty` 100, `qty` fracionário, slug vazio
- [x] Rejeita `payment`/`delivery` fora dos valores de `PAYMENT_METHODS`/`DELIVERY_METHODS`
- [x] Aceita `customerName` acima de 60 caracteres (o corte é do `sanitizeCustomerName`, não uma rejeição — AC de edge case)
- [x] Usa `.error.issues[0].message` (Zod v4) conforme `docs/CONVENTIONS.md`
- [x] Gate passa: `npx vitest run`
- [x] Test count: ≥ 10 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `feat(orders): adiciona schema zod do payload publico de pedido`

**Status**: ✅ Complete — 17 testes novos (`__tests__/pedido-validation.test.ts`). Suíte 365 → 382. Limites testados nos dois lados (20/21 linhas, qty 99/100). ⚠️ Spec-precision gap: a spec não define o comportamento de `payment`/`delivery`/`customerName`/`address` recebidos como `null`; o schema usa `.nullish()` e aceita como "não informado" (`:65`), porque rejeitar o pedido inteiro por um campo em branco violaria ORD-01.

---

### T5: Client Supabase com service role (server-only) [P] ✅

**What**: `createAdminClient()` isolado em módulo `server-only`, com erro explícito quando a env var falta.
**Where**: `lib/supabase/admin.ts` (novo), `__tests__/supabase-admin.test.ts` (novo)
**Depends on**: T1
**Reuses**: formato de `createAnonClient` em `lib/supabase/server.ts`
**Requirement**: ORD-24

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `import "server-only"` no topo do arquivo
- [x] Lê `process.env.SUPABASE_SERVICE_ROLE_KEY` (sem prefixo `NEXT_PUBLIC_`) e `NEXT_PUBLIC_SUPABASE_URL`
- [x] Lança `Error` com mensagem clara quando a chave está ausente/vazia; nunca loga o valor da chave
- [x] `auth: { persistSession: false, autoRefreshToken: false }` no client (uso stateless em servidor)
- [x] Nenhum import desse módulo em arquivo com `"use client"` (verificado por grep)
- [x] Gate passa: `npx vitest run`
- [x] Test count: ≥ 3 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `feat(supabase): adiciona client de service role restrito ao servidor`

**Status**: ✅ Complete — 5 testes novos (`__tests__/supabase-admin.test.ts`). Suíte 382 → 387.

**SPEC_DEVIATION (escopo de arquivos)**: a task listava só `lib/supabase/admin.ts` + o teste, mas os dois done-when (`import "server-only"` **e** ≥3 testes) são mutuamente inviáveis sem infra: o pacote `server-only` é resolvido pelo bundler do Next e não existe em `node_modules`, então o Vite falha na transformação de qualquer módulo que o importe (`vi.mock` não resolve — o erro é na fase de transform, antes do mock). Correção mínima: alias `server-only` → `test-utils/server-only.ts` (stub vazio) em `vitest.config.ts`. Também destrava a T10 (`lib/server/pedidos.ts` tem `import "server-only"`).

---

### T6: Server Action `registrarPedido` ✅

**What**: a action pública que valida, aplica o teto anti-abuso, resolve produtos no banco, grava pedido + itens de forma idempotente e nunca lança.
**Where**: `app/actions/pedidos.ts` (novo), `__tests__/registrar-pedido.test.ts` (novo)
**Depends on**: T2, T4, T5
**Reuses**: padrão de Server Action de `app/actions/produtos.ts`; mock de Supabase no estilo de `__tests__/slug-check-route.test.ts`
**Requirement**: ORD-01, ORD-02, ORD-04, ORD-06, ORD-07, ORD-08, ORD-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Payload válido + loja ativa → grava 1 linha em `orders` (status `pendente`) e N linhas em `order_items`, retornando `{ ok: true }` (ORD-01)
- [x] `total_cents`/`unit_price_cents` calculados só de `products.price_cents`; valor monetário enviado pelo cliente é ignorado (ORD-02)
- [x] Slug inexistente, loja `is_active = false`, payload inválido → `{ ok: false }` sem nenhuma escrita (ORD-07)
- [x] Item com produto inexistente/de outra loja/inativo é descartado; pedido grava o resto; zero itens resolvidos → nada gravado (ORD-06)
- [x] `upsert` com `onConflict: "store_id,client_order_id"` + `ignoreDuplicates` → segunda chamada com o mesmo `client_order_id` retorna `{ ok: true }` sem gravar de novo (ORD-04)
- [x] ≥ 20 pedidos da loja nos últimos 60 s → `{ ok: false }`, nada gravado (ORD-08)
- [x] Falha no insert dos itens → pedido órfão deletado + `console.error`; retorna `{ ok: false }`
- [x] Erro inesperado (inclusive `createAdminClient` lançando por env ausente) é capturado, logado e retorna `{ ok: false }` — a action nunca lança (ORD-03)
- [x] `customer_name` gravado via `sanitizeCustomerName` (ORD-10)
- [x] Gate passa: `npx vitest run && npm run lint`
- [x] Test count: ≥ 12 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: full

**Commit**: `feat(orders): registra pedido no banco antes do redirect para o WhatsApp`

**Status**: ✅ Complete — 23 testes novos (`__tests__/registrar-pedido.test.ts`). Suíte 389 → 412; lint em 17 erros (baseline, nenhum em arquivo novo). Nenhuma checagem de plano na action (ORD-27). Discriminadores: `:246`/`:247` (payload adulterado com `totalCents: 1`/`unitPriceCents: 1` e assertions exigindo `39800`/`19900` do banco), `:405` (janela anti-abuso conferida no timestamp exato com timers fake), `:392` (fronteira 19 pedidos grava, 20 descarta).

Decisão de implementação além do texto da task: `delivery_address` grava `address ?? null` sem condicionar a `delivery === "entrega"` — a spec não define o corte e o campo só é coletado pela UI no caso `entrega`; adicionar o condicional seria lógica sem AC.

---

### T7: `slug` explícito no view model `Store` ✅

**What**: expor `slug` em `Store` (preenchido por `mapPublicStore`) e atualizar as fixtures dos testes que constroem `Store`.
**Where**: `lib/types.ts`, `lib/catalog.ts`, `__tests__/catalog.test.ts` + fixtures em `__tests__/use-catalogo.test.ts`, `__tests__/CatalogoClient.test.tsx`, `__tests__/StoreHeader.test.tsx` (as que existirem)
**Depends on**: T1
**Reuses**: `mapPublicStore` (já recebe `row.slug` em `catalogUrl`)
**Requirement**: ORD-01 (habilitador)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `Store.slug: string` definido e preenchido por `mapPublicStore` com `row.slug`
- [x] Teste em `__tests__/catalog.test.ts` cobrindo `mapPublicStore` → `slug`
- [x] Todas as fixtures `Store` dos testes atualizadas; `npx tsc --noEmit` (ou `npm run build`) sem erro de tipo
- [x] Gate passa: `npx vitest run`
- [x] Test count: baseline + ≥ 1; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(catalog): expoe slug da loja no view model publico`

**Status**: ✅ Complete — 2 testes novos (`__tests__/catalog.test.ts:114-123`). Suíte 387 → 389. `npx tsc --noEmit` limpo (só os 2 erros pré-existentes: `.next/types/validator.ts` e `@vercel/speed-insights` ausente).

Além da lista de arquivos da task, por exigência do done-when de `tsc --noEmit`: `lib/data.ts:6` (constante `STORE` de demo também constrói `Store`) e a tipagem do mock em `__tests__/supabase-admin.test.ts:9` (as assertions de T5 seguem idênticas).

---

### T8: Campo "Seu nome (opcional)" no `BagDrawer` ✅

**What**: input opcional de nome na sacola, acima do botão de envio, sem afetar `canCheckout`.
**Where**: `components/catalogo/BagDrawer.tsx`, `__tests__/BagDrawer.test.tsx`
**Depends on**: T7
**Reuses**: markup/classes do input de endereço já existente no próprio `BagDrawer`
**Requirement**: ORD-09, ORD-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Props novas `customerName?: string` e `onCustomerNameChange?: (v: string) => void`
- [x] Input com `aria-label` "Seu nome (opcional)", `maxLength={60}`, exibido apenas quando há itens (ORD-09)
- [x] Botão de envio permanece habilitado com o campo vazio (ORD-11)
- [x] Digitar no campo dispara `onCustomerNameChange` com o valor
- [x] Sem `box-shadow`, transições ≤ 200ms, tokens do design system (`docs/CONVENTIONS.md`)
- [x] Gate passa: `npx vitest run`
- [x] Test count: ≥ 4 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `feat(catalogo): adiciona campo opcional de nome do cliente na sacola`

**Status**: ✅ Complete — 6 testes novos (`__tests__/BagDrawer.test.tsx:78-124`). Suíte 412 → 418. Input reaproveita as classes exatas do campo de endereço do próprio `BagDrawer` (sem `box-shadow`, `transition-colors`, tokens `border-sand`/`rounded-input`/`text-inactive`) e vive dentro do bloco `items.length > 0`, então o "exibido apenas quando há itens" sai da estrutura existente. Critério de design system verificado por inspeção (não é assertível em unit test).

---

### T9: `handleCheckout` grava o pedido antes de abrir o WhatsApp ✅

**What**: aba pré-aberta no clique, `Promise.race` com timeout de 2500 ms, `clientOrderId` regenerado a cada mudança da sacola, estado `customerName` e fallback de pop-up bloqueado.
**Where**: `app/[slug]/use-catalogo.ts`, `app/[slug]/CatalogoClient.tsx` (passa as props novas), `__tests__/use-catalogo.test.ts`
**Depends on**: T6, T8
**Reuses**: `renderWhatsAppMessage`/`normalizeWhatsapp` (mensagem inalterada), `newClientOrderId` de `lib/orders.ts`
**Requirement**: ORD-01, ORD-03, ORD-05, ORD-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `window.open("", "_blank")` é chamado sincronamente no clique, antes de qualquer `await` (ORD-01)
- [x] `registrarPedido` é chamado com slug, `clientOrderId`, `customerName`, pagamento/entrega/endereço e itens (`productId`, `size`, `color`, `qty`) — sem nenhum campo de preço
- [x] Sucesso da gravação → aba pré-aberta recebe a URL `wa.me` com a mensagem atual, byte a byte igual à de hoje (ORD-11)
- [x] Gravação rejeitada/erro → WhatsApp abre igual, sem toast de erro (ORD-03)
- [x] Gravação que passa de 2500 ms → WhatsApp abre pelo caminho do timeout (teste com timers fake) (ORD-03)
- [x] `window.open` retornando `null` → navega por `window.location.href` (edge case de pop-up bloqueado)
- [x] Loja sem WhatsApp → nada é gravado e nada é aberto (edge case)
- [x] `clientOrderId` muda após adicionar/remover item ou alterar quantidade, e se mantém entre dois envios da mesma sacola (ORD-05)
- [x] Gate passa: `npx vitest run && npm run lint`
- [x] Test count: ≥ 8 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: full

**Commit**: `feat(catalogo): captura o pedido antes de abrir o WhatsApp`

**Status**: ✅ Complete — 13 testes novos (`__tests__/use-catalogo.test.ts:198-416`). Suíte 418 → 431; lint segue em 17 erros (o único de `use-catalogo.ts` continua sendo o `setVisibleCount` pré-existente, agora na linha 67 por deslocamento). Discriminadores: `:205-206` (aba aberta e `href` ainda vazio dentro do `act` síncrono — prova o open antes do await), `:226` (`toEqual` exaustivo no payload: qualquer campo de preço reprova), `:265`/`:268` (URL byte a byte reconstruída com `renderWhatsAppMessage`/`normalizeWhatsapp` + nome do cliente ausente da mensagem), `:305-311` (2499 ms → `href` vazio; +1 ms → navega, fixando o corte em 2500 ms).

**Adaptação de teste existente (não é enfraquecimento)**: `__tests__/use-catalogo.test.ts:157` ("inclui pagamento e entrega selecionados na mensagem enviada") lia a URL do primeiro argumento de `window.open`. Com a aba pré-aberta em branco por design (`design.md`, ORD-01), a URL passou a chegar em `tab.location.href`; as duas assertions (`Forma de pagamento: Pix`, `Entrega: Retirar no local`) seguem idênticas — só mudou de onde a URL é lida. Nenhuma assertion removida ou relaxada.

`clientOrderId` é resolvido num `useRef` dentro do handler (`clientOrderIdFor` + assinatura `key x qty` da sacola) em vez de `useState`/`useMemo`: gerar uuid durante o render seria valor aleatório em render e um `setState` em efeito reintroduziria a classe de erro de lint que já é dívida no arquivo.

---

### T10: Leituras do painel em `lib/server/pedidos.ts` ✅

**What**: `getStoreOrders(storeId, page)` (paginado, com itens aninhados) e `getOrderMetrics(storeId, now?)`.
**Where**: `lib/server/pedidos.ts` (novo)
**Depends on**: T2, T3
**Reuses**: `createClient`, `getTotalPages`/`clampPage` de `lib/pagination.ts`, `mapOrderRow` de T2, `computeOrderMetrics`/`monthStartInSaoPaulo` de T3, regra "não engolir o `error` do Supabase" de `docs/CONVENTIONS.md`
**Requirement**: ORD-12, ORD-13, ORD-17, ORD-18, ORD-19

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `getStoreOrders` seleciona `order_items` aninhado, ordena por `created_at desc`, usa `range()` de 20 em 20 e devolve `{ orders, total, page, totalPages }` com `clampPage` aplicado (ORD-12, ORD-13)
- [x] `getOrderMetrics` faz a query do mês (`created_at >= monthStartInSaoPaulo`) + a contagem `head` de pendentes e delega o cálculo a `computeOrderMetrics` (ORD-17..19)
- [x] Todo `error` do Supabase é logado com `console.error` e propagado — nunca convertido em lista vazia
- [x] `import "server-only"` no topo (mesmo padrão de `lib/server/catalog.ts`)
- [x] Gate passa: `npm run build && npm run lint && npx vitest run`
- [x] Test count: baseline mantido (lógica pura já coberta em T2/T3); nenhum teste existente removido

**Tests**: none (camada fina de I/O — ver Test Coverage Matrix)
**Gate**: build

**Commit**: `feat(painel): adiciona leitura paginada de pedidos e metricas de ROI`

**Status**: ✅ Complete — `65b65cf`. Suíte em 431 (baseline mantido, sem camada de teste por decisão da Test Coverage Matrix); build ok; lint em 17 erros. Evidência dos done-when: `lib/server/pedidos.ts:16` (`ORDER_COLS` com `order_items` aninhado), `:46-58` (`clampPage` + `order` + `range`), `:74-96` (mês + `count head` de pendentes → `computeOrderMetrics`), `:27-30` (`fail` loga e propaga, usado em `:42`, `:60`, `:88-91`), `:1` (`server-only`). `ORDERS_PAGE_SIZE` ficou no próprio módulo em vez de `lib/pagination.ts` porque a task lista só este arquivo.

---

### T11: Tela `/painel/pedidos` (lista + detalhe + gate de plano) ✅

**What**: rota do histórico com lista paginada, `Modal` de detalhe, estado vazio e estado bloqueado para o plano Free.
**Where**: `app/painel/pedidos/page.tsx`, `app/painel/pedidos/PedidosClient.tsx`, `app/painel/pedidos/use-pedidos.ts`, `app/painel/pedidos/loading.tsx`, `components/painel/RecursoBloqueado.tsx` (novos), `__tests__/PedidosClient.test.tsx`, `__tests__/RecursoBloqueado.test.tsx` (novos)
**Depends on**: T10, T17
**Reuses**: estrutura de `app/painel/produtos/` (page sem lógica + client + hook + loading), `Card`, `Modal`, `Pagination`, `Badge`, `formatCents`, `formatPaymentLine`/`formatDeliveryLine`, texto/estilo do banner de upgrade em `app/painel/layout.tsx:31`, `VTRINE_WHATSAPP_NUMBER` de `lib/contact.ts`
**Requirement**: ORD-12, ORD-13, ORD-14, ORD-15, ORD-28, ORD-30

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `page.tsx` sem lógica: `getCurrentStore()` (redirect `/login` se ausente), lê `searchParams.page`, chama `getStoreOrders` e passa props (`docs/CONVENTIONS.md`)
- [x] Lista exibe data/hora, nome do cliente ou "Sem nome", quantidade de itens, total via `formatCents` e badge de status (ORD-12)
- [x] `Pagination` renderizada com `basePath="/painel/pedidos"` e escondida com 1 página só (ORD-13)
- [x] Detalhe (Modal) mostra cada item com nome, tamanho, cor, qtd, unitário e subtotal, mais pagamento, entrega + endereço quando `entrega`, total e status (ORD-14)
- [x] Zero pedidos → estado vazio explicando que os pedidos aparecem quando um cliente envia a sacola (ORD-15)
- [x] Item com `productName` de produto já excluído continua sendo exibido (snapshot — ORD-14/AC7)
- [x] `hasOrderHistory === false` → a `page.tsx` renderiza `RecursoBloqueado` e **não chama** `getStoreOrders` (ORD-28)
- [x] `RecursoBloqueado` não recebe nenhum pedido/contagem/total como prop e não exibe número real (ORD-28)
- [x] `hasOrderHistory === true` → lista e detalhe funcionam integralmente (ORD-30)
- [x] Gate passa: `npx vitest run && npm run lint`
- [x] Test count: ≥ 11 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: full

**Commit**: `feat(painel): adiciona tela de historico de pedidos`

**Status**: ✅ Complete — `035bbb4`. 21 testes novos (`__tests__/PedidosClient.test.tsx` 11, `__tests__/PedidosPage.test.tsx` 7, `__tests__/RecursoBloqueado.test.tsx` 3). Suíte 431 → 452; lint em 17 erros (baseline, nenhum em arquivo novo). Discriminadores do gate de plano: `PedidosPage.test.tsx:100` (`expect(getStoreOrders).not.toHaveBeenCalled()` no Free), `:112-114` (HTML sem "Ana" e sem "R$"), `:145` (Starter com `trial_ends_at` vencido cai no bloqueio — ORD-30/AC6), `RecursoBloqueado.test.tsx:44` (`textContent` sem nenhum dígito). Subtotal e total foram separados na fixture (R$ 398,00 vs R$ 478,00) para a assertion de subtotal não passar por acidente.

**Desvios de escopo de arquivos (2, ambos aditivos):**
1. `components/ui/Badge.tsx` — a task manda reusar `Badge`, mas os tones existentes eram só `new`/`soldout`; `confirmado`/`cancelado` precisam de verde/vermelho. Adicionados os tones `success` e `error` (2 linhas, nenhuma mudança nos usos existentes).
2. `__tests__/PedidosPage.test.tsx` — a Test Coverage Matrix dispensa teste de `page.tsx` (build gate), mas ORD-28/AC3 ("não executa a query") e ORD-30/AC6 (rebaixamento por trial vencido) não são observáveis em nenhuma outra camada. Sem esse arquivo, as duas ACs mais críticas da fase ficariam sem evidência.

**Check C:** um teste escrito nesta task ("mostra o total de pedidos da loja no cabeçalho") foi removido antes do commit — o subtítulo com a contagem é discricionariedade de design, não tem AC. Nenhum teste pré-existente foi tocado.

---

### T12: Mudança de status do pedido ✅

**What**: Server Action `updateOrderStatus` + controles no detalhe do pedido.
**Where**: `app/actions/pedidos.ts` (estende), `app/painel/pedidos/PedidosClient.tsx` + `use-pedidos.ts` (estende), `__tests__/update-order-status.test.ts` (novo), `__tests__/PedidosClient.test.tsx` (estende)
**Depends on**: T11
**Reuses**: padrão `useActionState` de `docs/CONVENTIONS.md`; `isOrderStatus` de T2; `getPlanLimits` de T17; `Toast`
**Requirement**: ORD-21, ORD-22, ORD-23, ORD-28

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Action valida sessão (`getUser`) e loja (`getCurrentStore`), aplica `.eq("id", …).eq("store_id", store.id)` e atualiza só a coluna `status` (ORD-21, ORD-23)
- [x] Action exige `getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory` — plano efetivo Free → `{ error }` sem escrita (ORD-28)
- [x] Qualquer um dos três status é aceito a partir de qualquer status atual (ORD-22)
- [x] Status fora do enum → `{ error: "Status inválido." }` e nenhuma escrita (ORD-22)
- [x] Pedido de outra loja (0 linhas afetadas) → `{ error }` (ORD-23)
- [x] `revalidatePath("/painel/pedidos")` + `revalidatePath("/painel")` em caso de sucesso (ORD-21, AC5 de status)
- [x] UI: três controles no detalhe (Pendente/Confirmado/Cancelado) com `useActionState`, feedback via `Toast`, botão desabilitado enquanto `pending`
- [x] Gate passa: `npx vitest run && npm run lint`
- [x] Test count: ≥ 8 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: full

**Commit**: `feat(painel): permite marcar pedido como confirmado ou cancelado`

**Status**: ✅ Complete — `e1a719b`. 21 testes novos (`__tests__/update-order-status.test.ts` 13, `__tests__/PedidosClient.test.tsx` +8). Suíte 452 → 473; lint em 17 erros (baseline). Discriminadores: `update-order-status.test.ts:106` (`toEqual([[{ status: "confirmado" }]])` — qualquer coluna extra no update reprova), `:107-110` (`eq` exatamente `[["id", …], ["store_id", STORE_ID]]`), `:118-125` (`revalidatePath` nos dois caminhos, na ordem), `:222`/`:236` (`expect(from).not.toHaveBeenCalled()` no Free e no trial vencido — prova que o gate corre antes de qualquer query).

O toast segue o padrão já usado em `app/painel/configuracoes/use-configuracoes.ts:39-52`: o `flash` roda dentro do reducer do `useActionState`, não num `useEffect` — evita reintroduzir a classe de erro de lint `react-hooks/set-state-in-effect` que é dívida pré-existente no repo.

**Adaptação de teste existente (não é enfraquecimento)**: `__tests__/PedidosClient.test.tsx` ("mostra o total e o status do pedido no detalhe", da T11) passou a localizar o badge de status pelo elemento (`<span>`) porque os controles novos usam os mesmos rótulos em `<button>`, o que tornava `getByText("Confirmado")` ambíguo. A assertion continua exigindo o rótulo exato do status no detalhe; nada foi removido ou relaxado.

Os três botões ficam sempre habilitados (só desabilitam enquanto `pending`), inclusive o do status atual — ORD-22 exige que qualquer transição seja aceita partindo de qualquer status, e desabilitar o atual deixaria a re-seleção inalcançável pela UI.

---

### T13: Item "Pedidos" na navegação do painel [P] ✅

**What**: entrada no `Sidebar` e no `MobileTabBar` (6ª aba, com "Personalização" abreviada para "Estilo") + `PainelRoute`.
**Where**: `components/painel/Sidebar.tsx`, `components/painel/MobileTabBar.tsx`, `lib/types.ts`, `__tests__/Sidebar.test.tsx`, `__tests__/MobileTabBar.test.tsx` (novo)
**Depends on**: T1
**Reuses**: `NavItem`/`TabItem` já existentes nos dois componentes; ícone `Receipt` de `lucide-react`
**Requirement**: ORD-16

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Link "Pedidos" → `/painel/pedidos` presente nos dois componentes, depois de "Produtos"
- [x] Item fica ativo quando `pathname` é `/painel/pedidos` e inativo em `/painel` (mesma regra `isActive` já existente)
- [x] `PainelRoute` inclui `"pedidos"`
- [x] `MobileTabBar` com 6 abas sem overflow horizontal em 375 px (verificado na validação); label "Estilo" no lugar de "Personalização"
- [x] Gate passa: `npx vitest run`
- [x] Test count: ≥ 5 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `feat(painel): adiciona Pedidos na navegacao do painel`

**Status**: ✅ Complete — `6e455a2`. 8 testes novos (`__tests__/MobileTabBar.test.tsx` 5, `__tests__/Sidebar.test.tsx` +3). Suíte 473 → 481. Discriminadores: a ordem completa dos labels é conferida com `toEqual` nos dois componentes (`MobileTabBar.test.tsx:22-29`, `Sidebar.test.tsx:66-73`) — item fora de posição ou label errado reprova; `MobileTabBar.test.tsx:52` exige `queryByText("Personalização")` nulo.

Adição além do texto da task (nos próprios arquivos listados): `aria-current="page"` no item ativo de `NavItem`/`TabItem`. O done-when pede o estado ativo testável e o projeto já usa esse atributo em `components/ui/Pagination.tsx:54`; a alternativa seria assertar classes de Tailwind, bem mais frágil. Nenhuma mudança visual.

O done-when de "sem overflow horizontal em 375 px" fica para a validação, como a própria task previu (`flex-1 min-w-0` + `truncate` já estavam no `TabItem`).

---

### T14: Cards de ROI no dashboard ✅

**What**: segunda linha de `StatCard` com pedidos do mês, vendas confirmadas do mês e pendentes, mais link "Ver pedidos".
**Where**: `app/painel/page.tsx`, `app/painel/DashboardClient.tsx`, `app/painel/use-dashboard.ts`, `__tests__/DashboardClient.test.tsx` (novo)
**Depends on**: T10, T17
**Reuses**: `StatCard`, `formatCents`, `getOrderMetrics` de T10, `RecursoBloqueado` de T11, `getPlanLimits` de T17
**Requirement**: ORD-17, ORD-18, ORD-19, ORD-20, ORD-29, ORD-30

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `page.tsx` busca `getOrderMetrics(store.id)` e passa `metrics` para o client (sem lógica na page)
- [x] Card "Pedidos no mês" com `metrics.ordersThisMonth` (ORD-17)
- [x] Card "Vendas confirmadas no mês" com `formatCents(metrics.confirmedCentsThisMonth)` (ORD-18)
- [x] Card "Aguardando confirmação" com `metrics.pendingCount` (ORD-19)
- [x] Métricas zeradas renderizam `0` e `R$ 0,00` (ORD-20)
- [x] Link "Ver pedidos" → `/painel/pedidos`
- [x] `hasOrderHistory === false` → `page.tsx` **não chama** `getOrderMetrics`, passa `metrics: null` e o client mostra o aviso de upgrade no lugar dos três cards; os cards de produtos seguem intactos (ORD-29)
- [x] Nenhum número real de pedido/faturamento no HTML quando o plano efetivo é Free (ORD-29)
- [x] Gate passa: `npx vitest run && npm run lint`
- [x] Test count: ≥ 7 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: full

**Commit**: `feat(painel): mostra pedidos e faturamento do mes no dashboard`

**Status**: ✅ Complete — `b1ece55`. 11 testes novos (`__tests__/DashboardClient.test.tsx` 8, `__tests__/DashboardPage.test.tsx` 3). Suíte 481 → 492; build ok; lint em 17 erros (baseline). Discriminadores: `DashboardClient.test.tsx:37` (helper `statValue` lê o valor do próprio `StatCard` pelo rótulo, então nenhum "0" de outro card satisfaz a assertion), `:52` (`"R$ 1234,50"` reprova render de centavos crus), `DashboardPage.test.tsx:83` (`expect(getOrderMetrics).not.toHaveBeenCalled()` no Free), `:110` (mesmo com Starter vencido).

Derivação dos três cards ficou em `use-dashboard.ts` (`orderStats`), mantendo `DashboardClient` sem cálculo e `page.tsx` sem lógica além do gate. `orderStats === null` é o sinal único de bloqueio — o client não recebe nenhum número quando o plano é Free.

**Desvio de escopo de arquivos (1, aditivo):** `__tests__/DashboardPage.test.tsx` — mesma razão da T11: ORD-29 ("`page.tsx` **não chama** `getOrderMetrics`") e ORD-30/AC6 não são observáveis na camada de componente. Sem esse arquivo o done-when central da task ficaria sem evidência.

---

### T15: Landing comunicando o histórico de pedidos [P] ✅

**What**: card de recurso, FAQ e bullet nos três planos.
**Where**: `app/landing/data.tsx`, `__tests__/landing-data.test.ts` (novo)
**Depends on**: None
**Reuses**: arrays `features`, `faqs`, `freeFeatures`/`starterFeatures`/`proFeatures` (a página `app/page.tsx` já renderiza por map — sem mudança de layout)
**Requirement**: ORD-25

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `features` ganha o card "Histórico de pedidos" (ícone `Receipt`/`ClipboardList`, texto sobre pedido registrado com itens e total, deixando claro que é recurso dos planos pagos)
- [x] `faqs` ganha a pergunta sobre o pedido ficar registrado no painel mesmo indo para o WhatsApp, deixando claro que não há checkout/pagamento no site e que o histórico começa no Starter
- [x] "Histórico de pedidos" presente em `starterFeatures` e `proFeatures` e **ausente** de `freeFeatures` (ORD-25)
- [x] Testes verificam presença em Starter/Pro, ausência no Free, e a existência do card e do FAQ (ORD-25)
- [x] Gate passa: `npx vitest run`
- [x] Test count: ≥ 5 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `feat(landing): comunica o historico de pedidos na landing`

**Status**: ✅ Complete — `e755c04`. 8 testes novos (`__tests__/landing-data.test.ts`). Suíte 492 → 500. Discriminadores: `:58-59` (Free reprova tanto o rótulo exato quanto qualquer variação de "histórico"), `:39-40` (a resposta do FAQ precisa negar checkout **e** falar de pagamento), `:44` ("plano Starter" explícito). Nenhum arquivo além de `app/landing/data.tsx` e do teste foi tocado — `app/page.tsx` renderiza os quatro arrays por `map`, então o layout saiu de graça.

Observação de layout (não corrigida — sem AC e fora do escopo da task): `features` passou de 6 para 7 cards e o grid é `sm:grid-cols-2 lg:grid-cols-3` (`app/page.tsx:275`), então a última linha fica com um card sozinho. Só ajuste visual; nenhuma AC de ORD-25 pede número par de cards.

---

### T16: Política de privacidade, documentação e env var [P] ✅

**What**: menção LGPD ao armazenamento do pedido + atualização de `ARCHITECTURE.md`, `Escopo.md` e `AGENTS.md` (cuidado crítico do `anon`) + registro da env var nova.
**Where**: `app/politica-de-privacidade/page.tsx`, `docs/ARCHITECTURE.md`, `docs/roadmap/Escopo.md`, `AGENTS.md`
**Depends on**: None
**Reuses**: seções existentes (schema, arquivos importantes, estado atual, §4.2/§5 do Escopo)
**Requirement**: ORD-26

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Política de privacidade menciona que itens, total e nome informado no pedido são armazenados e ficam visíveis ao lojista
- [x] `docs/ARCHITECTURE.md`: schema com `orders`/`order_items`, rota `/painel/pedidos`, arquivos novos na tabela, bloco de env com `SUPABASE_SERVICE_ROLE_KEY` (server-only) e "Estado atual" atualizado
- [x] `docs/roadmap/Escopo.md`: §4.2 ganha as linhas de captura/histórico/status como implementadas; §5 deixa de listar "Histórico de pedidos"/"Status da venda" como V2 (impressão e CSV permanecem V2); §6 (tabela de monetização) ganha a linha "Histórico de pedidos" com Free `—` e Starter/Pro `Incluso`; §4.3 registra o gate por plano
- [x] `AGENTS.md`: cuidado crítico registrando que `orders`/`order_items` nunca recebem grant para `anon`
- [x] Gate passa: `npm run build && npm run lint && npx vitest run`
- [x] Test count: baseline mantido; nenhum teste existente removido

**Tests**: none (docs e conteúdo estático)
**Gate**: build

**Commit**: `docs: registra captura de pedidos na arquitetura, escopo e politica de privacidade`

**Status**: ✅ Complete — `a151bcd`. Build ok; lint em 17 erros (baseline, mesmos 3 arquivos); suíte em 500 (mantida). Toda a documentação foi escrita a partir do código lido (migration `20260727000000_orders.sql`, `app/painel/pedidos/`, `lib/orders.ts`, `lib/order-metrics.ts`, `lib/server/pedidos.ts`, `app/actions/pedidos.ts`, `lib/supabase/admin.ts`), não do texto do `design.md`. A regra "a captura grava em qualquer plano, só a visualização é paga" está registrada em quatro lugares: `AGENTS.md`, "Estado atual" do `ARCHITECTURE.md`, §4.2/§4.3 e a nota de §6 do `Escopo.md`.

**Adições além da lista literal do done-when (mesmos 4 arquivos, motivo de consistência):**
1. `Escopo.md` §3.2 ganhou a linha da tela "Pedidos" e a linha do Dashboard passou a citar os cards de ROI — a tabela de telas do painel ficaria contradizendo §4.2 sem isso.
2. `Escopo.md` §5 ganhou "Notificação de novo pedido" (estava em Out of Scope da spec e em nenhuma seção do Escopo) e §9 ganhou a linha "Captura do pedido" + correção da linha "Mensagem WhatsApp" (a aba agora é pré-aberta no clique, com fallback na aba atual).
3. `app/politica-de-privacidade/page.tsx`: "Última atualização" foi de 1 para 28 de julho de 2026 — o conteúdo da política mudou, deixar a data antiga seria informação incorreta ao titular.

**Observação de processo:** o `npm run build` do gate reescreve `next-env.d.ts` (`.next/dev/types` → `.next/types`, arquivo gerado pelo Next). Ele entrou no commit por um `git add -A` e foi retirado por `git checkout HEAD~1 -- next-env.d.ts` + `--amend`; o commit final tem só os 4 arquivos da task.

---

### T17: Capability `hasOrderHistory` nos limites de plano [P] ✅

**What**: adicionar a capability de histórico de pedidos a `PlanLimits` — `false` no Free, `true` em Starter e Pro.
**Where**: `lib/plan-limits.ts`, `__tests__/plan-limits.test.ts`
**Depends on**: None
**Reuses**: `PlanLimits`, `getPlanLimits` e `getEffectivePlan` já existentes (rebaixamento por `trial_ends_at` sai de graça)
**Requirement**: ORD-27, ORD-28, ORD-29, ORD-30

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `PlanLimits.hasOrderHistory: boolean` adicionado; `FREE_LIMITS` `false`, `STARTER_LIMITS` e `PRO_LIMITS` `true`
- [x] `getPlanLimits("starter", <data vencida>).hasOrderHistory === false` (rebaixamento via `getEffectivePlan` — ORD-30)
- [x] `getPlanLimits("pro", null).hasOrderHistory === true`
- [x] Nenhuma mudança de comportamento em `maxProducts`/`maxCategories`/`maxPhotos` (testes existentes seguem verdes)
- [x] Gate passa: `npx vitest run`
- [x] Test count: ≥ 4 testes novos passando; nenhum teste existente removido

**Tests**: unit
**Gate**: quick

**Commit**: `feat(planos): adiciona capability de historico de pedidos aos limites de plano`

**Status**: ✅ Complete — 6 testes novos (`__tests__/plan-limits.test.ts:78-101`). Suíte 323 → 329. Os 5 `toEqual` exaustivos existentes ganharam a chave nova (assertion segue exaustiva, não enfraquecida).

---

## Fix Tasks — iteração 1 (Verifier FAIL de 28/07/2026)

> Origem: `.specs/features/captura-de-pedidos/validation.md` §8 (Fix Plans 1–4). Cada fix é um commit atômico. Nenhum requisito é marcado `Verified` aqui — isso é do Verifier.

### F1: GRANTs do `service_role` para a captura (BLOCKER) ✅

**What**: nova migration concedendo ao `service_role` exatamente o DML que `app/actions/pedidos.ts` usa; correção da premissa errada no comentário `SPEC_DEVIATION` da migration anterior e dos docs; guard de privilégios no CI.
**Where**: `supabase/migrations/20260728000000_orders_service_role_grants.sql` (novo), `supabase/migrations/20260727000000_orders.sql` (só comentários), `docs/ARCHITECTURE.md`, `AGENTS.md`, `.github/workflows/supabase-migrations-check.yml`
**Requirement**: ORD-01, ORD-02, ORD-04, ORD-06, ORD-08, ORD-24, ORD-26, ORD-27

**Done when**:
- [x] `grant select, insert, delete on orders to service_role`; `grant select, insert on order_items to service_role`; `grant select on stores/products to service_role` — e **nada além disso** (nenhum UPDATE em `orders` para o `service_role`; nenhum grant novo para `anon`)
- [x] Comentário do arquivo antigo corrigido: o default ACL de `public` (role `postgres`) concede só `Dxtm` a `anon`/`authenticated`/`service_role` — tabela nova **não** herda DML para ninguém. SQL da migration já aplicada permanece intacto
- [x] `docs/ARCHITECTURE.md:73,97` descreve os grants reais e diz que ignorar RLS não dispensa GRANT; `AGENTS.md` ganha o cuidado crítico simétrico (tabela escrita pela service role exige grant explícito)
- [x] CI: passo `Check table privileges (orders/order_items)` roda depois do `supabase start` e falha se faltar privilégio ao `service_role` ou se `anon` tiver **qualquer** privilégio nas duas tabelas (`has_table_privilege` via `psql` no container do banco)
- [x] Gate passa: `npm run build && npm run lint && npx vitest run` (500 testes, lint 17 = baseline)

**Tests**: none no vitest (não há banco na suíte) — a guarda de regressão é o passo novo do CI, único lugar do projeto com banco de verdade
**Gate**: build + migration

**Commit**: `fix(db): concede ao service_role os grants que a captura de pedidos usa`

**Status**: ✅ Complete.

Evidência de runtime (banco local, 28/07/2026):
1. **Guard discrimina**: rodado *antes* da migration, o passo novo do CI falhou com exit 3 listando os 7 privilégios ausentes (`public.orders:insert`, `public.stores:select`, …). Depois de `npx supabase migration up`: exit 0 + `NOTICE: grants ok`.
2. **Introspecção**: `has_table_privilege('service_role', …)` = `t` para SELECT/INSERT/DELETE em `orders`, SELECT/INSERT em `order_items`, SELECT em `stores`/`products`; `f` para todo UPDATE. `anon` segue com **zero** privilégio em `orders`/`order_items` (8 privilégios × 2 tabelas, todos `f`).
3. **Checkout real** em `/atelie-mira` (dev server, loja `pro` ativa), nome "Ana Fix1", 2× Vestido midi (M/Areia): **1 linha em `orders`** (`items_count=2`, `total_cents=57980` = 2 × `products.price_cents` 28990, `status='pendente'`, `customer_name='Ana Fix1'`) + **1 linha em `order_items`** (`unit_price_cents=28990`, `qty=2`, `size=M`, `color=Areia`). `console.error` do servidor: nenhum. Como o pop-up foi bloqueado no navegador automatizado, a navegação caiu no fallback da aba atual (`window.location.href`) — o edge case de `window.open → null` foi exercido de graça.
4. **Idempotência (ORD-04)**: segundo checkout (Blusa de tricô P/Off-white, `total_cents=16990`) com `window.open` stubado para a página não navegar, seguido de **reenvio da mesma sacola**: a action foi chamada 3 vezes (log do servidor), o banco ficou com **2 pedidos / 2 itens** — o terceiro envio, com o mesmo `client_order_id`, não gravou nada.
5. **Limpeza**: os 2 pedidos de teste foram deletados (`delete from orders where client_order_id in (…)`); banco em `0 orders / 0 items`, como estava antes. `npx supabase db lint --level warning` limpo. Nenhum `db reset`, `.env.local` intocado.

---

### F2: Testes de `lib/server/pedidos.ts` (M10–M14) ✅

**What**: cobrir a camada de query que decide qual loja, qual ordem, qual página e qual período.
**Where**: `__tests__/server-pedidos.test.ts` (novo)
**Requirement**: ORD-12, ORD-13, ORD-17, ORD-18, ORD-19

**Done when**:
- [x] `getStoreOrders`: `.eq("store_id", storeId)`, `.order("created_at", { ascending: false })`, `.range(0, 19)` na página 1, `.range(20, 39)` na página 2, `clampPage` aplicado, e o caminho de erro **lançando** com `console.error` (nunca lista vazia)
- [x] `getOrderMetrics`: `.gte("created_at", monthStartInSaoPaulo(now).toISOString())` e `.eq("status", "pendente")` na segunda query
- [x] Linha de `lib/server/pedidos.ts` na Test Coverage Matrix corrigida para `unit`
- [x] M10–M14 morrem (verificado por mutação manual em estado descartável)
- [x] Gate passa: `npx vitest run && npm run lint`

**Tests**: unit
**Gate**: full

**Commit**: `test(painel): cobre filtro, ordem, paginacao e periodo das queries de pedidos`

**Status**: ✅ Complete — 19 testes novos (`__tests__/server-pedidos.test.ts`). Suíte 500 → 519; lint em 17 erros (baseline).

**Mutação manual (estado descartável, `shutil.copy2` → mutação → `npx vitest run` → restauração; `git diff` do arquivo limpo no fim):**

| # | Mutação em `lib/server/pedidos.ts` | Antes (Verifier) | Agora |
|---|---|---|---|
| M10 | remove `.eq("store_id", storeId)` da listagem | ❌ Survived | ✅ **Killed** (1 failed) |
| M11 | `ascending: false` → `true` | ❌ Survived | ✅ **Killed** (1 failed) |
| M12 | `ORDERS_PAGE_SIZE` 20 → 7 | ❌ Survived | ✅ **Killed** (4 failed) |
| M13 | remove `.eq("status", "pendente")` | ❌ Survived | ✅ **Killed** (1 failed) |
| M14 | remove `.gte("created_at", monthStart)` | ❌ Survived | ✅ **Killed** (1 failed) |

Discriminadores: `:99`/`:108` (`eq` conferido nas duas queries de `getStoreOrders`, listagem **e** contagem), `:117` (`order` exato), `:158`/`:168`/`:179` (`range` nas páginas 1, 2 e na clampada), `:229-232` (`gte` conferido contra `monthStartInSaoPaulo(now).toISOString()` **e** contra o literal `2026-07-01T03:00:00.000Z`, para o teste não passar se as duas pontas errarem junto), `:277-280` (`eq` da contagem de pendentes exatamente `[["store_id",…],["status","pendente"]]`), `:290` (`gte` **ausente** na contagem de pendentes — ORD-19 não tem filtro de período), e os 4 caminhos de erro exigindo `rejects.toThrow` (`:207`, `:215`, `:314`, `:322` — ORD-12 nunca pode virar lista vazia).

---

### F3: Teste do redirect do middleware (ORD-16.5) ✅

**What**: `/painel/pedidos` sem sessão → `/login?next=/painel/pedidos`.
**Where**: `__tests__/middleware.test.ts` (novo)
**Requirement**: ORD-16

**Done when**:
- [x] Sem sessão em `/painel/pedidos` → `NextResponse.redirect` para `/login?next=/painel/pedidos` (status 307, querystring exata)
- [x] Gate passa: `npx vitest run`

**Tests**: unit
**Gate**: quick

**Commit**: `test(middleware): cobre redirect de /painel/pedidos sem sessao`

**Status**: ✅ Complete — 2 testes novos (`__tests__/middleware.test.ts`). Suíte 519 → 521.

Asserções: `:48-49` — `location.pathname` = `"/login"` e `location.searchParams.get("next")` = `"/painel/pedidos"` (o valor decodificado, que é o que a AC nomeia; na URL sai `next=%2Fpainel%2Fpedidos`, como observado em runtime na validação), com `status` 307 em `:46`. `:59-60` — com sessão e loja, `/painel/pedidos` passa sem `location`, status 200.

Mutação (estado descartável, restaurado): remover `url.searchParams.set('next', pathname)` → **Killed**; trocar `if (!user)` por `if (false)` → **Killed**.

`@supabase/ssr` é mockado no estilo do `@/lib/supabase/server` de `__tests__/slug-check-route.test.ts` (o middleware usa `createServerClient` direto, não o wrapper do projeto). O único ajuste de ambiente está documentado no próprio arquivo: sob jsdom, `NextRequest.headers` é o `Headers` do undici e `NextResponse.next({ request })` exige o `Headers` global.

---

### F4: Spec-precision gaps (ORD-27, ORD-30.7, ORD-18) ⏳

**What**: asserção negativa de que a captura não consulta plano; teste do histórico do período Free aparecendo no Starter; formato de dinheiro registrado como decisão de produto.
**Where**: `__tests__/registrar-pedido.test.ts`, `__tests__/PedidosPage.test.tsx`, `.specs/features/captura-de-pedidos/spec.md`, `.specs/features/captura-de-pedidos/context.md`
**Requirement**: ORD-27, ORD-30, ORD-18

**Done when**:
- [ ] `registrarPedido` roda com `@/lib/plan-limits` mockado de forma que **qualquer** chamada a `getPlanLimits`/`getEffectivePlan` reprova o teste (ORD-27)
- [ ] Pedido gravado no período Free aparece quando o plano efetivo vira `starter` — mesma query, sem migração de dados (ORD-30.7)
- [ ] `formatCents` **não** foi alterado; formato registrado nas Assumptions da `spec.md` e "separador de milhar" anotado em Deferred Ideas do `context.md` (decisão de produto, fora desta feature)
- [ ] Gate passa: `npx vitest run && npm run lint`

**Tests**: unit
**Gate**: full

**Commit**: `test(orders): fecha lacunas de precisao de ORD-27 e ORD-30.7`

**Status**: ⏳ Pendente.

---

## Parallel Execution Map

```
Phase 1:
  T1 ──┬── T2 [P]
       ├── T3 [P]
       ├── T4 [P]
       ├── T5 [P]
       └── T7 [P]
  T17 [P]  (independente de T1)

Phase 2:
  T2, T4, T5 ──→ T6 ─┐
  T7 ──→ T8 ─────────┴──→ T9

Phase 3:
  T2, T3 ──→ T10 ─┬─→ T11 ──→ T12
                  └─→ T14
  T17 ────────────┴─→ T11, T14
  T13 [P]

Phase 4:
  T15 [P]
  T16 [P]
```

> T7 é executada na Phase 1 (só depende de T1) e é pré-requisito de T8 na Phase 2.

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: migration | 1 arquivo SQL | ✅ Granular |
| T2: `lib/orders.ts` | 1 módulo puro cohesivo (+ tipos) | ✅ Granular |
| T3: `lib/order-metrics.ts` | 1 módulo puro | ✅ Granular |
| T4: schema zod | 1 arquivo | ✅ Granular |
| T5: admin client | 1 função | ✅ Granular |
| T6: `registrarPedido` | 1 Server Action | ✅ Granular |
| T7: `Store.slug` | 1 campo + fixtures | ✅ Granular |
| T8: campo de nome | 1 componente | ✅ Granular |
| T9: `handleCheckout` | 1 função de hook (+ props no client) | ✅ Granular |
| T10: `lib/server/pedidos.ts` | 2 funções coesas no mesmo arquivo | ⚠️ OK (mesmo arquivo, mesma responsabilidade) |
| T11: tela de pedidos | 1 rota (page + client + hook + loading, padrão do projeto) | ⚠️ OK (unidade coesa, espelha `app/painel/produtos/`) |
| T12: status | 1 action + o controle que a consome | ⚠️ OK (action sem UI seria código não verificável) |
| T13: navegação | 2 componentes irmãos, mesma mudança | ⚠️ OK |
| T14: cards de ROI | 1 seção do dashboard | ✅ Granular |
| T15: landing | 1 arquivo de dados | ✅ Granular |
| T16: docs + política | Conteúdo, sem lógica | ✅ Granular |
| T17: capability de plano | 1 campo + 3 constantes no mesmo arquivo | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | raiz | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T2, T4, T5 | T2, T4, T5 → T6 | ✅ Match |
| T7 | T1 | T1 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T6, T8 | T6, T8 → T9 | ✅ Match |
| T10 | T2, T3 | T2, T3 → T10 | ✅ Match |
| T11 | T10, T17 | T10 → T11, T17 → T11 | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T1 | T13 [P] (sem seta de entrada além de T1, satisfeita na Phase 1) | ✅ Match |
| T14 | T10, T17 | T10 → T14, T17 → T14 | ✅ Match |
| T15 | None | T15 [P] | ✅ Match |
| T16 | None | T16 [P] | ✅ Match |
| T17 | None | T17 [P] na Phase 1 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Migration SQL | none (gate de migration) | none | ✅ OK |
| T2 | Módulo puro de domínio | unit | unit | ✅ OK |
| T3 | Módulo puro de domínio | unit | unit | ✅ OK |
| T4 | Schema zod | unit | unit | ✅ OK |
| T5 | Infra server-only | unit | unit | ✅ OK |
| T6 | Server Action | unit | unit | ✅ OK |
| T7 | Módulo puro (`lib/catalog.ts`) + tipos | unit | unit | ✅ OK |
| T8 | Componente client | unit | unit | ✅ OK |
| T9 | Hook | unit | unit | ✅ OK |
| T10 | Acesso a dados fino | none (lógica pura testada em T2/T3) | none | ✅ OK |
| T11 | Server Component + componente client + hook | unit (maior exigência entre as camadas) | unit | ✅ OK |
| T12 | Server Action + componente client | unit | unit | ✅ OK |
| T13 | Componentes client | unit | unit | ✅ OK |
| T14 | Server Component + componente client + hook | unit | unit | ✅ OK |
| T15 | Dados de conteúdo | unit | unit | ✅ OK |
| T16 | Docs + conteúdo estático de página | none | none | ✅ OK |
| T17 | Módulo puro de domínio (`lib/plan-limits.ts`) | unit | unit | ✅ OK |

---

## Pré-requisito de ambiente

`SUPABASE_SERVICE_ROLE_KEY` — ✅ **adicionada ao `.env.local` pelo usuário em 27/07/2026** (valor de `supabase status -o env | grep SERVICE_ROLE_KEY`). O arquivo é protegido pelo hook `.claude/hooks/protect-env.sh`, então a variável é sempre responsabilidade do usuário.

⏳ **Pendente para o deploy:** cadastrar a mesma variável (com o valor de produção, do Supabase Dashboard → Project Settings → API keys → `service_role`) nas env vars da Vercel. Sem ela em produção, o catálogo continua funcionando e a captura só não grava (`{ ok: false }` + log) — comportamento coberto pela AC de ORD-03.

---

## Requirement Coverage

30 requisitos, 30 mapeados para tasks, 0 sem mapeamento.

| Requirement | Tasks |
|---|---|
| ORD-01 | T6, T7, T9 |
| ORD-02 | T2, T6 |
| ORD-03 | T6, T9 |
| ORD-04 | T6 |
| ORD-05 | T9 |
| ORD-06 | T2, T6 |
| ORD-07 | T4, T6 |
| ORD-08 | T6 |
| ORD-09 | T8 |
| ORD-10 | T2, T6 |
| ORD-11 | T8, T9 |
| ORD-12 | T10, T11 |
| ORD-13 | T10, T11 |
| ORD-14 | T2, T11 |
| ORD-15 | T11 |
| ORD-16 | T13 |
| ORD-27 | T17 (garantido por ausência de checagem de plano em T6) |
| ORD-28 | T11, T12, T17 |
| ORD-29 | T14, T17 |
| ORD-30 | T11, T14, T17 |
| ORD-17 | T3, T10, T14 |
| ORD-18 | T3, T10, T14 |
| ORD-19 | T3, T10, T14 |
| ORD-20 | T3, T14 |
| ORD-21 | T12 |
| ORD-22 | T2, T12 |
| ORD-23 | T12 |
| ORD-24 | T1, T5 |
| ORD-25 | T15 |
| ORD-26 | T16 |
