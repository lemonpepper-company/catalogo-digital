-- MEDIA-03 (relatório de segurança 06/07/2026): a policy "stores: slug lookup
-- public" (using (true)) permite ao papel `anon` ler TODAS as colunas de
-- `stores` via PostgREST direto, incluindo owner_id/plan/trial_ends_at — dados
-- internos que o app nunca expõe no catálogo público (ver STORE_COLS em
-- lib/server/catalog.ts). Mantemos a policy de linha como está (is_active=false
-- também precisa ficar visível: é o que sustenta o estado "loja pausada" em
-- lib/catalog.ts:resolveCatalog — só restringimos as colunas via GRANT.
revoke select on public.stores from anon;

grant select (
  id, name, slug, is_active, whatsapp, accent_color, logo_url, description,
  monogram, analytics_id, pixel_id, message_template, instagram,
  payment_methods, delivery_methods
) on public.stores to anon;
