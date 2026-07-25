-- Adiciona 'free' como valor válido de stores.plan. Lojas existentes (todas em
-- plan='starter', trial_ends_at=null do modo demo) não são afetadas — o
-- default de novas lojas passa a ser 'free' na aplicação (app/actions/auth.ts),
-- não no banco.
alter table public.stores
  drop constraint if exists stores_plan_check;

alter table public.stores
  add constraint stores_plan_check check (plan in ('free', 'starter', 'pro'));
