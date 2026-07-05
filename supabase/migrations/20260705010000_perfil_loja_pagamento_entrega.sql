-- Perfil social da loja (Instagram) e formas de pagamento/entrega configuráveis.
-- Arrays vazios por padrão: lojas existentes mantêm o checkout sem seletor até
-- o lojista habilitar manualmente ao menos uma opção de cada grupo.
alter table public.stores
  add column instagram text,
  add column payment_methods text[] not null default '{}',
  add column delivery_methods text[] not null default '{}';
