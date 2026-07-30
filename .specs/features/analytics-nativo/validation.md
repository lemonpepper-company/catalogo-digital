# Analytics Nativo — Validation

**Date**: 2026-07-30
**Spec**: `.specs/features/analytics-nativo/spec.md`
**Diff range**: `main...feature/analytics-nativo` — 14 commits, `29438e7` (docs) … `d1d3a10` (test); código em `3f768a7`…`14647cf`
**Verifier**: sub-agente independente (author ≠ verifier), evidence-or-zero — 2 iterações
**Verdict**: ✅ **PASS** — iteração 1 PASS com 1 mutante sobrevivente; **iteração 2 PASS sem sobreviventes** (ver [Iteração 2](#iteração-2--reverificação))

> A iteração 1 (abaixo) fica registrada como está, inclusive o mutante sobrevivente. O estado
> final da feature é o da iteração 2, no fim deste documento.

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1 migration `catalog_events` | ✅ Done | `supabase/migrations/20260730000000_catalog_events.sql` — DDL, 3 índices, RLS, revokes e grants conforme design |
| T2 migration funções de leitura | ✅ Done | `supabase/migrations/20260730010000_catalog_metrics_functions.sql` — `security invoker`, `p_from`/`p_to` anuláveis, revoke/grant de EXECUTE |
| T3 guard de privilégios no CI | ✅ Done | `.github/workflows/supabase-migrations-check.yml` +83 linhas (tabela, coluna e funções) |
| T4 schema zod | ✅ Done | `lib/validation/evento.ts` |
| T5 Server Action | ✅ Done | `app/actions/eventos.ts` |
| T6 client de analytics | ✅ Done | `lib/analytics-client.ts` |
| T7 instrumentação do catálogo | ✅ Done | `app/[slug]/use-catalogo.ts`, `app/[slug]/CatalogoClient.tsx` — contém 1 `SPEC_DEVIATION` (avaliado abaixo) |
| T8 view-model puro | ✅ Done | `lib/catalog-metrics.ts` |
| T9 leitura server-side | ✅ Done | `lib/server/analytics.ts` |
| T11 wiring da page | ✅ Done | `app/painel/page.tsx`, `app/painel/use-dashboard.ts` |
| T12 seção do dashboard | ✅ Done | `app/painel/DashboardClient.tsx` |
| T13 verificação integrada local | ⚠️ Manual | Executada contra o Supabase local pelo implementador, evidências em `tasks.md`; **sem cobertura automatizada** — ver Lacuna 4 |

---

## Spec-Anchored Acceptance Criteria

ANL-20 é **Superseded (PR #71)** e foi ignorado. 21 requisitos ativos.

| Req | Critério (WHEN → THEN) | Outcome definido pela spec | `file:line` + assertion | Result |
| --- | --- | --- | --- | --- |
| ANL-01 | 1ª abertura de `/{slug}` na sessão → registra `catalog_visit` | 1 evento `catalog_visit` da loja, dedup por `sessionStorage` escopado por slug | `__tests__/use-catalogo.test.ts:594` — `expect(eventsOf("catalog_visit")).toEqual([["ateliemira", "catalog_visit"]])` (+ `:593` `expect(shouldTrackVisit).toHaveBeenCalledWith("ateliemira")`); `__tests__/analytics-client.test.ts:134-136` — `expect(shouldTrackVisit("loja-da-ana")).toBe(true)` + `expect(sessionStorage.getItem("cd_visited_loja-da-ana")).toBe("1")`; escopo por slug em `:150-152` | ✅ PASS |
| ANL-02 | Recarga/renavegação na mesma sessão → NÃO registra nova visita | zero eventos adicionais | `__tests__/use-catalogo.test.ts:601` — `expect(eventsOf("catalog_visit")).toHaveLength(0)`; remount em `:615` — `toHaveLength(1)` após 2 montagens; `__tests__/analytics-client.test.ts:144` — `expect(segunda.shouldTrackVisit("loja-da-ana")).toBe(false)` | ✅ PASS |
| ANL-03 | Abrir detalhe do produto → `product_view` com `product_id` | evento com o id do produto aberto | `__tests__/use-catalogo.test.ts:625` — `expect(eventsOf("product_view")).toEqual([["ateliemira", "product_view", "p1"]])`; `__tests__/CatalogoClient.test.tsx:241` e `:257` — `expect(trackEvent.mock.calls).toEqual([["ateliemira","product_view",products[0].id]])` (grade e destaques); `:269` — fechar o modal não dispara | ✅ PASS |
| ANL-04 | `handleAdd` → `add_to_bag` com `product_id` | evento com o id do produto adicionado | `__tests__/use-catalogo.test.ts:636` — `expect(eventsOf("add_to_bag")).toEqual([["ateliemira", "add_to_bag", "p1"]])` (+ `:637` carrinho preservado) | ✅ PASS |
| ANL-05 | Checkout válido → `buy_click` **sem** `product_id` | 1 evento, sem produto | `__tests__/use-catalogo.test.ts:651` — `expect(eventsOf("buy_click")).toEqual([["ateliemira", "buy_click"]])` (array de 2 args ⇒ nenhum `productId`); guard negativo em `:665` — sem WhatsApp, `toHaveLength(0)` | ✅ PASS |
| ANL-06 | Todo evento carrega `visitor_id` UUID em `localStorage`, zero PII | payload exatamente `{slug, visitorId, eventType, productId}`; nada de IP/UA | `__tests__/analytics-client.test.ts:177-182` — `expect(lastPayload()).toEqual({slug, visitorId: id, eventType, productId})` (`toEqual` exaustivo ⇒ nenhum campo extra); `:42-43` — `expect(id).toMatch(UUID_RE)` + `expect(localStorage.getItem("cd_visitor_id")).toBe(id)`; linha gravada em `__tests__/registrar-evento.test.ts:151-156` — `expect(insertedRow(made)).toEqual({store_id, event_type, product_id: null, visitor_id})` (4 colunas, nada mais) | ✅ PASS |
| ANL-07 | Falha/lentidão do registro → navegação e checkout seguem, sem `await` no caminho crítico | WhatsApp abre; nenhum erro ao usuário; erro só no servidor | `__tests__/analytics-client.test.ts:199` — `expect(retorno).toBeUndefined()` (nunca Promise); `:206` e `:216` — `expect(() => trackEvent(...)).not.toThrow()` (rejeição e throw síncrono); `__tests__/use-catalogo.test.ts:723-724` — com `trackEvent` lançando, `expect(tab.location.href).toContain("https://wa.me/5511999990000")` + `registrarPedido` chamado; `:770` — `expect(ordem.slice(-3)).toEqual(["track:buy_click","window.open","registrarPedido"])`; `:679` e `:697` — `buy_click` mesmo com `registrarPedido` rejeitando/estourando timeout; `__tests__/registrar-evento.test.ts:324` e `:333` — action resolve `{ok:false}` sem lançar | ✅ PASS |
| ANL-08 | `event_type` fora da allowlist, slug inexistente, `visitor_id` não-UUID, produto de outra loja → rejeita **sem gravar** | `{ok:false}` e zero escrita | `__tests__/registrar-evento.test.ts:246-248` — `expect(result).toEqual({ok:false})` + `expect(made).toHaveLength(0)` + `expect(writeCalls(made)).toHaveLength(0)`; `:257-258` (visitorId), `:267-268` (loja ausente), `:277-278` (erro na busca da loja), `:289-291` (produto de outra loja: `insert` 0 e `writeCalls` 0), `:302-303`; schema: `__tests__/evento-validation.test.ts:55` (allowlist, inclui `"CATALOG_VISIT"`), `:61` (uuid), `:66-68` (slug), `:83-84` e `:98-99` (regra cruzada com mensagem e `path` exatos) | ✅ PASS |
| ANL-09 | Qualquer plano (inclusive `free`) → grava normalmente | insert executado, plano nunca consultado | `__tests__/registrar-evento.test.ts:233-235` — `expect(getPlanLimits).not.toHaveBeenCalled()` + `expect(getEffectivePlan).not.toHaveBeenCalled()` + `expect(callsOf(made,"catalog_events","insert")).toHaveLength(1)` | ✅ PASS |
| ANL-10 | Escrita só via service role; `anon` sem privilégio em `catalog_events` | insert exclusivamente pelo admin client; ACL zerada para `anon` | Escrita: `__tests__/registrar-evento.test.ts:6-8` mocka **apenas** `@/lib/supabase/admin` e `:150` prova que o insert passou por ele (usar o client autenticado quebraria o teste); ACL: `supabase/migrations/20260730000000_catalog_events.sql:50-51` — `revoke all ... from anon` / `from authenticated`, `:54` `grant select to authenticated`, `:58` `grant select, insert to service_role`; guarda no CI `.github/workflows/supabase-migrations-check.yml:212-225` | ✅ PASS (camada SQL sem teste JS — decisão registrada na Test Coverage Matrix) |
| ANL-11 | Grant DML explícito a `service_role` + guarda no CI | `has_table_privilege('service_role','public.catalog_events','insert'\|'select')` = true; `anon` = 0 | `supabase/migrations/20260730000000_catalog_events.sql:58`; CI `.github/workflows/supabase-migrations-check.yml:194-205` (`raise exception 'service_role sem privilegio necessario'`), `:227-236` (`anon` sem privilégio de tabela), `:239-249` (`anon` sem EXECUTE nas RPCs), `:252-264` (`authenticated` COM EXECUTE) | ✅ PASS (passo de CI **não executado** nesta validação — exige Docker/Supabase) |
| ANL-12 | Dashboard exibe visitas, únicos, cliques e conversão do período | visitas=`count catalog_visit`; únicos=`count distinct visitor_id` em `catalog_visit`; conversão = pedidos não-cancelados ÷ visitantes com `add_to_bag`, em % | `__tests__/DashboardClient.test.tsx:194-198` — `expect(statValue("Visitas")).toBe("120")`, `("Visitantes únicos")).toBe("84")`, `("Cliques em comprar")).toBe("9")`, `("Conversão sacola → pedido")).toBe("25%")` (5 pedidos ÷ 20 bagVisitors); `:208` — `"37.5%"` (3÷8); mapeamento em `__tests__/server-analytics.test.ts:83-88` — `expect(result.metrics).toEqual({visits:12, uniqueVisitors:7, buyClicks:3, bagVisitors:4})`; puro em `__tests__/catalog-metrics.test.ts:6-8`; definição SQL em `20260730010000_catalog_metrics_functions.sql:37-40` | ✅ PASS |
| ANL-13 | Top 5 produtos mais vistos do período, só existentes, com nome e contagem | `p_limit = 5`, ordenado por views desc, deletado fora da lista | `__tests__/server-analytics.test.ts:194` — `expect(argsOf("get_top_viewed_products").p_limit).toBe(5)`; `__tests__/DashboardClient.test.tsx:268` — `expect(itens).toEqual(["Blusa de tricô31 visualizações","Vestido midi12 visualizações"])`; `:290` — produto deletado filtrado: `toEqual(["Vestido midi9 visualizações"])`; `:277` singular; `:297` estado vazio | ⚠️ PASS com ressalva — a **ordenação** por contagem desc só existe no SQL (`20260730010000_...sql:69 order by count(*) desc`) e não tem teste automatizado (Lacuna 3) |
| ANL-14 | Período vem do `PeriodoFiltro`/`resolvePeriodRange`; nenhum seletor novo | um único `resolvePeriodRange`; um único filtro na tela | `__tests__/DashboardPage.test.tsx:190` — `expect(resolvePeriodRange).toHaveBeenCalledTimes(1)`; `__tests__/DashboardClient.test.tsx:96` — `screen.getByRole("group", {name:"Filtrar por período"})` (falha se houver 2) + `:103-104` `expect(filtro.compareDocumentPosition(vendas\|vitrine)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)`. Default "mês" é comportamento pré-existente de `resolvePeriodRange` (fora do diff) | ✅ PASS |
| ANL-15 | Analytics e cards de pedidos refletem o mesmo período | mesma fonte de range | `__tests__/DashboardPage.test.tsx:189` — `expect(getCatalogAnalytics.mock.calls[0][1]).toBe(getOrderMetrics.mock.calls[0][1])` (mesma **referência**, não só equivalência) + `:186-187` `toHaveBeenCalledWith(STORE_ID, RANGE)` nos dois | ✅ PASS |
| ANL-16 | Período sem eventos → zeros e conversão "—", sem erro e sem esconder a seção | 0/0/0 + "—" | `__tests__/DashboardClient.test.tsx:222-225` — `expect(statValue("Visitas")).toBe("0")`, únicos `"0"`, cliques `"0"`, `expect(statValue("Conversão sacola → pedido")).toBe("—")`; puro em `__tests__/catalog-metrics.test.ts:24-25` — `expect(computeConversionPct(0,0)).toBeNull()` e `:34` `not.toBe(0)` | ✅ PASS |
| ANL-17 | Lojista autenticado só lê dados da própria loja (RLS own-store) | linhas de outras lojas invisíveis | Policy: `20260730000000_catalog_events.sql:43-46` — `for select to authenticated using (exists (... s.owner_id = auth.uid()))`; `security invoker` explícito nas RPCs (`20260730010000_...sql:34`, `:59`); leitura via client autenticado em `lib/server/analytics.ts:52`, evidenciada indiretamente por `__tests__/server-analytics.test.ts:7-9` (mocka `@/lib/supabase/server`; usar o admin client quebraria a suíte) | ⚠️ PASS parcial — nenhum teste automatizado prova o isolamento entre lojas (Lacuna 2) |
| ANL-18 | Plano `free` → nenhuma query de analytics | `getCatalogAnalytics` nunca chamado | `__tests__/DashboardPage.test.tsx:198` — `expect(getCatalogAnalytics).not.toHaveBeenCalled()` (free); `:206` idem para Pro com trial vencido; `:129` no bloco pré-existente, junto de `from`/`getOrderMetrics`/`resolvePeriodRange` | ✅ PASS |
| ANL-19 | Upgrade → métricas reais, **incluindo eventos do período Free** | métricas exibidas cobrem o histórico capturado antes do upgrade | `__tests__/DashboardPage.test.tsx:213` — `expect(getCatalogAnalytics).toHaveBeenCalledTimes(1)` (plano pago busca). A cláusula "incluindo eventos capturados durante o período Free" é **estrutural** (ANL-09: captura nunca consulta plano; leitura não filtra por plano nem por data de upgrade), sem assertion própria | ⚠️ PASS parcial (Lacuna 1) |
| ANL-21 | Consent `"rejected"` → `visitor_id` efêmero, eventos continuam | nada escrito em `localStorage["cd_visitor_id"]`; eventos seguem | `__tests__/analytics-client.test.ts:81` — `expect(localStorage.getItem("cd_visitor_id")).toBeNull()`; `:95-96` — id difere entre páginas e storage segue vazio; `:104` — ignora id preexistente; `:115` — com `accepted`/`null` **persiste** (`toBe(id)`); `:125-126` — `expect(registrarEvento).toHaveBeenCalledTimes(1)` + `visitorId` UUID | ✅ PASS |
| ANL-22 | Preset "tudo" → histórico completo, sem filtro de data | `p_from`/`p_to` nulos nas duas RPCs | `__tests__/server-analytics.test.ts:175-185` — `expect(argsOf("get_catalog_metrics")).toEqual({p_store_id, p_from:null, p_to:null})` e idem para `get_top_viewed_products` (com `p_limit:5`); predicado SQL em `20260730010000_...sql:43-44` e `:66-67`; `resolvePeriodRange` devolve `null` para `"tudo"` (`lib/period-filter.ts:69`) | ✅ PASS |

**Status**: 18/21 ✅ com outcome exato; 3 ⚠️ parciais (ANL-13 ordenação, ANL-17 isolamento, ANL-19 histórico pós-upgrade) — nenhum sem `file:line`.

### Regra payload/conjunção (campos, não só "a chamada aconteceu")

| Registro | Campos verificados por valor | Evidência |
| --- | --- | --- |
| `insert` em `catalog_events` (4 colunas) | `store_id`, `event_type`, `product_id`, `visitor_id` — `toEqual` exaustivo, 3 combinações de tipo de evento | `__tests__/registrar-evento.test.ts:151-156`, `:166-171`, `:182-187` |
| Payload do `trackEvent` (4 campos) | `slug`, `visitorId`, `eventType`, `productId` — `toEqual` exaustivo (rejeita campo extra) + `productId: null` quando o evento não tem produto | `__tests__/analytics-client.test.ts:177-182`, `:190-191` |
| Args das RPCs | `p_store_id`, `p_from`, `p_to`, `p_limit` — `toEqual` do objeto inteiro nos dois presets | `__tests__/server-analytics.test.ts:156-166`, `:175-185` |
| View-model do dashboard | valor renderizado de cada card, não presença do card | `__tests__/DashboardClient.test.tsx:194-198` |

---

## Discrimination Sensor

Todas as mutações foram aplicadas em estado descartável e revertidas com `git checkout -- <arquivo>`; `git status --porcelain` **vazio** ao final.

| # | File:line | Mutação | Testes rodados | Resultado |
| --- | --- | --- | --- | --- |
| 1 | `lib/analytics-client.ts:58` | Inverte o consent: `=== "rejected"` → `!== "rejected"` (rejeitado passa a persistir) | `__tests__/analytics-client.test.ts` | ✅ **Killed** — 6 falhas / 18 |
| 2 | `app/actions/eventos.ts:69` | Remove o `?? null`: `product_id: productId ?? null` → `product_id: productId` | `__tests__/registrar-evento.test.ts` | ❌ **Survived** — 16/16 verdes (análise abaixo) |
| 3 | `lib/catalog-metrics.ts:28` | `bagVisitors === 0` → `return 0` em vez de `return null` | `catalog-metrics` + `DashboardClient` | ✅ **Killed** — 3 falhas / 29 |
| 4 | `app/painel/page.tsx:49` | Resolve um range **separado** para analytics em vez de reusar o dos pedidos | `__tests__/DashboardPage.test.tsx` | ✅ **Killed** — 1 falha / 11 |
| 5 | `app/[slug]/use-catalogo.ts:176→222` | Move `track(..., "buy_click")` para **depois** do `Promise.race` | `__tests__/use-catalogo.test.ts` | ✅ **Killed** — 2 falhas / 45 |
| 6 | `lib/server/analytics.ts:83` | Troca o mapeamento: `uniqueVisitors: toCount(row?.visits)` | `__tests__/server-analytics.test.ts` | ✅ **Killed** — 2 falhas / 10 |

**Sensor depth**: P0-full (6 mutações, caminho de venda + integridade de dados)
**Resultado**: 5/6 killed — ⚠️ 1 sobrevivente

### Análise do mutante sobrevivente (#2)

Todo payload dos testes de `registrarEvento` traz `productId: null` **explícito** (`registrar-evento.test.ts:102-110`), então `productId ?? null` e `productId` produzem o mesmo valor e nenhuma assertion muda. O schema aceita `productId` **ausente** (`.nullish()`, `lib/validation/evento.ts:25`, coberto em `evento-validation.test.ts:25-30`), e esse caminho nunca chega à action nos testes.

Severidade **baixa**: em produção o mutante é equivalente — `supabase-js` serializa o objeto em JSON, `undefined` é descartado pelo `JSON.stringify` e a coluna assume o default `null`. Ainda assim, a lacuna de discriminação é real: nenhum teste dirige a action com `productId` omitido.

---

## Code Quality

| Princípio | Status | Nota |
| --- | --- | --- |
| Minimum code | ✅ | Lógica nova concentrada em 4 módulos pequenos e puros |
| Surgical changes | ✅ | Arquivos existentes tocados só no necessário; `CatalogoClient` mudou 2 linhas (`setOpenProduct` → `handleOpenProduct`) |
| No scope creep | ⚠️ | 2 itens avaliados abaixo — ambos defensáveis, nenhum bloqueante |
| Matches patterns | ✅ | `registrarEvento` espelha `registrarPedido`; `fail()` em `lib/server/analytics.ts:27` segue `lib/server/pedidos.ts:43`; migrations seguem `orders` |
| Spec-anchored outcome check | ✅ | Ver tabela de ACs; valores asseridos batem com a spec |
| Per-layer Coverage Expectation | ✅ | Lib pura e Server Action com 1:1 e todos os branches de erro; hooks/pages com happy + vazio + erro + bloqueado; camada SQL = "none" por decisão da Test Coverage Matrix |
| Todo teste mapeia a um AC/edge/Done-when | ✅ | Nenhum teste órfão nos 9 arquivos do escopo |
| Guidelines do projeto seguidas | ✅ | `AGENTS.md` (grant explícito para `service_role`; `anon` zerado; CI estendido), `docs/CONVENTIONS.md` (Vitest + Testing Library) |

### Avaliação do `SPEC_DEVIATION` (`app/[slug]/use-catalogo.ts:23-38`)

O helper `track()` embrulha `trackEvent` num `try/catch` no call site. **`trackEvent` já engole tudo internamente** (`lib/analytics-client.ts:99-109`, verificado em `analytics-client.test.ts:210-217`), então a borda é redundante em relação ao código real — os 3 testes que a exercitam (`use-catalogo.test.ts:707`, `:728`, `:741`) precisam **mockar** `trackEvent` para lançar, cenário que o `trackEvent` real não produz (o próprio comentário do teste admite isso).

**Veredito**: justificado por ANL-07, **não** escopo excedido. A AC exige explicitamente que o checkout prossiga "sem bloqueio" e o design (linha 118) manda o disparo do `buy_click` ficar **fora** do `try`/`Promise.race` do checkout — nessa posição, um throw síncrono escaparia de `handleCheckout` e a aba do WhatsApp nunca receberia a URL. São 6 linhas de defesa em profundidade no ponto mais caro do produto, com o desvio declarado e explicado. Aceito com a ressalva de que a redundância deve ser lembrada se `trackEvent` for refatorado.

### Avaliação de `p_limit` e da normalização bigint→Number

- **`p_limit`**: **não é scope creep** — está explícito no design (`design.md:84`, `get_top_viewed_products(..., p_limit int default 5)`) e serve ao "top 5" de ANL-13, com a constante `TOP_VIEWED_LIMIT` (`lib/server/analytics.ts:6`) passada explicitamente e asserida em `server-analytics.test.ts:194`.
- **`toCount()` (`lib/server/analytics.ts:34-36`)**: 3 linhas defensivas. Elas cobrem dois casos: (a) linha ausente (`row?.visits` → `undefined` → 0), que é **real** e testado em `server-analytics.test.ts:121-137`; e (b) bigint chegando como string, que na prática o PostgREST não produz (serializa `int8` como número JSON) — o teste `:103-119` documenta um cenário hipotético. Custo mínimo, risco zero; **mantido, sem ação**. Nota: o caso (b) não deriva de nenhum AC.

---

## Edge Cases

- [x] Sem `localStorage`/`sessionStorage` → id efêmero, tudo registra: `analytics-client.test.ts:56-70` (`expect(segundo).toBe(primeiro)`) e `:155-166`
- [x] Produto deletado sai de "mais vistos" e o evento permanece: `DashboardClient.test.tsx:281-292`; `on delete set null` em `20260730000000_catalog_events.sql:24`
- [x] Conversão > 100% não é capada: `DashboardClient.test.tsx:227-235` (`"200%"`), `catalog-metrics.test.ts:28-31` (150 e 1000)
- [x] Falha na leitura de métricas → dashboard renderiza com a seção indisponível: `DashboardPage.test.tsx:217-231` (página resolve, cards de pedidos intactos, `console.error` chamado) + `DashboardClient.test.tsx:237-245` ("Não foi possível carregar agora.", `statValue("Pedidos")` = `"5"`)
- [x] `buy_click` registrado mesmo com `registrarPedido` falhando/estourando timeout: `use-catalogo.test.ts:668-705`
- [x] Retry de rede grava os dois eventos (sem dedup além de `catalog_visit`): decisão da spec; ausência de dedup verificável em `app/actions/eventos.ts:66-71` (insert direto, sem upsert/`client_event_id`)

---

## Gate Check

- **Comando (Build gate de `tasks.md`)**: `npx vitest run && npm run build`
- **`npx vitest run`**: **82 arquivos / 928 testes — 928 passed, 0 failed, 0 skipped** (18,13 s) — bate exatamente com o esperado
- **`npm run build`**: **exit 0**, todas as rotas compiladas (inclusive `ƒ /painel` e `ƒ /[slug]`)
- **Test count antes da feature**: 77 arquivos / 837 testes (baseline registrada em `tasks.md:14`)
- **Delta**: +5 arquivos / **+91 testes**; nenhum teste removido, nenhuma assertion pré-existente enfraquecida (o único teste alterado, `DashboardClient.test.tsx:92`, foi **fortalecido**: `getByRole` singular + ordem no documento)
- **Não executado nesta validação**: o job `supabase-migrations-check` (exige Docker + Supabase local) e a verificação integrada T13 (manual)

---

## Lacunas (ranqueadas, nenhuma bloqueante)

1. **Mutante sobrevivente em `app/actions/eventos.ts:69`** — nenhum teste dirige `registrarEvento` com `productId` **omitido** do objeto, só com `null` explícito. Fix sugerido: um caso em `__tests__/registrar-evento.test.ts` com o payload sem a chave `productId`, asserindo `product_id: null` na linha inserida. Severidade: Minor (mutante equivalente em produção).
2. **ANL-17 sem prova automatizada de isolamento entre lojas** — a garantia vive inteiramente na policy RLS + `security invoker`. Coberta pelo Independent Test manual da spec e por T13. Fix sugerido (opcional): asserção SQL no job de CI consultando as RPCs como uma loja alheia. Severidade: Minor.
3. **ANL-13: ordenação "top 5 por contagem desc" só no SQL** — os testes de UI asseguram que a ordem **da RPC** é preservada, não que a RPC ordena. Verificado manualmente em T2. Severidade: Minor.
4. **T13 (verificação integrada) é manual** — o fluxo real vitrine→banco→dashboard não tem cobertura automatizada; a evidência é o registro em `tasks.md` (dados de teste removidos ao final). Registrado, não é regressão. Severidade: Informational.

### Spec-precision gaps

- **Arredondamento da conversão para 1 casa decimal** (`lib/catalog-metrics.ts:29`, travado em `catalog-metrics.test.ts:11-15` com `33.3`/`66.7`/`14.3`): nem a spec nem o design definem a precisão de exibição — só "em %". O teste fixa um valor que a spec não define. ⚠️ Registrado como spec-precision gap (não é defeito).
- **ANL-19**: a spec define o outcome ("incluindo eventos capturados durante o período Free") mas nenhuma assertion o mira; a garantia é composicional (ANL-09 + leitura sem filtro de plano). ⚠️ Registrado.

---

## Requirement Traceability Update

| Requirement | Previous | New |
| --- | --- | --- |
| ANL-01 … ANL-12, ANL-14 … ANL-16, ANL-18, ANL-21, ANL-22 | In Tasks | ✅ Verified |
| ANL-13 | In Tasks | ✅ Verified (ordenação SQL sem teste automatizado) |
| ANL-17 | In Tasks | ✅ Verified (RLS por migration; isolamento sem teste automatizado) |
| ANL-19 | In Tasks | ✅ Verified (cobertura composicional) |
| ANL-20 | — | Superseded (PR #71) — fora do escopo |

---

## Summary

**Overall**: ✅ **Ready**

**Spec-anchored check**: 21/21 ACs ativos com `file:line`; 18 com outcome exato, 3 parciais, 2 spec-precision gaps sinalizados
**Sensor**: 5/6 mutações mortas (1 sobrevivente equivalente em produção)
**Gate**: 928 passed / 0 failed / 0 skipped; `npm run build` exit 0

**O que funciona**: captura dos 4 tipos de evento com dedup de sessão, zero PII e fire-and-forget provado por ordem de execução; validação estrita na Server Action com "nada gravado" asserido em todos os caminhos de rejeição; leitura server-side com erro que nunca vira zero; um único range governando pedidos e analytics (mesma **referência** de objeto); gate de página do PR #71 mantendo `free` sem nenhuma query; grants e ACL de funções cobertos por migration + CI.

**Próximos passos**: nenhum bloqueio para merge. As 4 lacunas acima são candidatas a fix tasks de baixa prioridade — a #1 é a única que fecha um buraco real de discriminação de testes.

---
---

# Iteração 2 — Reverificação

**Date**: 2026-07-30
**Verifier**: sub-agente independente, olhos novos (author ≠ verifier), evidence-or-zero
**Escopo**: focado — confirmar que a Lacuna 1 (mutante M2 sobrevivente) fechou e que nada regrediu
**Fix task sob análise**: commit `d1d3a10` — `test(analytics): cobre productId ausente no payload de evento`
**Verdict**: ✅ **PASS** — mutante M2 morto, 3 mutações novas mortas, gate verde, nenhuma assertion enfraquecida

---

## Gate (executado, valores reais)

| Comando | Esperado | Real | Result |
| --- | --- | --- | --- |
| `npx vitest run` | 82 arquivos / 929 testes | **82 passed (82) / 929 passed (929)** — 0 failed, 0 skipped, 16,60 s | ✅ |
| `npm run build` | exit 0 | **exit 0**; todas as rotas compiladas (`ƒ /painel`, `ƒ /[slug]`, `ƒ Proxy (Middleware)`); 0 ocorrências de `error`/`failed` no log | ✅ |

**Delta vs. iteração 1**: 928 → **929 testes** (+1, exatamente o caso adicionado por `d1d3a10`); 82 → 82 arquivos.
**Delta vs. baseline pré-feature** (`tasks.md:14`, 77 arquivos / 837 testes): +5 arquivos / **+92 testes**.

---

## M2 reverificado (o mutante que sobreviveu na iteração 1)

| Item | Valor |
| --- | --- |
| File:line | `app/actions/eventos.ts:69` |
| Mutação | `product_id: productId ?? null` → `product_id: productId` |
| Testes rodados | `npx vitest run __tests__/registrar-evento.test.ts` |
| Iteração 1 | ❌ **Survived** — 16/16 verdes |
| Iteração 2 | ✅ **Killed** — **1 failed \| 16 passed (17)** |

Falha exata que mata o mutante (`__tests__/registrar-evento.test.ts:170`):

```
- "product_id": null,
+ "product_id": undefined,
```

Ou seja: o novo caso é o **único** teste que falha sob a mutação — ele é precisamente o sensor que faltava, não um efeito colateral de outro teste. A mutação foi aplicada em estado descartável e revertida com `git checkout -- app/actions/eventos.ts`; `git status --porcelain app/actions/eventos.ts` **vazio** depois.

### A fix task não enfraqueceu nada

`git diff d1d3a10~1 d1d3a10` → `__tests__/registrar-evento.test.ts | 19 +++++++++++++++++++`, **1 file changed, 19 insertions(+), 0 deletions(-)**.

- ✅ Somente adição — zero linhas removidas em todo o commit
- ✅ Nenhuma assertion existente alterada, nenhum teste removido
- ✅ Nenhum `skip`/`only`/`todo` introduzido
- ✅ O caso adicionado usa `toEqual` exaustivo nas 4 colunas (mesmo rigor dos casos vizinhos) e assere também `result` `{ ok: true }`
- ✅ Constrói o payload por desestruturação (`const { productId: _omit, ...semProduto }`), o que garante a **ausência da chave** — não `productId: undefined` — que era exatamente o caminho não exercitado

---

## Sensor de regressão — 3 mutações NOVAS

Áreas não sondadas pela iteração 1. Todas aplicadas em estado descartável e revertidas.

| # | File:line | Mutação | Testes rodados | Resultado |
| --- | --- | --- | --- | --- |
| 7 | `lib/validation/evento.ts:18` | Inverte a regra cruzada: `EVENT_TYPES_WITH_PRODUCT` passa a listar `["catalog_visit","buy_click"]` em vez de `["product_view","add_to_bag"]` | `evento-validation` + `registrar-evento` + `use-catalogo` | ✅ **Killed** — **14 failed / 73** (2 arquivos) |
| 8 | `lib/analytics-client.ts:79` | `shouldTrackVisit` retorna `true` incondicionalmente (mata o dedup de sessão) | `analytics-client` + `use-catalogo` | ✅ **Killed** — **4 failed / 63** (falha em `analytics-client.test.ts:165`, `toBe(false)` na 2ª chamada) |
| 9 | `app/painel/use-dashboard.ts:56` | `flatMap` → `map` que aceita produto inexistente (`name: product?.name ?? ""`), deixando o produto deletado na lista | `DashboardClient` + `DashboardPage` | ✅ **Killed** — **1 failed / 34** (falha em `DashboardClient.test.tsx:291`, lista de "mais vistos") |

**Sensor iteração 2**: 4 mutações (M2 reverificada + 3 novas) — **4/4 killed**.
**Sensor acumulado (it. 1 + it. 2)**: 9 mutações distintas — **9/9 killed**, zero sobreviventes.

Nota sobre a #8: `use-catalogo.test.ts` passou sob a mutação porque mocka `shouldTrackVisit` — comportamento correto para um teste de hook; a discriminação vive no teste de unidade do client, que matou o mutante. Nota sobre a #9: a mutação sobrevive a `DashboardPage.test.tsx` (que não inspeciona a lista) e morre no teste que assere o conteúdo renderizado — a divisão de responsabilidade está certa.

### Higiene do sensor

`git diff --stat HEAD -- app lib supabase __tests__` → **vazio** ao final. `git status --porcelain` mostra apenas `.specs/LESSONS.md`, `.specs/lessons.json` (fora do escopo desta validação) e `next-env.d.ts` (regenerado pelo `npm run build`). **Nenhuma mutação residual em código de produção ou de teste.**

---

## Estado final das lacunas da iteração 1

| # | Lacuna | Estado após it. 2 |
| --- | --- | --- |
| 1 | Mutante sobrevivente em `app/actions/eventos.ts:69` — nenhum teste dirige `registrarEvento` com `productId` omitido | ✅ **FECHADA** — `d1d3a10` adicionou o caso; mutação reinjetada e **morta** (1 failed / 17) |
| 2 | ANL-17 sem prova automatizada de isolamento entre lojas (garantia vive na policy RLS + `security invoker`) | ⚠️ **Permanece — limitação aceita**. Coberta pelo Independent Test manual da spec e por T13. Severidade Minor; fix opcional = asserção SQL no job de CI |
| 3 | ANL-13: ordenação "top 5 por contagem desc" só existe no SQL, sem teste automatizado | ⚠️ **Permanece — limitação aceita**. Verificada manualmente em T2; a mutação #9 confirma que a camada JS preserva (e filtra) corretamente a ordem que a RPC devolve. Severidade Minor |
| 4 | T13 (verificação integrada vitrine→banco→dashboard) é manual | ⚠️ **Permanece — limitação aceita**. Evidência registrada em `tasks.md`; consistente com a decisão da Test Coverage Matrix de não cobrir a camada SQL em JS. Severidade Informational |

**Spec-precision gaps** (arredondamento da conversão para 1 casa decimal; ANL-19 com cobertura composicional) **permanecem registrados como estavam** — não são defeitos e não foram alvo desta iteração.

**Não executado nesta iteração** (idem it. 1): o job `supabase-migrations-check` (exige Docker + Supabase local) e a verificação integrada T13 (manual).

---

## Summary — Iteração 2

**Overall**: ✅ **Ready — sem ressalvas de discriminação**

**Gate**: 82 arquivos / 929 testes — 929 passed, 0 failed, 0 skipped; `npm run build` exit 0
**Sensor**: 4/4 mutações mortas nesta iteração; 9/9 acumuladas; **zero sobreviventes**
**Fix task**: `d1d3a10` é adição pura de teste (+19/-0), sem enfraquecer nenhuma assertion existente
**Lacunas remanescentes**: 3 (nºs 2, 3 e 4), todas Minor/Informational, todas na fronteira SQL/integração que a Test Coverage Matrix já declarou fora do escopo automatizado. **Nenhum bloqueio para merge.**
