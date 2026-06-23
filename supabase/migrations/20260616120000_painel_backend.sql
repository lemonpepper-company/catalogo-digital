-- Painel backend: produtos, categorias, ajustes da loja e Storage

-- 1. Ajustes da loja (1:1 em stores)
alter table public.stores
  add column whatsapp         text,
  add column accent_color     text default '#C9A96E',
  add column logo_url         text,
  add column description      text,
  add column monogram         text,
  add column analytics_id     text,
  add column pixel_id         text,
  add column message_template text;

-- 2. Categorias
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null,
  position   int default 0,
  created_at timestamptz default now(),
  unique (store_id, name)
);

-- 3. Produtos
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  name        text not null,
  price_cents int not null,
  description text,
  category_id uuid references public.categories(id) on delete restrict,
  sizes       text[] default '{}',
  sold_sizes  text[] default '{}',
  colors      jsonb default '[]',
  images      text[] default '{}',
  stock       int default 0,
  is_active   boolean default true,
  is_new      boolean default false,
  created_at  timestamptz default now()
);

create index categories_store_id_idx on public.categories(store_id);
create index products_store_id_idx   on public.products(store_id);
create index products_category_id_idx on public.products(category_id);

-- 4. RLS — own store only
alter table public.categories enable row level security;
alter table public.products enable row level security;

create policy "categories: own store only" on public.categories for all
  using (exists (
    select 1 from public.stores s
    where s.id = categories.store_id and s.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.stores s
    where s.id = categories.store_id and s.owner_id = auth.uid()));

create policy "products: own store only" on public.products for all
  using (exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = auth.uid()));

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.products   to authenticated;

-- 5. Storage — bucket público, escrita só do dono na pasta da própria loja
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images: public read" on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product-images: owner insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(objects.name))[1] and s.owner_id = auth.uid()));

create policy "product-images: owner update" on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(objects.name))[1] and s.owner_id = auth.uid()));

create policy "product-images: owner delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(objects.name))[1] and s.owner_id = auth.uid()));
