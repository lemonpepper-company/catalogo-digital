-- Modo demo: lojas cadastradas passam a nascer no plano Pro, sem data de
-- expiração (trial_ends_at nulo = indeterminado). Preços/checkout ficam fora
-- do fluxo de cadastro por enquanto.
alter table public.stores alter column trial_ends_at drop not null;
