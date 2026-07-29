-- Grants do `service_role` para a captura de pedidos.
--
-- Fato verificado no Postgres local (17.6) antes desta migration: o default ACL
-- do schema `public` deste projeto é criado pelo role `postgres` — que é quem roda
-- as migrations — e concede apenas `Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN)
-- a `anon`, `authenticated` e `service_role`:
--
--   pg_default_acl → postgres | public | r |
--     {postgres=arwdDxtm/postgres,anon=Dxtm/postgres,
--      authenticated=Dxtm/postgres,service_role=Dxtm/postgres}
--
-- Ou seja: tabela nova em `public` **não** herda nenhum DML para nenhum desses
-- papéis. `relacl` de `orders` depois de 20260727000000_orders.sql confirmava
-- `service_role=Dxtm/postgres` — sem SELECT/INSERT/DELETE. Resultado: a Server
-- Action `registrarPedido` (que usa a service role) morria na primeira query com
-- `permission denied for table stores` e nenhum pedido era gravado.
--
-- Aqui concedemos ao `service_role` exatamente o que `app/actions/pedidos.ts` usa,
-- e nada além disso. Em especial, nenhum UPDATE em `orders`: quem muda status é o
-- lojista autenticado (`grant update (status) ... to authenticated`, já concedido
-- na migration anterior). O lockdown do `anon` continua intacto — nenhum grant
-- para `anon` é adicionado aqui.

-- orders: SELECT (contagem anti-abuso e leitura do id inserido),
--         INSERT (upsert idempotente),
--         DELETE (rollback do pedido órfão quando o insert dos itens falha).
grant select, insert, delete on public.orders to service_role;

-- order_items: SELECT + INSERT (gravação dos itens do pedido).
grant select, insert on public.order_items to service_role;

-- Leituras que a captura faz para não confiar no cliente:
-- a loja pelo slug e o preço/nome do produto no banco.
grant select on public.stores   to service_role;
grant select on public.products to service_role;
