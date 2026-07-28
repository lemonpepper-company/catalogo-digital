# Captura de Pedidos — Validation

**Date**: 2026-07-28
**Spec**: `.specs/features/captura-de-pedidos/spec.md` (30 ACs, ORD-01..30 — única fonte de verdade)
**Diff range**: `cafaeab..8a3d7f7` (`git diff main..HEAD`) — 57 arquivos, +5538/−49
**Verifier**: sub-agent independente (author ≠ verifier), coverage re-derivada do zero com evidence-or-zero

---

## Veredito

**❌ FAIL** — 1 blocker de runtime (a captura **nunca grava** no ambiente real) + 5 mutantes sobreviventes numa camada sem nenhum teste.

A suíte está 500/500 verde, o lint está no baseline e o build passa. Mesmo assim a feature **não funciona**: nenhum pedido é persistido, porque o papel `service_role` não tem privilégio de DML em `orders`/`order_items`/`stores`. Todos os testes que cobrem a gravação mockam o client do Supabase, então nenhum deles pode observar essa falha.

---

## 1. Blocker: `service_role` não tem GRANT — a captura falha 100% das vezes

**ACs afetadas**: ORD-01, ORD-02, ORD-04, ORD-06, ORD-08, ORD-27 (e, por consequência, todo o Success Criteria de gravação).

### Evidência de runtime (checkout real no dev server, loja `atelie-mira`, plano `pro`)

Adicionei um produto à sacola em `http://localhost:3000/atelie-mira`, preenchi "Ana Verificacao" no campo de nome e cliquei em "Enviar pedido via WhatsApp →". Log do servidor:

```
registrarPedido: erro ao buscar a loja — permission denied for table stores
└─ ƒ registrarPedido({"address":null,"clientOrderId":"c2be91cb-…","customerName":"Ana Verificacao",…}) in 36ms
```

Contagem no banco imediatamente depois: `orders = 0`, `order_items = 0`.

A action morre na **primeira** query (`select id from stores`), retorna `{ ok: false }` e nunca chega ao `upsert`. `orders` tinha 0 linhas antes e continua com 0 — ou seja, a captura nunca funcionou nem uma vez neste ambiente.

### Causa-raiz (introspecção real, não o SQL do arquivo)

```sql
select t.tbl, p.priv, has_table_privilege('service_role','public.'||t.tbl,p.priv)
```

| tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `orders` | f | f | f | f |
| `order_items` | f | f | f | f |
| `stores` | f | f | f | f |
| `products` | f | f | f | f |

`relacl` de `orders`: `{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres,authenticated=r/postgres}` — `service_role` recebeu só `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), **nenhum DML**.

O motivo está no default ACL do schema `public` **deste** projeto, criado pelo role `postgres` (que é quem roda as migrations):

```
postgres | public | r | {postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=Dxtm/postgres,service_role=Dxtm/postgres}
```

Tabelas novas em `public` **não** herdam DML para `anon`/`authenticated`/`service_role`. Isso invalida a premissa escrita no comentário `SPEC_DEVIATION` da própria migration (`supabase/migrations/20260727000000_orders.sql:68`): *"as default privileges do schema public concedem TUDO a anon e a authenticated em tabelas novas"* — não concedem. O `revoke ... from authenticated` era inócuo, e o que faltou foi o **grant para `service_role`**, que a migration nunca faz.

Confirmação pelo mesmo caminho que o app usa (PostgREST com a `SERVICE_ROLE_KEY`):

```
GET  /rest/v1/stores?slug=eq.atelie-mira  → HTTP 403  permission denied for table stores
POST /rest/v1/orders                      → HTTP 403  permission denied for table orders
```

### Por que nenhum teste pega

`__tests__/registrar-pedido.test.ts:6` mocka `@/lib/supabase/admin` inteiro; `lib/server/pedidos.ts` mocka `@/lib/supabase/server`. Nenhum teste da feature toca o banco real, e não existe teste de integração/migration. O Success Criteria da spec (*"100% dos envios … geram uma linha em `orders` no ambiente local de teste"*) nunca foi exercido.

**Fix**: adicionar à migration os grants que faltam para `service_role` em `orders`, `order_items` e — se a leitura da loja/produtos pela admin client for mantida — `stores` e `products`. Um teste que exercite a action contra o Postgres local (ou um lint de migration que exija grant explícito para `service_role` em tabela escrita pela service role) impediria a recorrência.

---

## 2. Spec-Anchored Acceptance Criteria

Legenda: ✅ asserção bate com o outcome da spec · ⚠️ spec-precision gap · 🟡 coberto mas sem discriminação (mutante sobreviveu) · ❌ sem evidência / falha

### P1 — Pedido registrado antes do WhatsApp

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-01 grava 1 `orders` (status `pendente`) + 1 `order_items` por item, e abre `wa.me` independentemente | 1 upsert, `status:"pendente"`, `items_count:2`, `total_cents:39800`; aba aberta no clique | `__tests__/registrar-pedido.test.ts:148` — `expect(callsOf(made,"orders","upsert")).toHaveLength(1)` + `:149` `toMatchObject({store_id:STORE_ID, client_order_id:CLIENT_ORDER_ID, status:"pendente", items_count:2, total_cents:39800})`; `__tests__/registrar-pedido.test.ts:181` — `expect(itemRows(made)).toEqual([...])`; `__tests__/use-catalogo.test.ts:205` — `expect(openMock()).toHaveBeenCalledWith("","_blank")` | ✅ em teste / ❌ **falha em runtime** (§1) |
| ORD-02 preço e total só de `products.price_cents`, ignorando valor do cliente | `total_cents = 39800`, `unit_price_cents = 19900` mesmo com `unitPriceCents:1` no payload | `__tests__/registrar-pedido.test.ts:246` — `expect(upsertRow(made).total_cents).toBe(39800)` + `:247` `expect(itemRows(made)[0].unit_price_cents).toBe(19900)`; `__tests__/orders.test.ts:93` — `expect(result.items[0].unitPriceCents).toBe(19900)` | ✅ (mutante M4 morto) |
| ORD-03 falha ou >2500 ms → abre WhatsApp, loga `console.error`, sem erro ao cliente | redirect ocorre; toast permanece "Abrindo o WhatsApp…"; timeout exatamente 2500 ms | `__tests__/use-catalogo.test.ts:279-280` — `expect(tab.location.href).toContain("https://wa.me/…")` + `expect(result.current.toast).toBe("Abrindo o WhatsApp…")`; `:305-312` — `advanceTimersByTimeAsync(2499)` → `href` `""`, +1 ms → `href` com `wa.me` (limite exato); `registrar-pedido.test.ts:455` — `expect(errorSpy).toHaveBeenCalled()` | ✅ (M2, M3 mortos) |
| ORD-04 mesmo `client_order_id` → total permanece 1 e resposta de sucesso | `{onConflict:"store_id,client_order_id", ignoreDuplicates:true}`; 0 linhas → `{ok:true}` sem inserir itens | `__tests__/registrar-pedido.test.ts:352` — `expect(upsertOptions(made)).toEqual({onConflict:"store_id,client_order_id",ignoreDuplicates:true})`; `:367-368` — `expect(result).toEqual({ok:true})` + `expect(callsOf(made,"order_items","insert")).toHaveLength(0)` | ✅ (M5 morto) |
| ORD-05 sacola muda → novo `client_order_id` | mesmo id no reenvio idêntico; id diferente após qty/add/remove | `__tests__/use-catalogo.test.ts:374` — `expect(capturePayload(0).clientOrderId).toBe(capturePayload(1).clientOrderId)`; `:387`, `:400`, `:414` — `.not.toBe(...)` para qty, add e remove | ✅ |
| ORD-06 item que não resolve é descartado; nenhum resolve → nada gravado | 1 item restante, `items_count:2`, `total_cents:39800`; nenhum → `{ok:false}` e 0 writes | `__tests__/registrar-pedido.test.ts:316-318` — `toMatchObject({items_count:2,total_cents:39800})` + `expect(itemRows(made)).toHaveLength(1)`; `:340-341` — `expect(result).toEqual({ok:false})` + `expect(writeCalls(made)).toHaveLength(0)` | ✅ |
| ORD-07 >20 linhas, qty fora de 1..99, uuid inválido, slug inexistente, loja inativa, método inválido → `{ok:false}` sem gravar | `safeParse` false para cada caso; action → `{ok:false}` e `from` não chamado | `__tests__/pedido-validation.test.ts:92,99,108,113,118,127,136,145,150,157` (um caso por item); `__tests__/registrar-pedido.test.ts:260-261` — `expect(result).toEqual({ok:false})` + `expect(from).not.toHaveBeenCalled()`; `:281` — `expect(callsOf(made,"stores","eq")).toEqual([["slug","ateliemira"],["is_active",true]])` | ✅ |
| ORD-08 ≥20 pedidos em 60 s → descarta com `{ok:false}` | `count:20` → `{ok:false}`, 0 writes; `count:19` → grava; janela = agora−60 s | `__tests__/registrar-pedido.test.ts:379-380` — `expect(result).toEqual({ok:false})` + `expect(writeCalls(made)).toHaveLength(0)`; `:392` — `count:19` → `{ok:true}`; `:405` — `expect(callsOf(made,"orders","gte")[0]).toEqual(["created_at","2026-07-27T11:59:00.000Z"])` | ✅ |

### P1 — Nome opcional do cliente

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-09 campo "Seu nome (opcional)" quando há itens | campo presente com itens, ausente com sacola vazia | `__tests__/BagDrawer.test.tsx` — `expect(screen.getByLabelText("Seu nome (opcional)")).toBeTruthy()` / `queryByLabelText(...)).toBeNull()` com `items=[]`; confirmado também em runtime (campo renderizado no drawer real) | ✅ |
| ORD-10 `customer_name` com `trim()` e máx. 60 | `"   Ana Maria   "` → `"Ana Maria"`; branco → `null`; 70 chars → 60 | `__tests__/registrar-pedido.test.ts:419` — `expect(upsertRow(made).customer_name).toBe("Ana Maria")`; `:428` — `.toBeNull()`; `:437` — `.toBe("A".repeat(60))`; `__tests__/orders.test.ts:56,60-63,68` idem em `sanitizeCustomerName` | ✅ |
| ORD-11 nome vazio não bloqueia envio; template do WhatsApp intacto | botão habilitado e `onCheckout` chamado; URL sem o nome | `__tests__/BagDrawer.test.tsx` — `expect(btn.disabled).toBe(false)` + `expect(onCheckout).toHaveBeenCalledTimes(1)` com `customerName:""`; `__tests__/use-catalogo.test.ts:265-268` — `expect(tab.location.href).toBe(\`https://wa.me/…?text=${encodeURIComponent(expectedMsg)}\`)` + `expect(decodeURIComponent(tab.location.href)).not.toContain("Ana")` | ✅ |

### P1 — Histórico de pedidos no painel

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-12 lista **só** os pedidos da própria loja, **ordenados por `created_at` desc**, com data/hora, nome (ou "Sem nome"), qtd itens, total em reais, status | filtro por `store_id`; ordem decrescente; campos renderizados | Renderização: `__tests__/PedidosClient.test.tsx:56-58` — `getByText("27/07/2026, 12:30 · 3 itens")`, `getByText("R$ 478,00")`, `getByText("Pendente")`; `:71` — `getByText("Sem nome")`. **Filtro e ordenação: sem asserção.** `lib/server/pedidos.ts:54-55` (`.eq("store_id",…)`, `.order("created_at",{ascending:false})`) não é coberto por nenhum teste — M10 e M11 sobreviveram | 🟡 parcial |
| ORD-13 >20 pedidos → páginas de 20 reusando `Pagination` | tamanho de página = 20 | `__tests__/PedidosClient.test.tsx:101-102` — `within(nav).getByRole("link",{name:"2"}).getAttribute("href")` = `"/painel/pedidos?page=2"` (só a renderização). **`ORDERS_PAGE_SIZE = 20` e o `.range()` não têm asserção** — M12 (20→7) sobreviveu | 🟡 parcial |
| ORD-14 detalhe com nome, tamanho, cor, qtd, unitário, subtotal, pagamento, entrega (+endereço), total, status | `"2x R$ 199,00"`, `"R$ 398,00"`, `"Tamanho M · Cor Areia"`, `"Entrega: Enviar no endereço — Rua X, 123"` | `__tests__/PedidosClient.test.tsx:120-125`, `:137-140`, `:149`, `:158-159` | ✅ |
| ORD-15 estado vazio explicando quando os pedidos aparecem | texto "Nenhum pedido ainda" + explicação da sacola | `__tests__/PedidosClient.test.tsx:300-306` — `getByText("Nenhum pedido ainda")` + a frase completa + `queryByRole("button",{name:/Ver detalhe/})).toBeNull()` | ✅ |
| ORD-16 não autenticado → `/login?next=/painel/pedidos`; item "Pedidos" no Sidebar e MobileTabBar em qualquer plano, ativo em `/painel/pedidos` | redirect com querystring `next`; navegação presente e `aria-current="page"` | Navegação: `__tests__/Sidebar.test.tsx:57-70` — ordem `["Dashboard","Produtos","Pedidos",…]` + `href="/painel/pedidos"`; `:79-81` — `aria-current` = `"page"`; `__tests__/MobileTabBar.test.tsx:20-29,36-38,54-56`. Redirect do middleware: **sem teste** — verificado em runtime: `/painel/pedidos` → `http://localhost:3000/login?next=%2Fpainel%2Fpedidos` | ⚠️ AC5 sem teste (confirmada em runtime) |
| ORD-14/ORD-16.7 snapshot sobrevive à exclusão do produto | nome e unitário gravados continuam exibidos | `__tests__/PedidosClient.test.tsx:186-187` — `getByText("Saia plissada (produto excluído)")` + `getByText("1x R$ 129,00")`; `__tests__/orders.test.ts:250-251` — `mapOrderRow` preserva `productName`/`unitPriceCents`; schema: `order_items.product_id … on delete set null` (verificado: `confdeltype='n'`) | ✅ |

### P1 — Números de ROI no dashboard

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-17 "Pedidos no mês" = pedidos do mês corrente (SP) com status ≠ `cancelado` | 4 linhas, 1 cancelada → 3 | `__tests__/order-metrics.test.ts:52` — `expect(metrics.ordersThisMonth).toBe(3)`; `:14-15,19-20,25-26,31-32` — `monthStartInSaoPaulo` (jan, jul, virada de mês e de ano no fuso SP); `__tests__/DashboardClient.test.tsx:56` — `expect(statValue("Pedidos no mês")).toBe("7")`. **Filtro `gte(created_at, monthStart)` na query não asserido** — M14 sobreviveu | 🟡 parcial |
| ORD-18 "Vendas confirmadas no mês" = soma de `total_cents` com status `confirmado`, em reais | 2500+7500 → 10000; render `R$ 1234,50` | `__tests__/order-metrics.test.ts:65` — `expect(metrics.confirmedCentsThisMonth).toBe(10000)`; `__tests__/DashboardClient.test.tsx:62` — `expect(statValue("Vendas confirmadas no mês")).toBe("R$ 1234,50")` | ⚠️ ver nota de formatação |
| ORD-19 "Aguardando confirmação" = todos os `pendente`, sem filtro de período | `pendingTotal` repassado intacto (7) | `__tests__/order-metrics.test.ts:70` — `expect(metrics.pendingCount).toBe(7)`; `__tests__/DashboardClient.test.tsx:68` — `.toBe("3")`. **`.eq("status","pendente")` na query não asserido** — M13 sobreviveu | 🟡 parcial |
| ORD-20 sem pedidos → `0` e `R$ 0,00`, nunca vazio/`NaN`/erro | exatamente `0`, `R$ 0,00`, `0` | `__tests__/order-metrics.test.ts:75-80` — `toEqual({ordersThisMonth:0,confirmedCentsThisMonth:0,pendingCount:0})` + `expect(Number.isNaN(...)).toBe(false)`; `__tests__/DashboardClient.test.tsx:84-86` — `"0"`, `"R$ 0,00"`, `"0"` | ✅ |
| ORD-21/ORD-20 `cancelado` deixa de contar e não soma | antes 1/12000 → depois 0/0 | `__tests__/order-metrics.test.ts:95-98` — as quatro asserções antes/depois; `:87-89` — só cancelados → 0 e 0 | ✅ (M9 morto) |

### P2 — Status da venda

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-21 persiste o novo status e a lista reflete sem recarregar | `update({status:"confirmado"})`; `revalidatePath` em `/painel/pedidos` e `/painel` | `__tests__/update-order-status.test.ts:107` — `expect(writeCalls()).toEqual([[{status:"confirmado"}]])`; `:119-122` — `revalidatePath` chamado com `["/painel/pedidos","/painel"]`; `__tests__/PedidosClient.test.tsx:290-292` — lista reflete `confirmado` e não mostra mais `Pendente` | ✅ |
| ORD-22 as 3 transições aceitas de qualquer origem; valor fora do enum → `{error}` sem alterar linha | cada status → `{ok:true}`; `"entregue"` → `{error:"Status inválido."}` e `from` não chamado | `__tests__/update-order-status.test.ts:140-149` — `it.each` dos 3 status com `expect(writeCalls()).toEqual([[{status}]])`; `:160-161` — `toEqual({error:"Status inválido."})` + `expect(from).not.toHaveBeenCalled()`; `__tests__/orders.test.ts:45-51` — `isOrderStatus` rejeita fora do enum | ✅ |
| ORD-23 pedido de outra loja → nenhuma linha alterada e `{error}` | `update` restrito a `store_id`; 0 linhas → `{error:"Pedido não encontrado."}` | `__tests__/update-order-status.test.ts:108-111` — `expect(chain.calls.eq).toEqual([["id",ORDER_ID],["store_id",STORE_ID]])`; `:184` — `toEqual({error:"Pedido não encontrado."})`; `:193` — `toContainEqual(["store_id",STORE_ID])` | ✅ (M8 morto) |
| ORD-21.5 cards de ROI refletem na próxima renderização | `revalidatePath("/painel")` | `__tests__/update-order-status.test.ts:119-122` (mesma asserção) | ✅ |

### P1 — Segurança (ORD-24) — introspecção real no Postgres local

| Requisito da spec | Estado real verificado | Result |
|---|---|---|
| `anon` sem **nenhum** privilégio em `orders`/`order_items` | `has_table_privilege('anon', …)` = **f** para SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER nas duas tabelas (14/14 `f`). `information_schema.table_privileges` não lista `anon` nas duas tabelas. Probes REST: `GET /orders` → 401 `permission denied`, `POST /orders` → 401, `GET /order_items` → 401 | ✅ |
| `authenticated` só `SELECT` (+ `UPDATE` na coluna `status` de `orders`) | Table-level: `authenticated` = `SELECT` em `orders` e `order_items`, nada mais (UPDATE table-level = `f`). Column-level: `UPDATE` **apenas** em `orders.status` (1 única linha de UPDATE em 21) | ✅ |
| RLS habilitada nas duas tabelas | `pg_class.relrowsecurity = t` em `orders` e `order_items` | ✅ |
| Todas as policies escopadas a `authenticated` | 3 policies (`orders: own store read`/SELECT, `orders: own store status update`/UPDATE, `order_items: own store read`/SELECT), todas `roles = {authenticated}`; a query de controle `where roles <> '{authenticated}'` retorna **0 linhas** | ✅ |
| service role server-only | `lib/supabase/admin.ts:1` `import "server-only"`; env sem prefixo `NEXT_PUBLIC_`; `__tests__/supabase-admin.test.ts` cobre chave ausente/vazia, não vazar a chave no erro e `persistSession:false` | ✅ |
| Extras verificados | `unique (store_id, client_order_id)` presente; `orders.store_id → stores` e `order_items.order_id → orders` com `on delete cascade` (`confdeltype='c'`); `order_items.product_id` com `set null` | ✅ |

**ORD-24: ✅ PASS.** O lockdown do `anon` está correto no estado real do banco — o problema do §1 é o oposto: o `service_role` também ficou sem privilégio.

### P1 — Histórico como recurso dos planos pagos

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-27 grava em qualquer plano; captura nunca consulta plano | `registrarPedido` sem `getPlanLimits`/`plan` | `app/actions/pedidos.ts:25-145` não referencia plano (verificado por leitura); `__tests__/registrar-pedido.test.ts` grava com sucesso sem nenhum mock de plano. **Nenhuma asserção negativa explícita** ("não consulta plano") | ⚠️ spec-precision gap / ❌ irrelevante em runtime enquanto §1 não for corrigido |
| ORD-28 Free → tela bloqueada, sem listar pedido, sem contagem/total/dado real | `getStoreOrders` **não** chamado; texto "Disponível a partir do plano Starter"; HTML sem "Ana" e sem "R$" | `__tests__/PedidosPage.test.tsx:94-96` — `expect(getStoreOrders).not.toHaveBeenCalled()` + `getByText("Disponível a partir do plano Starter")` + link "Falar no WhatsApp →"; `:104-106` — `expect(container.textContent).not.toContain("Ana")`, `not.toContain("R$")`, `queryByRole("button",{name:/Ver detalhe/})).toBeNull()`; `__tests__/RecursoBloqueado.test.tsx` — `expect(container.textContent).not.toMatch(/\d/)` | ✅ (M6 morto) |
| ORD-29 Free → 3 cards de ROI trocados por aviso com CTA, sem número real; cards de produtos intactos | `getOrderMetrics` não chamado; nenhum dos 3 rótulos; sem "R$"; cards de produto preservados | `__tests__/DashboardPage.test.tsx:82-85` — `expect(getOrderMetrics).not.toHaveBeenCalled()` + `queryByText("Pedidos no mês")).toBeNull()` + `not.toContain("R$")`; `__tests__/DashboardClient.test.tsx:95-99` — os 3 `queryByText(...)).toBeNull()`; `:112-114` — `statValue("Produtos ativos")`=`"1"`, esgotados=`"1"`, catálogo=`"2"` | ✅ (M7 morto) |
| ORD-30 Starter/Pro liberam tudo; `trial_ends_at` vencido rebaixa via `getEffectivePlan()` sem escrita | Starter → `getStoreOrders(STORE_ID,1)` e pedido listado; vencido → bloqueio | `__tests__/PedidosPage.test.tsx:116-118` — `toHaveBeenCalledWith(STORE_ID,1)` + `getByText("Ana")` + `getByText("R$ 398,00")`; `:137-138` — vencido → `not.toHaveBeenCalled()` + bloqueio; `__tests__/DashboardPage.test.tsx:95-98`, `:106-107`; `__tests__/plan-limits.test.ts` — `getEffectivePlan`/`hasOrderHistory` para free/starter/pro × vencido/futuro/null; `__tests__/update-order-status.test.ts:220-238` — action recusa no Free e no expirado | ✅ |
| ORD-30.7 histórico do período Free aparece ao virar pago, sem migração | mesma query, nada gravado diferente por plano | Por construção: `getStoreOrders` filtra só por `store_id` (`lib/server/pedidos.ts:54`) e a gravação não grava plano. **Sem teste dedicado** | ⚠️ spec-precision gap |

### P2 — Landing e documentação

| AC | Outcome definido na spec | `file:line` + assertion | Result |
|---|---|---|---|
| ORD-25.1 card "Histórico de pedidos" na landing com itens e total | card existe; desc casa `/registrad/i`, `/itens/i`, `/total/i` | `__tests__/landing-data.test.ts:14-19` | ✅ |
| ORD-25.2 FAQ: pedido registrado mesmo indo para o WhatsApp, sem checkout/pagamento | pergunta com `/WhatsApp/i`, resposta com `/painel/i`, `/não existe checkout/i`, `/pagamento/i` | `__tests__/landing-data.test.ts:29-32`, `:36-38` | ✅ |
| ORD-25.3 "Histórico de pedidos" em Starter e Pro, ausente no Free | `toContain` em starter/pro; Free sem nenhuma variação de "histórico" | `__tests__/landing-data.test.ts:44,48,52-53` — inclui `expect(freeFeatures.some(f=>/hist(ó\|o)rico/i.test(f))).toBe(false)` | ✅ |
| ORD-26 `docs/ARCHITECTURE.md`, `docs/roadmap/Escopo.md` (§4.2, §5), `AGENTS.md` refletem `orders`/`order_items` e a tela | schema, arquivos, estado atual e planos documentados | `docs/ARCHITECTURE.md:60,64,73,97,112,116,119,129,130,175,178,179`; `docs/roadmap/Escopo.md:44,46,91,92,106,135,143` | ✅ conteúdo presente / ⚠️ ver nota |
| ORD-26.5 política de privacidade menciona itens, total e nome do pedido | menção explícita ao armazenamento | `app/politica-de-privacidade/page.tsx:76` — item "Dados de pedidos: … itens escolhidos (nome do produto, tamanho, cor, quantidade e valor unitário), o total, a forma de pagamento e de entrega, o endereço … e o nome …"; `:96` — finalidade de uso. **Sem teste** (página estática, coerente com o resto do repo) | ⚠️ sem teste |

**Nota ORD-26**: o conteúdo existe e é detalhado, mas `docs/ARCHITECTURE.md:97` afirma que a `SUPABASE_SERVICE_ROLE_KEY` *"é a única chave capaz de gravar em `orders`/`order_items`"* — no estado real do banco ela **não** consegue gravar (§1). A doc precisa ser corrigida junto com a migration.

**Nota ORD-18 (formatação)**: `formatCents` (`lib/utils.ts:125-127`) não usa separador de milhar, então R$ 1.234,50 é renderizado como `R$ 1234,50`. É o formatador pré-existente do projeto (usado também nos preços de produto), e a spec só diz "formatada em reais" — não é regressão desta feature, mas é um **spec-precision gap**: a spec não fixa o formato, e o valor exibido não é o padrão pt-BR.

### Resumo do check spec-anchored

- ✅ **19/30** ACs com asserção casando o outcome exato da spec e discriminação comprovada
- 🟡 **5/30** cobertas só na renderização, com a lógica de query sem asserção (ORD-12, ORD-13, ORD-17, ORD-19 — e ORD-18 no lado servidor): mutantes sobreviveram
- ⚠️ **5** spec-precision / evidence gaps: ORD-16.5 (redirect sem teste, confirmado em runtime), ORD-18 (formato não fixado na spec), ORD-27 (sem asserção negativa de "não consulta plano"), ORD-30.7 (sem teste dedicado), ORD-26.5 (sem teste)
- ❌ **1 blocker** de runtime atingindo ORD-01/02/04/06/08/27

---

## 3. Discrimination Sensor

Todas as mutações foram aplicadas sobre cópia de backup do arquivo real e revertidas imediatamente (`shutil.copy2` → mutação → vitest → `shutil.move` de volta). `git status` limpo antes e depois; nenhum `.sensorbak` remanescente.

### Passe 1 — caminhos de maior risco (testes dirigidos)

| # | File | Mutação | Killed? |
|---|---|---|---|
| M1 | `app/[slug]/use-catalogo.ts:135` | move `window.open("","_blank")` para **depois** do `await` | ✅ Killed (1 failed) |
| M2 | `app/[slug]/use-catalogo.ts:11` | timeout de captura `2500` → `900000` ms | ✅ Killed (1 failed) |
| M3 | `app/[slug]/use-catalogo.ts:158` | `catch` passa a rethrow → falha da gravação **bloqueia** o redirect | ✅ Killed (1 failed) |
| M4 | `lib/orders.ts:82` | `unitPriceCents` passa a vir do payload do cliente | ✅ Killed (1 failed) |
| M5 | `app/actions/pedidos.ts:108` | `ignoreDuplicates: true` → `false` | ✅ Killed (1 failed) |
| M6 | `app/painel/pedidos/page.tsx:18` | inverte o gate `hasOrderHistory` | ✅ Killed (6 failed) |
| M7 | `app/painel/page.tsx:12` | inverte o gate `hasOrderHistory` dos cards de ROI | ✅ Killed (3 failed) |
| M8 | `app/actions/pedidos.ts:179` | remove `.eq("store_id", store.id)` de `updateOrderStatus` | ✅ Killed (2 failed) |
| M9 | `lib/order-metrics.ts:64` | conta `cancelado` no total do mês | ✅ Killed (4 failed) |

**9/9 mortas.** Os caminhos que a spec destaca como críticos (pop-up síncrono, timeout, falha silenciosa, preço do banco, idempotência, gates de plano, isolamento por loja, exclusão de cancelados) são todos discriminados.

### Passe 2 — `lib/server/pedidos.ts` (suíte **completa** por mutação)

| # | Mutação | Killed? |
|---|---|---|
| M10 | `getStoreOrders`: remove `.eq("store_id", storeId)` | ❌ **Survived** (500 passed) |
| M11 | `getStoreOrders`: `ascending: false` → `true` (mais antigos primeiro) | ❌ **Survived** (500 passed) |
| M12 | `ORDERS_PAGE_SIZE` `20` → `7` | ❌ **Survived** (500 passed) |
| M13 | `getOrderMetrics`: remove `.eq("status","pendente")` do card de pendentes | ❌ **Survived** (500 passed) |
| M14 | `getOrderMetrics`: remove `.gte("created_at", monthStart)` (mês inteiro ignorado) | ❌ **Survived** (500 passed) |

**0/5 mortas.** `lib/server/pedidos.ts` não tem **nenhum** teste: `PedidosPage.test.tsx:14` e `DashboardPage.test.tsx:13` mockam o módulo inteiro, e `PedidosClient.test.tsx:74` assume explicitamente a ordenação como responsabilidade do servidor ("preserva a ordem recebida do servidor"). Resultado: a camada que decide **qual loja**, **qual ordem**, **qual página** e **qual período** é totalmente desprotegida.

Severidade honesta por mutante:
- **M13 e M14 são os mais graves**: corrompem silenciosamente os números de ROI — exatamente a proposta de valor da feature — e nada no banco os impede.
- **M11 e M12** violam outcomes explícitos da spec (ORD-12 "ordenados por `created_at` decrescente", ORD-13 "páginas de 20").
- **M10** seria contido em produção pela RLS (`orders: own store read` restringe por `owner_id`), então o `.eq("store_id")` é defesa em profundidade; a sobrevivência é lacuna de teste, não vazamento explorável.

**Sensor total: 14 mutações, 9 mortas, 5 sobreviventes.** Profundidade: P0-full (>5 mutações, caminho de dados/pagamento).

---

## 4. Gates

| Gate | Comando | Resultado |
|---|---|---|
| Testes | `npx vitest run` | ✅ **500 passed, 0 failed, 0 skipped** (45 arquivos) — reconfirmado após o sensor |
| Lint | `npm run lint` | ✅ **17 erros = baseline exato** — `ConfiguracoesClient.tsx` (15), `SlugInput.tsx:26` (1), `use-catalogo.ts:67` (1). Nenhum erro novo. O de `use-catalogo.ts` é o `setVisibleCount` pré-existente (em `main` na linha 45/46, só deslocado) |
| Build | `npm run build` | ✅ passa; 23 rotas geradas, incluindo `ƒ /painel/pedidos` |

**Test integrity**: contagem subiu de baseline para 500 (+~180 testes na feature); nenhum teste removido, nenhum `skip`, nenhuma asserção enfraquecida detectada.

---

## 5. Verificação de runtime

### Confirmado

| # | O que | Resultado |
|---|---|---|
| 1 | Checkout real em `/atelie-mira` (loja ativa, `pro`) dispara `registrarPedido` com payload correto | ✅ payload íntegro (`clientOrderId` uuid, `customerName:"Ana Verificacao"`) |
| 2 | Linha gravada em `orders` + `order_items` com total do banco | ❌ **0 linhas** — `permission denied for table stores` (§1) |
| 3 | WhatsApp abre mesmo com a gravação falhando, sem erro ao cliente | ✅ aba foi para `https://api.whatsapp.com/…`; nenhum erro exibido — ORD-03 confirmada no pior caso real |
| 4 | Campo "Seu nome (opcional)" renderizado no drawer real | ✅ (ORD-09) |
| 5 | `/painel/pedidos` sem sessão | ✅ → `http://localhost:3000/login?next=%2Fpainel%2Fpedidos` (ORD-16.5, que não tem teste) |
| 6 | `anon` bloqueado em `orders`/`order_items` via REST com a `ANON_KEY` | ✅ 401 `permission denied` em GET `/orders`, POST `/orders`, GET `/order_items` |
| 7 | Privilégios/RLS/policies por introspecção SQL | ✅ conforme §2/ORD-24 |

### **Não** verificado em runtime

- **Tela bloqueada no plano `free` e liberada ao trocar para `starter`** (itens (c) e (d) do pedido): exige autenticar como lojista no painel, e digitar senha/criar conta não está entre as ações que posso executar. A evidência para ORD-28/29/30 é, portanto, teste + leitura de código (gate antes do I/O em `app/painel/pedidos/page.tsx:18` e `app/painel/page.tsx:12`, com M6/M7 mortos), **não** observação direta do HTML renderizado numa sessão autenticada.
- **"Nenhum número real no HTML da página de pedidos no plano Free"** na resposta HTTP real: coberto só pelas asserções de `container.textContent` em jsdom (`PedidosPage.test.tsx:104-106`), não pelo fonte de uma resposta autenticada.
- **Paginação com 21 pedidos semeados** (Independent Test de ORD-13): não executável — a gravação está quebrada (§1) e `orders` está vazia; semear direto no banco sairia do escopo read-only.

### Estado do banco ao final

`orders = 0`, `order_items = 0`. Nenhum dado de teste foi deixado: os probes de INSERT como `service_role` rodaram em transações com `ROLLBACK` e/ou foram negados por permissão; o checkout real não gravou nada. Nenhuma migration foi executada, nenhum `db reset`, `.env.local` intocado.

---

## 6. Code Quality

| Princípio | Status |
|---|---|
| Código mínimo, sem features além do pedido | ✅ |
| Sem abstração para uso único | ✅ |
| Mudanças cirúrgicas, só arquivos necessários | ✅ |
| Não "melhorou" código alheio | ✅ (`Badge.tsx` e `lib/catalog.ts`/`lib/data.ts` mudam o mínimo para suportar status/slug) |
| Segue padrões existentes | ✅ (`RecursoBloqueado` no padrão do banner de upgrade; `fail()` em `lib/server/pedidos.ts:27` segue a convenção de "erro nunca vira lista vazia" de `docs/CONVENTIONS.md`) |
| Um senior aprovaria? | ⚠️ Sim quanto à estrutura e aos testes de domínio; **não** com o grant faltando e a camada de query sem teste |
| Testes mapeiam ACs e não são shallow | ✅ nos módulos puros e nos componentes; ❌ na camada de query (`lib/server/pedidos.ts` sem teste) |
| Spec-anchored: valor asserido = outcome da spec | ⚠️ 19 ✅, 5 🟡, 5 ⚠️ (§2) |
| Coverage Expectation por camada | ❌ `lib/server/pedidos.ts` (2 funções, 4 queries) sem happy/edge/error path |
| Todo teste mapeia para AC/edge case | ✅ nenhum teste órfão encontrado |
| Guidelines documentadas seguidas | ✅ `AGENTS.md`, `docs/CONVENTIONS.md`. Observação: o cuidado crítico do `AGENTS.md` sobre GRANT por coluna para `anon` foi respeitado; o caso simétrico — grant para o papel que **escreve** — não está documentado e é exatamente o que falhou |

---

## 7. Edge Cases da spec

- [x] Sacola vazia → nenhum botão de envio, nada gravado — `BagDrawer.test.tsx` (campo/botão ausentes com `items=[]`)
- [x] Loja sem WhatsApp → checkout bloqueado, nada gravado — `use-catalogo.test.ts:339-341` (`registrarPedido` e `open` não chamados)
- [x] `window.open` → `null` → navega na aba atual — `use-catalogo.test.ts:329`
- [x] Cliente offline → WhatsApp abre sem erro visível — coberto por `use-catalogo.test.ts:271-281` (rejeição da action)
- [x] Preço mudou entre sacola e envio → banco vence — `orders.test.ts:93`, `registrar-pedido.test.ts:246`
- [x] Nome >60 chars → truncado, pedido aceito — `orders.test.ts:68`, `registrar-pedido.test.ts:437`
- [x] Mesmo produto com variações diferentes → 1 linha por variação — `orders.test.ts:167-174`
- [x] Loja excluída → cascade — verificado no schema real (`orders_store_id_fkey` `confdeltype='c'`)
- [x] Free acumula e depois vira Starter → histórico aparece — por construção; sem teste dedicado (⚠️ ORD-30.7)
- [x] Free chamando a action de status → isolamento por dono continua valendo — `update-order-status.test.ts:220-238` + RLS verificada
- [ ] **Dois clientes simultâneos → ambos gravados**: não verificável hoje — nenhuma gravação funciona (§1). `unique(store_id, client_order_id)` e `gen_random_uuid()` existem no schema, mas o comportamento concorrente não foi exercido

---

## 8. Fix Plans (ranqueados)

### Fix 1 — BLOCKER: conceder DML ao `service_role` nas tabelas escritas pela Server Action

- **Root cause**: o default ACL do schema `public` criado pelo role `postgres` concede apenas `Dxtm` a `anon`/`authenticated`/`service_role` em tabelas novas. A migration `20260727000000_orders.sql` revoga de `anon`/`authenticated` e concede a `authenticated`, mas **nunca concede nada a `service_role`** — e `registrarPedido` depende dele para ler `stores`/`products` e escrever `orders`/`order_items`. A premissa contrária está escrita no comentário `SPEC_DEVIATION` da própria migration.
- **Fix**: nova migration com os grants para `service_role` em `orders` e `order_items` (SELECT/INSERT/DELETE — o DELETE é usado no rollback do pedido órfão em `app/actions/pedidos.ts:136`) e em `stores`/`products` (SELECT) enquanto a admin client fizer essas leituras. Corrigir também `docs/ARCHITECTURE.md:97` e o comentário da migration.
- **Verify**: `registrarPedido` num checkout real grava 1 linha em `orders` + N em `order_items` com `total_cents` calculado do banco; reenviar a mesma sacola mantém 1 pedido; `anon` continua 401 em todos os verbos.
- **Priority**: **Blocker** — ORD-01/02/04/06/08/27 e o Success Criteria não são atendidos sem isso.

### Fix 2 — Testar `lib/server/pedidos.ts` (5 mutantes sobreviventes)

- **Root cause**: as duas páginas mockam o módulo inteiro; o módulo nunca é exercido.
- **Fix**: testes com fake chain do Supabase (o padrão já existe em `registrar-pedido.test.ts:36-49`) asserindo, em `getStoreOrders`: `.eq("store_id", storeId)`, `.order("created_at",{ascending:false})`, `.range(0,19)` na página 1 e `.range(20,39)` na página 2; e em `getOrderMetrics`: `.gte("created_at", monthStartInSaoPaulo(now).toISOString())` e `.eq("status","pendente")` na segunda query. Incluir o caminho de erro (`fail()` deve lançar, não devolver lista vazia).
- **Verify**: M10–M14 passam a morrer.
- **Priority**: **Major** — M13/M14 corrompem silenciosamente os números de ROI.

### Fix 3 — Teste de guarda para o redirect do middleware (ORD-16.5)

- **Root cause**: `middleware.ts:57-63` não tem teste em todo o repo; o comportamento é genérico e pré-existente, mas a AC nomeia o `?next=`.
- **Fix**: teste unitário do middleware para `/painel/pedidos` sem sessão → `/login?next=/painel/pedidos`.
- **Priority**: **Minor** (confirmado em runtime nesta validação).

### Fix 4 — Fechar os spec-precision gaps

- ORD-18: fixar o formato na spec (`R$ 1.234,50` vs. `R$ 1234,50`) e, se o separador de milhar for desejado, corrigir `formatCents` — decisão de produto, fora do escopo desta feature.
- ORD-27: asserção negativa explícita de que `registrarPedido` não consulta plano (ex.: mock de `getPlanLimits` que falha se chamado).
- ORD-30.7: teste de que o histórico gravado no Free aparece ao virar `starter`.
- **Priority**: Minor.

---

## 9. Requirement Traceability

| Requirement | Previous | New |
|---|---|---|
| ORD-01 | Implementing | ❌ Needs Fix (runtime — Fix 1) |
| ORD-02 | Implementing | ❌ Needs Fix (lógica ✅; não executa — Fix 1) |
| ORD-03 | Implementing | ✅ Verified (teste + runtime) |
| ORD-04 | Implementing | ❌ Needs Fix (Fix 1) |
| ORD-05 | Implementing | ✅ Verified |
| ORD-06 | Implementing | ❌ Needs Fix (Fix 1) |
| ORD-07 | Implementing | ✅ Verified |
| ORD-08 | Implementing | ❌ Needs Fix (Fix 1) |
| ORD-09 | Implementing | ✅ Verified (teste + runtime) |
| ORD-10 | Implementing | ✅ Verified |
| ORD-11 | Implementing | ✅ Verified |
| ORD-12 | Implementing | ⚠️ Partial (Fix 2 — M10/M11) |
| ORD-13 | Implementing | ⚠️ Partial (Fix 2 — M12) |
| ORD-14 | Implementing | ✅ Verified |
| ORD-15 | Implementing | ✅ Verified |
| ORD-16 | Implementing | ✅ Verified (AC5 por runtime; Fix 3) |
| ORD-17 | Implementing | ⚠️ Partial (Fix 2 — M14) |
| ORD-18 | Implementing | ⚠️ Partial (Fix 2 + gap de formato) |
| ORD-19 | Implementing | ⚠️ Partial (Fix 2 — M13) |
| ORD-20 | Implementing | ✅ Verified |
| ORD-21 | Implementing | ✅ Verified |
| ORD-22 | Implementing | ✅ Verified |
| ORD-23 | Implementing | ✅ Verified |
| ORD-24 | Implementing | ✅ Verified (introspecção real) |
| ORD-25 | Implementing | ✅ Verified |
| ORD-26 | Implementing | ⚠️ Partial (corrigir `ARCHITECTURE.md:97` — Fix 1) |
| ORD-27 | Implementing | ❌ Needs Fix (Fix 1) |
| ORD-28 | Implementing | ✅ Verified |
| ORD-29 | Implementing | ✅ Verified |
| ORD-30 | Implementing | ✅ Verified (AC7 sem teste — Fix 4) |

---

## 10. Summary

**Overall**: ❌ **Not Ready**

**Spec-anchored check**: 19/30 ✅ · 5 🟡 (cobertura só de renderização, mutante sobreviveu) · 5 ⚠️ spec-precision/evidence gaps · 1 blocker de runtime atingindo 6 ACs
**Sensor**: 14 mutações, **9 mortas, 5 sobreviventes** (todas em `lib/server/pedidos.ts`)
**Gate**: 500 passed, 0 failed · lint 17 = baseline · build ok
**Segurança ORD-24**: ✅ `anon` sem nenhum privilégio, `authenticated` só SELECT + UPDATE(status), RLS on, 3/3 policies escopadas a `authenticated` — verificado por SQL e por probe REST

**O que funciona**: a lógica de domínio é sólida e bem testada — preço sempre do banco, idempotência, sanitização do nome, timeout de 2500 ms com falha silenciosa, pop-up pré-aberto no gesto do clique, exclusão de cancelados nas métricas, isolamento por loja na troca de status, gates de plano rodando antes do I/O, snapshot dos itens, e o lockdown do `anon` no banco real. O redirect para o WhatsApp sobrevive à pior falha possível — confirmado num checkout real com a gravação quebrando.

**Problemas encontrados**:
1. **A captura nunca grava** — `service_role` sem DML; 0 linhas em `orders` após um checkout real (Fix 1).
2. **`lib/server/pedidos.ts` sem teste** — 5/5 mutantes sobreviveram, incluindo dois que corrompem os números de ROI (Fix 2).
3. ORD-16.5 sem teste automatizado (Fix 3); gaps menores de precisão em ORD-18/27/30.7 (Fix 4).
4. `docs/ARCHITECTURE.md:97` afirma que a service role key grava em `orders` — hoje é falso.

**Next steps**: Fix 1 (blocker) → Fix 2 (major) → re-verificar com um checkout real de ponta a ponta e o Independent Test de paginação com 21 pedidos, que hoje é inexecutável.
