-- Downgrade só vale na virada do ciclo: a loja segue no plano pago até
-- plan_expires_at e só então cai para o plano menor. A Spec 2A modelou o plano
-- EM VIGOR, não uma mudança futura — sem esta coluna o downgrade não é
-- expressável. Gravar plan na hora do pedido derrubaria o acesso que o lojista
-- já pagou (getEffectivePlan devolve plan enquanto a data não vence); não
-- gravar nada deixaria o webhook do próximo ciclo sem saber que o plano mudou.
--
-- A alternativa descartada foi o webhook deduzir o plano pelo `value` da
-- cobrança: funciona, mas amarra a resolução de plano à tabela de preços, e
-- mudar R$ 59,90 no futuro quebraria a promoção de plano de todo mundo com o
-- sintoma aparecendo longe da causa.
alter table public.stores
  add column pending_plan text
    check (pending_plan in ('free', 'starter', 'pro'));

-- Mesma regra das colunas de assinatura (20260801000000): só o webhook escreve,
-- e ele roda com service_role. authenticated/anon não recebem nada — o grant de
-- authenticated é allowlist nominal (20260728110000) e o select do anon é por
-- coluna (20260709000000), então a coluna já nasce inacessível para os dois.
grant update (pending_plan) on public.stores to service_role;
