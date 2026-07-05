-- Catálogo público deve mostrar produtos esgotados (desabilitados na UI),
-- não escondê-los. Only is_active continua controlando a visibilidade.
drop policy "products: public active read" on public.products;

create policy "products: public active read" on public.products
  for select using (is_active = true);
