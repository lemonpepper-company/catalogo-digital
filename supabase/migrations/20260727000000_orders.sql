-- Captura de pedidos: orders + order_items
--
-- O pedido é gravado por uma Server Action pública usando a service role
-- (que ignora RLS). Nenhum papel do PostgREST recebe insert: o lojista só lê
-- e só altera a coluna status; o anon não enxerga nada.

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores(id) on delete cascade,
  client_order_id  uuid not null,
  customer_name    text,
  payment_method   text,
  delivery_method  text,
  delivery_address text,
  items_count      int  not null,
  total_cents      int  not null,
  status           text not null default 'pendente'
                     check (status in ('pendente', 'confirmado', 'cancelado')),
  created_at       timestamptz default now(),
  unique (store_id, client_order_id)
);

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  product_name     text not null,
  unit_price_cents int  not null,
  qty              int  not null check (qty between 1 and 99),
  size             text,
  color            text,
  created_at       timestamptz default now()
);

create index orders_store_created_idx on public.orders(store_id, created_at desc);
create index orders_store_status_idx  on public.orders(store_id, status);
create index order_items_order_id_idx on public.order_items(order_id);

-- RLS — own store only
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Policies escopadas a authenticated (lição da migration 20260713230000:
-- policy sem "TO" também vale para anon e faz o Postgres tentar ler
-- stores.owner_id como anon → permission denied em vez de simplesmente
-- ocultar as linhas).
create policy "orders: own store read" on public.orders for select to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = orders.store_id and s.owner_id = auth.uid()));

create policy "orders: own store status update" on public.orders for update to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = orders.store_id and s.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.stores s
    where s.id = orders.store_id and s.owner_id = auth.uid()));

create policy "order_items: own store read" on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_items.order_id and s.owner_id = auth.uid()));

-- SPEC_DEVIATION: design.md lista apenas "revoke all ... from anon"; aqui também
-- revogamos de authenticated antes dos grants.
-- Reason: as default privileges do schema public concedem TUDO a anon e a
-- authenticated em tabelas novas. Sem o revoke de authenticated, o lojista
-- manteria insert/delete/update irrestrito via PostgREST — o oposto do que o
-- próprio design exige ("nenhum insert é concedido a authenticated ou anon" e
-- "lojista não consegue alterar total/itens nem via PostgREST direto").
revoke all on public.orders      from anon;
revoke all on public.order_items from anon;
revoke all on public.orders      from authenticated;
revoke all on public.order_items from authenticated;

grant select on public.orders            to authenticated;
grant update (status) on public.orders   to authenticated;  -- lojista só muda status
grant select on public.order_items       to authenticated;
