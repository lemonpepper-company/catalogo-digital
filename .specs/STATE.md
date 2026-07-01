# Project State

## Decisions log

- **AD-001** — Catálogo público servido por slug em `app/[slug]/page.tsx` (raiz), não `/catalogo/[slug]`. Rotas estáticas existentes têm precedência sobre a dinâmica. (feature: catalogo-publico)
- **AD-002** — Item 3.3 é fullstack: ligar as telas já mockadas ao Supabase (dados reais), não apenas refino de frontend. (feature: catalogo-publico)
- **AD-003** — Visibilidade do catálogo = `store.is_active === true` (trial ignorado por ora — confirmado pelo usuário). `is_active=false` → página de expiração; slug inexistente → 404. Cheque de trial volta com pagamento (passo 6). (feature: catalogo-publico)
- **AD-004** — GA/Pixel e persistência de sacola em localStorage ficam fora deste ciclo. (feature: catalogo-publico)
- **AD-005** — `stores` já tem leitura pública (`init_auth.sql:27`); migration nova só adiciona policies de `products` e `categories`. Filtro `is_active and stock>0` no próprio RLS. (feature: catalogo-publico)
- **AD-006** — Componentes de UI do catálogo (`StoreHeader`/`ProductCard`/`ProductDetail`/`BagDrawer`) mantêm contrato; dados do banco são mapeados para os view-models `Store`/`Product`/`CartItem` existentes. (feature: catalogo-publico)

## Handoff snapshot

- **Branch:** `feature/catalogo-publico` (5 commits: fceca3e→2b7b037)
- **Fase atual:** Concluído. Todas as tasks T1–T5 implementadas, commitadas e verificadas.
- **Validação:** ✅ PASS — 120 testes verdes, build OK, sensor de discriminação (3/3 mutações mortas), runtime end-to-end confirmado (`/atelie-mira` 200, slug inexistente 404, loja inativa → expiração, esgotado/inativo ocultos). Ver `.specs/features/catalogo-publico/validation.md`.
- **Ambiente:** stack Supabase local iniciado (`supabase start`) + seed demo aplicado (loja `atelie-mira`).
- **Próximo passo:** revisar/abrir PR. Backlog: injeção GA/Pixel, persistência de sacola, cheque de trial quando houver pagamento.
