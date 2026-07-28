# Project State

## Decisions log

- **AD-001** — Catálogo público servido por slug em `app/[slug]/page.tsx` (raiz), não `/catalogo/[slug]`. Rotas estáticas existentes têm precedência sobre a dinâmica. (feature: catalogo-publico)
- **AD-002** — Item 3.3 é fullstack: ligar as telas já mockadas ao Supabase (dados reais), não apenas refino de frontend. (feature: catalogo-publico)
- **AD-003** — Visibilidade do catálogo = `store.is_active === true` (trial ignorado por ora — confirmado pelo usuário). `is_active=false` → página de expiração; slug inexistente → 404. Cheque de trial volta com pagamento (passo 6). (feature: catalogo-publico)
- **AD-004** — GA/Pixel e persistência de sacola em localStorage ficam fora deste ciclo. (feature: catalogo-publico)
- **AD-005** — `stores` já tem leitura pública (`init_auth.sql:27`); migration nova só adiciona policies de `products` e `categories`. Filtro `is_active and stock>0` no próprio RLS. (feature: catalogo-publico)
- **AD-006** — Componentes de UI do catálogo (`StoreHeader`/`ProductCard`/`ProductDetail`/`BagDrawer`) mantêm contrato; dados do banco são mapeados para os view-models `Store`/`Product`/`CartItem` existentes. (feature: catalogo-publico)
- **AD-007** — Escrita de pedidos usa `SUPABASE_SERVICE_ROLE_KEY` **server-only** (`lib/supabase/admin.ts`, com `import "server-only"`). `orders`/`order_items` nunca recebem GRANT nem policy para o papel `anon` — é o inverso do cuidado com colunas públicas de `stores`. (feature: captura-de-pedidos)
- **AD-008** — A captura do pedido nunca bloqueia a venda: aba do WhatsApp é pré-aberta no clique e a gravação corre num `Promise.race` com timeout de 2500 ms; falha/timeout → abre o WhatsApp e loga o erro no servidor. (feature: captura-de-pedidos)
- **AD-009** — Valor do pedido é sempre recalculado a partir de `products.price_cents` no servidor; nenhum campo monetário do cliente é aceito. Itens são gravados com snapshot (`product_name`, `unit_price_cents`) e `product_id` com `on delete set null`. (feature: captura-de-pedidos)
- **AD-010** — Status da venda tem três estados (`pendente` default, `confirmado`, `cancelado`) com transição livre entre eles (correção sempre possível); faturamento do dashboard conta só `confirmado`, e `cancelado` sai também da contagem de pedidos do mês. (feature: captura-de-pedidos)
- **AD-011** — Histórico de pedidos e cards de ROI são recurso de **Starter/Pro**: plano efetivo `free` vê estado bloqueado (sem número real, sem query executada), com CTA de WhatsApp no padrão do banner de `app/painel/layout.tsx`. A **captura grava em qualquer plano** — ao subir de plano o histórico já está pronto. Gate via nova capability `hasOrderHistory` em `lib/plan-limits.ts`. (feature: captura-de-pedidos)

## Handoff snapshot

- **Branch:** `feature/captura-de-pedidos` (criada a partir de `main` em cafaeab)
- **Fase atual:** Execute concluído (T1–T17) + **iteração 1 de fix tasks concluída** (F1–F4, commits `d9a7f12`, `762a49f`, `e035b1b`, `2632d95`). Próximo passo: **re-dispatch do Verifier** (o relatório de 28/07/2026 em `.specs/features/captura-de-pedidos/validation.md` é o FAIL que originou as fixes; ele ainda não reflete as correções).
- **Gates atuais:** 47 arquivos / **524 testes** verdes (baseline da validação era 500); lint em **17 erros = baseline** pré-existente; `npm run build` ok.
- **Blocker do FAIL resolvido:** `service_role` sem DML — corrigido em `supabase/migrations/20260728000000_orders_service_role_grants.sql`, aplicado no banco local com `npx supabase migration up` (nenhum `db reset`). Checkout real gravou 1 pedido + itens com total do banco; reenvio da mesma sacola manteve 1 pedido; dados de teste removidos (`orders`/`order_items` em 0).
- **Guarda de regressão nova:** passo `Check table privileges` em `.github/workflows/supabase-migrations-check.yml` — falha se o `service_role` perder privilégio ou o `anon` ganhar qualquer um em `orders`/`order_items`. Verificado que falha no estado anterior à migration.
- **Mutantes M10–M14** (`lib/server/pedidos.ts`), antes 5/5 sobreviventes: agora **5/5 mortos** por `__tests__/server-pedidos.test.ts`.
- **Ambiente:** `SUPABASE_SERVICE_ROLE_KEY` já no `.env.local` (usuário, 27/07/2026). Ainda falta configurar na Vercel antes do deploy.
- **Feature anterior (catalogo-publico):** concluída e validada — ver `.specs/features/catalogo-publico/validation.md`.
