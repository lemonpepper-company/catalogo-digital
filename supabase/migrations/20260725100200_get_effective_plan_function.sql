-- Replica só a regra de expiração de lib/plan-limits.ts:getEffectivePlan() —
-- devolve o plano JÁ RESOLVIDO ('free'/'starter'/'pro'), nunca trial_ends_at
-- cru. security definer: roda com o dono da function (bypassa o grant restrito
-- do anon só para esta leitura pontual e específica), então o anon ganha
-- EXECUTE na função, não SELECT nas colunas plan/trial_ends_at.
create or replace function public.get_effective_plan(p_store_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when s.plan <> 'free' and s.trial_ends_at is not null and s.trial_ends_at <= now()
      then 'free'
      else s.plan
    end
  from public.stores s
  where s.id = p_store_id;
$$;

grant execute on function public.get_effective_plan(uuid) to anon;
