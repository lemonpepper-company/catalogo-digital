-- Analytics nativo: catalog_events
--
-- Eventos do catálogo público (visita, view de produto, adição à sacola, clique
-- em comprar). A escrita é feita por uma Server Action pública usando a service
-- role (que ignora RLS) — mesmo padrão de `orders` (AD-007/AD-012). O `anon`
-- nunca recebe privilégio algum aqui; o lojista autenticado só lê a própria loja.
--
-- Lição de 20260728000000_orders_service_role_grants.sql: o default ACL do schema
-- `public` deste projeto concede apenas `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/
-- MAINTAIN) a anon/authenticated/service_role → tabela nova NÃO herda DML para
-- ninguém. Por isso o `grant select, insert ... to service_role` abaixo vive na
-- própria migration da tabela: sem ele a Server Action falha com
-- `permission denied for table catalog_events` e a suíte (que mocka o Supabase)
-- fica verde mesmo assim.
--
-- Zero PII: nenhum IP, user-agent ou identificador de pessoa — apenas um
-- `visitor_id` UUID anônimo gerado no client (ANL-06).

create table public.catalog_events (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  event_type  text not null check (event_type in
                ('catalog_visit', 'product_view', 'add_to_bag', 'buy_click')),
  product_id  uuid references public.products(id) on delete set null,
  visitor_id  uuid not null,
  occurred_at timestamptz not null default now()
);

create index catalog_events_store_time_idx
  on public.catalog_events (store_id, occurred_at desc);
create index catalog_events_store_type_time_idx
  on public.catalog_events (store_id, event_type, occurred_at desc);
create index catalog_events_product_idx
  on public.catalog_events (store_id, product_id)
  where product_id is not null;

-- RLS — own store only
alter table public.catalog_events enable row level security;

-- Policy escopada a authenticated (lição da migration 20260713230000: policy sem
-- "TO" também vale para anon e faz o Postgres tentar ler stores.owner_id como
-- anon → permission denied em vez de simplesmente ocultar as linhas).
create policy "catalog_events: own store read" on public.catalog_events for select to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = catalog_events.store_id and s.owner_id = auth.uid()));

-- Estado final explícito de privilégios (defesa em profundidade: independe do
-- que as default privileges tenham concedido).
revoke all on public.catalog_events from anon;
revoke all on public.catalog_events from authenticated;

-- Lojista autenticado: só leitura, filtrada pela policy own-store acima.
grant select on public.catalog_events to authenticated;

-- Service role: leitura (agregações server-side futuras) + gravação do evento.
-- Nenhum UPDATE/DELETE — as linhas são imutáveis (append-only).
grant select, insert on public.catalog_events to service_role;
