-- Achado da revisão final do plano "Domínio Próprio": authenticated tinha
-- insert/update irrestrito em todas as colunas de stores (grant original de
-- 20260616031248_init_auth.sql) — a RLS "own store only" restringe por LINHA
-- (owner_id = auth.uid()), não por COLUNA. Isso permitia a qualquer lojista
-- autenticado gravar plan='pro' e/ou custom_domain_verified=true na própria
-- loja via chamada direta ao PostgREST, pulando tanto o gate de Pro quanto a
-- regra de ativação sempre-manual (feita por humano, direto no Supabase,
-- nunca por código). Este trigger neutraliza qualquer tentativa de escrita
-- nessas três colunas vinda do PostgREST (authenticated/anon), sem afetar
-- escritas via SQL direto/Studio/service_role — o único caminho sancionado
-- para liberar plano ou verificar domínio.
create or replace function public.enforce_admin_only_store_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan := 'free';
      new.trial_ends_at := null;
      new.custom_domain_verified := false;
    elsif tg_op = 'UPDATE' then
      new.plan := old.plan;
      new.trial_ends_at := old.trial_ends_at;
      new.custom_domain_verified := old.custom_domain_verified and new.custom_domain_verified;
    end if;
  end if;

  return new;
end;
$$;

create trigger stores_enforce_admin_only_columns
  before insert or update on public.stores
  for each row execute function public.enforce_admin_only_store_columns();
