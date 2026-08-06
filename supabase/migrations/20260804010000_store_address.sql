-- Endereço do lojista. Exigido pelo Asaas no checkout hospedado de cartão
-- quando o customer é passado por id em vez de customerData — confirmado ao
-- vivo no sandbox: POST /v3/checkouts recusa com "campo X deve existir para
-- o customer informado" para address, addressNumber, postalCode, province e
-- city, todos de uma vez. O Pix não passa por esse endpoint e não exige nada
-- disso (só name+cpfCnpj no POST /v3/subscriptions).
--
-- Opcional na criação da loja pelo mesmo motivo do document: só é cobrado no
-- momento de assinar via cartão, numa modal (CEP + número, o resto vem do
-- ViaCEP).
alter table public.stores
  add column address text,
  add column address_number text,
  add column address_province text,
  add column address_city text,
  add column address_postal_code text;

-- Mesma justificativa do document (20260802010000): dado de identidade da
-- própria loja, não de plano — entra no grant de authenticated.
grant
  insert (address, address_number, address_province, address_city, address_postal_code),
  update (address, address_number, address_province, address_city, address_postal_code)
on public.stores to authenticated;
