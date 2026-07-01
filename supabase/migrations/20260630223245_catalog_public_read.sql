-- Catálogo público: leitura anônima de produtos visíveis e categorias.
-- `stores` já tem leitura pública (ver 20260616031248_init_auth.sql).
-- Policies SELECT são permissivas (OR-ed): o dono continua enxergando tudo pela
-- policy "own store only"; estas apenas somam acesso público de leitura.

-- Produtos: público vê apenas ativos e em estoque (reforça a regra de ocultar esgotados no próprio RLS)
create policy "products: public active read" on public.products
  for select using (is_active = true and stock > 0);

-- Categorias: leitura pública (necessária para montar as pills do catálogo)
create policy "categories: public read" on public.categories
  for select using (true);

grant select on public.products   to anon;
grant select on public.categories to anon;
