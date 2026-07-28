# Captura de Pedidos — Validation (iteração 2)

**Date**: 2026-07-28
**Spec**: `.specs/features/captura-de-pedidos/spec.md` (30 ACs, ORD-01..30 — única fonte de verdade)
**Diff range**: `cafaeab..9d8ad8b` (`git diff main..HEAD`). Fix tasks desta iteração: `d9a7f12`, `762a49f`, `e035b1b`, `2632d95` (+ `9d8ad8b` de handoff)
**Verifier**: sub-agent independente (author ≠ verifier), coverage re-derivada do zero com evidence-or-zero. Não herda as premissas da iteração 1.

---

## Veredito

**✅ PASS** — 30/30 ACs com asserção casando o outcome da spec, 10/10 mutações mortas, blocker de runtime corrigido e **comprovado por checkout real**.

O blocker da iteração 1 não foi apenas "corrigido no SQL": foi verificado nos dois sentidos. Com os grants aplicados, um checkout real grava o pedido com o total recalculado do banco; com os grants revogados, reaparece exatamente o erro da iteração 1 (`permission denied for table stores`) — o que prova causalidade, e não coincidência.

---

## Histórico — o que a iteração 1 reprovou e o que foi confirmado corrigido

| # | Achado da iteração 1 (FAIL) | Correção alegada | Confirmado nesta iteração? |
|---|---|---|---|
| 1 | **Blocker**: `service_role` sem nenhum DML → `registrarPedido` morria com `permission denied for table stores`; 0 linhas em `orders`. ACs atingidas: ORD-01/02/04/06/08/27 | `supabase/migrations/20260728000000_orders_service_role_grants.sql` + passo `Check table privileges` no CI | ✅ **Sim** — introspecção real + checkout real gravando + prova reversa com `revoke` (§5, §6) |
| 2 | **5 mutantes sobreviventes** (M10–M14) em `lib/server/pedidos.ts`, camada sem nenhum teste | `__tests__/server-pedidos.test.ts` (19 testes) | ✅ **Sim** — M10–M14 **todos mortos** (§4) |
| 3 | **ORD-16.5** sem teste (redirect `?next=`) | `__tests__/middleware.test.ts` | ✅ **Sim** — 2 testes; mutação M19 morta (§4) |
| 4 | Spec-precision gaps ORD-27 e ORD-30.7 | asserções novas em `registrar-pedido.test.ts` e `PedidosPage.test.tsx` | ✅ **Sim** — asserção negativa de plano (M17 morta) e teste Free→Starter (§3) |
| 5 | Gap ORD-18 (formato do dinheiro) | decisão de produto registrada, sem código | ✅ **Sim** — registrado em `spec.md` (Assumptions, linha 55) **e** `context.md:90` (Deferred Ideas) |
| 6 | `docs/ARCHITECTURE.md:97` afirmava algo falso sobre a service role key | doc corrigida | ✅ **Sim** — `docs/ARCHITECTURE.md:73,97` reescritos; premissa errada do `SPEC_DEVIATION` corrigida em `20260727000000_orders.sql:66-81`; cuidado crítico novo em `AGENTS.md` |

---

## 1. Gates

| Gate | Comando | Resultado |
|---|---|---|
| Testes | `npx vitest run` | ✅ **524 passed, 0 failed, 0 skipped** (47 arquivos). Reconfirmado após o sensor: 524 de novo |
| Lint | `npm run lint` | ✅ **17 erros = baseline exato**: `ConfiguracoesClient.tsx` (15), `SlugInput.tsx:26` (1), `use-catalogo.ts:67` (1). **Nenhum erro novo** |
| Build | `npm run build` | ✅ passa; 23 rotas, incluindo `ƒ /painel/pedidos` |
| Migrations | `supabase_migrations.schema_migrations` | ✅ `20260728000000` aplicada no banco local |

**Test integrity**: 500 → **524** (+24: 19 em `server-pedidos.test.ts`, 2 em `middleware.test.ts`, 2 em `registrar-pedido.test.ts`, 1 em `PedidosPage.test.tsx`). Nenhum teste removido, nenhum `skip`, nenhuma asserção enfraquecida.

---

## 2. Nota de ambiente

O stack Supabase local **não estava rodando** no início desta validação (nenhum container `supabase_*`; `supabase status` falhava). Os volumes `supabase_db_catalogo-digital` e `supabase_storage_catalogo-digital` persistiam, então `supabase start` reaproveitou o banco existente sem perder dados nem reaplicar migrations do zero. **Nenhum `supabase db reset` foi executado.**

---

## 3. Spec-Anchored Acceptance Criteria (30/30)

Legenda: ✅ asserção bate com o outcome da spec · ✅+RT também confirmado em runtime real · ⚠️ gap

### P1 — Pedido registrado antes do WhatsApp

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-01 grava 1 `orders` (`pendente`) + 1 `order_items` por item; abre `wa.me` independentemente | 1 upsert, `status:"pendente"`; aba aberta no clique | `__tests__/registrar-pedido.test.ts:148` — `expect(callsOf(made,"orders","upsert")).toHaveLength(1)`; `:173` — `status: "pendente"`; `__tests__/use-catalogo.test.ts:205` — `expect(openMock()).toHaveBeenCalledWith("","_blank")` | ✅+RT — 1 linha `orders` + 2 `order_items`, `status='pendente'` (§5) |
| ORD-02 preço e total só de `products.price_cents`, ignorando valor do cliente | `total_cents=39800`, `unit_price_cents=19900` com `unitPriceCents:1` adulterado no payload | `__tests__/registrar-pedido.test.ts:246` — `expect(upsertRow(made).total_cents).toBe(39800)`; `:247` — `expect(itemRows(made)[0].unit_price_cents).toBe(19900)`; `__tests__/orders.test.ts:93` — `expect(result.items[0].unitPriceCents).toBe(19900)` | ✅+RT — `total_cents` gravado = `sum(products.price_cents*qty)` conferido por join (§5) |
| ORD-03 falha ou >2500 ms → abre WhatsApp, loga `console.error`, sem erro ao cliente | redirect ocorre; toast segue "Abrindo o WhatsApp…"; corte exato em 2500 ms | `__tests__/use-catalogo.test.ts:280` — `expect(result.current.toast).toBe("Abrindo o WhatsApp…")`; `:305-312` — `advanceTimersByTimeAsync(2499)` → `href` `""`, +1 ms → `wa.me`; `registrar-pedido.test.ts:455` — `expect(errorSpy).toHaveBeenCalled()` | ✅+RT — com grants revogados, WhatsApp abriu e o erro só apareceu no log do servidor (§6) |
| ORD-04 mesmo `client_order_id` → total permanece 1 e resposta de sucesso | `{onConflict:"store_id,client_order_id", ignoreDuplicates:true}`; 0 linhas → `{ok:true}` sem inserir itens | `__tests__/registrar-pedido.test.ts:352` — `expect(upsertOptions(made)).toEqual({onConflict:"store_id,client_order_id",ignoreDuplicates:true})`; `:367-368` — `expect(result).toEqual({ok:true})` + `expect(callsOf(made,"order_items","insert")).toHaveLength(0)` | ✅+RT — **duplo clique real** disparou `registrarPedido` 2× com o mesmo `clientOrderId`; 1 única linha gravada (§5) |
| ORD-05 sacola muda → novo `client_order_id` | mesmo id no reenvio idêntico; id diferente após qty/add/remove | `__tests__/use-catalogo.test.ts:374` — `expect(capturePayload(0).clientOrderId).toBe(capturePayload(1).clientOrderId)`; `:387`, `:400`, `:414` — `.not.toBe(...)` | ✅ |
| ORD-06 item que não resolve é descartado; nenhum resolve → nada gravado | 1 item restante, `items_count:2`, `total_cents:39800`; nenhum → `{ok:false}` e 0 writes | `__tests__/registrar-pedido.test.ts:316-318` — `toMatchObject({items_count:2,total_cents:39800})` + `expect(itemRows(made)).toHaveLength(1)`; `:340-341` — `{ok:false}` + `expect(writeCalls(made)).toHaveLength(0)` | ✅ |
| ORD-07 >20 linhas, qty fora de 1..99, uuid inválido, slug inexistente, loja inativa, método inválido → `{ok:false}` sem gravar | `safeParse` false por caso; action → `{ok:false}` e `from` não chamado | `__tests__/pedido-validation.test.ts:92,99,108,113,118,127,136,145,150,157`; `__tests__/registrar-pedido.test.ts:260-261` — `{ok:false}` + `expect(from).not.toHaveBeenCalled()`; `:281` — `eq` = `[["slug","ateliemira"],["is_active",true]]` | ✅ |
| ORD-08 ≥20 pedidos em 60 s → descarta com `{ok:false}` | `count:20` → `{ok:false}`, 0 writes; `count:19` → grava; janela = agora−60 s | `__tests__/registrar-pedido.test.ts:418` — `count:20`; `:430` — `count:19` → grava; `:449-451` — `expect(callsOf(made,"orders","gte")[0]).toEqual(["created_at","2026-07-27T11:59:00.000Z"])` | ✅ |

### P1 — Nome opcional do cliente

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-09 campo "Seu nome (opcional)" quando há itens | campo presente com itens, ausente com sacola vazia | `__tests__/BagDrawer.test.tsx` — `getByLabelText("Seu nome (opcional)")` / `queryByLabelText(...)).toBeNull()` com `items=[]` | ✅+RT — campo renderizado no drawer real |
| ORD-10 `customer_name` com `trim()` e máx. 60 | `"   Ana Maria   "` → `"Ana Maria"`; branco → `null`; 70 chars → 60 | `__tests__/registrar-pedido.test.ts:419` — `.toBe("Ana Maria")`; `:428` — `.toBeNull()`; `:437` — `.toBe("A".repeat(60))`; `__tests__/orders.test.ts:56,60-63,68` | ✅+RT — digitei `"   Ana Iteracao2   "` → gravado `Ana Iteracao2`; campo vazio → `customer_name IS NULL` (`name_is_null = t`) |
| ORD-11 nome vazio não bloqueia envio; template do WhatsApp intacto | botão habilitado, `onCheckout` chamado; URL sem o nome | `__tests__/BagDrawer.test.tsx` — `expect(btn.disabled).toBe(false)`; `__tests__/use-catalogo.test.ts:265-268` — URL byte a byte + `expect(decodeURIComponent(tab.location.href)).not.toContain("Ana")` | ✅+RT — checkout com o campo vazio concluído normalmente |

### P1 — Histórico de pedidos no painel

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-12 lista **só** os pedidos da própria loja, **ordenados por `created_at` desc**, com data/hora, nome (ou "Sem nome"), qtd, total em reais, status | filtro por `store_id` nas duas queries; ordem decrescente; campos renderizados | **Filtro (novo)**: `__tests__/server-pedidos.test.ts:99` — `expect(made[1].calls.eq).toEqual([["store_id",STORE_ID]])`; `:108` — idem na contagem. **Ordem (novo)**: `:117` — `expect(made[1].calls.order).toEqual([["created_at",{ascending:false}]])`. **Mapeamento**: `:126-147` — `toEqual` exaustivo do view model. **Render**: `__tests__/PedidosClient.test.tsx:56-58,71` | ✅ (M10/M11 mortos) |
| ORD-13 >20 pedidos → páginas de 20 reusando `Pagination` | tamanho de página = 20; `.range(0,19)` / `.range(20,39)` | `__tests__/server-pedidos.test.ts:158` — `expect(made[1].calls.range).toEqual([[0,19]])` + `toMatchObject({total:45,page:1,totalPages:3})`; `:168` — `[[20,39]]` na página 2; `:179` — clamp acima → `[[40,59]]`; `:189` — clamp abaixo → `[[0,19]]`; `__tests__/PedidosClient.test.tsx:101-102` — `href="/painel/pedidos?page=2"` | ✅ (M12 morto) |
| ORD-14 detalhe com nome, tamanho, cor, qtd, unitário, subtotal, pagamento, entrega (+endereço), total, status | `"2x R$ 199,00"`, `"R$ 398,00"`, `"Tamanho M · Cor Areia"`, `"Entrega: Enviar no endereço — Rua X, 123"` | `__tests__/PedidosClient.test.tsx:120-125,137-140,149,158-159` | ✅ |
| ORD-15 estado vazio explicando quando os pedidos aparecem | "Nenhum pedido ainda" + explicação da sacola | `__tests__/PedidosClient.test.tsx:300-306` + `queryByRole("button",{name:/Ver detalhe/})).toBeNull()`; `server-pedidos.test.ts:198` — `toEqual({orders:[],total:0,page:1,totalPages:1})` | ✅ |
| ORD-16 não autenticado → `/login?next=/painel/pedidos`; item "Pedidos" no Sidebar e MobileTabBar em qualquer plano, ativo em `/painel/pedidos` | redirect 307 com querystring `next`; navegação presente e `aria-current="page"` | **Redirect (novo)**: `__tests__/middleware.test.ts:46-49` — `expect(res.status).toBe(307)` + `expect(location.pathname).toBe("/login")` + `expect(location.searchParams.get("next")).toBe("/painel/pedidos")`; `:59-60` — com sessão segue sem redirect. **Navegação**: `__tests__/Sidebar.test.tsx:57-70,79-81`; `__tests__/MobileTabBar.test.tsx:20-29,36-38,54-56` | ✅ (M19 morto) |
| ORD-16.7 snapshot sobrevive à exclusão do produto | nome e unitário gravados continuam exibidos | `__tests__/PedidosClient.test.tsx:186-187`; `__tests__/orders.test.ts:250-251`; schema `order_items.product_id … on delete set null` (`confdeltype='n'`) | ✅ |

### P1 — Números de ROI no dashboard

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-17 "Pedidos no mês" = mês corrente (fuso SP) com status ≠ `cancelado` | corte `2026-07-01T03:00:00.000Z`; 4 linhas, 1 cancelada → 3 | **Filtro de período (novo)**: `__tests__/server-pedidos.test.ts:229-232` — `expect(made[0].calls.gte).toEqual([["created_at",monthStartInSaoPaulo(NOW).toISOString()]])` + `expect(made[0].calls.gte[0][1]).toBe("2026-07-01T03:00:00.000Z")`; `:241` — `.eq(["store_id",STORE_ID])`; `:260-264` — `toEqual({ordersThisMonth:3,…})`. `__tests__/order-metrics.test.ts:52`; `__tests__/DashboardClient.test.tsx:56` | ✅ (M14 morto) |
| ORD-18 "Vendas confirmadas no mês" = soma de `total_cents` com status `confirmado`, em reais | 2500+7500 → 10000; render via `formatCents` → `R$ 1234,50` | `__tests__/server-pedidos.test.ts:260-264` — `confirmedCentsThisMonth:10000`; `__tests__/order-metrics.test.ts:65`; `__tests__/DashboardClient.test.tsx:62` — `.toBe("R$ 1234,50")` | ✅ — formato fixado como decisão de produto em `spec.md:55` + `context.md:90`; **não é mais spec-precision gap** |
| ORD-19 "Aguardando confirmação" = todos os `pendente`, sem filtro de período | `.eq("status","pendente")` presente e **nenhum** `.gte` na 2ª query | **Novo**: `__tests__/server-pedidos.test.ts:277-280` — `expect(made[1].calls.eq).toEqual([["store_id",STORE_ID],["status","pendente"]])`; `:290` — `expect(made[1].calls.gte).toBeUndefined()`; `:281` — `pendingCount` 7. `__tests__/DashboardClient.test.tsx:68` | ✅ (M13 morto) |
| ORD-20 sem pedidos → `0` e `R$ 0,00`, nunca vazio/`NaN`/erro | exatamente `0`, `R$ 0,00`, `0` | `__tests__/order-metrics.test.ts:75-80` — `toEqual({…:0,…:0,…:0})` + `expect(Number.isNaN(metrics.confirmedCentsThisMonth)).toBe(false)`; `__tests__/server-pedidos.test.ts:303-307` — zeros com `data:null`/`count:null`; `__tests__/DashboardClient.test.tsx:84-86` | ✅ |
| ORD-20.5 / erro de banco nunca vira lista vazia | `fail()` lança e loga | `__tests__/server-pedidos.test.ts:207-208,215-216,314-315,322-323` — `rejects.toThrow("permission denied")` + `expect(errorSpy).toHaveBeenCalled()` nos 4 caminhos de erro | ✅ (cobertura nova) |

### P2 — Status da venda

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-21 persiste o novo status e a lista reflete sem recarregar | `update({status:"confirmado"})`; `revalidatePath` em `/painel/pedidos` e `/painel` | `__tests__/update-order-status.test.ts:107` — `expect(writeCalls()).toEqual([[{status:"confirmado"}]])`; `:119-122` — `revalidatePath` com `["/painel/pedidos","/painel"]`; `__tests__/PedidosClient.test.tsx:290-292` | ✅ |
| ORD-22 as 3 transições aceitas de qualquer origem; valor fora do enum → `{error}` sem alterar linha | cada status → `{ok:true}`; `"entregue"` → `{error:"Status inválido."}` e `from` não chamado | `__tests__/update-order-status.test.ts:140-149` — `it.each` dos 3; `:157,160-161` — `toEqual({error:"Status inválido."})` + `expect(from).not.toHaveBeenCalled()`; `__tests__/orders.test.ts:45-51` | ✅ |
| ORD-23 pedido de outra loja → nenhuma linha alterada e `{error}` | `update` restrito a `store_id`; 0 linhas → `{error:"Pedido não encontrado."}` | `__tests__/update-order-status.test.ts:108-111` — `expect(chain.calls.eq).toEqual([["id",ORDER_ID],["store_id",STORE_ID]])`; `:184`; `:193` | ✅ |
| ORD-21.5 cards de ROI refletem na próxima renderização | `revalidatePath("/painel")` | `__tests__/update-order-status.test.ts:119-122` | ✅ |

### P1 — Histórico como recurso dos planos pagos

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-27 grava em qualquer plano; a captura **nunca** consulta plano | `getPlanLimits`/`getEffectivePlan` não chamados; `stores` select só `id` | **Novo (asserção negativa)**: `__tests__/registrar-pedido.test.ts:14-24` — mocks que **lançam** se chamados; `:252-255` — `expect(result).toEqual({ok:true})` + `expect(getPlanLimits).not.toHaveBeenCalled()` + `expect(getEffectivePlan).not.toHaveBeenCalled()`; `:265` — `expect(callsOf(made,"stores","select")).toEqual([["id"]])` | ✅ (M17 morto) |
| ORD-28 Free → tela bloqueada, sem listar pedido, sem contagem/total/dado real | `getStoreOrders` **não** chamado; "Disponível a partir do plano Starter"; HTML sem "Ana" e sem "R$" | `__tests__/PedidosPage.test.tsx:94-96` — `expect(getStoreOrders).not.toHaveBeenCalled()` + texto + link; `:104-106` — `not.toContain("Ana")`, `not.toContain("R$")`, `queryByRole(...)).toBeNull()`; `__tests__/RecursoBloqueado.test.tsx` — `not.toMatch(/\d/)` | ✅ (M18 morto) |
| ORD-29 Free → 3 cards de ROI trocados por aviso com CTA; cards de produtos intactos | `getOrderMetrics` não chamado; nenhum dos 3 rótulos; sem "R$" | `__tests__/DashboardPage.test.tsx:82-85`; `__tests__/DashboardClient.test.tsx:95-99,112-114` | ✅ |
| ORD-30 Starter/Pro liberam tudo; `trial_ends_at` vencido rebaixa via `getEffectivePlan()` sem escrita | Starter → `getStoreOrders(STORE_ID,1)`; vencido → bloqueio | `__tests__/PedidosPage.test.tsx:116-118,137-138`; `__tests__/DashboardPage.test.tsx:95-98,106-107`; `__tests__/plan-limits.test.ts`; `__tests__/update-order-status.test.ts:220-238` | ✅ |
| ORD-30.7 histórico do período Free aparece ao virar pago, sem migração | mesma linha; Free → 0 chamadas e sem "Ana"; Starter → `getStoreOrders(STORE_ID,1)` e "Ana"/"R$ 398,00" visíveis | **Novo**: `__tests__/PedidosPage.test.tsx:157-181` — `expect(getStoreOrders).not.toHaveBeenCalled()` + `not.toContain("Ana")` no Free, depois `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(STORE_ID,1)` + `getByText("Ana")` + `getByText("R$ 398,00")` no Starter — **mesma `mockResolvedValue`, provando que nada muda por plano** | ✅ |

### P2 — Landing e documentação

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-25.1 card "Histórico de pedidos" na landing | desc casa `/registrad/i`, `/itens/i`, `/total/i` | `__tests__/landing-data.test.ts:14-19` | ✅ |
| ORD-25.2 FAQ: registrado mesmo indo para o WhatsApp, sem checkout | `/WhatsApp/i`, `/painel/i`, `/não existe checkout/i`, `/pagamento/i` | `__tests__/landing-data.test.ts:29-32,36-38` | ✅ |
| ORD-25.3 "Histórico de pedidos" em Starter e Pro, ausente no Free | `toContain` em starter/pro; Free sem variação de "histórico" | `__tests__/landing-data.test.ts:44,48,52-53` — inclui `expect(freeFeatures.some(f=>/hist(ó|o)rico/i.test(f))).toBe(false)` | ✅ |
| ORD-26 docs refletem `orders`/`order_items` e a tela | schema, arquivos, estado atual, planos | `docs/ARCHITECTURE.md:60,64,73,97,112,116,119,129,130,175,178,179`; `docs/roadmap/Escopo.md:44,46,91,92,106,135,143`; `AGENTS.md:23` (cuidado crítico novo) | ✅ — a afirmação falsa da iteração 1 (`:97`) foi corrigida |
| ORD-26.5 política de privacidade menciona itens, total e nome | menção explícita ao armazenamento | `app/politica-de-privacidade/page.tsx:76,96` | ✅ conteúdo verificado por inspeção (página estática sem teste — padrão do repo) |

### Resumo

- ✅ **30/30** ACs com asserção casando o outcome definido na spec
- ⚠️ **0** spec-precision gaps (os 5 da iteração 1 foram fechados: 4 com teste, 1 com decisão de produto registrada)
- ✅ **12** ACs confirmadas também em runtime real (marcadas +RT)

---

## 4. Discrimination Sensor

Mutações de código aplicadas sobre backup do arquivo real e revertidas no `finally` (`shutil.copy2` → mutação → vitest → `shutil.move` de volta). Mutações de banco revertidas reaplicando a migration verbatim. `git status` **limpo** antes e depois; nenhum `.sensorbak` remanescente; suíte reconfirmada em 524 no fim.

### Passe A — os 5 sobreviventes da iteração 1 (obrigatório)

| # | File:line | Mutação | Iteração 1 | **Iteração 2** |
|---|---|---|---|---|
| M10 | `lib/server/pedidos.ts:54` | `getStoreOrders`: remove `.eq("store_id", storeId)` da listagem | ❌ Survived | ✅ **Killed** (1 failed / 18 passed) |
| M11 | `lib/server/pedidos.ts:55` | `ascending: false` → `true` | ❌ Survived | ✅ **Killed** (1 failed / 18 passed) |
| M12 | `lib/server/pedidos.ts:13` | `ORDERS_PAGE_SIZE` `20` → `7` | ❌ Survived | ✅ **Killed** (4 failed / 15 passed) |
| M13 | `lib/server/pedidos.ts:86` | `getOrderMetrics`: remove `.eq("status","pendente")` | ❌ Survived | ✅ **Killed** (1 failed / 18 passed) |
| M14 | `lib/server/pedidos.ts:81` | `getOrderMetrics`: remove `.gte("created_at", monthStart)` | ❌ Survived | ✅ **Killed** (1 failed / 18 passed) |

**5/5 agora mortos.** A camada que decide qual loja, qual ordem, qual página e qual período está discriminada.

### Passe B — mutações novas escolhidas nos caminhos de maior risco

| # | File:line | Mutação | Killed? |
|---|---|---|---|
| M15 | `supabase/migrations/20260728000000_…sql` (estado do banco) | `revoke` dos 7 grants do `service_role` — simula a regressão que causou o blocker | ✅ **Killed pela guarda de CI** (exit 3, nomeando os 7 privilégios) — e reproduziu o erro original em runtime (§6) |
| M16 | estado do banco | `grant select on public.orders to anon` — simula regressão de ORD-24 | ✅ **Killed pela guarda de CI** (exit 3: `anon com privilegio em orders/order_items: public.orders:select`) |
| M17 | `app/actions/pedidos.ts:34` | `registrarPedido` passa a consultar plano (`getPlanLimits("free", null)`) — viola ORD-27 | ✅ **Killed** (17 failed / 8 passed) |
| M18 | `app/painel/pedidos/page.tsx:18` | inverte o gate `hasOrderHistory` | ✅ **Killed** (7 failed / 1 passed) |
| M19 | `middleware.ts:61` | remove `url.searchParams.set('next', pathname)` do redirect | ✅ **Killed** (1 failed / 1 passed) |

**Sensor total: 10 mutações, 10 mortas, 0 sobreviventes.** Profundidade: **P0-full** (caminho de dados/receita, >5 mutações).

---

## 5. Segurança (ORD-24) — introspecção real no Postgres

`DB_URL` obtida via `supabase status`; consultas rodadas com `psql` dentro do container `supabase_db_catalogo-digital`. **O SQL do arquivo não foi aceito como prova** — tudo abaixo vem de `pg_class`, `has_table_privilege`, `information_schema.column_privileges` e `pg_policies`.

| Requisito da spec | Estado real verificado | Result |
|---|---|---|
| `anon` com **zero** privilégio em `orders`/`order_items` | Query de controle sobre 2 tabelas × 8 privilégios → **0 linhas**. `anon` ausente do `relacl` das duas tabelas | ✅ |
| `authenticated` só `SELECT` (+ `UPDATE` na coluna `status` de `orders`) | Table-level: `authenticated` = `select` apenas, nas duas tabelas (`relacl` = `authenticated=r/postgres`). Column-level `UPDATE` em `orders`: **só** `status` (única linha não-`postgres`) | ✅ |
| `service_role` com exatamente `select/insert/delete` em `orders` | `relacl` = `service_role=ardDxtm/postgres` → `a`=INSERT, `r`=SELECT, `d`=DELETE (`Dxtm` é o default ACL herdado) | ✅ |
| `service_role` com `select/insert` em `order_items` | `relacl` = `service_role=arDxtm/postgres` → sem `d`, sem `w` | ✅ |
| `service_role` com `select` em `stores`/`products` | `has_table_privilege` = `t` para select; nenhum DML | ✅ |
| `service_role` **sem UPDATE** em `orders` | `has_table_privilege('service_role','public.orders','update')` = **f**; `has_column_privilege(…,'status','update')` = **f** | ✅ |
| RLS habilitada nas duas tabelas | `pg_class.relrowsecurity = t` em `orders` e `order_items` | ✅ |
| Policies todas escopadas a `authenticated` | 3 policies (`orders: own store read`/SELECT, `orders: own store status update`/UPDATE, `order_items: own store read`/SELECT); controle `where roles <> '{authenticated}'` → **0 linhas** | ✅ |
| service role server-only | `lib/supabase/admin.ts:1` `import "server-only"`; env sem `NEXT_PUBLIC_`; `__tests__/supabase-admin.test.ts` | ✅ |

**ORD-24: ✅ PASS.** O `service_role` recebeu **exatamente** o que `app/actions/pedidos.ts` usa e nada além — em particular, o poder de mudar `status` continua sendo só do lojista autenticado.

---

## 6. Verificação runtime end-to-end

Dev server via `next dev` em `localhost:3000`; loja `atelie-mira` (ativa, `pro`, WhatsApp configurado). Banco começou em `orders = 0`, `order_items = 0`.

### (a) Checkout real grava o pedido — **o teste que reprovou a iteração 1**

Sacola montada pela UI real: `Vestido midi linho areia` (M/Areia, qty 2) + `Blusa de tricô off-white` (P/Off-white, qty 1); total exibido **R$ 749,70**. Nome digitado com espaços de propósito: `"   Ana Iteracao2   "`.

```
POST /atelie-mira 200 in 164ms
 └─ ƒ registrarPedido({"clientOrderId":"0d51a1d8-…","customerName":"Ana Iteracao2",…}) in 85ms
```

| Verificação | Resultado |
|---|---|
| 1 linha em `orders` | ✅ `items_count=3`, `total_cents=74970`, `status='pendente'` |
| N linhas em `order_items` | ✅ 2 linhas (uma por variação): `28990×2` e `16990×1`, com `size`/`color` corretos |
| `total_cents` calculado **do banco** | ✅ join de controle: `sum(products.price_cents * qty)` = **74970** = `orders.total_cents` |
| `unit_price_cents` = `products.price_cents` | ✅ 28990 e 16990, idênticos à tabela `products` |
| `customer_name` com `trim()` (ORD-10) | ✅ gravado `Ana Iteracao2` (espaços removidos) |
| WhatsApp abriu | ✅ aba foi para `https://api.whatsapp.com/…` |

### (b) Reenvio da mesma sacola não duplica (ORD-04)

O `clientOrderId` vive num `useRef` (`app/[slug]/use-catalogo.ts:39`), então recarregar a página gera chave nova — um reenvio "de sessão nova" não testaria idempotência. Usei então o cenário que a própria spec cita ("duplo clique / retry"): **duplo clique real** no botão de envio, com a sacola inalterada.

```
 └─ ƒ registrarPedido({"clientOrderId":"cdf909b4-0914-4dd4-9ab0-20a742684c07","customerName":null,…}) in 67ms
 └─ ƒ registrarPedido({"clientOrderId":"cdf909b4-0914-4dd4-9ab0-20a742684c07","customerName":null,…}) in 33ms
```

**Duas invocações da Server Action com o mesmo `client_order_id`** → banco ficou com **1** única linha para essa chave (`orders = 2` no total: uma por sacola distinta; `count(distinct client_order_id) = 2`). Confirmado ainda por um replay do upsert exato que o supabase-js emite (`on_conflict=store_id,client_order_id` + `Prefer: resolution=ignore-duplicates`): **HTTP 201 com body `[]`** — 0 linhas devolvidas, que é exatamente o ramo `if (!orderId) return { ok: true }` de `app/actions/pedidos.ts:120`. Como bônus, `customer_name IS NULL` quando o campo fica vazio (ORD-10).

### (c) WhatsApp abre mesmo com a gravação falhando (ORD-01/ORD-03) — prova reversa do blocker

Revoguei os 7 grants do `service_role` e refiz um checkout:

```
registrarPedido: erro ao buscar a loja — permission denied for table stores
 └─ ƒ registrarPedido({"clientOrderId":"f0b30f96-…",…}) in 28ms
```

| Verificação | Resultado |
|---|---|
| Erro reproduzido é **exatamente** o da iteração 1 | ✅ `permission denied for table stores` — prova que os grants são a causa real, não coincidência |
| WhatsApp abriu de qualquer forma | ✅ aba foi para `https://api.whatsapp.com/…` |
| Nenhum erro exibido ao cliente | ✅ erro só no log do servidor |
| Nada gravado | ✅ `orders` permaneceu em 2 |

Grants restaurados reaplicando a migration verbatim; `relacl` volta bit a bit ao estado anterior.

### Guarda de CI nova — ela pega a regressão?

`.github/workflows/supabase-migrations-check.yml`, passo `Check table privileges (orders/order_items)`. Extraí o bloco `do $$ … $$` do workflow e rodei contra três estados do banco real:

| Estado do banco | Exit code | Saída |
|---|---|---|
| Atual (grants aplicados) | **0** | `NOTICE: grants ok: service_role com DML na captura, anon sem nada` |
| Grants do `service_role` revogados (M15) | **3** | `ERROR: service_role sem privilegio necessario: public.order_items:insert, public.order_items:select, public.orders:delete, public.orders:insert, public.orders:select, public.products:select, public.stores:select` |
| `grant select on orders to anon` (M16) | **3** | `ERROR: anon com privilegio em orders/order_items: public.orders:select` |

**A guarda pega as duas regressões** — a que causou o blocker e a que violaria ORD-24 — e o `raise exception` produz exit ≠ 0, então o passo falha de verdade. Ambos os estados foram revertidos e a guarda voltou a exit 0.

### Estado final do banco

`orders = 0`, `order_items = 0` — os 2 pedidos de teste foram removidos (o `delete` de 2 `orders` levou as 3 `order_items` por cascade, confirmando o `on delete cascade`). Privilégios idênticos ao estado inicial. Nenhuma migration nova, nenhum `db reset`, `.env.local` intocado, dev server parado.

### O que **não** pôde ser verificado

- **Telas do painel numa sessão autenticada real** (Free bloqueado / Starter liberado): exige login com senha, que não está entre as ações que posso executar. A evidência para ORD-28/29/30 é teste + mutação M18 morta + leitura do gate antes do I/O (`app/painel/pedidos/page.tsx:18`, `app/painel/page.tsx:12`) — **não** observação do HTML de uma resposta autenticada.
- **O workflow do GitHub Actions nunca executou de fato** (dispara em `pull_request`; não há PR nesta branch). Verifiquei localmente a **lógica SQL** do passo — que é a parte substantiva — e o nome do container (`supabase_db_catalogo-digital`) confere com o stack local. Os passos `supabase start` / `supabase db lint` e o nome do container no runner do GitHub seguem não exercitados.
- **Paginação com 21 pedidos semeados** (Independent Test de ORD-13) não foi rodada contra o banco real; semear 21 pedidos sairia do escopo read-only. Coberta por asserções diretas de `.range()` nas páginas 1, 2 e nos dois clamps.
- **Dois clientes simultâneos** não foi exercitado com sessões concorrentes de verdade. O duplo clique produziu duas chamadas sobrepostas da action com a mesma chave (evidência adjacente), mas não dois `client_order_id` distintos em paralelo.

---

## 7. Code Quality

| Princípio | Status |
|---|---|
| Código mínimo, sem features além do pedido | ✅ as fix tasks só adicionam teste, migration de grant, guarda de CI e correção de doc |
| Sem abstração para uso único | ✅ `server-pedidos.test.ts` reusa o padrão de fake chain de `registrar-pedido.test.ts:36-49` |
| Mudanças cirúrgicas | ✅ nenhum arquivo de produção mudou de comportamento nesta iteração |
| Não "melhorou" código alheio | ✅ |
| Segue padrões existentes | ✅ |
| Um senior aprovaria? | ✅ agora sim — o grant existe, a camada de query tem teste e há guarda automatizada contra a recorrência |
| Testes mapeiam ACs e não são shallow | ✅ inclusive `lib/server/pedidos.ts`, que antes não tinha teste |
| Spec-anchored: valor asserido = outcome da spec | ✅ 30/30 |
| Coverage Expectation por camada | ✅ `lib/server/pedidos.ts` com happy + edge (clamp, lista vazia) + error path nos 4 pontos de falha |
| Todo teste mapeia para AC/edge case | ✅ nenhum teste órfão |
| Guidelines documentadas seguidas | ✅ `AGENTS.md`, `docs/CONVENTIONS.md`. O cuidado crítico que faltava (grant para o papel que **escreve**) agora está documentado em `AGENTS.md:23` |

---

## 8. Edge Cases da spec

- [x] Sacola vazia → nenhum botão de envio, nada gravado — `BagDrawer.test.tsx`
- [x] Loja sem WhatsApp → checkout bloqueado — `use-catalogo.test.ts:339-341`
- [x] `window.open` → `null` → navega na aba atual — `use-catalogo.test.ts:329`; **observado em runtime** (o pop-up foi bloqueado no browser automatizado e o fallback levou a aba atual ao `wa.me`)
- [x] Cliente offline → WhatsApp abre sem erro visível — `use-catalogo.test.ts:271-281`
- [x] Preço mudou entre sacola e envio → banco vence — `orders.test.ts:93`, `registrar-pedido.test.ts:246`; confirmado em runtime pelo join de controle
- [x] Nome >60 chars → truncado — `orders.test.ts:68`, `registrar-pedido.test.ts:437`
- [x] Mesmo produto com variações diferentes → 1 linha por variação — `orders.test.ts:167-174`; **confirmado em runtime** (2 linhas para 2 variações)
- [x] Loja excluída → cascade — `confdeltype='c'` no schema; **exercitado no cleanup** (delete de 2 `orders` removeu as 3 `order_items`)
- [x] Free acumula e depois vira Starter → histórico aparece — agora com teste dedicado (`PedidosPage.test.tsx:157-181`)
- [x] Free chamando a action de status → isolamento por dono vale — `update-order-status.test.ts:220-238` + RLS verificada
- [ ] **Dois clientes simultâneos** → não exercitado com concorrência real (ver §6)

---

## 9. Requirement Traceability

Todos os 30 requisitos → **✅ Verified**.

| Requirement | Iteração 1 | Iteração 2 |
|---|---|---|
| ORD-01 | ❌ Needs Fix (runtime) | ✅ Verified (teste + runtime) |
| ORD-02 | ❌ Needs Fix | ✅ Verified (teste + runtime) |
| ORD-03 | ✅ Verified | ✅ Verified |
| ORD-04 | ❌ Needs Fix | ✅ Verified (duplo clique real) |
| ORD-05 | ✅ Verified | ✅ Verified |
| ORD-06 | ❌ Needs Fix | ✅ Verified |
| ORD-07 | ✅ Verified | ✅ Verified |
| ORD-08 | ❌ Needs Fix | ✅ Verified |
| ORD-09 | ✅ Verified | ✅ Verified |
| ORD-10 | ✅ Verified | ✅ Verified (trim + null em runtime) |
| ORD-11 | ✅ Verified | ✅ Verified |
| ORD-12 | ⚠️ Partial (M10/M11) | ✅ Verified |
| ORD-13 | ⚠️ Partial (M12) | ✅ Verified |
| ORD-14 | ✅ Verified | ✅ Verified |
| ORD-15 | ✅ Verified | ✅ Verified |
| ORD-16 | ✅ (AC5 sem teste) | ✅ Verified (AC5 com teste) |
| ORD-17 | ⚠️ Partial (M14) | ✅ Verified |
| ORD-18 | ⚠️ Partial (formato) | ✅ Verified (formato = decisão de produto registrada) |
| ORD-19 | ⚠️ Partial (M13) | ✅ Verified |
| ORD-20 | ✅ Verified | ✅ Verified |
| ORD-21 | ✅ Verified | ✅ Verified |
| ORD-22 | ✅ Verified | ✅ Verified |
| ORD-23 | ✅ Verified | ✅ Verified |
| ORD-24 | ✅ Verified | ✅ Verified (introspecção real, incl. ausência de UPDATE) |
| ORD-25 | ✅ Verified | ✅ Verified |
| ORD-26 | ⚠️ Partial (doc falsa) | ✅ Verified (doc corrigida) |
| ORD-27 | ❌ Needs Fix | ✅ Verified (asserção negativa, M17 morto) |
| ORD-28 | ✅ Verified | ✅ Verified |
| ORD-29 | ✅ Verified | ✅ Verified |
| ORD-30 | ✅ (AC7 sem teste) | ✅ Verified (AC7 com teste) |

---

## 9b. Lessons

**Nenhuma lição nova registrada** — esta iteração é um PASS limpo (0 mutantes sobreviventes, 0 spec-precision gaps, 0 ACs falhando, nenhum `SPEC_DEVIATION` novo), e a regra é explícita: sem signal, não se escreve lição.

As 5 lições da iteração 1 (`L-001..L-005`, todas `candidate`) foram revisadas e **seguem válidas** — as fix tasks são, na prática, a aplicação direta delas:

| ID | Lição | Status nesta iteração |
|---|---|---|
| L-001 | grant explícito de DML ao `service_role` na mesma migration | ✅ confirmada na prática (`20260728000000`) |
| L-002 | nunca deixar módulo de query coberto só por consumidores que o mockam | ✅ confirmada (`server-pedidos.test.ts` matou M10–M14) |
| L-003 | migration que muda grants/RLS precisa de asserção de privilégio contra o banco real | ✅ confirmada (guarda de CI, provada nos dois sentidos) |
| L-004 | verificar premissa de default privileges introspectando `pg_default_acl` | ✅ confirmada (premissa errada corrigida na migration) |
| L-005 | fixar na spec a string exata de moeda esperada por uma AC | ✅ confirmada (formato registrado em `spec.md`/`context.md`) |

Nenhuma foi penalizada (nenhuma recorrência). As 5 seguem `candidate` porque a promoção exige corroboração em **outra** feature — comportamento correto do script, não pendência.

---

## 10. Summary

**Overall**: ✅ **Ready**

**Spec-anchored check**: **30/30** ACs com o outcome da spec asserido · **0** spec-precision gaps · 12 confirmadas também em runtime
**Sensor**: **10 mutações, 10 mortas, 0 sobreviventes** — inclui os 5 sobreviventes da iteração 1 (M10–M14), todos agora mortos
**Gate**: 524 passed, 0 failed · lint 17 = baseline exato · build ok
**Segurança ORD-24**: ✅ `anon` com zero privilégio, `authenticated` só SELECT + UPDATE(status), `service_role` exatamente com o DML que a action usa e **sem UPDATE**, RLS on, 3/3 policies `{authenticated}`
**Guarda de CI**: ✅ pega as duas regressões (grant faltando → exit 3 nomeando os 7 privilégios; leak para `anon` → exit 3), provado contra o banco real

**O que funciona**: a captura agora **grava de verdade** — checkout real produziu 1 pedido + 2 itens com total recalculado do banco e `status='pendente'`. Duplo clique não duplica. O redirect para o WhatsApp sobrevive à pior falha possível, comprovado revogando os grants e refazendo o checkout. A camada de query, antes sem nenhum teste, está discriminada nas quatro decisões que importam (qual loja, qual ordem, qual página, qual período). O lockdown do `anon` continua intacto e agora tem guarda automatizada no CI, além do cuidado crítico documentado em `AGENTS.md`.

**Problemas encontrados**: nenhum bloqueante. Limitações de verificação, não defeitos: painel autenticado não observado em navegador real; o workflow de CI teve sua lógica SQL validada localmente mas nunca rodou no runner do GitHub; concorrência de dois clientes não exercitada.

**Next steps**: promover ORD-01..30 a `Verified` na spec e marcar `tasks.md` como `Done`. Fora deste ciclo: decidir o separador de milhar em `formatCents` (Deferred Ideas do `context.md`) e, se quiser fechar a última lacuna de evidência, um teste de integração que exercite `registrarPedido` contra o Postgres local.
