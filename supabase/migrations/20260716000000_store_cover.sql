-- Capa da vitrine pública: imagem promocional exibida na página de listagem.
-- Nullable, sem default. Upload usa o bucket product-images em {store_id}/cover/*.
alter table stores add column cover_url text;
