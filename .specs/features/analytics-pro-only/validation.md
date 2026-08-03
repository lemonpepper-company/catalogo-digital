# Analytics exclusivo do plano Pro — Validation

**Date**: 2026-08-03
**Spec**: `.specs/features/analytics-pro-only/spec.md`
**Diff range**: `fc6f61a..HEAD` (branch `feature/analytics-pro-only`, 10 commits)
**Verifier**: ⚠️ **pass standalone, executado pelo autor** — o usuário optou por execução inline (sem sub-agentes), então esta validação usa o *standalone fallback* de `validate.md`. Ela cumpre o roteiro completo (checagem ancorada na spec + sensor de discriminação em worktree isolado), **mas não tem a separação autor ≠ verificador**. Um Verifier independente continua disponível como passo extra.

---

## Task Completion

| Task | Status | Notas |
| --- | --- | --- |
| T1 — capability `hasAnalytics` | ✅ Done | `7616ffd` |
| T2 — gate de captura | ✅ Done | `ddb3f35` |
| T3 — selo variável do `RecursoBloqueado` | ✅ Done | `d4416ce` |
| T4 + T5 — gate de leitura + render dos 3 estados | ✅ Done | `081c7b0` — **fundidas**, contrato de prop compartilhado (desvio registrado em `tasks.md`) |
| T6 — `hasAnalytics` no view-model público | ✅ Done | `67b7612` |
| T7 — curto-circuito no `track()` | ✅ Done | `c0b8a2d` |
| T8 — bullet do Pro na landing | ✅ Done | `df2a123` |
| T9 — AD-014 + spec original marcada | ✅ Done | `5ff8873` |
| T10 — verificação integrada | ✅ Done | `ecf7da3` — evidência completa em `tasks.md` |

---

## Spec-Anchored Acceptance Criteria

### P1: Captura exclusiva do Pro

| Critério | Outcome definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| AC1 free/starter → `{ok:false}`, sem insert | nenhuma escrita, retorno `{ok:false}` | `__tests__/registrar-evento.test.ts:229,240` — `expect(result).toEqual({ok:false})` + `expect(writeCalls(made)).toHaveLength(0)` | ✅ PASS |
| AC2 pro grava o mesmo shape | linha `{store_id, event_type, product_id, visitor_id}` | `registrar-evento.test.ts:251` — `expect(insertedRow(made)).toEqual({store_id: STORE_ID, event_type:"catalog_visit", product_id:null, visitor_id: VISITOR_ID})` | ✅ PASS |
| AC3 trial vencido = free | recusa; futuro → grava | `registrar-evento.test.ts:266` — `expect(writeCalls(made)).toHaveLength(0)`; `:277` — `expect(callsOf(made,"catalog_events","insert")).toHaveLength(1)` | ✅ PASS |
| AC4 recusa por plano sem `console.error` | zero log na recusa; log preservado nos demais | `registrar-evento.test.ts:288` — `expect(errorSpy).not.toHaveBeenCalled()` seguido de `expect(errorSpy).toHaveBeenCalledTimes(1)` na loja inexistente | ✅ PASS |
| AC5 ordem de validação preservada | gate de plano depois da loja, antes da posse do produto | `registrar-evento.test.ts:300` — `expect(made.filter(e=>e.table==="products")).toHaveLength(0)`; caminhos de payload/loja/erro cobertos em `:262-310` (pré-existentes, intactos) | ✅ PASS |
| AC6 sem round-trip novo | uma consulta a `stores`, colunas `id, plan, trial_ends_at` | `registrar-evento.test.ts:309` — `expect(callsOf(made,"stores","select")).toEqual([["id, plan, trial_ends_at"]])` + `expect(made.filter(e=>e.table==="stores")).toHaveLength(1)` | ✅ PASS |

### P1: Exibição exclusiva do Pro

| Critério | Outcome definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| AC1 starter → nenhuma RPC | `getCatalogAnalytics` não chamada | `__tests__/DashboardPage.test.tsx:234` — `expect(getCatalogAnalytics).not.toHaveBeenCalled()` | ✅ PASS |
| AC2 starter → upsell, zero número | selo "Disponível no plano Pro", nenhum rótulo de métrica | `__tests__/DashboardClient.test.tsx:259` — `getByText("Disponível no plano Pro")` + 5× `queryByText(...).toBeNull()`; `DashboardPage.test.tsx:242` idem no server render | ✅ PASS |
| AC3 pro sem regressão | mesmos valores de ANL-12/13/16 | `DashboardClient.test.tsx:196` — `expect(statValue("Visitas")).toBe("120")`, `…("Conversão sacola → pedido")).toBe("25%")`; `:309` — lista de mais vistos com ordem e plural | ✅ PASS |
| AC4 bloqueado ≠ indisponível | textos mutuamente exclusivos | `DashboardClient.test.tsx:271` — bloqueado **não** mostra "Não foi possível carregar agora."; `:277` — indisponível **não** mostra o selo | ✅ PASS |
| AC5 starter mantém pedidos/filtro | cards e `PeriodoFiltro` intactos | `DashboardClient.test.tsx:284` — `expect(statValue("Pedidos")).toBe("5")` + `getByRole("group",{name:"Filtrar por período"})`; `DashboardPage.test.tsx:252` — `expect(getOrderMetrics).toHaveBeenCalledWith(STORE_ID, RANGE)` | ✅ PASS |
| AC6 free segue bloqueado pela página | nenhum I/O | `DashboardPage.test.tsx:122` — `expect(from).not.toHaveBeenCalled()` + `expect(getOrderMetrics).not.toHaveBeenCalled()` (pré-existente, intacto) | ✅ PASS |

### P2: Catálogo público não chama a action fora do Pro

| Critério | Outcome definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| AC1 loja sem `hasAnalytics` não chama | zero chamadas no fluxo completo | `__tests__/use-catalogo.test.ts:655` — `expect(trackEvent).not.toHaveBeenCalled()` após view+sacola+checkout | ✅ PASS |
| AC2 loja pro dispara os 4 | eventos com slug/tipo/produto | `use-catalogo.test.ts:591-653` (testes ANL-01..05 intactos) — ex.: `expect(eventsOf("buy_click")).toEqual([["ateliemira","buy_click"]])` | ✅ PASS |
| AC3 servidor é a garantia | comportamento correto sem o cliente | `registrar-evento.test.ts:229-247` (gate do servidor testado isoladamente, sem passar pelo cliente); `use-catalogo.test.ts:671` prova que o guard não quebra a venda | ✅ PASS |
| Derivação de `hasAnalytics` | false/false/true por plano | `__tests__/catalog.test.ts:328` — `expect(hasAnalyticsDo("pro")).toBe(true)` etc. | ✅ PASS |

### P3 + capability

| Critério | Outcome | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| APO-07 capability | free/starter false, pro true | `__tests__/plan-limits.test.ts:183,187,191` — `expect(getPlanLimits("pro", null).hasAnalytics).toBe(true)`; `:196` trial vencido → false | ✅ PASS |
| APO-16 bullet do Pro | presente no Pro, ausente nos demais | `__tests__/landing-data.test.ts:83` — `expect(proFeatures).toContain("Métricas de visitas da vitrine")`; `:87` — `expect(starterFeatures.some(f=>/visita/i.test(f))).toBe(false)` | ✅ PASS |
| APO-13 (linhas antigas preservadas) | 9 linhas de loja starter intactas | verificação integrada em `tasks.md` (T10) — contagem antes/depois em SQL | ✅ PASS (evidência runtime, não unitária) |

**Status**: ✅ **16/16 requisitos cobertos com evidência `file:line`. 0 spec-precision gaps.**

---

## Discrimination Sensor

Executado num `git worktree` descartável sobre `HEAD`; a árvore real nunca foi mutada (confirmado por `git status --short` vazio após remoção do worktree).

| # | `file:line` | Mutação | Morto? |
| --- | --- | --- | --- |
| 1 | `app/actions/eventos.ts:52` | Gate de captura invertido (`!hasAnalytics` → `hasAnalytics`) | ✅ 12 falhas |
| 2 | `lib/plan-limits.ts:36` | `STARTER_LIMITS.hasAnalytics` false → true | ✅ 5 falhas |
| 3 | `app/painel/page.tsx:50` | Dashboard sempre consulta analytics (`if (limits.hasAnalytics)` → `if (true)`) | ✅ 2 falhas |
| 4 | `app/painel/DashboardClient.tsx:147` | Estado `blocked` cai no aviso de indisponível em vez do upsell | ✅ 3 falhas |
| 5 | `app/[slug]/use-catalogo.ts:35` | Curto-circuito do cliente removido (`if (!enabled) return`) | ✅ 1 falha |
| 6 | `app/actions/eventos.ts:53` | Recusa por plano passa a emitir `console.error` (viola APO-04) | ✅ 1 falha |
| 7 | `lib/catalog.ts:101` | `hasAnalytics: limits.hasAnalytics` → `true` fixo | ✅ 1 falha |
| 8 | `app/actions/eventos.ts:33` | `select` volta a `"id"` (plano some do payload — viola APO-06/APO-02) | ✅ 1 falha |

**Profundidade**: expandida (8 mutações) — o gate é uma fronteira de monetização, não código comum.
**Resultado**: **8/8 mortos — PASS ✅**

---

## Gate Check

- **Comando**: `npx vitest run && npm run build && npm run lint` (+ `npx tsc --noEmit`, incorporado ao gate durante a execução)
- **Testes**: **985 passed, 0 failed, 0 skipped** em 83 arquivos
- **Contagem antes da feature** (`main` em `fc6f61a`): 956
- **Delta**: **+29 testes**. Nenhum teste deletado sem substituição mais forte — o único removido (`registrar-evento.test.ts`, prova de ANL-09 via `expect(getPlanLimits).not.toHaveBeenCalled()`) deu lugar a 8 testes que exercitam o `lib/plan-limits` real
- **Build**: `✓ Compiled successfully`
- **Lint**: 19 erros = **baseline exato da `main`**, zero novos
- **tsc**: 3 erros = **baseline exato da `main`** (medido em worktree limpo de `fc6f61a`), zero novos

---

## Code Quality

| Princípio | Status |
| --- | --- |
| Código mínimo | ✅ |
| Mudanças cirúrgicas | ✅ — nenhum arquivo fora do escopo das tasks |
| Sem scope creep | ✅ |
| Segue os padrões existentes | ✅ — capability como `hasOrderHistory`; campo derivado como `gridDensity`; união discriminada como `PublicCatalog` |
| Asserções batem com o outcome da spec | ✅ |
| Cobertura por camada | ✅ — lib pura e Server Action com mapeamento 1:1 de ACs; páginas/componentes com happy + bloqueado + indisponível |
| Todo teste mapeia um requisito | ✅ |
| Guidelines seguidas | ✅ — `AGENTS.md`, `docs/CONVENTIONS.md` (Vitest + Testing Library) |

**SPEC_DEVIATION ativos:** o marcador pré-existente em `app/[slug]/use-catalogo.ts:23` (try/catch no call site de `track`, justificado por ANL-07 e aprovado no ciclo anterior) permanece — esta feature não o alterou.

---

## Edge Cases

- [x] Rebaixamento pro → starter para a captura na visita seguinte, histórico permanece — coberto por `registrar-evento.test.ts:240` + T10 (a mesma loja alternou entre os três planos)
- [x] Loja starter com eventos antigos vira pro e os vê — T10: as 9 linhas de `maria-das-roupas` sobreviveram a toda a execução
- [x] Erro de banco na consulta da loja ≠ recusa por plano — `registrar-evento.test.ts:290` (pré-existente) + `:288` (recusa silenciosa); os dois caminhos se distinguem pelo log
- [x] Produto de outra loja + plano free: qualquer recusa basta — `registrar-evento.test.ts:300` prova que o plano decide primeiro
- [x] Chamada direta à Server Action fora do catálogo — `registrar-evento.test.ts:229` chama a action sem passar pelo cliente

---

## Requirement Traceability Update

| Requisito | Status anterior | Novo status |
| --- | --- | --- |
| APO-01 … APO-16 | Pending | ✅ **Verified** (16/16) |

---

## Summary

**Overall**: ✅ **Ready**

**Spec-anchored check**: 16/16 requisitos com outcome batendo · 0 spec-precision gaps
**Sensor**: 8/8 mutantes mortos
**Gate**: 985 testes verdes · build ok · lint e tsc no baseline exato da `main`

**O que funciona**: captura recusada em free/starter e gravada no pro (provado em unit e em runtime, com o log do servidor mostrando que nem requisição sai fora do Pro); dashboard do starter com upsell e zero query; dashboard do pro idêntico ao de antes; pedidos, faturamento e filtro de período intactos; linhas de evento antigas preservadas.

**Ressalva de método**: validação executada pelo autor (o usuário optou por execução inline). O roteiro foi cumprido por inteiro, mas sem a separação autor ≠ verificador que torna o gate independente.

**Próximo passo**: revisar e abrir PR.
