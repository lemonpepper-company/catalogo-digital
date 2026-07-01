# Project State

## Decisions log

- **AD-001** — Catálogo público servido por slug em `app/[slug]/page.tsx` (raiz), não `/catalogo/[slug]`. Rotas estáticas existentes têm precedência sobre a dinâmica. (feature: catalogo-publico)
- **AD-002** — Item 3.3 é fullstack: ligar as telas já mockadas ao Supabase (dados reais), não apenas refino de frontend. (feature: catalogo-publico)
- **AD-003** — Visibilidade do catálogo = `store.is_active === true` (trial ignorado por ora — confirmado pelo usuário). `is_active=false` → página de expiração; slug inexistente → 404. Cheque de trial volta com pagamento (passo 6). (feature: catalogo-publico)
- **AD-004** — GA/Pixel e persistência de sacola em localStorage ficam fora deste ciclo. (feature: catalogo-publico)
- **AD-005** — `stores` já tem leitura pública (`init_auth.sql:27`); migration nova só adiciona policies de `products` e `categories`. Filtro `is_active and stock>0` no próprio RLS. (feature: catalogo-publico)
- **AD-006** — Componentes de UI do catálogo (`StoreHeader`/`ProductCard`/`ProductDetail`/`BagDrawer`) mantêm contrato; dados do banco são mapeados para os view-models `Store`/`Product`/`CartItem` existentes. (feature: catalogo-publico)

## Handoff snapshot

- **Branch:** `feature/catalogo-publico`
- **Fase atual:** Planejamento concluído (spec + design + tasks escritos). Aguardando confirmação do usuário antes de executar.
- **A confirmar:** AD-003 (regra de visibilidade do catálogo).
- **Próximo passo:** Executar Fase 1 (T1 migration RLS → T2 camada de dados).
- **Arquivos-chave:** `.specs/features/catalogo-publico/{spec,design,tasks}.md`.
