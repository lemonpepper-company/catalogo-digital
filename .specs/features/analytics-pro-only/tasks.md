# Analytics exclusivo do plano Pro — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/analytics-pro-only/design.md`
**Status**: ✅ **Executada** (2026-08-03) — T1–T9 concluídas na branch `feature/analytics-pro-only`, um commit atômico por task.

**Desvios de execução registrados:**

1. **T4 e T5 foram fundidas num único commit (`081c7b0`).** As duas dividem o mesmo contrato de prop (`AnalyticsState` entre `page.tsx` e `DashboardClient`) e nenhuma é verificável sozinha: com a página emitindo a união e o cliente ainda esperando `CatalogAnalytics | null`, o gate full falharia por construção. Aplicado o "merge forward" de `implement.md` (resolving compilation dependencies).
2. **`npx vitest run` não faz typecheck** — descoberto durante T6, quando `tsc --noEmit` acusou 4 fixtures de teste sem o campo novo (uma delas resíduo do commit de T1, que passou verde). O baseline real da `main` (`fc6f61a`) tem **3 erros de tsc pré-existentes** em `__tests__/analytics-client.test.ts` (2) e `__tests__/use-catalogo.test.ts` (1), medidos num worktree limpo. A branch terminou nesses mesmos 3. **`npx tsc --noEmit` passou a integrar o gate build de fato.**
3. **Aridade de `trackEvent` preservada em T7.** A primeira versão do guard passava `productId` posicional, injetando um `undefined` explícito no 3º argumento dos eventos sem produto — 6 testes de ANL-05 quebraram. Corrigido na implementação (flag como parâmetro separado, rest-param mantido); nenhuma asserção foi afrouxada.

**Pré-requisito de execução**: criar branch `feature/analytics-pro-only` a partir de `main`. Supabase local (`npx supabase start`) apenas para T10.
**Baseline medida em 2026-08-03 na `main` (fc6f61a)**: suíte **83 arquivos / 956 testes verdes**; `npm run lint` **19 erros pré-existentes** — nenhum erro novo é aceitável, e o número não pode subir.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md` (cuidados de grants), `docs/CONVENTIONS.md` ("Vitest + Testing Library para testes unitários"), `vitest.config.ts` (jsdom, sem threshold de coverage).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Lib pura de plano/view-model (`lib/plan-limits.ts`, `lib/catalog.ts`, `lib/types.ts`) | unit | Todos os branches; 1:1 com ACs da spec; todo edge case listado | `__tests__/<nome>.test.ts` | `npx vitest run __tests__/<alvo>` |
| Server Action (`app/actions/eventos.ts`) | unit (Supabase mockado) | 1:1 com ACs; **todos** os caminhos de recusa e de erro cobertos (padrão `registrar-pedido.test.ts`) | `__tests__/registrar-evento.test.ts` | `npx vitest run __tests__/registrar-evento` |
| Hooks / Components / Pages (`use-dashboard`, `DashboardClient`, `DashboardPage`, `RecursoBloqueado`, `use-catalogo`) | unit (Testing Library, jsdom) | Happy + estados bloqueado/vazio/erro, **um teste por estado** (padrão `DashboardPage.test.tsx`) | `__tests__/*.test.tsx` | `npx vitest run __tests__/<alvo>` |
| Dados de conteúdo (`app/landing/data.tsx`) | unit | Bullet presente no plano certo e ausente nos demais (padrão `landing-data.test.ts`) | `__tests__/landing-data.test.ts` | `npx vitest run __tests__/landing-data` |
| Documentação de spec (`.specs/**`, `docs/**`) | none | — | — | build gate |
| Verificação integrada com Supabase local | none (roteiro manual) | Evidência colada na task | — | ver Done when de T10 |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (vitest) | Yes | Isolamento por arquivo (workers do vitest); Supabase sempre mockado; storages limpos em `beforeEach` | `__tests__/registrar-evento.test.ts` (mock de `lib/supabase/admin`), `__tests__/analytics-client.test.ts` |
| manual / Supabase local | No | Banco local único compartilhado | `supabase/config.toml` — uma instância |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após task cujos testes vivem em um arquivo só | `npx vitest run __tests__/<arquivo-alvo>` |
| Full | Após task que altera contrato consumido por outros arquivos (page/client/types) | `npx vitest run` — ≥ 956 testes, zero falha |
| Build | Fim de fase e tasks de docs/config | `npx vitest run && npm run build && npm run lint` (lint ≤ 19 erros) |

---

## Execution Plan

```
Phase 1 (Sequencial — capability + captura):
  T1 ──→ T2

Phase 2 (Exibição no painel):
  T1 ──→ T4 ──┐
  T3 [P] ─────┴──→ T5
  (T3 não depende de nada; T5 depende de T3 e T4)

Phase 3 (P2 — curto-circuito no catálogo público):
  T1 ──→ T6 ──→ T7

Phase 4 (Fechamento):
  T8 [P]   T9 [P]
  T2, T5, T7 ──→ T10
```

> 4 fases → na ativação do Execute, oferecer a delegação de um sub-agente por fase (offer-then-confirm), conforme a skill.

---

## Task Breakdown

### T1: Adicionar a capability `hasAnalytics` a `PlanLimits`

**What**: incluir `hasAnalytics: boolean` em `PlanLimits` com `false` em Free e Starter e `true` em Pro.
**Where**: `lib/plan-limits.ts`, `__tests__/plan-limits.test.ts`
**Depends on**: None
**Reuses**: formato de `hasOrderHistory` / `csvImport` / `customDomain`
**Requirement**: APO-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `PlanLimits.hasAnalytics` existe e é obrigatório; `FREE_LIMITS`/`STARTER_LIMITS` = `false`, `PRO_LIMITS` = `true`
- [ ] Testes afirmam o valor da capability nos 3 planos **e** no caso de `trial_ends_at` vencido (Pro expirado → `hasAnalytics === false`, via `getPlanLimits`)
- [ ] Nenhum outro campo de `PlanLimits` mudou de valor (asserção de regressão nos 3 objetos)
- [ ] Gate quick passa: `npx vitest run __tests__/plan-limits`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planos): adiciona capability hasAnalytics (Pro-only)`

---

### T2: Recusar a captura de eventos fora do Pro

**What**: `registrarEvento` passa a ler `plan`/`trial_ends_at` na consulta de loja que já existe e retorna `{ok:false}` — silenciosamente, sem `console.error` — quando `hasAnalytics` é falso.
**Where**: `app/actions/eventos.ts`, `__tests__/registrar-evento.test.ts`
**Depends on**: T1
**Reuses**: `getPlanLimits`; a consulta `stores` de `eventos.ts:30-44`
**Requirement**: APO-01, APO-02, APO-03, APO-04, APO-05, APO-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] O `select` da loja passa a ser `"id, plan, trial_ends_at"` e **nenhuma consulta nova** é adicionada (asserção sobre as chamadas do mock: `from` chamado com `stores` uma única vez)
- [ ] Plano efetivo `free` → sem `insert`, retorno `{ok:false}` (APO-01)
- [ ] Plano efetivo `starter` → sem `insert`, retorno `{ok:false}` (APO-01)
- [ ] Plano efetivo `pro` → `insert` com o mesmo shape de hoje: `store_id`, `event_type`, `product_id`, `visitor_id` (APO-02)
- [ ] `plan: "pro"` com `trial_ends_at` no passado → sem `insert` (APO-03)
- [ ] Recusa por plano **não** emite `console.error` — asserção com spy sobre `console.error` (APO-04)
- [ ] Payload inválido, loja inexistente/inativa e erro de banco continuam recusando **e logando** exatamente como hoje, antes do gate de plano (APO-05)
- [ ] **Reescrita, não afrouxamento**, dos testes que hoje provam ANL-09 (`expect(getPlanLimits).not.toHaveBeenCalled()`, `registrar-evento.test.ts:12-31`): cada asserção retirada é substituída por outra igual ou mais forte; o `FREE_LIMITS_STUB` é corrigido para bater com `PlanLimits` real (hoje tem `advancedTheme` inexistente e não tem `csvImport`/`customDomain`), e o mock de `plan-limits` passa a repassar os argumentos recebidos
- [ ] Contagem de testes do arquivo **não diminui**
- [ ] Gate quick passa: `npx vitest run __tests__/registrar-evento`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(analytics): grava eventos da vitrine apenas no plano Pro`

---

### T3: Tornar variável o selo de plano do `RecursoBloqueado` [P]

**What**: prop opcional `planoMinimo?: "starter" | "pro"` (default `"starter"`) que troca o selo entre "Disponível a partir do plano Starter" e "Disponível no plano Pro".
**Where**: `components/painel/RecursoBloqueado.tsx`, `__tests__/RecursoBloqueado.test.tsx`
**Depends on**: None
**Reuses**: todo o corpo atual do componente (cadeado, `Card`, CTA `vtrineWhatsAppHref`)
**Requirement**: APO-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Sem a prop, o componente renderiza o texto atual **byte a byte** ("Disponível a partir do plano Starter") — teste de regressão explícito
- [ ] Com `planoMinimo="pro"`, renderiza "Disponível no plano Pro"
- [ ] Os 3 call sites existentes (`app/painel/page.tsx:24`, `app/painel/pedidos/page.tsx:27`, `app/painel/DashboardClient.tsx:96`) permanecem sem alteração
- [ ] O teste "não exibe nenhum número real" continua valendo para as duas variantes
- [ ] Gate quick passa: `npx vitest run __tests__/RecursoBloqueado`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(painel): permite anunciar plano minimo Pro no RecursoBloqueado`

---

### T4: Gate de leitura no dashboard + estado tri-valente `AnalyticsState`

**What**: introduzir `AnalyticsState` e fazer `app/painel/page.tsx` **não chamar** `getCatalogAnalytics` quando o plano não tem `hasAnalytics`.
**Where**: `lib/server/analytics.ts` (tipo), `app/painel/page.tsx`, `__tests__/DashboardPage.test.tsx`
**Depends on**: T1
**Reuses**: a chamada de `getPlanLimits` já presente na linha do `hasOrderHistory` (`page.tsx:40`); padrão de gate antes do I/O de ORD-29/ANL-18
**Requirement**: APO-08, APO-11, APO-13

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `AnalyticsState` declarado como união `{status:"ok";data} | {status:"blocked"} | {status:"unavailable"}`
- [ ] `starter` → `expect(getCatalogAnalytics).not.toHaveBeenCalled()` e prop `{status:"blocked"}` (APO-08)
- [ ] `pro` → `getCatalogAnalytics` chamada com `(store.id, range)`, prop `{status:"ok"}` (APO-10 no caminho da página)
- [ ] `pro` com leitura lançando erro → prop `{status:"unavailable"}`, página renderiza, erro logado (APO-11)
- [ ] `free` → segue no `RecursoBloqueado` de página inteira, sem `getOrderMetrics` nem `getCatalogAnalytics` (regressão de APO-13)
- [ ] `starter` continua recebendo `getOrderMetrics` e o `range` do `PeriodoFiltro` (regressão de APO-12)
- [ ] `getPlanLimits` continua sendo chamada **uma vez** na página
- [ ] Gate full passa: `npx vitest run` (≥ 956 testes)

**Tests**: unit · **Gate**: full
**Commit**: `feat(painel): so o plano Pro executa a leitura de metricas da vitrine`

---

### T5: Renderizar os três estados da seção "Sua vitrine em números"

**What**: `use-dashboard` e `DashboardClient` passam a consumir `AnalyticsState`, exibindo métricas (`ok`), `RecursoBloqueado planoMinimo="pro"` (`blocked`) ou o aviso de indisponibilidade (`unavailable`).
**Where**: `app/painel/use-dashboard.ts`, `app/painel/DashboardClient.tsx`, `__tests__/DashboardClient.test.tsx`
**Depends on**: T3, T4
**Reuses**: `computeConversionPct`, `StatCard`, a lista de mais vistos e o `RecursoBloqueado` já usado em `DashboardClient.tsx:96`
**Requirement**: APO-09, APO-10, APO-11, APO-12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `blocked` → renderiza o bloco com selo "Disponível no plano Pro" e **nenhum** dos rótulos "Visitas", "Visitantes únicos", "Cliques em comprar", "Conversão sacola → pedido" nem a lista de mais vistos (APO-09)
- [ ] `blocked` → nenhum dígito de métrica no bloco (mesma regra ORD-28 já testada no `RecursoBloqueado`)
- [ ] `unavailable` → texto "Não foi possível carregar agora." e **não** o bloco de upgrade (APO-11 — os dois estados são visualmente distintos)
- [ ] `ok` → todos os testes atuais de ANL-12/13/16 continuam passando com as **mesmas asserções de valor**, apenas migrados para o contrato novo (APO-10)
- [ ] `ok` com período sem eventos → zeros e conversão "—", como hoje
- [ ] Em `blocked`, os cards de pedidos, o `PeriodoFiltro` e os cards de produtos continuam renderizando (APO-12)
- [ ] Nenhum teste de analytics existente foi deletado; contagem do arquivo não diminui
- [ ] Gate full passa: `npx vitest run` (≥ 956 testes)

**Tests**: unit · **Gate**: full
**Commit**: `feat(painel): Starter ve upsell do Pro no lugar das metricas da vitrine`

---

### T6: Expor `hasAnalytics` no view-model público `Store`

**What**: campo obrigatório `hasAnalytics: boolean` em `Store`, derivado de `limits.hasAnalytics` dentro de `mapPublicStore`, com o mock `lib/data.ts` atualizado.
**Where**: `lib/types.ts`, `lib/catalog.ts`, `lib/data.ts`, `__tests__/catalog.test.ts`
**Depends on**: T1
**Reuses**: `gridDensity` em `mapPublicStore` (`lib/catalog.ts:100`) — mesmo padrão de campo derivado de `limits`
**Requirement**: APO-14 (parte)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `resolveCatalog`/`mapPublicStore` devolvem `hasAnalytics: false` para `free` e `starter`, `true` para `pro`
- [ ] Campo é obrigatório em `Store` (o compilador força quem constrói o objeto a se posicionar) e `lib/data.ts:6` foi atualizado
- [ ] `STORE_COLS` de `lib/server/catalog.ts` **não** mudou — o plano continua vindo do `get_effective_plan` fora do cache (`lib/server/catalog.ts:24-31`)
- [ ] Gate full passa: `npx vitest run` (≥ 956 testes)

**Tests**: unit · **Gate**: full
**Commit**: `feat(catalogo): expoe hasAnalytics no view-model publico da loja`

---

### T7: Curto-circuitar `track()` no catálogo público

**What**: `use-catalogo.ts` deixa de chamar `registrarEvento` quando a loja não tem `hasAnalytics`.
**Where**: `app/[slug]/use-catalogo.ts`, `__tests__/use-catalogo.test.ts`
**Depends on**: T6
**Reuses**: o funil único `track()` de `use-catalogo.ts:31`, por onde passam os 4 eventos
**Requirement**: APO-14, APO-15

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Loja sem `hasAnalytics`: percorrer visita → ver produto → adicionar à sacola → checkout e afirmar `trackEvent` **não** chamado nenhuma vez
- [ ] Loja com `hasAnalytics`: os 4 eventos disparam exatamente como hoje (teste de regressão de ANL-01..05 intacto)
- [ ] O checkout e a navegação continuam funcionando nos dois casos (nenhum `await` novo, ANL-07 preservado)
- [ ] Comentário no código registra que este guard é otimização e que o gate autoritativo é o de T2 (APO-15)
- [ ] Gate full passa: `npx vitest run` (≥ 956 testes)

**Tests**: unit · **Gate**: full
**Commit**: `perf(catalogo): nao dispara telemetria em lojas sem o recurso`

---

### T8: Listar métricas da vitrine como item do plano Pro [P]

**What**: adicionar um bullet de métricas de visitas da vitrine a `proFeatures`, sem tocar em `starterFeatures`/`freeFeatures`.
**Where**: `app/landing/data.tsx`, `__tests__/landing-data.test.ts`
**Depends on**: None
**Reuses**: os blocos `describe("bullets de plano …")` já existentes em `landing-data.test.ts:48-77`
**Requirement**: APO-16

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `proFeatures` contém o novo bullet (texto sugerido: "Métricas de visitas da vitrine")
- [ ] `starterFeatures` e `freeFeatures` **não** o contêm, incluindo variação por regex (padrão do teste de `dashboard`/`histórico`)
- [ ] As asserções existentes sobre "Dashboard com métricas de vendas" em Starter e Pro continuam passando (esse recurso não mudou de plano)
- [ ] Gate quick passa: `npx vitest run __tests__/landing-data`

**Tests**: unit · **Gate**: quick
**Commit**: `docs(planos): metricas da vitrine passam a ser bullet do Pro`

---

### T9: Registrar a mudança na spec original e no STATE [P]

**What**: anotar em `analytics-nativo/spec.md` o que ficou obsoleto e registrar **AD-014** em `.specs/STATE.md`, marcando AD-011 como parcialmente supersedido.
**Where**: `.specs/features/analytics-nativo/spec.md`, `.specs/STATE.md`
**Depends on**: None
**Reuses**: o formato de revisão datada já usado no cabeçalho de `analytics-nativo/spec.md`
**Requirement**: rastreabilidade (tabela "Impacto na spec `analytics-nativo`" do spec.md desta feature)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `analytics-nativo/spec.md` ganha nota de revisão datada apontando para `.specs/features/analytics-pro-only/`
- [ ] ANL-09 marcado como supersedido por APO-01/APO-02; ANL-18 marcado como ampliado; ANL-19 reinterpretado; ANL-20 marcado como ressuscitado por APO-07
- [ ] `.specs/STATE.md` ganha **AD-014** com o texto do design (captura só com `hasAnalytics`) e AD-011 recebe `parcialmente supersedido por AD-014 (apenas a parte de analytics; pedidos seguem inalterados)`
- [ ] Gate build passa: `npx vitest run && npm run build && npm run lint` (lint ≤ 19 erros)

**Tests**: none (camada "Documentação de spec" da matriz) · **Gate**: build
**Commit**: `docs(specs): registra AD-014 e supersede ANL-09/18/19/20`

---

### T10: Verificação integrada com Supabase local

**What**: rodar o fluxo real nos três planos e colar a evidência SQL/visual na task.
**Where**: roteiro manual (Supabase local + `npm run dev`)
**Depends on**: T2, T5, T7
**Reuses**: roteiro de T13 de `analytics-nativo/tasks.md`
**Requirement**: verificação de ponta a ponta de APO-01, APO-02, APO-08, APO-09, APO-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Com a loja de teste em `free`: percorrer a vitrine e conferir `select count(*) from catalog_events where store_id = …` **inalterado**
- [ ] Mesma loja em `starter`: idem, contagem inalterada; dashboard mostra pedidos e o bloco "Disponível no plano Pro" no lugar das métricas
- [ ] Mesma loja em `pro`: os 4 tipos de evento aparecem em `catalog_events` e o dashboard exibe as métricas obedecendo ao `PeriodoFiltro`
- [ ] Linhas gravadas antes desta mudança continuam na tabela (nenhuma foi apagada) — evidência por contagem antes/depois
- [ ] Gate build passa: `npx vitest run && npm run build && npm run lint` (lint ≤ 19 erros)

**Tests**: none (verificação manual guiada) · **Gate**: build
**Commit**: `chore(analytics): registra verificacao integrada do gate Pro-only`

#### ✅ Evidência da execução (2026-08-03, Supabase local + `npm run dev`)

Loja `atelie-mira` (5 produtos ativos), mesmo fluxo nos três planos: montar a vitrine → abrir detalhe de produto → adicionar à sacola → finalizar checkout. `sessionStorage` limpo entre os cenários para o `catalog_visit` não ser dedupado.

| Plano | `catalog_events` da loja | POSTs de `registrarEvento` no log do servidor |
| --- | --- | --- |
| `free` | **0** | **nenhum** |
| `starter` | **0** | **nenhum** |
| `pro` | **4** — `catalog_visit` 1, `product_view` 5, `add_to_bag` 1, `buy_click` 1 | 8 chamadas, todas `200` |

A ausência total de POST nos dois primeiros cenários prova o curto-circuito do cliente (APO-14) em runtime: não é só "nada foi gravado", é "nenhuma requisição saiu". A gravação no `pro` prova que o gate não é um bloqueio cego.

**Dashboard** (mesma loja, sessão obtida por magic link com service role — nenhuma senha digitada):

- `pro`: "Sua vitrine em números" com 1 visita · 1 visitante único · 1 clique em comprar · 100% de conversão · top 3 de mais vistos — cada número conferido contra a mesma agregação em SQL.
- `starter`: bloco `RecursoBloqueado` com selo **"DISPONÍVEL NO PLANO PRO"**, título "Visitas e produtos mais vistos" e CTA de WhatsApp. Ausentes do HTML: "Visitas", "Visitantes únicos", "Conversão sacola", "Mais vistos no período" — e **também** ausente "Não foi possível carregar agora", provando que bloqueio ≠ indisponível em runtime (APO-11). Cards de pedidos, faturamento e `PeriodoFiltro` intactos (APO-12).

**Linhas antigas preservadas (APO / decisão do usuário):** a loja `maria-das-roupas` (plano `starter`) tinha 9 eventos gravados antes desta mudança e continua com os mesmos 9 — nenhuma migration de dados rodou.

**Limpeza:** eventos e pedido de teste removidos; `atelie-mira` devolvida ao plano `pro`; 4 pedidos e 9 eventos preexistentes intactos.

**Artefato de tooling:** o browser headless renderiza o painel com viewport 0×0 e `innerText` volta vazio (o layout usa `h-dvh` + `overflow-hidden`). As asserções acima foram feitas sobre `textContent`/`innerHTML`, mais o screenshot com viewport 1280×900.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 campo em 1 objeto de config | ✅ Granular |
| T2 | 1 Server Action | ✅ Granular |
| T3 | 1 componente | ✅ Granular |
| T4 | 1 tipo + 1 página (coesos: o tipo só existe para a página produzir) | ⚠️ OK — coeso |
| T5 | 1 hook + 1 componente (mesma seção de UI, mesmo contrato) | ⚠️ OK — coeso |
| T6 | 1 função de mapeamento + tipo + mock (o compilador acopla os três) | ⚠️ OK — coeso |
| T7 | 1 função (`track`) | ✅ Granular |
| T8 | 1 array de conteúdo | ✅ Granular |
| T9 | 2 documentos de spec | ✅ Granular |
| T10 | 1 roteiro de verificação | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início da Phase 1 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | `T3 [P]` sem seta de entrada | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T3, T4 | T3, T4 → T5 | ✅ Match |
| T6 | T1 | T1 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | None | `T8 [P]` sem seta de entrada | ✅ Match |
| T9 | None | `T9 [P]` sem seta de entrada | ✅ Match |
| T10 | T2, T5, T7 | T2, T5, T7 → T10 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Lib pura de plano | unit | unit | ✅ OK |
| T2 | Server Action | unit | unit | ✅ OK |
| T3 | Component | unit | unit | ✅ OK |
| T4 | Page (+ tipo) | unit | unit | ✅ OK |
| T5 | Hook + Component | unit | unit | ✅ OK |
| T6 | Lib pura de view-model | unit | unit | ✅ OK |
| T7 | Hook | unit | unit | ✅ OK |
| T8 | Dados de conteúdo | unit | unit | ✅ OK |
| T9 | Documentação de spec | none | none | ✅ OK |
| T10 | Verificação manual | none | none | ✅ OK |

---

## Requirement Coverage (spec ↔ tasks)

APO-01 → T2, T10 · APO-02 → T2, T10 · APO-03 → T2 · APO-04 → T2 · APO-05 → T2 · APO-06 → T2 · APO-07 → T1 · APO-08 → T4, T10 · APO-09 → T3, T5, T10 · APO-10 → T4, T5, T10 · APO-11 → T4, T5 · APO-12 → T4, T5 · APO-13 → T4 · APO-14 → T6, T7 · APO-15 → T7 · APO-16 → T8.

**Coverage: 16 total — 16 mapeados, 0 unmapped ✅**

---

## Tools per task (confirmar antes do Execute)

Nenhuma task precisa de MCP ou skill externa: tudo é edição de código TypeScript/TSX com Vitest local. Se você quiser usar algum MCP específico (ex.: Supabase MCP em T10), avise antes da execução.
