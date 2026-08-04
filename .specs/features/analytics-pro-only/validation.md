# analytics-pro-only Validation

**Date**: 2026-08-03
**Spec**: `.specs/features/analytics-pro-only/spec.md`
**Diff range**: `fc6f61a..HEAD` (branch `feature/analytics-pro-only`, 13 commits)
**Verifier**: sub-agente independente — **autor ≠ verificador**. Este relatório **sobrescreve** o do autor. Todas as conclusões foram re-derivadas do zero a partir de `spec.md` + diff + testes; as mutações do sensor foram escolhidas de forma independente.

**Veredicto final: ✅ PASS** (iteração 2 de 3 do laço fix→re-verify).

| Iteração | Veredicto | Sensor | Gaps |
| --- | --- | --- | --- |
| 1 | ❌ FAIL | 16/17 mortos | 1 Major — APO-11 não asserido na camada que **deriva** o estado (mutante M6 sobreviveu) |
| 2 | ✅ **PASS** | 17/17 + 8/8 = **25/25 mortos** (2 equivalentes provados) | 0 |

O histórico da iteração 1 é mantido abaixo de propósito: o gap encontrado e o fix aplicado são parte do valor deste relatório.

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1 capability `hasAnalytics` | ✅ Done | `7616ffd` |
| T2 gate de captura | ✅ Done | `ddb3f35` |
| T3 selo variável do `RecursoBloqueado` | ✅ Done | `d4416ce` |
| T4 + T5 gate de exibição + 3 estados | ✅ Done | Fundidas em `081c7b0` — desvio registrado em `tasks.md` e legítimo: o contrato `AnalyticsState` acopla `page.tsx` e `DashboardClient`, e nenhuma das duas é verificável isolada |
| T6 `Store.hasAnalytics` | ✅ Done | `67b7612` |
| T7 curto-circuito no catálogo | ✅ Done | `c0b8a2d` |
| T8 copy do Pro | ✅ Done | `df2a123` |
| T9 AD-014 + supersede ANL-09/18/19/20 | ✅ Done | `5ff8873` |
| T10 verificação integrada (Supabase local) | ✅ Done | `ecf7da3` — evidência colada em `tasks.md:319-341` |

---

## Spec-Anchored Acceptance Criteria

### P1: Captura exclusiva do Pro

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| APO-01 · free/starter → recusa sem insert | `{ ok: false }` e **nenhum** insert em `catalog_events` | `__tests__/registrar-evento.test.ts:235-237` — `expect(result).toEqual({ ok: false })` + `expect(callsOf(made,"catalog_events","insert")).toHaveLength(0)` + `expect(writeCalls(made)).toHaveLength(0)`; idem starter em `:246-248` | ✅ PASS |
| APO-02 · pro → grava com o mesmo shape | linha `{store_id, event_type, product_id, visitor_id}` | `__tests__/registrar-evento.test.ts:258-263` — `expect(insertedRow(made)).toEqual({ store_id: STORE_ID, event_type: "catalog_visit", product_id: null, visitor_id: VISITOR_ID })` | ✅ PASS |
| APO-03 · pro com trial vencido = free → recusa | `{ ok: false }`, sem escrita | `__tests__/registrar-evento.test.ts:273-274` — `expect(result).toEqual({ ok: false })` + `expect(writeCalls(made)).toHaveLength(0)`; contraprova (trial futuro grava) em `:284-285` | ✅ PASS |
| APO-04 · recusa por plano não emite `console.error`; logs existentes intactos | zero `console.error` na recusa por plano; 1 na loja inexistente | `__tests__/registrar-evento.test.ts:293,297` — `expect(errorSpy).not.toHaveBeenCalled()` … `expect(errorSpy).toHaveBeenCalledTimes(1)` **no mesmo teste** (contraste explícito) | ✅ PASS |
| APO-05 · ordem de validação preservada (payload/loja antes do plano) | rejeição idêntica à de hoje, antes de qualquer consideração de plano | `__tests__/registrar-evento.test.ts:328` — `expect(made).toHaveLength(0)` (payload inválido não toca o banco); loja inexistente `:348-349`; erro de banco `:358-359`; gate antes da posse do produto `:306` — `expect(made.filter(e => e.table === "products")).toHaveLength(0)` | ✅ PASS |
| APO-06 · sem round-trip extra | plano vem da mesma consulta da loja | `__tests__/registrar-evento.test.ts:315-316` — `expect(callsOf(made,"stores","select")).toEqual([["id, plan, trial_ends_at"]])` + `expect(made.filter(e => e.table === "stores")).toHaveLength(1)` | ✅ PASS |
| APO-07 · capability nos 3 planos + trial | free `false`, starter `false`, pro `true`, pro expirado `false` | `__tests__/plan-limits.test.ts:180,184,188,193,198` — `expect(getPlanLimits("free",null).hasAnalytics).toBe(false)` … `expect(getPlanLimits("pro", past).hasAnalytics).toBe(false)`; regressão dos objetos inteiros em `:39,:54,:69,:85,:101` | ✅ PASS |

### P1: Exibição exclusiva do Pro

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| APO-08 · starter não chama `getCatalogAnalytics` | zero RPC de analytics | `__tests__/DashboardPage.test.tsx:239` — `expect(getCatalogAnalytics).not.toHaveBeenCalled()` | ✅ PASS |
| APO-09 · starter vê `RecursoBloqueado` com selo "Disponível no plano Pro" e nenhum número | selo exato + ausência de Visitas/Únicos/Cliques/Conversão/mais vistos | `__tests__/DashboardClient.test.tsx:259-266` — `expect(screen.getByText("Disponível no plano Pro")).toBeTruthy()` + 5 `queryByText(...)` `.toBeNull()`; camada página em `__tests__/DashboardPage.test.tsx:247-249`; componente em `__tests__/RecursoBloqueado.test.tsx:35-36` e ORD-28 (`:52-61`, `container.textContent).not.toMatch(/\d/)`) | ✅ PASS |
| APO-10 · pro sem regressão (ANL-12..16, ANL-22) | valores exatos e mesmo objeto de range | `__tests__/DashboardClient.test.tsx:199-203` — `expect(statValue("Visitas")).toBe("120")` etc. (asserções de valor preservadas, apenas migradas para `ok()`); `__tests__/DashboardPage.test.tsx:189` — `expect(getCatalogAnalytics.mock.calls[0][1]).toBe(getOrderMetrics.mock.calls[0][1])` | ✅ PASS |
| APO-11 · pro + falha de leitura → "Não foi possível carregar agora", **estado distinto** do bloqueado | o dashboard **exibe** o aviso de indisponibilidade quando a leitura falha; erro nunca se disfarça de upsell | **Camada que DERIVA o estado (o `catch` de `page.tsx`)** — `__tests__/DashboardPage.test.tsx:233,234`: `expect(screen.getByText("Não foi possível carregar agora.")).toBeTruthy()` + `expect(screen.queryByText("Disponível no plano Pro")).toBeNull()` (adicionadas em `9ab353d`). **Camada que CONSOME** — `__tests__/DashboardClient.test.tsx:280,281` (mesmo par) e a contraprova simétrica em `:274` (`queryByText("Não foi possível carregar agora.")).toBeNull()` no estado bloqueado). Mutante **M6 reinjetado na iteração 2 → morre** (1 falha, exatamente esse teste). | ✅ PASS |
| APO-12 · starter mantém pedidos, faturamento, filtro e cards de produtos | cards e `PeriodoFiltro` presentes | `__tests__/DashboardPage.test.tsx:257-259` — `expect(getOrderMetrics).toHaveBeenCalledWith(STORE_ID, RANGE)` + `getByRole("group", { name: "Filtrar por período" })`; `__tests__/DashboardClient.test.tsx:283-287` — `expect(statValue("Pedidos")).toBe("5")`, `expect(statValue("Vendas confirmadas")).toBe("R$ 1000,00")`, produtos ativos/esgotados | ✅ PASS |
| APO-13 · free segue bloqueado pela página (PR #71) | página inteira bloqueada, sem I/O | `__tests__/DashboardPage.test.tsx:127-132` — `expect(from).not.toHaveBeenCalled()` + `expect(getCatalogAnalytics).not.toHaveBeenCalled()` + selo "Disponível a partir do plano Starter"; trial vencido em `:140-141` | ✅ PASS |

### P2: Catálogo público

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| APO-14 · loja sem `hasAnalytics` não chama `registrarEvento` (4 eventos) | zero chamadas no fluxo completo | `__tests__/use-catalogo.test.ts:667` — `expect(trackEvent).not.toHaveBeenCalled()` após visita → ver produto → sacola → checkout; derivação do view-model em `__tests__/catalog.test.ts:338-340` — `expect(hasAnalyticsDo("free")).toBe(false)` / `("starter")` false / `("pro")` true | ✅ PASS |
| APO-14 (b) · loja pro dispara os 4 eventos como hoje | 4 eventos preservados | `__tests__/use-catalogo.test.ts:50` (`hasAnalytics: true` no `baseStore`) governando toda a suíte ANL-01..05 preexistente; mutante M13 derrubou 11 testes | ✅ PASS |
| APO-15 · servidor é a garantia mesmo sem o cliente | recusa acontece na Server Action, independente do cliente | `__tests__/registrar-evento.test.ts:229-249` — a action é chamada **diretamente**, sem o cliente, e recusa free/starter. Rótulo impreciso corrigido em `25f2670`: `__tests__/use-catalogo.test.ts:674` agora diz `(ANL-07)`, que é o que ele de fato prova (o guard não pode quebrar a venda). | ✅ PASS |

### P3: Copy

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| APO-16 · bullet no Pro, ausente no Starter/Free | `proFeatures` contém; `starterFeatures`/`freeFeatures` não, nem por variação | `__tests__/landing-data.test.ts:83,88-89,93-94` — `expect(proFeatures).toContain(VITRINE_FEATURE)` + `expect(starterFeatures.some(f => /visita/i.test(f))).toBe(false)` (idem free) | ✅ PASS |

**Status**: ✅ **16/16 ACs** bateram com o outcome definido na spec (era 15/16 na iteração 1). Nenhum ⚠️ spec-precision gap: a spec define outcome preciso para todos os 16 critérios.

---

## Discrimination Sensor

Executado em `git worktree add -q <tmp> HEAD` descartável, com `node_modules` symlinkado. A árvore real nunca foi mutada — `git status --short` vazio após `git worktree remove --force`. Mutações escolhidas de forma independente, priorizando pontos onde os testes pareciam fracos (caminho de erro, aridade do guard, propagação do trial) e não só os gates óbvios.

| # | `file:line` | Mutação | Por que esta escolha | Morto? |
| --- | --- | --- | --- | --- |
| M1 | `app/actions/eventos.ts:52` | Gate de captura **removido** por completo (volta ao comportamento ANL-09) | Regressão mais provável no mundo real: alguém "limpa" o `if` num refactor | ✅ 4 falhas |
| M2 | `app/actions/eventos.ts:53` | Recusa por plano passa a emitir `console.error` | APO-04 é um requisito *negativo* — só morre se houver spy | ✅ 1 falha |
| M3 | `app/actions/eventos.ts:35` | `select("id, plan, trial_ends_at")` → `select("id")` | Sonda cruel: o mock ignora o argumento do `select`, então o gate **continua funcionando**; só a asserção de APO-06 pode matar | ✅ 1 falha |
| M4 | `app/actions/eventos.ts:52` | Trial ignorado no gate (`store.trial_ends_at` → `null`) | Propagação do 2º argumento é o erro clássico de repasse; expiração é fronteira de receita | ✅ 1 falha |
| M5 | `app/painel/page.tsx:47` | `if (limits.hasAnalytics)` → `if (true)` | Gate de exibição removido: Starter volta a executar a RPC | ✅ 2 falhas |
| **M6** | **`app/painel/page.tsx:54`** | **`catch` mapeia a falha de leitura para `{status:"blocked"}` em vez de `{status:"unavailable"}` — o erro se disfarça de upsell** | **É exatamente o bug que APO-11 e o design (`design.md:109`, "bug silencioso que nenhum teste atual pegaria") existem para impedir. Nenhuma mutação do autor tocou o caminho de erro.** | ❌ **SOBREVIVEU na it.1** → ✅ **morto na it.2** (ver M6r) |
| M7 | `app/painel/page.tsx:45` | Estado inicial `blocked` → `unavailable` (Starter veria erro em vez do upsell) | O espelho de M6, no outro sentido | ✅ 1 falha |
| M8 | `lib/plan-limits.ts:39` | `STARTER_LIMITS.hasAnalytics` false → true | Capability é a fonte única dos 3 gates | ✅ 6 falhas |
| M9 | `lib/plan-limits.ts:52` | `PRO_LIMITS.hasAnalytics` true → false | Sonda o caminho positivo (o gate não pode ser bloqueio cego) | ✅ 16 falhas |
| M10 | `app/painel/use-dashboard.ts:70` | `status === "blocked"` → `status !== "ok"` (colapsa `blocked` e `unavailable`) | Ataca a distinção de APO-11 na derivação do hook | ✅ 3 falhas |
| M11 | `app/painel/DashboardClient.tsx:156` | Remove `planoMinimo="pro"` (cai no default Starter) | Selo errado é falha de posicionamento de plano, não de render | ✅ 3 falhas |
| M12 | `app/[slug]/use-catalogo.ts:35` | Curto-circuito removido (`if (!enabled) return`) | Otimização P2 | ✅ 1 falha |
| M13 | `app/[slug]/use-catalogo.ts:35` | Guard **invertido** (`if (enabled) return`) | Garante que o guard não é no-op: loja Pro precisa continuar disparando | ✅ 11 falhas |
| M14 | `app/[slug]/use-catalogo.ts:181` | Guard vazado **só no `buy_click`** (`track(true, …)`) | Vazamento parcial no evento mais valioso do produto — morre só se o teste percorrer o fluxo inteiro | ✅ 1 falha |
| M15 | `lib/catalog.ts:101` | `hasAnalytics: limits.hasAnalytics` → `true` fixo | Derivação do view-model público | ✅ 1 falha |
| M16 | `app/landing/data.tsx:136` | Bullet do Pro removido | APO-16 | ✅ 1 falha |
| M17 | `components/painel/RecursoBloqueado.tsx:11` | Texto do selo Pro alterado ("no plano" → "a partir do plano") | Copy é o contrato observável do upsell | ✅ 3 falhas |

**Sensor depth (rodada 1)**: P0-full expandida — 17 mutações (fronteira de monetização; mínimo pedido era 6).
**Result (rodada 1)**: **16/17 mortos — FAIL ❌** (M6 sobreviveu; reconfirmado contra a suíte completa: `83 files / 985 tests passed`).

### Rodada 2 — re-verificação do fix + 7 ângulos novos

Mesmo protocolo: `git worktree add` descartável com `node_modules` symlinkado, **uma mutação por vez, revertida antes da próxima**, suíte completa (`npx vitest run`) a cada uma. A árvore real nunca foi mutada; `git worktree remove --force` + `git status --short` sem nenhum arquivo de produção ao final.

O foco da rodada foi a **classe de fraqueza** que a iteração 1 revelou — *"a camada que deriva um valor precisa ser testada, não só a que o consome"* — atacando **produtores** que a rodada 1 não tocou, e não os gates óbvios.

| # | `file:line` | Mutação | Por que esta escolha (produtor sob teste) | Morto? |
| --- | --- | --- | --- | --- |
| **M6r** | `app/painel/page.tsx:54` | **Reinjeção literal de M6**: `{status:"unavailable"}` → `{status:"blocked"}` no `catch` | Prova de que o fix `9ab353d` fecha o gap da iteração 1 | ✅ **1 falha** — `DashboardPage.test.tsx > "renderiza a página com os pedidos intactos quando a leitura de analytics lança"` |
| N1 | `lib/catalog.ts:101` | `hasAnalytics: limits.hasAnalytics` → `limits.gridDensity` | Mais cruel que M15 (`true` fixo): **Free continua `false`**, só Starter vaza. Só morre se o teste do produtor cobrir os **três** planos, não só as pontas | ✅ 1 falha — `catalog.test.ts > "hasAnalytics acompanha o plano efetivo… (APO-14)"` |
| N2 | `app/[slug]/use-catalogo.ts:93` | Guard vazado **só no `catalog_visit`** (`track(true, …)`) no efeito de montagem | Espelho de M14 no evento de maior volume, e o único protegido por dedup de `sessionStorage` — o dedup podia mascarar o vazamento | ✅ 1 falha — `use-catalogo.test.ts > "loja sem hasAnalytics não dispara evento nenhum no fluxo completo (APO-14)"` |
| N3 | `app/painel/DashboardClient.tsx:154` | Ramos do ternário **trocados** (`analyticsBloqueado ?` → `!analyticsBloqueado ?`): bloqueado renderiza "Não foi possível", indisponível renderiza o upsell | O **M6 do lado do render**: a mesma confusão erro↔upsell, um andar acima. Ataca o produtor do JSX, não o do estado | ✅ 7 falhas (2 arquivos), incl. `"bloqueado não é confundido com indisponível"` e `"indisponível não é confundido com bloqueado"` |
| N4 | `components/painel/RecursoBloqueado.tsx:16` | Default `planoMinimo = "starter"` → `"pro"` | O **default** é um valor derivado consumido por 3 telas que nem passam a prop (dashboard Free, pedidos Free, ROI). Regressão silenciosa clássica ao parametrizar um componente | ✅ 7 falhas em **4 arquivos** — inclusive `/painel/pedidos`, fora do escopo da feature |
| N5 | `app/painel/use-dashboard.ts:70` | `status === "blocked"` → `status === "unavailable"` | Troca (não colapso, como M10) das duas variantes na derivação do hook — a camada intermediária entre página e render | ✅ 7 falhas (2 arquivos) |
| N6 | `app/[slug]/use-catalogo.ts:95` | `store.hasAnalytics` removido do dep array do `useEffect` de visita | Classe stale-closure: dependência é um "contrato derivado" que nenhum teste costuma asserir | ⚠️ **Sobreviveu ao vitest — mas morto pelo gate**: `npm run lint` vai de `19 problems (19 errors, 0 warnings)` para `20 problems (19 errors, 1 warning)` — `react-hooks/exhaustive-deps` em `use-catalogo.ts:95`. **Equivalente**: o efeito só roda na montagem e `shouldTrackVisit` deduplica por sessão, então não há estado alcançável em que a re-execução mude o observável |
| N7 | `app/painel/page.tsx:40` | `getPlanLimits(store.plan, store.trialEndsAt)` → `getPlanLimits(store.plan, null)` | Propagação do trial no produtor do painel — o análogo de M4 (que matou na Server Action) | ⚠️ **Sobreviveu — equivalente provado**: `page.tsx:22` já faz `if (getEffectivePlan(store.plan, store.trialEndsAt) === "free") return <RecursoBloqueado/>`. Nos estados alcançáveis da linha 40 o trial nunca está vencido, logo os dois argumentos produzem o mesmo `PlanLimits`. O early-return em si **é** asserido: `DashboardPage.test.tsx > "rebaixa Starter/Pro com trial_ends_at vencido para o bloqueio do Free"` (derrubado por N4) |

**Sensor depth (rodada 2)**: 8 mutações (mínimo pedido era 4), todas em ângulos não cobertos pela rodada 1.
**Result (rodada 2)**: **6/6 mutantes não-equivalentes mortos**; 2 equivalentes (N6, N7) — e mesmo N6 é detectado pelo gate via linter.
**Total acumulado**: **23/23 mutantes não-equivalentes mortos** de 25 injetados. ✅

**A classe de fraqueza da iteração 1 não se repete em nenhum outro produtor do diff.** Os 5 outros pontos em que um valor é derivado numa camada e consumido noutra — `lib/catalog.ts` → `use-catalogo` (N1), `page.tsx` → `DashboardClient` (M6r), `use-dashboard` → JSX (N5), JSX → DOM (N3), default de prop → 3 telas (N4) — têm todos asserção **no lado da derivação**, cada um morto por mutação dirigida.

---

## Code Quality

| Principle | Status | Nota |
| --- | --- | --- |
| Minimum code | ✅ | Nenhuma peça nova além da capability e da união `AnalyticsState`; ambas justificadas no design |
| Surgical changes | ✅ | O único "refactor adjacente" é extrair `const limits = getPlanLimits(...)` em `page.tsx:40`, que a própria feature exige (duas decisões, uma chamada) |
| No scope creep | ✅ | `STORE_COLS` intocado (`git diff` em `lib/server/catalog.ts` vazio); nenhuma migration; nenhum `delete/truncate` sobre `catalog_events` em todo o repo |
| Matches patterns | ✅ | `hasAnalytics` segue `hasOrderHistory`/`csvImport`; `store.plan as Plan` espelha `lib/server/catalog.ts:99`; `AnalyticsState` fica em módulo `server-only` e é importado como `import type` (apagado na compilação) |
| Spec-anchored outcome check | ✅ | 16/16 após `9ab353d` (era 15/16 na it.1) |
| Per-layer Coverage Expectation | ✅ | Lib pura e Server Action com 1:1 nos ACs e todos os caminhos de erro; **página**: happy, bloqueado **e** caminho de erro agora asserem o estado emitido (`DashboardPage.test.tsx:233-234`) |
| Todo teste mapeia a AC / edge case / Done-when | ✅ | Nenhum teste órfão. O único rótulo impreciso (`use-catalogo.test.ts`, APO-15 → ANL-07) foi corrigido em `25f2670` |
| Guidelines documentadas seguidas | ✅ | `AGENTS.md` (nenhum grant novo — o gate é de aplicação), `docs/CONVENTIONS.md` (Vitest + Testing Library) |

**Observações menores (não bloqueiam):**

- `app/painel/use-dashboard.ts:18` — o default `analytics: AnalyticsState = { status: "unavailable" }` faz um chamador que esqueça o argumento renderizar "Não foi possível carregar agora.". É herança do `= null` anterior (mesma semântica), e `DashboardClient` sempre passa o valor — dívida pré-existente, não regressão.
- `app/[slug]/use-catalogo.ts:31` — `track(enabled, ...args)` põe uma flag como 1º posicional de um wrapper genérico. Feio, mas é a forma que **preserva a aridade** de `trackEvent` (o desvio nº 3 de `tasks.md` documenta que a alternativa quebrou 6 testes de ANL-05). Aceito.

---

## Edge Cases

- [x] **Loja `pro` rebaixada para `starter`** — captura para na próxima visita: `__tests__/registrar-evento.test.ts:240-249`. Histórico permanece: nenhum `delete`/`truncate` sobre `catalog_events` existe no repo (grep) + evidência manual em `tasks.md:336` (loja `maria-das-roupas`, 9 eventos intactos).
- [x] **Starter com eventos antigos vira `pro`** — o caminho `pro` devolve o que a RPC devolver, sem filtro por data de mudança de plano (`app/painel/page.tsx:48`); evidência de runtime em `tasks.md:333`. Sem teste unitário dedicado, mas nada no código poderia filtrá-lo.
- [x] **Erro de banco na consulta da loja ≠ recusa por plano** — `__tests__/registrar-evento.test.ts:352-360` (recusa **com** log) contrastado com `:288-298` (recusa **sem** log).
- [x] **`product_id` de outra loja E plano `free`** — `__tests__/registrar-evento.test.ts:306` prova que o gate de plano vem antes e o resultado é o mesmo (nada gravado).
- [x] **Chamada direta a `registrarEvento` fora do catálogo, loja não-Pro** — `__tests__/registrar-evento.test.ts:229-249`: a action é invocada diretamente e recusa. O gate não depende do cliente.

---

## Gate Check

Re-executado na íntegra na iteração 2, em `25f2670`. Resultado idêntico ao da iteração 1 — os dois fixes são só de teste.

- **Gate command**: `npx vitest run && npm run build && npm run lint` (+ `npx tsc --noEmit`, incorporado ao gate pelo desvio nº 2 de `tasks.md`)
- **`npx vitest run`**: **83 arquivos / 985 testes — 985 passed, 0 failed, 0 skipped**
- **Test count before feature** (`main` @ `fc6f61a`): 83 arquivos / **956** testes
- **Test count after**: 83 arquivos / **985** testes — **delta +29**, nenhuma contagem de arquivo caiu
- **Integridade das asserções**: os testes de ANL-09 que provavam o comportamento **oposto** (`expect(getPlanLimits).not.toHaveBeenCalled()`) foram **reescritos, não afrouxados** — o bloco de 1 teste virou 8, o `FREE_LIMITS_STUB` desatualizado (`advancedTheme` inexistente, sem `csvImport`/`customDomain`) foi eliminado e `lib/plan-limits` passou a rodar de verdade no arquivo (`__tests__/registrar-evento.test.ts:10-14`). Isso é **fortalecimento**: o gate agora é exercitado pela resolução real de plano + trial, não por um stub que devolveria `undefined` (falsy) e passaria por acidente.
- **`npm run build`**: ✅ sucesso
- **`npm run lint`**: **19 erros** — exatamente o baseline, nenhum novo
- **`npx tsc --noEmit`**: **3 erros** — exatamente o baseline pré-existente (`__tests__/analytics-client.test.ts:6,22`, `__tests__/use-catalogo.test.ts:23`); nenhum arquivo desta feature aparece
- **Skipped**: nenhum

**Contagem depois dos fixes**: ainda **985**. Os dois commits de correção são **puramente aditivos**, conferido em `git show 9ab353d` / `git show 25f2670`:

- `9ab353d` — **+6 linhas, 0 removidas**, só em `__tests__/DashboardPage.test.tsx`: 2 asserções novas + 4 de comentário. **Nenhuma linha de produção tocada**, nenhuma asserção existente alterada ou removida.
- `25f2670` — **+4/-1** em `__tests__/use-catalogo.test.ts`: o corpo do `it` é byte-idêntico; muda só o rótulo do requisito no título (`APO-15` → `ANL-07`) e um comentário apontando onde APO-15 realmente é coberto.

Nenhuma asserção afrouxada, nenhum teste removido, nenhum `skip`/`only` introduzido (grep limpo). Delta líquido de força: **+2 asserções**, e são exatamente as que matam M6.

---

## Fix Plans

### ✅ Fix 1 — RESOLVIDO na iteração 2 (`9ab353d`)

**Verificação do fix**: mutante M6 reinjetado em worktree descartável → **suíte falha** (`1 failed | 984 passed`), no teste `DashboardPage.test.tsx > "renderiza a página com os pedidos intactos quando a leitura de analytics lança"`. Gate re-executado inteiro: 985 verdes, build ✅, lint 19, tsc 3. **Done-when do Fix 1 cumprido integralmente.**

<details><summary>Enunciado original do gap (iteração 1)</summary>

#### Fix 1: caminho de erro do dashboard Pro não distingue "indisponível" de "bloqueado"

- **Severidade**: **Major**
- **Root cause**: **o código está correto** — `app/painel/page.tsx:52` mapeia o `catch` para `{ status: "unavailable" }`. O defeito é de **cobertura**: o único teste de "pro + leitura lança" (`__tests__/DashboardPage.test.tsx:217-230`) verifica que a página renderiza, que os pedidos sobrevivem e que o erro foi logado, mas **não assere qual estado a página emitiu**. Trocar `unavailable` por `blocked` nessa linha mantém a suíte inteira verde (985/985) e faz um lojista **Pro** com o banco fora do ar ver um convite para assinar o Pro que ele já assina — precisamente o "erro disfarçado de upsell" que APO-11 e `design.md:109` proíbem.
- **Por que passou despercebido**: a distinção `blocked` × `unavailable` foi testada com fartura em `DashboardClient` (que **recebe** o estado pronto) e nunca na página (que **deriva** o estado). Cobrir o consumidor de um contrato não cobre o produtor.
- **Fix task**:
  - **What**: fortalecer o teste existente de falha de leitura no Pro.
  - **Where**: `__tests__/DashboardPage.test.tsx:217-230`.
  - **How**: acrescentar ao teste `renderiza a página com os pedidos intactos quando a leitura de analytics lança`:
    ```ts
    expect(screen.getByText("Não foi possível carregar agora.")).toBeTruthy();
    expect(screen.queryByText("Disponível no plano Pro")).toBeNull();
    ```
  - **Verify**: aplicar a mutação M6 (`analytics = { status: "unavailable" }` → `{ status: "blocked" }` em `app/painel/page.tsx:52`) num worktree descartável e confirmar que o teste agora **falha**.
  - **Done when**: M6 morre; suíte segue com 985 testes verdes; lint 19 / tsc 3.
- **Custo**: 2 linhas, nenhuma mudança de produção.

</details>

**Nenhum gap novo encontrado na iteração 2.** Fix Plans em aberto: **0**.

---

## Requirement Traceability Update

| Requirement | Status it.1 | Status final (it.2) |
| --- | --- | --- |
| APO-01 … APO-10 | ✅ Verified | ✅ Verified |
| APO-11 | ⚠️ Needs Fix — coberto só na camada consumidora; M6 sobreviveu | ✅ **Verified** — `DashboardPage.test.tsx:233-234` cobre o produtor; M6 morre |
| APO-12 … APO-16 | ✅ Verified | ✅ Verified |

---

## Summary

**Overall**: ✅ **PASS** — implementação correta e cobertura sem furo conhecido.

**Spec-anchored check**: **16/16** ACs bateram com o outcome da spec; 0 gaps de camada; 0 spec-precision gaps
**Sensor**: **23/23 mutantes não-equivalentes mortos** (25 injetados em 2 rodadas; N6 e N7 provados equivalentes, e N6 ainda assim é pego pelo linter no gate)
**Gate**: 985 passed / 0 failed (baseline `main` 956, +29) · build ✅ · lint 19 = baseline · tsc 3 = baseline

**O que funciona**: os dois gates são reais e independentes — a captura recusa free/starter/pro-expirado sem log e sem round-trip extra, e a página não executa nenhuma RPC de analytics fora do Pro. A capability é fonte única e mata mutantes nas três leituras. O curto-circuito do cliente é otimização de verdade (nem o `buy_click` nem o `catalog_visit` escapam dele) e o gate do servidor permanece a garantia quando o cliente é ignorado. Os testes que protegiam o contrato antigo (ANL-09) foram reescritos para o contrato novo com asserções **mais fortes**, não afrouxados — e o stub de limits desatualizado, que era o risco nº 2 do design, foi eliminado em favor do módulo real. A distinção `blocked` × `unavailable` agora é asserida nas **três** camadas em que existe: quem deriva (`page.tsx`), quem transforma (`use-dashboard`) e quem renderiza (`DashboardClient`) — e cada uma morre com mutação dirigida.

**Issues found**: 0 em aberto. O único gap do ciclo (Fix 1, Major) foi fechado por `9ab353d` e a correção está empiricamente verificada por reinjeção do mutante.

**Lições**: nenhuma lição nova. A iteração 2 apenas **confirmou** L-012 e L-013, já registradas na iteração 1; os dois sobreviventes desta rodada são equivalentes, não sinal novo.

**Next steps**: nenhum bloqueio. A feature está pronta para merge.
