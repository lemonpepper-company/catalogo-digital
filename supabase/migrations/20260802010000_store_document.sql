-- CPF ou CNPJ do lojista, só dígitos. Exigido pelo Asaas em POST /v3/customers,
-- que é o caminho do Pix (no cartão, o checkout hospedado coleta na tela deles).
--
-- Opcional: quem cria a loja para experimentar não é barrado por um formulário
-- maior. A coleta obrigatória acontece na modal, no momento de assinar.
alter table public.stores add column document text;

-- Ao contrário das colunas de plano, esta ENTRA no grant de authenticated: é
-- dado de identidade da própria loja, da mesma natureza de name e whatsapp, e
-- exigir service_role para uma edição de perfil seria desproporcional. O risco
-- que o grant restrito de 20260728110000 existe para conter é auto-promoção de
-- plano — document não concede acesso a nada.
grant insert (document), update (document) on public.stores to authenticated;
