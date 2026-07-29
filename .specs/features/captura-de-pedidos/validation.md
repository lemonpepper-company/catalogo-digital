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

---
---

# Captura de Pedidos — Validation **Ciclo 2** (nome obrigatório + código do pedido)

**Date**: 2026-07-28
**Spec**: `.specs/features/captura-de-pedidos/spec.md` — foco em **ORD-31..35** e nas ACs revisadas da story "P1: Nome obrigatório do cliente na sacola". As ACs antigas do nome opcional (**ORD-09..11**) foram **revogadas pela spec** e não foram tratadas como requisito.
**Diff range**: `65bc6ea..4e0c940` (`git diff main..HEAD`), branch `feature/pedido-nome-e-codigo`, 11 commits (10 de implementação + 1 de spec)
**Verifier**: sub-agent independente (author ≠ verifier). Coverage re-derivada do zero, evidence-or-zero. Não herda as premissas do implementador nem dos Verifiers do ciclo 1.
**Escopo desta seção**: as garantias do ciclo 1 (ORD-01..30) **não** foram revalidadas por inteiro — só as que a mudança podia derrubar (§C2-3).

---

## Veredito

**✅ PASS** — 17/17 sub-ACs de ORD-31..35 com asserção casando o outcome da spec, 12/12 mutações mortas, 11/11 alterações de teste justificadas por AC nova (nenhuma enfraquecida), `anon` sem privilégio na coluna `code` por introspecção real, e checkout end-to-end confirmado em browser + Postgres, inclusive no caminho de falha de gravação.

Três achados **não bloqueantes** ficam registrados em §C2-9 — o mais relevante é que a guarda de CI de privilégios é cega a `grant` **por coluna** para `anon` (comprovado empiricamente).

---

## C2-1. Gates

| Gate | Comando | Resultado |
|---|---|---|
| Testes | `npx vitest run` | ✅ **657 passed, 0 failed, 0 skipped** (60 arquivos). Reconfirmado 2× depois do sensor: 657 |
| Tipos | `npx tsc --noEmit` | ✅ **limpo** (exit 0, nenhuma saída) |
| Lint | `npm run lint` | ✅ **17 erros = baseline exato**: `ConfiguracoesClient.tsx` (15), `SlugInput.tsx:26` (1), `use-catalogo.ts:72` (1). **Nenhum erro novo** — o de `use-catalogo.ts` é o mesmo `set-state-in-effect` pré-existente, só deslocado de `:67` para `:72` pelos imports novos |
| Build | `npm run build` | ✅ passa; 26 rotas, incluindo `ƒ /painel/pedidos` |
| Migrations | `supabase_migrations.schema_migrations` | ✅ `20260728100000_orders_code` aplicada no banco local |

**Test integrity**: 524 (ciclo 1) → **657** (+133). Nenhum arquivo de teste perdeu testes (`BagDrawer` 17→17, `pedido-validation` 17→21, `orders` 23→35, `registrar-pedido` 25→30, `server-pedidos` 19→28, `use-catalogo` 23→32, `utils` 50→60, `PedidosPage` 8→12, `PedidosClient` 17→27). Zero `skip`/`only`/`todo` na suíte. Nenhuma asserção enfraquecida (auditoria completa em §C2-4).

---

## C2-2. Spec-Anchored Acceptance Criteria — ORD-31..35 (17/17)

Numeração `ORD-3x.N` = AC nº N da story correspondente, igual à usada nos comentários do código.

### ORD-31 — Nome obrigatório do cliente (5 ACs revisadas)

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| **31.1** sacola com itens → campo obrigatório "Seu nome", `maxLength` 60 | label exatamente `"Seu nome"`; `required`; `maxLength=60`; ausente com sacola vazia | `__tests__/BagDrawer.test.tsx:81-83` — `getByLabelText("Seu nome")` + `expect(input.required).toBe(true)`; `:103` — `expect(input.maxLength).toBe(60)`; `:97` — `expect(queryByLabelText("Seu nome")).toBeNull()` com `items=[]` | ✅+RT |
| **31.2** valor gravado em `orders.customer_name` com `trim()` e ≤60 | `"   Ana Maria   "` → `"Ana Maria"`; 70 chars → 60 | `__tests__/registrar-pedido.test.ts:487` — `expect(upsertRow(made).customer_name).toBe("Ana Maria")`; `:528` — `.toBe("A".repeat(60))`; `__tests__/orders.test.ts:66,82-83,88-89` | ✅+RT |
| **31.3** vazio / só espaços / <2 chars após `trim()` → botão desabilitado + "Informe seu nome para continuar" | string **exata**; `canCheckout=false`; `onCheckout` não chamado | `__tests__/use-catalogo.test.ts:94-96` (vazio), `:102-103` (`"    "`), `:109-110` (`"  A  "`) — `expect(canCheckout).toBe(false)` + `expect(checkoutBlockedReason).toBe("Informe seu nome para continuar")`; `:116-118` — `"  An  "` → `true` + `toBeNull()`; `__tests__/BagDrawer.test.tsx:128-133` — `getByText("Informe seu nome para continuar")` + `expect(btn.disabled).toBe(true)` + `expect(onCheckout).not.toHaveBeenCalled()` | ✅+RT |
| **31.4** servidor sem nome válido → `{ ok: false }` sem gravar | `{ok:false}`, 0 writes, `from` não chamado; zod rejeita ausente/null/""/"   "/1 char | `__tests__/registrar-pedido.test.ts:490-499` (`"   "`) — `toEqual({ok:false})` + `expect(writeCalls(made)).toHaveLength(0)` + `expect(from).not.toHaveBeenCalled()`; `:501-509` (1 char); `:511-521` (ausente); `__tests__/pedido-validation.test.ts:181-189` — `it.each` dos 6 casos → `success === false` | ✅ |
| **31.5** mensagem do WhatsApp contém o nome e o código | mensagem carrega nome e código | `__tests__/use-catalogo.test.ts:310-311` — `expect(message).toContain("Cliente: Ana")` + `toContain("Pedido: ${payload.code}")`; `:340-352` — URL byte a byte igual a `renderWhatsAppMessage(...,{customerName:"Ana",code})` | ✅+RT |

### ORD-32 — Código gerado no cliente, na mensagem e em `orders.code` (ACs 1–3)

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| **32.1** cliente gera 6 chars `[A-Z0-9]` derivados do `client_order_id`, põe na mensagem, manda no payload; servidor grava em `orders.code` | `code` casa `/^[A-Z0-9]{6}$/` **e** `=== deriveOrderCode(clientOrderId)`; `upsert.code` = valor recebido; formato inválido → `{ok:false}` sem gravar | `__tests__/orders.test.ts:119-122` — `toHaveLength(6)` + `toMatch(ORDER_CODE_PATTERN)`; `__tests__/use-catalogo.test.ts:297-298` — `expect(payload.code).toMatch(ORDER_CODE_PATTERN)` + `expect(payload.code).toBe(deriveOrderCode(payload.clientOrderId))`; `__tests__/registrar-pedido.test.ts:200` — `expect(upsertRow(made).code).toBe("HS0L52")`; `:533-542`,`:544-553` — código malformado/ausente → `{ok:false}` + 0 writes; `__tests__/pedido-validation.test.ts:191-197` — 7 formatos rejeitados | ✅+RT |
| **32.2** mesmo `client_order_id` → código idêntico (determinístico) | reenvio da mesma sacola repete o código; sacola alterada muda | `__tests__/orders.test.ts:125-128` — `expect(deriveOrderCode(UUID_A)).toBe(deriveOrderCode(UUID_A))`; `:135-137` — vetores travados `"HS0L52"`/`"MIXICD"`; `__tests__/use-catalogo.test.ts:497` — `expect(capturePayload(1).code).toBe(capturePayload(0).code)`; `:511` — `.not.toBe(...)` após mudar qty | ✅+RT |
| **32.3** falha ou timeout → mensagem **continua** com nome e código (AD-008 preservada) | aba pré-aberta antes de qualquer `await`; mensagem completa nos dois caminhos de falha | `__tests__/use-catalogo.test.ts:246-256` — chama `handleCheckout()` **sem `await`** e já assere `expect(openMock()).toHaveBeenCalledWith("","_blank")` + `expect(tab.location.href).toBe("")`; `:362-374` — `mockRejectedValue` → `toContain("Cliente: Ana")` + `toContain("Pedido: <derivado>")`; `:376-392` — `advanceTimersByTimeAsync(2500)` com promise pendente → idem | ✅+RT |

### ORD-33 — Formato padrão e "Restaurar padrão" (ACs 4–5)

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| **33.4** `message_template` nulo → formato padrão inclui nome e código | mensagem esperada **byte a byte**, com `Cliente:`/`Pedido:` entre saudação e itens | `__tests__/utils.test.ts:142-163` — `expect(buildWhatsAppMessage(items,{customerName:"Ana",code:"HS0L52"})).toBe(expected)` com o array de 13 linhas literal; `__tests__/ConfiguracoesMensagem.test.tsx:84-88` — template nulo abre o textarea em `MSG_DEFAULT` | ✅+RT |
| **33.5** "Restaurar padrão" traz `{nome}`/`{pedido}` **e** é idêntico ao formato de `message_template` nulo | igualdade **exata** entre as duas fontes, em vários cenários | `__tests__/mensagem-padrao.test.ts:44-51` — `it.each` de **5 cenários**: `expect(renderWhatsAppMessage(MSG_DEFAULT, items, order)).toBe(buildWhatsAppMessage(items, order))` (completo / sem pagamento-entrega / sem nome / sem código / sem nada); `:63-66` — `MSG_DEFAULT` contém os 2 tokens; `__tests__/ConfiguracoesMensagem.test.tsx:74-81` — clique em "Restaurar padrão" → `expect(textarea.value).toBe(MSG_DEFAULT)` | ✅ — **cadeado de paridade real**, não um `toContain` frouxo |

### ORD-34 — Variáveis `{nome}`/`{pedido}`, chips, preview, template preservado (ACs 6–8)

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| **34.6** template customizado preservado como está, sem reescrita nem anexo | valor do textarea **idêntico** ao gravado; render não injeta nome/código | `__tests__/ConfiguracoesMensagem.test.tsx:67-72` — `expect(templateTextarea().value).toBe(custom)`; `__tests__/utils.test.ts:402-407` — `renderWhatsAppMessage(custom, items, {customerName:"Ana",code:"HS0L52"})` → exatamente `Oi! Quero:\n<itens>\nTotal R$ 80,00` (sem sobra) | ✅ |
| **34.7** `{nome}`/`{pedido}` como chips clicáveis e renderizadas no preview | chips por nome acessível; clique insere o token; preview mostra os valores mock | `__tests__/ConfiguracoesMensagem.test.tsx:45-50` — `getByRole("button",{name:"+ {nome}"})` e `"+ {pedido}"`; `:52-58` — clique → `expect(textarea.value).toContain("{pedido}")`; `:60-65` — `getByText(/Cliente: Ana/)` + `getByText(/Pedido: A1B2C3/)`; `__tests__/utils.test.ts:384-390` — `renderWhatsAppMessage("{nome}\n{pedido}",…)` → `"Cliente: Ana\nPedido: HS0L52"`; `__tests__/mensagem-padrao.test.ts:68-75` — **toda** variável de `MSG_DEFAULT` está em `MSG_VARS`; `:77-87` — nenhum chip resolve para o próprio token | ✅ |
| **34.8** variável não usada resolve como hoje, sem sobra de linha em branco | `"Início\n\n{nome}\n{pedido}\n\nFim"` → `"Início\n\nFim"`; nunca `\n{3,}` | `__tests__/utils.test.ts:397-400` — `expect(msg).toBe("Início\n\nFim")`; `:164-168`,`:170-174` — só código / só nome → posição exata + `expect(msg).not.toMatch(/\n{3,}/)` | ✅ |

### ORD-35 — Código na lista e no detalhe + busca (ACs 9–12)

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| **35.9** cada linha da lista **e** o detalhe exibem o código | os dois códigos visíveis na lista; código dentro do dialog | `__tests__/PedidosClient.test.tsx:102-118` — `getByText("HS0L52")` + `getByText("MIXICD")` com 2 pedidos; `:120-127` — `within(dialog).getByText("MIXICD")`; `__tests__/PedidosPage.test.tsx:157-163` — código renderizado pela página real | ✅+RT (via PostgREST) |
| **35.10** código (completo/parcial) ou parte do nome → só os pedidos da própria loja que casam, case-insensitive, paginação recalculada sobre o filtrado | filtro `or=(code.ilike.%t%,customer_name.ilike.%t%)` na **listagem e na contagem**; `.eq("store_id")` mantido nas duas; `range` recalculado | `__tests__/server-pedidos.test.ts:207-214` — `expect(made[1].calls.or).toEqual([["code.ilike.%ana%,customer_name.ilike.%ana%"]])`; `:216-225` — mesmo filtro na contagem + `expect(made[0].calls.eq).toEqual([["store_id",STORE_ID]])`; `:227-236` — `count:25` → `toMatchObject({total:25,page:2,totalPages:2})` + `range` `[[20,39]]`; `:238-247` — parcial minúsculo `"hs0l"`; `:249-256` — `trim`; `:258-265` — sanitização de `,()%*\`; `:267-278` — busca vazia → `or` **undefined** nas duas queries; `__tests__/PedidosPage.test.tsx:135-141` — `expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID,1,"hs0l")`; `:143-155` — busca + página; `__tests__/PedidosClient.test.tsx:137-152` — debounce 400 ms → `replace("/painel/pedidos?q=HS0L52",{scroll:false})` (sem `page`); `:190-202` — `href="/painel/pedidos?page=2&q=ana"` | ✅+RT (query real no Postgres, §C2-6d) |
| **35.11** busca sem resultado → estado vazio de busca **distinto** de "nenhum pedido ainda" | "Nenhum pedido encontrado" presente **e** "Nenhum pedido ainda" ausente; termo citado; campo de busca permanece | `__tests__/PedidosClient.test.tsx:427-437` — `getByText("Nenhum pedido encontrado")` + `expect(queryByText("Nenhum pedido ainda")).toBeNull()` + texto da loja-vazia ausente; `:439-447` — termo citado + input com o valor; `:417-421` — loja sem pedido **não** mostra o campo de busca | ✅ |
| **35.12** busca preenchida + plano `free` → bloqueio de ORD-28 continua; nenhuma query | `getStoreOrders` **não** chamado; bloqueio exibido; nada do histórico no HTML; campo de busca ausente | `__tests__/PedidosPage.test.tsx:119-131` — `expect(getStoreOrders).not.toHaveBeenCalled()` + `getByText("Disponível a partir do plano Starter")` + `not.toContain("Ana")` + `not.toContain("HS0L52")` + `expect(queryByLabelText("Buscar por código ou nome do cliente")).toBeNull()`. Estrutural: o gate está **antes** do `await searchParams` (`app/painel/pedidos/page.tsx:18` vs `:27`) | ✅ (M8 morto) |

### Como as ACs foram descobertas (evidence-or-zero)

Nenhuma AC foi declarada coberta sem busca. As buscas usadas, todas sobre `__tests__/`: `grep -n 'ORD-31.4\|ORD-32.3\|ORD-33.5\|ORD-34.6\|ORD-34.7\|ORD-34.8\|ORD-35.9\|ORD-35.10\|ORD-35.11\|ORD-35.12'`, `grep -n 'Informe seu nome para continuar'`, `grep -n 'input.required\|input.maxLength\|getByLabelText("Seu nome")'`, `grep -n 'customer_name).toBe\|upsertRow(made).code'`, `grep -n 'sanitizeCustomerName('`, `grep -n 'toMatch(ORDER_CODE_PATTERN)'`, `grep -n 'MSG_DEFAULT'`, `grep -n 'Cliente: Ana\|Pedido: \${'`, `grep -n 'sincronamente no clique'`. Cada AC acima cita `file:line` + a expressão da assertion.

### Resumo

- ✅ **17/17** sub-ACs de ORD-31..35 com asserção casando o outcome definido na spec
- ⚠️ **1** spec-precision gap (não bloqueante, §C2-9 achado 2): os rótulos exatos das linhas novas da mensagem (`"Cliente: "` e `"Pedido: "`) são escolha de implementação — ORD-31.5/32.1 só exigem que "a mensagem contenha o nome e o código". Os testes assertam as strings exatas (mais preciso que a spec), então o risco não é teste frouxo, é a spec não travar o texto que o lojista vê — mesmo padrão do gap de `formatCents` fechado no ciclo 1 (L-005)
- ✅ **12** sub-ACs confirmadas também em runtime real (marcadas +RT)

---

## C2-3. Regressão do ciclo 1 — o que a mudança podia derrubar

| Requisito | Por que estava em risco | Verificação | Result |
|---|---|---|---|
| **ORD-01** aba pré-aberta sincronamente, **antes** de qualquer `await` | o ciclo 2 inseriu 3 chamadas novas (`clientOrderIdFor`, `deriveOrderCode`, `sanitizeCustomerName`) e o `renderWhatsAppMessage` antes do `window.open` | Leitura: `app/[slug]/use-catalogo.ts:140-155` — tudo que precede `window.open("", "_blank")` é síncrono e puro; o primeiro `await` está em `:159`. Teste: `use-catalogo.test.ts:246-256` (sem `await`). **Runtime**: hook em `window.open`/`fetch` mostrou `open("","_blank")` em `t=128351 ms`, POST da Server Action em `t=128377`, atribuição do `href` em `t=128535` — ordem open → fetch → href | ✅ (M1 morto) |
| **ORD-03** falha/timeout de 2500 ms → WhatsApp abre; **agora com nome e código** | a mensagem passou a depender de dados novos | `use-catalogo.test.ts:355-360` (rejeição, toast segue "Abrindo o WhatsApp…"), `:362-374` e `:376-392` (falha e timeout **com** nome e código). **Runtime**: com `insert` revogado do `service_role`, a mensagem saiu com `Cliente: Bea Falha` + `Pedido: 6OJ0T1`, erro só no log do servidor, nada na tela (§C2-6e) | ✅ |
| **ORD-04** idempotência | `code` entrou no `upsert` | `registrar-pedido.test.ts` — `onConflict:"store_id,client_order_id", ignoreDuplicates:true` intacto; `use-catalogo.test.ts:485-497` — reenvio repete `clientOrderId` **e** `code`. Índice `orders_store_id_client_order_id_key` confirmado no banco | ✅ |
| **ORD-24** `anon` sem privilégio, **inclusive na coluna `code` nova** | coluna nova em tabela com grants | Introspecção real: `has_column_privilege('anon','public.orders',<toda coluna>, select/insert/update/references)` → **0 linhas verdadeiras**; `has_table_privilege` → 0 linhas. Controle positivo `has_column_privilege('anon','public.stores','slug','select') = t` prova que a consulta funciona. PostgREST com chave `anon`: `GET orders` → **HTTP 401 `permission denied for table orders`**; `POST orders` com `code` → **HTTP 401** (§C2-5) | ✅ |
| **ORD-28/29** gate de plano, **agora também com busca preenchida** | `searchParams.q` é lido depois do gate | `app/painel/pedidos/page.tsx:18` (gate) vem antes de `:27` (`await searchParams`) e de `:29` (`getStoreOrders`); `PedidosPage.test.tsx:119-131` cobre Free **com** `q="HS0L52"`; M8 (gate invertido) mata 11 testes | ✅ |
| **ORD-12/13** lista e paginação sem busca | `getStoreOrders` ganhou 3º parâmetro com default `""` | `server-pedidos.test.ts:279-286` — sem argumento, `or` fica `undefined`; toda a bateria de `.range`/`.order`/`.eq` do ciclo 1 segue verde | ✅ |
| **ORD-33.4 / formato §8** mensagem das lojas sem nome/código | o formato padrão mudou | `utils.test.ts:120-141` — o formato exato do Escopo §8 é **preservado byte a byte** quando não há nome nem código (`collapseBlankLines` come as duas linhas) | ✅ |

**Nenhuma regressão encontrada.**

---

## C2-4. Auditoria das alterações de teste (crítica nesta rodada)

11 assinaturas `it(...)` de testes pré-existentes foram alteradas (o pedido falava em 7; a contagem por `git diff` é 11, incluindo renomeações mecânicas). Para cada uma: qual AC nova exige o comportamento, e se a asserção ficou mais forte ou mais fraca. Comparado com `git show` de `a99f765`, `c0a2f4f`, `881b1f5`, `c53986e`, `84c2bc3`, `1b5ae09`.

| # | Teste (antes → depois) | Arquivo | AC que exige a mudança | Força da asserção |
|---|---|---|---|---|
| 1 | "exibe o campo **opcional** de nome…" → "exibe o campo **obrigatório** de nome… (ORD-31.1)" | `BagDrawer.test.tsx:80-84` | **ORD-31.1** (`spec.md:100`): campo obrigatório "Seu nome" | ⬆️ **Mais forte** — antes só `getByLabelText`; agora label exata **+** `expect(input.required).toBe(true)` |
| 2 | "mantém o botão de envio **habilitado** com o campo de nome vazio" → "**bloqueia** o envio e exibe o aviso… (ORD-31.3)" | `BagDrawer.test.tsx:121-136` | **ORD-31.3** (`spec.md:102`). A AC antiga (ORD-11, "nome vazio não bloqueia") foi **explicitamente revogada** pela nota de revisão em `spec.md:92` | ⬆️ **Mais forte** — 1 asserção (`disabled === false`) → 4 (texto de bloqueio presente, texto de WhatsApp ausente, `disabled === true`, `onCheckout` não chamado) |
| 3 | "limita o campo de nome a 60 caracteres" → idem "(ORD-31.1)" | `BagDrawer.test.tsx:101-104` | **ORD-31.1** (`maxLength` de 60) | ↔️ **Igual** — só a label mudou; `expect(input.maxLength).toBe(60)` preservado |
| 4 | "aceita o payload mínimo: 1 item, **sem nome**…" → "…**nome e código**, sem pagamento ou entrega" | `pedido-validation.test.ts:28-31` | **ORD-31.4** + **ORD-32.1**: os dois campos passaram a ser obrigatórios no schema | ↔️ **Igual** em força; o `minimalPayload` teve de ganhar os campos novos, senão o teste de "payload mínimo válido" testaria um payload inválido |
| 5 | "aceita o payload completo com nome, pagamento…" → "…com nome, **código**, pagamento…" | `pedido-validation.test.ts:33-45` | **ORD-32.1** | ↔️ **Igual** |
| 6 | "aceita **null nos campos opcionais**" → "aceita null em **pagamento, entrega e endereço**" (removeu `customerName: null`) | `pedido-validation.test.ts:65-75` | **ORD-31.4** (`spec.md:103`): payload sem nome válido **SHALL** ser rejeitado | ⬆️ **Mais forte** no conjunto — o caso removido não desapareceu: migrou para a lista de **rejeição** em `:181-189` (`null` entre os 6 casos que devem falhar) |
| 7 | "**grava null** quando o nome vem em branco" → "**rejeita** nome em branco sem gravar nada (ORD-31.4)" | `registrar-pedido.test.ts:490-499` | **ORD-31.4** — inversão exigida pela AC nova; a AC antiga (ORD-10, "branco → `null`") está revogada | ⬆️ **Mais forte** — 1 asserção (`customer_name` é `null`) → 3 (`{ok:false}`, 0 writes, `from` não chamado). Somaram-se 2 testes irmãos (1 char, ausente) |
| 8 | "fica true com whatsapp e sem pagamento/entrega **(comportamento atual preservado)**" → "fica true com whatsapp **e nome**, sem pagamento/entrega" | `use-catalogo.test.ts:44-47` | **ORD-31.3**: o nome entrou no `canCheckout`, então o cenário precisa preenchê-lo para isolar a variável sob teste | ↔️ **Igual** — `expect(canCheckout).toBe(true)` preservado; o `withName()` é setup, não relaxamento. E o cenário oposto (sem nome → `false`) ganhou 4 testes dedicados em `:93-119` |
| 9 | "informa para selecionar pagamento/entrega **quando a loja tem whatsapp mas faltam seleções**" → "…**quando só faltam as seleções**" | `use-catalogo.test.ts:151-163` | **ORD-31.3** — mesma razão do #8; a string asserida continua `"Selecione forma de pagamento e entrega para continuar."` | ↔️ **Igual** |
| 10 | "aponta a aba pré-aberta … **sem** o nome do cliente (ORD-11)" → "… **com nome e código** (ORD-31.5)"; `.not.toContain("Ana")` → `.toContain("Ana")` | `use-catalogo.test.ts:337-353` | **ORD-31.5** (`spec.md:104`): a mensagem **SHALL** conter o nome e o código. A asserção antiga afirmava o **oposto** e só podia sobreviver enquanto ORD-11 valesse | ⬆️ **Mais forte** — a igualdade byte a byte da URL foi preservada e o `expectedMsg` agora inclui `customerName` e `code`, então o teste trava o formato completo, não só a presença de "Ana" |
| 11 | "mantém o formato exato do Escopo §8" → "…**quando não há nome nem código**" | `utils.test.ts:127-141` | **ORD-34.8** (`spec.md:127`): variável não usada resolve sem sobra de linha — é justamente o que mantém o §8 intacto sem nome/código | ↔️ **Igual** — o array de 13 linhas esperado é **idêntico** ao anterior; só o título ficou mais preciso. O caso com nome e código foi **adicionado** em `:142-163`, não substituiu |

**Veredito da auditoria: 11/11 justificadas por AC do ciclo 2. Zero asserções enfraquecidas.** As 3 inversões reais (#2, #7, #10) correspondem exatamente às 3 ACs que a spec marca como revogadas (`spec.md:92`, ORD-09..11), e as três terminaram com mais asserções do que tinham.

Duas observações da auditoria (nenhuma bloqueante):
- `use-catalogo.test.ts:315-328` ("envia null (nunca string vazia) em nome, pagamento, entrega e endereço não informados") **não** foi alterado e continua assertando `customerName: null` no payload. Não é contradição: o teste cobre a normalização do cliente (`"" → null`, nunca `""`), e o servidor rejeita esse payload (#7). É defesa em profundidade, e o invariante "nunca string vazia" segue coberto.
- `orders.test.ts:135-137` trava os vetores `HS0L52`/`MIXICD` como constantes literais. Confirmei de forma **independente** que não são inventados: rodei a expressão SQL do backfill (`20260728100000_orders_code.sql:16-27`) no Postgres local contra 10 uuids (os 2 vetores, `00000000-…`, `ffffffff-…` e 6 `gen_random_uuid()`) e comparei com `deriveOrderCode` — **10/10 idênticos**, incluindo o pedido criado no runtime (`0780d5cd-… → PWVV7K` nas duas implementações).

---

## C2-5. Segurança por introspecção real no Postgres (ORD-24 + coluna `code`)

`DB_URL` de `supabase status`; `psql` dentro do container `supabase_db_catalogo-digital`. O comentário da migration ("grant de tabela vale para colunas futuras") **não** foi aceito como prova — foi verificado.

| Requisito | Estado real verificado | Result |
|---|---|---|
| `anon` sem **nenhum** privilégio de **coluna** em `orders` (incl. `code`) | `has_column_privilege('anon','public.orders',<cada coluna>, {select,insert,update,references})` → **0 linhas verdadeiras**. Controle positivo: `has_column_privilege('anon','public.stores','slug','select') = t` | ✅ |
| `anon` sem privilégio de **tabela** em `orders`/`order_items` | 2 tabelas × 8 privilégios → **0 linhas**. `relacl` = `{postgres=arwdDxtm/postgres, service_role=…, authenticated=r/postgres}` — `anon` ausente das duas | ✅ |
| `anon` barrado na prática (não só no catálogo) | PostgREST com `apikey`+`Authorization` = chave `anon`: `GET /orders?select=code,customer_name` → **HTTP 401** `permission denied for table orders`; `POST /orders` com `code` → **HTTP 401** | ✅ |
| `code` herdou o grant de tabela para quem precisa | `information_schema.column_privileges`: `authenticated` → `code:SELECT`; `service_role` → `code:INSERT`, `code:SELECT`, `code:REFERENCES`. **A premissa da migration se confirma empiricamente** | ✅ |
| `authenticated` **não** pode escrever `code` | `has_column_privilege('authenticated','public.orders','code','update') = f`. As únicas linhas `UPDATE` não-`postgres` em `orders` continuam sendo `authenticated / status` | ✅ |
| `service_role` sem `UPDATE` em `orders` | `has_table_privilege(...,'update') = f`; `has_column_privilege(...,'code','update') = f`. `relacl` = `service_role=ardDxtm/postgres` (a=INSERT, r=SELECT, d=DELETE) | ✅ |
| `order_items` sem `d`/`w` para `service_role` | `relacl` = `service_role=arDxtm/postgres` | ✅ |
| `code` é `NOT NULL` e o backfill cobriu tudo | `information_schema.columns` → `is_nullable = NO`; as 2 linhas pré-existentes têm `code` preenchido (`HS0L52`, `MIXICD`) e batem com a regra de derivação | ✅ |
| Índice de busca criado | `orders_store_code_idx` = `btree (store_id, code)` — prefixo `store_id` mantém a busca dentro da loja | ✅ |
| RLS e policies inalteradas | `relrowsecurity = t` nas duas; 3 policies, todas `{authenticated}` (`orders: own store read`/SELECT, `orders: own store status update`/UPDATE, `order_items: own store read`/SELECT) | ✅ |

### Bloco SQL do passo `Check table privileges` do workflow

Extraí o `do $$ … $$` de `.github/workflows/supabase-migrations-check.yml` e rodei contra o banco real:

| Estado | Exit | Saída |
|---|---|---|
| Atual | **0** | `NOTICE: grants ok: service_role com DML na captura, anon sem nada` |
| Após revogar `insert on orders` do `service_role` (§C2-6e) | — | reprovaria: `has_table_privilege(...,'insert')` volta `f` (verificado direto) |
| Após `grant select (code) on public.orders to anon` (mutação de coluna) | **0** ❌ | **a guarda não pega** — ver §C2-9 achado 1 |

---

## C2-6. Verificação runtime end-to-end

Dev server `next dev` em `localhost:3000`; loja `atelie-mira` (ativa, `pro`, WhatsApp configurado, `message_template` **nulo** → exercita o formato padrão de ORD-33.4). Banco começou com `orders = 2` (linhas pré-existentes da loja `maria-das-roupas`, **não** criadas por mim).

Instrumentação: `window.open` e `window.fetch` embrulhados por hooks que **registram** as chamadas; o objeto devolvido por `window.open` é um duplo que grava a atribuição de `location.href` (mesmo formato do `FakeTab` da suíte). Tudo o mais — Server Action, validação, Supabase, Postgres — é real.

### (a) Sem nome o botão está bloqueado, com a mensagem certa

| Verificação | Resultado |
|---|---|
| Input renderizado | ✅ `aria-label="Seu nome"`, `placeholder="Seu nome"`, `maxLength=60`, `required=true` (ORD-31.1) |
| Campo vazio | ✅ botão "Enviar pedido via WhatsApp →" com `disabled = true` |
| Mensagem de bloqueio | ✅ **"Informe seu nome para continuar"** visível na sacola |
| Nome de **1 caractere** (`"A"`) | ✅ ainda `disabled = true`, aviso ainda visível (ORD-31.3, limite de 2) |
| Nome válido com espaços (`"   Ana Ciclo2   "`) | ✅ `disabled = false`, aviso desaparece |

### (b) Com nome, a mensagem do WhatsApp leva nome **e** código

Sacola: `Vestido midi linho areia` (M/Areia, qty 2), total exibido **R$ 579,80**.

```
t=128351 ms  open("", "_blank")            ← síncrono no clique, ANTES de qualquer rede
t=128377 ms  fetch POST /atelie-mira       ← Server Action (26 ms depois)
t=128535 ms  tab.location.href = "https://wa.me/5511999990000?text=..."
```

Mensagem decodificada (formato padrão, `message_template` nulo):

```
Olá! Gostaria de fazer um pedido:

Cliente: Ana Ciclo2
Pedido: PWVV7K

01. Vestido midi linho areia
    Quantidade: 2x | Valor unitário: R$ 289,90
    Tamanho: M
    Cor: Areia
    Subtotal: R$ 579,80

━━━━━━━━━━━━━━━━━
*Total: R$ 579,80*
━━━━━━━━━━━━━━━━━
```

✅ nome **com `trim()` aplicado** (`"   Ana Ciclo2   "` → `Cliente: Ana Ciclo2`), código presente, e a ordem `open → fetch → href` é evidência direta de AD-008 no browser real.

### (c) A linha em `orders` tem o **mesmo** código e o nome preenchido

```
 code   | customer_name | client_order_id                      | status   | items_count | total_cents
 PWVV7K | Ana Ciclo2    | 0780d5cd-6890-40f6-9f7f-70d83a7eb80d | pendente | 2           | 57980
```

| Verificação | Resultado |
|---|---|
| `orders.code` **idêntico** ao da mensagem | ✅ `PWVV7K` = `Pedido: PWVV7K` |
| `code` = derivação do `client_order_id` nas **duas** implementações | ✅ `deriveOrderCode("0780d5cd-…")` = `PWVV7K` **e** a expressão SQL do backfill = `PWVV7K` |
| `customer_name` preenchido e trimado | ✅ `Ana Ciclo2`, não `null` |
| Total recalculado do banco | ✅ `57980` = `28990 × 2` (`products.price_cents`) |
| `order_items` | ✅ 1 linha, `unit_price_cents=28990`, `qty=2`, `size='M'`, `color='Areia'` |

### (d) Colar o código na busca devolve exatamente aquele pedido

A tela autenticada do painel **não** pôde ser aberta no browser (login exige senha — ação que não executo). Verifiquei então a parte substantiva contra o **Postgres real via PostgREST**, com JWT `authenticated` do dono da loja, reproduzindo exatamente a query que `getStoreOrders` monta (`select` com `order_items(...)` embutido, `store_id=eq.`, `or=(code.ilike…,customer_name.ilike…)`, `order=created_at.desc`, `Range: 0-19`, `Prefer: count=exact`):

| Termo buscado | Resultado | AC |
|---|---|---|
| `PWVV7K` (código colado da mensagem) | ✅ **1 linha, exatamente aquele pedido** (`Content-Range: 0-0/1`), com `order_items` embutido | ORD-35.10 |
| `pwvv` (parcial, caixa baixa) | ✅ 1 linha — `ilike` é case-insensitive e casa parcial | ORD-35.10 |
| `ana ciclo` (parte do nome) | ✅ 1 linha | ORD-35.10 |
| `ZZZZZZ` | ✅ 0 linhas, `Content-Range: */0`, sem erro | ORD-35.11 (dado) |
| `HS0L52` (pedido de **outra** loja), com `.eq(store_id)` | ✅ 0 linhas | isolamento |
| `HS0L52` **sem** `.eq(store_id)` — RLS sozinha | ✅ 0 linhas — a policy por dono barra mesmo sem o filtro explícito | ORD-24 |
| chave `anon` pura | ✅ **HTTP 401** `permission denied for table orders` | ORD-24 |

### (e) A mensagem sai com nome e código mesmo quando a gravação falha

Falha induzida em estado **revertido**: `revoke insert on public.orders from service_role` (um único grant, restaurado depois). Sacola alterada (qty 4) para gerar `client_order_id`/código novos.

```
registrarPedido: erro ao gravar o pedido — permission denied for table orders
POST /atelie-mira 200 in 84ms
 └─ ƒ registrarPedido({"clientOrderId":"0e80e9a0-…","code":"6OJ0T1", …}) in 61ms
```

```
t=289323  open("", "_blank")
t=289343  fetch POST /atelie-mira
t=289438  href = ".../?text=… Cliente: Bea Falha \n Pedido: 6OJ0T1 …"
```

| Verificação | Resultado |
|---|---|
| Mensagem **com nome e código** apesar da falha | ✅ `Cliente: Bea Falha` + `Pedido: 6OJ0T1` (ORD-32.3 / AD-008) |
| WhatsApp abriu | ✅ `href` atribuído normalmente |
| Nenhum erro exibido ao cliente | ✅ nada de "erro"/"falha" no DOM; erro só no log do servidor (ORD-03) |
| Nada gravado | ✅ `orders` da loja continuou só com `PWVV7K` |
| Grant restaurado | ✅ `relacl` de `orders` **bit a bit idêntico** ao estado inicial (`diff` vazio); guarda de CI volta a exit 0 |

### Estado final do banco

`orders = 2`, `order_items = 2` — **exatamente o que encontrei ao começar** (as 2 linhas de `maria-das-roupas`, `HS0L52`/`MIXICD`, que **não** criei e por isso não removi). O pedido que criei (`PWVV7K`, loja `atelie-mira`) foi deletado. Privilégios idênticos ao inicial (verificado por `diff` de `relacl`). Nenhuma migration nova, nenhum `supabase db reset`, `.env.local` intocado, dev server parado, árvore git limpa.

### O que **não** pôde ser verificado

- **A tela `/painel/pedidos` numa sessão autenticada real** (Free bloqueado, Starter listando, campo de busca, estado vazio de busca, código nas linhas). Exige login com senha, que não está entre as ações que executo — mesma limitação do ciclo 1. Compensado por: query real contra o Postgres com JWT do dono (§C2-6d), testes de `PedidosPage`/`PedidosClient`, e as mutações M8/M12 mortas. **Não** é observação do HTML de uma resposta autenticada.
- **O debounce de 400 ms com navegação real do Next** (`router.replace`) — coberto só por teste com fake timers e `useRouter` mockado.
- **A migration aplicada do zero** (`supabase start` num banco vazio) — a `20260728100000` já estava aplicada; validei a **regra** do backfill contra 10 vetores, não a execução do `update` sobre uma tabela populada de produção.
- **O workflow do GitHub Actions no runner** — segue sem PR nesta branch; validei localmente a lógica SQL do passo de privilégios (e encontrei a limitação do §C2-9 achado 1).
- **Concorrência real de dois clientes** — não exercitada (limitação herdada do ciclo 1).

---

## C2-7. Discrimination Sensor

Profundidade: **P0-full** (caminho de receita/dados, 12 mutações > 5). Mutações aplicadas sobre backup do arquivo real (`shutil.copy2` → mutação → `vitest` → `shutil.move` de volta no `finally`). `git status` limpo antes e depois; nenhum `.sensorbak` remanescente; suíte reconfirmada em **657** no fim. As 8 mutações obrigatórias do pedido estão todas presentes (M1–M8).

| # | File:line | Mutação | AC visada | Killed? |
|---|---|---|---|---|
| **M1** | `app/[slug]/use-catalogo.ts:155` | move `window.open("", "_blank")` para **depois** do `await Promise.race(...)` | AD-008 / ORD-32.3 / ORD-01 | ✅ **Killed** (1 failed / 31 passed) — `use-catalogo.test.ts:246` |
| **M2** | `lib/orders.ts:70` | `deriveOrderCode` passa a derivar de `Math.random()` em vez do `client_order_id` | ORD-32.2 | ✅ **Killed** (9 failed / 58 passed) |
| **M3** | `app/[slug]/use-catalogo.ts:91` | remove `nameComplete` do `canCheckout` | ORD-31.3 | ✅ **Killed** (3 failed / 29 passed) |
| **M4** | `lib/validation/pedido.ts:31` | zod aceita nome de **1** caractere (`>= 1`) | ORD-31.4 | ✅ **Killed** (2 failed / 49 passed) |
| **M5** | `app/painel/configuracoes/use-configuracoes.ts:12` | `MSG_DEFAULT` diverge de `buildWhatsAppMessage` (troca a ordem de `{nome}`/`{pedido}`) | ORD-33.5 — o cadeado de paridade | ✅ **Killed** (2 failed / 13 passed) |
| **M6** | `app/actions/pedidos.ts:101` | remove `code` do payload persistido | ORD-32.1 | ✅ **Killed** (1 failed / 29 passed) |
| **M7** | `lib/server/pedidos.ts:75-76` | remove o `.or(searchFilter(term))` da listagem | ORD-35.10 | ✅ **Killed** (4 failed / 24 passed) |
| **M8** | `app/painel/pedidos/page.tsx:18` | inverte o gate de plano (`!hasOrderHistory` → `hasOrderHistory`) | ORD-35.12 / ORD-28 | ✅ **Killed** (11 failed / 1 passed) |
| M9 | `lib/server/pedidos.ts:32` | busca deixa de casar código (só `customer_name.ilike`) | ORD-35.10 | ✅ **Killed** (5 failed / 23 passed) |
| M10 | `lib/orders.ts:69` | `sanitizeCustomerName` volta ao critério antigo (`trimmed === ""`) | ORD-31.2 / 31.3 | ✅ **Killed** (3 failed / 94 passed) |
| M11 | `lib/server/pedidos.ts:64` | filtro deixa de ser aplicado na **contagem** (paginação não recalculada) | ORD-35.10 | ✅ **Killed** (1 failed / 27 passed) |
| M12 | `app/painel/pedidos/PedidosClient.tsx:69` | `isSearching = false` — estado vazio de busca deixa de ser distinto | ORD-35.11 | ✅ **Killed** (3 failed / 26 passed) |

**Sensor total: 12 mutações, 12 mortas, 0 sobreviventes.**

Mutação extra, **de estado do banco** (não de código), fora da contagem porque não é sobre a suíte:

| # | Mutação | Guarda | Resultado |
|---|---|---|---|
| DB-1 | `grant select (code) on public.orders to anon` (dentro de transação com `rollback`) | bloco SQL do workflow | ❌ **Sobreviveu** — `has_table_privilege` = `f` enquanto `has_column_privilege` = `t`, e a guarda saiu **0**. Ver §C2-9 achado 1 |

---

## C2-8. Code Quality

| Princípio | Status |
|---|---|
| Código mínimo, sem features além do pedido | ✅ `deriveOrderCode`, 2 formatadores de linha, `usePedidosBusca`, 3º parâmetro em `getStoreOrders`, 1 migration |
| Sem abstração para uso único | ✅ `orderSearchTerm`/`searchFilter` são funções locais do módulo; `usePedidosBusca` copia o padrão de `use-produtos-filtros.ts` (citado no docstring) |
| Mudanças cirúrgicas | ✅ 29 arquivos, todos no caminho da feature; nada de refactor oportunista |
| Não "melhorou" código alheio | ✅ |
| Segue padrões existentes | ✅ `{nome}`/`{pedido}` resolvem para linha rotulada inteira, igual a `{pagamento}`/`{entrega}`; busca no servidor com debounce + URL, igual a produtos |
| Um senior aprovaria? | ✅ com as 3 ressalvas de §C2-9 registradas como follow-up |
| Testes mapeiam ACs e não são shallow | ✅ o teste de paridade `MSG_DEFAULT` × `buildWhatsAppMessage` (5 cenários, igualdade exata) é o melhor exemplo — trava o risco que a spec nomeia em `spec.md:45` |
| Spec-anchored: valor asserido = outcome da spec | ✅ 17/17 (1 gap de precisão **da spec**, §C2-9 achado 2) |
| Coverage Expectation por camada | ✅ `lib/orders.ts` (deriveOrderCode: shape, determinismo, vetores SQL, hífens, caixa, 50 uuids aleatórios), `lib/server/pedidos.ts` (happy + trim + sanitização + vazio + sem argumento + sem resultado + paginação filtrada), `PedidosPage` (Free com busca, starter, pro, página+busca), `PedidosClient` (lista, detalhe, debounce, limpar, refletir, paginação, 2 estados vazios) |
| Todo teste mapeia para AC/edge case | ✅ nenhum teste órfão; os 84 testes novos citam ORD-31..35 no título ou no describe |
| Guidelines documentadas seguidas | ✅ `AGENTS.md` (os 3 cuidados críticos de grant), `docs/CONVENTIONS.md`. O comentário da migration antecipa a pergunta do grant e a resposta se confirma na introspecção (§C2-5) |

**Edge cases da spec afetados pelo ciclo 2**: nome >60 → truncado (`orders.test.ts:88`, `registrar-pedido.test.ts:528`) ✅; variação sem `{nome}`/`{pedido}` no template → sem linha sobrando (`utils.test.ts:397`) ✅; template customizado preservado (`ConfiguracoesMensagem.test.tsx:67`) ✅.

---

## C2-9. Achados não bloqueantes (nenhum reprova o ciclo)

**1. A guarda de CI de privilégios é cega a `grant` por coluna para `anon`.** O bloco do workflow usa só `has_table_privilege`. Comprovei no banco real (em transação com `rollback`): com `grant select (code) on public.orders to anon` aplicado, `has_table_privilege('anon','public.orders','select')` devolve `f`, `has_column_privilege('anon','public.orders','code','select')` devolve `t`, e a guarda **sai 0 com `NOTICE: anon sem nada`**. O ciclo 1 só exercitou a mutação de tabela (M16), então a lacuna passou. O risco é concreto e específico deste projeto: `docs/CONVENTIONS.md` e `AGENTS.md` ensinam justamente o padrão "coluna pública nova em `stores` → `grant select (coluna) to anon`", e alguém aplicando esse padrão por analogia a `orders.code` abriria o histórico ao `anon` sem o CI reclamar. Correção sugerida (fora do escopo read-only): trocar o segundo bloco por `information_schema.column_privileges` / `has_column_privilege` sobre todas as colunas. **Estado atual continua correto** — não existe nenhum grant de coluna para `anon` hoje.

**2. Spec-precision gap: os rótulos das linhas novas da mensagem não estão fixados na spec.** ORD-31.5 e ORD-32.1 pedem que a mensagem "contenha o nome" e "contenha o código"; a implementação escolheu `"Cliente: <nome>"` e `"Pedido: <código>"`, e os testes travam essas strings exatas (`utils.test.ts:142-163`, `mensagem-padrao.test.ts:53-61`). O teste é mais preciso que a spec, então não há risco de asserção frouxa — o risco é o inverso: o texto que o lojista lê no WhatsApp virou decisão implícita do agente, exatamente como o formato de `formatCents` no ciclo 1 (fechado como decisão de produto em `spec.md:61` e registrado como L-005). Sugestão: registrar os dois rótulos em Assumptions.

**3. Nits sem impacto em AC.**
- `orderSearchTerm` (`lib/server/pedidos.ts:29`) descarta `,()%*\` mas **não** `_`, que é curinga de um caractere no `LIKE`. Confirmado em PostgREST real: buscar `h_0l52` encontra `HS0L52`. Efeito é só busca ligeiramente mais larga — sem injeção (o filtro segue somado a `.eq("store_id")` + RLS) e sem erro (testei `.`, `:`, `"` → HTTP 200, 0 linhas).
- O servidor valida o **formato** de `code` mas não confere que ele é `deriveOrderCode(clientOrderId)` (escolha documentada em `lib/validation/pedido.ts:32-33`). Um payload forjado pode gravar qualquer código de 6 caracteres. A spec não exige a checagem e o `code` não é valor monetário nem chave de acesso — o impacto máximo é poluir a busca do lojista com códigos repetidos. Se quiser fechar, é uma linha na Server Action.
- `orders.customer_name` continua **nullable** no schema, enquanto ORD-31.4 diz "nunca é `null`". Correto assim: o invariante é garantido na aplicação (zod + `sanitizeCustomerName`) e a coluna tem de aceitar `null` pelas linhas legadas, que a UI já mostra como "Sem nome" (ORD-12.1). Não é gap.

---

## C2-10. Requirement Traceability — Ciclo 2

| Requirement | Antes | Ciclo 2 |
|---|---|---|
| ORD-31 | Implementing | ✅ **Verified** (17 ACs, teste + runtime; M3/M4/M10 mortos) |
| ORD-32 | Implementing | ✅ **Verified** (teste + runtime + paridade TS↔SQL em 10 vetores; M1/M2/M6 mortos) |
| ORD-33 | Implementing | ✅ **Verified** (paridade exata em 5 cenários; M5 morto) |
| ORD-34 | Implementing | ✅ **Verified** (chips, preview, template preservado, colapso de linha) |
| ORD-35 | Implementing | ✅ **Verified** (teste + query real no Postgres; M7/M9/M11/M12/M8 mortos) |
| ORD-01/03/04/24/28/29 | ✅ Verified (ciclo 1) | ✅ **Verified — sem regressão** (§C2-3) |

---

## C2-11. Lessons

Signal desta rodada: **0 ACs falhando, 0 mutantes de código sobreviventes**, mas **1 spec-precision gap** (achado 2) e **1 mutação de estado de banco sobrevivente** (DB-1, achado 1). Pela regra de [lessons.md](../../../.claude/skills/tlc-spec-driven/references/lessons.md), signal ⇒ lição. Registradas 2, sem duplicar L-001..005:

| ID | Lição | Signal / grounding |
|---|---|---|
| L-006 | Uma asserção de privilégio para `anon` precisa cobrir grants por coluna, não só `has_table_privilege` — um grant de coluna deixa o teste de tabela em `false`. | `surviving_mutant` — DB-1 (`.github/workflows/supabase-migrations-check.yml:64`) |
| L-007 | Fixe na spec o texto exato de qualquer rótulo que o usuário final lê, antes de assertar a string na suíte. | `spec_precision_gap` — ORD-31.5 / ORD-32.1 |

As 5 lições do ciclo 1 foram revisadas e **seguem válidas**, nenhuma penalizada (nenhuma recorrência):

| ID | Status nesta rodada |
|---|---|
| L-001 (grant explícito de DML ao `service_role`) | ✅ confirmada por contraste — a migration nova **não** precisou de grant novo, e a introspecção provou por quê (grant de tabela alcança coluna nova). A lição continua certa para *tabela* nova |
| L-002 (não deixar módulo de query coberto só por consumidores que o mockam) | ✅ aplicada — a busca nasceu com 9 testes diretos em `server-pedidos.test.ts`, e M7/M9/M11 morreram lá |
| L-003 (migration que muda grants/RLS precisa de asserção contra o banco real) | ✅ confirmada, e **estendida** por L-006 |
| L-004 (introspectar `pg_default_acl` antes de assumir default privileges) | ✅ confirmada — a premissa "grant de tabela vale para coluna futura" foi verificada, não assumida |
| L-005 (fixar na spec a string exata esperada por uma AC) | ✅ confirmada, e **generalizada** por L-007 |

---

## C2-12. Summary — Ciclo 2

**Overall**: ✅ **Ready**

**Spec-anchored check**: **17/17** sub-ACs de ORD-31..35 com o outcome da spec asserido · **1** spec-precision gap não bloqueante · 12 confirmadas também em runtime
**Regressão ciclo 1**: ORD-01/03/04/24/28/29 **sem regressão** — inclusive a garantia mais frágil (aba pré-aberta antes de qualquer `await`), agora comprovada por timestamps num browser real
**Auditoria de testes alterados**: **11/11** justificadas por AC do ciclo 2, **zero** enfraquecidas; as 3 inversões reais correspondem às 3 ACs que a spec revoga em `spec.md:92`
**Gate**: 657 passed · tsc limpo · lint 17 = baseline exato · build ok
**Sensor**: **12 mutações de código, 12 mortas, 0 sobreviventes** (as 8 obrigatórias inclusas) + 1 mutação de banco que expôs a lacuna da guarda de CI
**Segurança**: `anon` com **zero** privilégio de tabela **e de coluna** em `orders`/`order_items` (com controle positivo e prova via HTTP 401 no PostgREST); `code` herdou o grant de tabela exatamente para `authenticated`(SELECT) e `service_role`(INSERT/SELECT), sem `UPDATE` para nenhum dos dois
**Runtime**: confirmado — checkout real gravou `code = PWVV7K` idêntico ao da mensagem, `customer_name = 'Ana Ciclo2'` trimado; o mesmo código sai na mensagem **com a gravação falhando**; colar o código na query real do Postgres devolve exatamente aquele pedido

**O que funciona**: o nome virou pré-requisito de verdade — bloqueio no cliente com a string da spec, rejeição no servidor sem gravar nada, e as duas pontas discriminadas. O código do pedido nasce no cliente antes de qualquer ida ao servidor, e isso não é promessa de comentário: os timestamps de `open`/`fetch`/`href` num browser real mostram a aba abrindo 26 ms antes do POST, e com o `insert` revogado a mensagem ainda saiu completa. A paridade entre as duas fontes do formato padrão, que a spec aponta como risco, tem um cadeado de igualdade exata em 5 cenários. A busca casa código e nome, case-insensitive, dentro da loja, com a paginação recalculada — verificado contra o Postgres real, inclusive o isolamento por RLS sozinha.

**Problemas encontrados**: nenhum bloqueante. Um achado que vale ação: a guarda de CI de privilégios não pega um `grant` por coluna para `anon` — a proteção mais importante do projeto tem um ponto cego numa direção que a própria documentação do repo ensina a usar em `stores`.

**Next steps**: promover ORD-31..35 a `Verified` (feito). Follow-ups fora deste ciclo: (1) trocar `has_table_privilege` por checagem de coluna na guarda de CI; (2) registrar em Assumptions os rótulos `Cliente:`/`Pedido:` da mensagem; (3) opcional — descartar `_` em `orderSearchTerm` e cruzar `code` com `client_order_id` na Server Action.
