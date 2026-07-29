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

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
