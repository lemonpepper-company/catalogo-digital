-- Analytics nativo: funções de leitura das métricas do catálogo.
--
-- Agregação no banco porque `count(distinct visitor_id)` do período é a única
-- forma correta de contar visitantes únicos: somar "únicos por dia" superconta
-- (o mesmo visitante em N dias contaria N vezes).
--
-- SEGURANÇA — `security invoker` (default, explicitado aqui): a RLS de
-- `catalog_events` continua valendo dentro da função, então o lojista
-- autenticado só agrega a própria loja mesmo se passar um `p_store_id` alheio
-- (nesse caso a policy own-store filtra tudo e o retorno é zerado).
--
-- Uma função nova herda `EXECUTE` para `PUBLIC` por default — o análogo
-- funcional do problema de default ACL que derrubou a captura de pedidos. Por
-- isso o `revoke execute ... from public, anon` abaixo é obrigatório.
--
-- `p_from`/`p_to` são ANULÁVEIS: o filtro de período do painel tem presets com
-- início e fim ("hoje"), presets só com início, ranges customizados e "tudo"
-- (sem filtro de data) — `null` em qualquer lado desliga aquele lado do
-- predicado.

create or replace function public.get_catalog_metrics(
  p_store_id uuid,
  p_from     timestamptz,
  p_to       timestamptz
)
returns table (
  visits          bigint,
  unique_visitors bigint,
  buy_clicks      bigint,
  bag_visitors    bigint
)
language sql
stable
security invoker
as $$
  select
    count(*) filter (where e.event_type = 'catalog_visit')                      as visits,
    count(distinct e.visitor_id) filter (where e.event_type = 'catalog_visit')  as unique_visitors,
    count(*) filter (where e.event_type = 'buy_click')                          as buy_clicks,
    count(distinct e.visitor_id) filter (where e.event_type = 'add_to_bag')     as bag_visitors
  from public.catalog_events e
  where e.store_id = p_store_id
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to   is null or e.occurred_at <= p_to);
$$;

create or replace function public.get_top_viewed_products(
  p_store_id uuid,
  p_from     timestamptz,
  p_to       timestamptz,
  p_limit    int default 5
)
returns table (
  product_id uuid,
  views      bigint
)
language sql
stable
security invoker
as $$
  select e.product_id, count(*) as views
  from public.catalog_events e
  where e.store_id = p_store_id
    and e.event_type = 'product_view'
    and e.product_id is not null
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to   is null or e.occurred_at <= p_to)
  group by e.product_id
  order by count(*) desc
  limit p_limit;
$$;

revoke execute on function public.get_catalog_metrics(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.get_top_viewed_products(uuid, timestamptz, timestamptz, int) from public, anon;

grant execute on function public.get_catalog_metrics(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.get_top_viewed_products(uuid, timestamptz, timestamptz, int) to authenticated, service_role;
