-- Código curto do pedido (ORD-32): 6 caracteres [0-9A-Z] derivados do
-- client_order_id no cliente, antes de qualquer ida ao servidor — a mensagem do
-- WhatsApp nunca depende da resposta da gravação (AD-008).
--
-- `code` é NOT NULL: a derivação é determinística e o backfill abaixo cobre 100%
-- das linhas existentes (client_order_id já é NOT NULL), então a coluna nunca
-- precisa aceitar ausência de código.
--
-- Nenhum GRANT novo: os grants de `orders` são de tabela
-- (`grant select on public.orders to authenticated` em 20260727000000_orders.sql,
-- `grant select, insert, delete ... to service_role` em 20260728000000), e grant
-- de tabela vale para colunas futuras. O caso que exige migration de grant é o
-- grant *por coluna* de `stores` para `anon` (docs/CONVENTIONS.md → Supabase).

alter table public.orders add column code text;

-- Backfill com a mesma regra de `deriveOrderCode` (lib/orders.ts): 6 blocos de 5
-- dígitos hex do uuid, cada bloco mod 36 indexando o alfabeto [0-9A-Z].
-- `'x000' || <5 hex>` = 8 dígitos hex = os 32 bits que bit(32)::int aceita, com
-- os 12 bits altos zerados (sem risco de valor negativo).
update public.orders
set code = (
  select string_agg(
    substr(
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      (('x000' || substr(replace(client_order_id::text, '-', ''), 1 + i * 5, 5))::bit(32)::int % 36) + 1,
      1
    ),
    '' order by i
  )
  from generate_series(0, 5) as g(i)
)
where code is null;

alter table public.orders alter column code set not null;

-- Busca do lojista por código, sempre dentro da própria loja (ORD-35).
create index orders_store_code_idx on public.orders(store_id, code);
