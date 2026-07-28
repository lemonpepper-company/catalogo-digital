-- custom_domain/custom_domain_verified não são sensíveis (um domínio próprio é
-- informação pública assim que o DNS existe) — diferente de plan/trial_ends_at
-- (achado MEDIA-03), este grant não reabre nenhuma proteção de segurança.
-- Necessário para o middleware resolver a loja pelo host da request usando o
-- mesmo cliente anon já usado no catálogo público (ver lib/supabase/server.ts).
grant select (custom_domain, custom_domain_verified) on public.stores to anon;
