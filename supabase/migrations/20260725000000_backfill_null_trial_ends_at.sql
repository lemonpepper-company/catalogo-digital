-- Corrige lojas criadas antes do modo demo (migração 20260702000000), que
-- ficaram com um trial_ends_at real do antigo sistema de trial de 14 dias.
-- A partir de lib/plan-limits.ts (getEffectivePlan), qualquer trial_ends_at
-- no passado num plano pago é interpretado como "liberação manual expirada"
-- e rebaixa a loja para os limites do Free — o que não é a intenção para
-- essas lojas antigas, cujo trial_ends_at nunca representou uma liberação
-- manual. Como nenhuma loja tem hoje uma liberação manual real com prazo
-- intencional, é seguro zerar trial_ends_at de todas.
update public.stores
set trial_ends_at = null
where trial_ends_at is not null;
