-- font_pairing/background_palette/corner_style/secondary_color/grid_density:
-- lidos pelo catálogo público para decidir o tema efetivo. NÃO inclui
-- plan/trial_ends_at — essas colunas foram deliberadamente removidas do
-- grant do anon em 20260709000000_restringe_colunas_publicas_stores.sql
-- (achado de segurança MEDIA-03). O plano efetivo é obtido via a função
-- get_effective_plan (Step 3), não por leitura direta das colunas.
grant select (font_pairing, background_palette, corner_style, secondary_color, grid_density) on public.stores to anon;
grant select (is_featured) on public.products to anon;
