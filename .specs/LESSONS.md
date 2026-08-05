# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — When a table is written by the service role, grant that role its DML explicitly in the same migration — new tables in public inherit no DML for anon, authenticated or service_role.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `supabase-migrations` · harmful: 0
- features: captura-de-pedidos
- evidence: ORD-01/ORD-27 — runtime: 'permission denied for table stores'; orders=0 after real checkout; supabase/migrations/20260727000000_orders.sql:73-81 (supabase-migrations)
- last seen: 2026-07-28T03:48:46Z

### L-002 — Never leave a server query module covered only through consumers that mock it — assert its filters, ordering, range and period directly.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `server-data-layer` · harmful: 0
- features: captura-de-pedidos
- evidence: M10-M14 survived full suite — lib/server/pedidos.ts has no test; PedidosPage.test.tsx:14 and DashboardPage.test.tsx:13 mock the module (server-data-layer)
- last seen: 2026-07-28T03:48:47Z

### L-003 — Back every migration that changes grants, RLS or policies with a privilege assertion against the real database — mocked Supabase clients cannot observe permission errors.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `supabase-migrations` · harmful: 0
- features: captura-de-pedidos
- evidence: ORD-01/ORD-24 — every order test mocks @/lib/supabase/admin; grant defect invisible to 500 green tests (supabase-migrations)
- last seen: 2026-07-28T03:48:47Z

### L-004 — Verify an assumption about database default privileges by introspecting pg_default_acl before writing revokes or grants based on it.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `supabase-migrations` · harmful: 0
- features: captura-de-pedidos
- evidence: supabase/migrations/20260727000000_orders.sql:66-72 SPEC_DEVIATION claims default privileges grant everything to anon/authenticated; pg_default_acl shows only Dxtm (supabase-migrations)
- last seen: 2026-07-28T03:48:47Z

### L-005 — Pin the exact currency string an AC expects in the spec, including thousands separator, before asserting a formatted money value.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-authoring` · harmful: 0
- features: captura-de-pedidos
- evidence: ORD-18 — DashboardClient.test.tsx:62 asserts 'R$ 1234,50'; spec only says 'formatada em reais' (spec-authoring)
- last seen: 2026-07-28T03:48:47Z

### L-006 — A privilege assertion for anon must cover column-level grants, not only has_table_privilege — a column grant leaves the table-level check false.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `supabase-migrations` · harmful: 0
- features: captura-de-pedidos
- evidence: .github/workflows/supabase-migrations-check.yml:64 (mutacao DB-1) (supabase-migrations)
- last seen: 2026-07-29T01:56:33Z

### L-007 — Pin in the spec the exact text of any label an end user reads before asserting that string in the suite.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-authoring` · harmful: 0
- features: captura-de-pedidos
- evidence: ORD-31.5 / ORD-32.1 (spec-authoring)
- last seen: 2026-07-29T01:56:33Z

### L-008 — Exercite campos opcionais do payload nos dois estados — ausente e null explícito — ao testar a camada que persiste, senão o coalescing para null fica sem cobertura.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `app/actions` · harmful: 0
- features: analytics-nativo
- evidence: app/actions/eventos.ts:69 (sensor mutation 2) (app/actions)
- last seen: 2026-07-30T21:47:21Z

### L-009 — Decida a precisão de exibição de um valor derivado na spec antes de travá-la em teste; caso contrário o teste vira a única fonte de verdade de um número que ninguém especificou.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `lib` · harmful: 0
- features: analytics-nativo
- evidence: lib/catalog-metrics.ts:29 / __tests__/catalog-metrics.test.ts:11 (lib)
- last seen: 2026-07-30T21:47:21Z

### L-010 — Uma AC cuja garantia é composicional entre dois módulos precisa de um teste que atravesse os dois, ou de nota explícita de que a cobertura é indireta.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `app/painel` · harmful: 0
- features: analytics-nativo
- evidence: ANL-19 / __tests__/DashboardPage.test.tsx:213 (app/painel)
- last seen: 2026-07-30T21:47:21Z

### L-011 — Quando um disparo de telemetria precisa ficar fora do try/catch do caminho crítico, proteja o call site mesmo que o helper já engula erros, e registre a redundância.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `app/[slug]` · harmful: 0
- features: analytics-nativo
- evidence: app/[slug]/use-catalogo.ts:23-38 SPEC_DEVIATION (app/[slug])
- last seen: 2026-07-30T21:47:21Z

### L-012 — Ao introduzir uma união discriminada, teste também a camada que DERIVA cada variante, não só a que a consome — asserte qual variante o produtor emitiu em cada caminho, inclusive no catch.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `server-components` · harmful: 0
- features: analytics-pro-only
- evidence: M6 — app/painel/page.tsx:52 (catch mapeia falha para blocked); validation.md Fix 1 (server-components)
- last seen: 2026-08-03T23:37:05Z

### L-013 — Um teste de caminho de erro que só prova 'a página renderizou e logou' não cobre o AC: asserte o texto/estado exato exibido e a ausência do estado concorrente.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: analytics-pro-only
- evidence: APO-11 — __tests__/DashboardPage.test.tsx:217-230 (teste de falha de leitura não assere o estado renderizado) (tests)
- last seen: 2026-08-03T23:37:13Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
