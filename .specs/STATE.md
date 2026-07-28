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

## Handoff snapshot

- **Branch:** `feature/captura-de-pedidos` (criada a partir de `main` em cafaeab)
- **Fase atual:** Specify + Design + Tasks concluídos (`.specs/features/captura-de-pedidos/`). Aguardando aprovação do usuário para o Execute.
- **Baseline de testes:** 32 arquivos / 323 testes verdes em 27/07/2026.
- **Plano:** 16 tasks em 4 fases (fundação de schema/módulos puros → captura no catálogo → painel/histórico/status/ROI → landing e docs).
- **Bloqueio de ambiente:** `SUPABASE_SERVICE_ROLE_KEY` precisa ser adicionada pelo usuário em `.env.local` (`supabase status`) e depois na Vercel; sem ela a captura simplesmente não grava.
- **Feature anterior (catalogo-publico):** concluída e validada — ver `.specs/features/catalogo-publico/validation.md`.
