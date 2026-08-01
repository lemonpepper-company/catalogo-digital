-- Substitui o trial_ends_at sobrecarregado (trial de 14 dias → "liberação
-- manual expira em" → seria também "fim do período pago" e "fim da graça")
-- por um modelo explícito. A coluna antiga sai na migration seguinte, depois
-- que o TypeScript migrar — nada aqui a remove.
--
-- Vocabulário de subscription_status é NOSSO, não o do Asaas: a tradução dos
-- eventos do gateway acontece num único ponto do webhook (Spec 2B). Sem
-- estado 'expired': expiração é comparação de data, e um estado que precisa
-- de job agendado para ficar correto é um estado que vai ficar errado.
alter table public.stores
  add column plan_expires_at timestamptz,
  add column subscription_status text
    check (subscription_status in ('active', 'past_due', 'canceled')),
  add column billing_cycle text
    check (billing_cycle in ('monthly', 'annual')),
  add column asaas_customer_id text,
  add column asaas_subscription_id text;

-- DUAS funções replicam a regra de expiração. Ambas precisam migrar ANTES do
-- drop da coluna antiga: Postgres não rastreia dependências dentro do corpo
-- de funções SQL, então o drop passaria sem erro e a quebra só apareceria em
-- runtime.

-- 1/2 — vitrine por slug. Continua devolvendo o plano JÁ resolvido, nunca
-- plan/plan_expires_at crus: o anon tem EXECUTE aqui e nada nas colunas.
create or replace function public.get_effective_plan(p_store_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when s.plan <> 'free'
        and s.plan_expires_at is not null
        and s.plan_expires_at <= now()
      then 'free'
      else s.plan
    end
  from public.stores s
  where s.id = p_store_id;
$$;

-- 2/2 — vitrine por domínio próprio. Esta é a que falha em SILÊNCIO se for
-- esquecida: o middleware faz fail-open, então o visitante veria a landing da
-- Vtrine no domínio do lojista, sem 500 e sem alarme.
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
      when s.plan <> 'free'
        and s.plan_expires_at is not null
        and s.plan_expires_at <= now()
      then 'free'
      else s.plan
    end
  from public.stores s
  where s.custom_domain = p_hostname;
$$;

-- O webhook (Spec 2B) roda com service_role, que hoje só tem update em
-- (plan, trial_ends_at) e (custom_domain, custom_domain_verified). Sem este
-- grant a escrita falha com "permission denied for table stores" — e, como
-- toda a suíte mocka o Supabase, a suíte fica verde. É o cuidado crítico do
-- AGENTS.md.
--
-- authenticated e anon NÃO recebem nada: o grant de authenticated é uma
-- allowlist nominal (20260728110000) e o select do anon é por coluna
-- (20260709000000), então as colunas novas já nascem inacessíveis para os
-- dois. Adicionar qualquer uma delas àqueles grants reabriria a
-- auto-promoção a Pro via PostgREST.
grant update (
  plan_expires_at,
  subscription_status,
  billing_cycle,
  asaas_customer_id,
  asaas_subscription_id
) on public.stores to service_role;
