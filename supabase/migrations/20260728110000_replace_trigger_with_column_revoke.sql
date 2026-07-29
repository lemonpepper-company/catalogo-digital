-- Substitui a trigger stores_enforce_admin_only_columns (20260728100000) por
-- um controle declarativo de colunas via GRANT/REVOKE, agora que existe um
-- client service_role dedicado (lib/supabase/admin.ts, já usado pela captura
-- de pedidos) para as escritas admin-only.
--
-- A trigger precisava de um caso especial pra reconhecer acesso via SQL
-- direto/Studio (auth.role() is null) e não se autobloquear — foi assim que
-- um bug de NULL-handling na primeira versão chegou a bloquear a própria
-- ativação manual. GRANT/REVOKE não tem esse problema: superusuário/dono da
-- tabela ignora ACL por definição do Postgres, então a ativação manual
-- continua funcionando sem nenhuma lógica condicional. E uma tentativa
-- indevida agora falha alto (permission denied), não silenciosamente sem
-- efeito.
--
-- Postgres não permite "revogar só uma coluna" de um GRANT tabela-inteira —
-- um REVOKE em coluna específica não subtrai de um GRANT já concedido na
-- tabela toda (a coluna continua liberada pelo grant mais amplo). Por isso o
-- padrão correto é revogar o grant tabela-inteira de authenticated e
-- reconceder explicitamente só as colunas que os fluxos atuais do app
-- realmente escrevem (auditado em app/actions/store.ts e app/actions/auth.ts
-- nesta data).
--
-- plan/trial_ends_at/custom_domain_verified saem de vez do alcance de
-- authenticated: liberação de plano é sempre manual (Studio/SQL direto, ou
-- futuramente uma rota de servidor com service_role); custom_domain_verified
-- idem. custom_domain também sai — updateCustomDomain migrou para o client
-- service_role (app/actions/store.ts), porque a escrita de custom_domain e o
-- reset de custom_domain_verified=false acontecem no mesmo update.

drop trigger if exists stores_enforce_admin_only_columns on public.stores;
drop function if exists public.enforce_admin_only_store_columns();

-- Novas lojas nascem 'free' sem que o insert precise (ou consiga) informar a
-- coluna — trial_ends_at já é nullable sem default (correto: nasce null) e
-- custom_domain_verified já tem default false (20260725110000).
alter table public.stores alter column plan set default 'free';

revoke insert, update on public.stores from authenticated;

-- Insert de cadastro (app/actions/auth.ts): dados de identidade da loja nova.
grant insert (
  owner_id, name, slug, whatsapp, monogram, description, instagram,
  accent_color, payment_methods, delivery_methods
) on public.stores to authenticated;

-- Update de Configurações (identidade + integrações) e de Personalização
-- (app/actions/store.ts): nenhuma coluna admin-only nesta lista.
grant update (
  name, whatsapp, description, monogram, instagram, payment_methods,
  delivery_methods, analytics_id, pixel_id, message_template, logo_url,
  accent_color, cover_url, font_pairing, background_palette, corner_style,
  secondary_color, grid_density
) on public.stores to authenticated;

-- updateCustomDomain (app/actions/store.ts) passou a rodar com o client
-- service_role — a propriedade da loja já foi confirmada antes via
-- getCurrentStore() (RLS), então este grant é seguro mesmo sem RLS ativa
-- para o service_role.
grant update (custom_domain, custom_domain_verified) on public.stores to service_role;
