-- As policies "products: own store only" e "categories: own store only" usam
-- USING (exists (select 1 from stores s where s.id = ... and s.owner_id = auth.uid()))
-- e, por padrão, se aplicam a QUALQUER role (inclusive anon), já que foram
-- criadas sem "TO authenticated" (ver 20260616120000_painel_backend.sql).
--
-- A migration 20260709000000_restringe_colunas_publicas_stores.sql revogou o
-- select genérico do anon em public.stores, concedendo apenas 15 colunas —
-- sem incluir owner_id. Como o Postgres precisa ler stores.owner_id para
-- avaliar essa policy (mesmo sabendo que vai dar false para anon, já que
-- auth.uid() é null), toda leitura anônima de products/categories passou a
-- falhar com "permission denied for table stores" em vez de simplesmente
-- ocultar as linhas. Resultado real: catálogo público sempre vazio, para
-- qualquer loja, mesmo com produtos ativos — não era um problema de cache.
--
-- Fix: restringe as policies "own store only" à role authenticated, a única
-- que de fato precisa delas (dono de loja autenticado gerenciando seus
-- produtos/categorias). A leitura pública continua coberta pelas policies
-- "products: public active read" e "categories: public read".
alter policy "products: own store only" on public.products to authenticated;
alter policy "categories: own store only" on public.categories to authenticated;
