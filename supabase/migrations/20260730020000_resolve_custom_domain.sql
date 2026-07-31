-- O middleware precisa do plano efetivo para decidir se o domínio próprio ainda
-- resolve, mas o anon não tem select em plan/trial_ends_at (20260709000000) —
-- mesma restrição que motivou get_effective_plan. Esta função repete aquele
-- padrão: security definer, o anon ganha EXECUTE aqui e nada nas colunas.
--
-- Devolve tudo o que o middleware precisa numa chamada só. A alternativa
-- (select de id + rpc get_effective_plan) colocaria duas round-trips no caminho
-- crítico de todo request de domínio próprio, antes de qualquer byte de HTML.
--
-- Devolve o plano CRU já resolvido pela regra de expiração — quem decide se
-- aquele plano inclui domínio próprio é getPlanLimits em lib/plan-limits.ts.
-- Nada de 'pro' hardcoded aqui: o dia que o recurso mudar de plano, o banco não
-- muda.
--
-- Os nomes de saída são prefixados (store_slug/domain_verified) para não
-- colidirem com as colunas homônimas de public.stores dentro do corpo.
create or replace function public.resolve_custom_domain(p_hostname text)
returns table (
  store_slug text,
  domain_verified boolean,
  effective_plan text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.slug,
    s.custom_domain_verified,
    case
      when s.plan <> 'free' and s.trial_ends_at is not null and s.trial_ends_at <= now()
      then 'free'
      else s.plan
    end
  from public.stores s
  where s.custom_domain = p_hostname;
$$;

grant execute on function public.resolve_custom_domain(text) to anon;
