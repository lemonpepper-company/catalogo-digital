# AGENTS.md — Catálogo Digital

Contexto inicial para agentes de IA trabalhando neste projeto.

## O que é este projeto

**Catálogo Digital** é um SaaS de assinatura para lojistas de moda criarem uma vitrine online premium e venderem via WhatsApp. Não há carrinho — o cliente clica "Comprar" e cai direto no WhatsApp do lojista com a mensagem do pedido pré-preenchida.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Superfícies, arquivos-chave, estado atual, roadmap de backend |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Regras de frontend, convenções de componentes, estilos, stack |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Paleta, tipografia, espaçamento, componentes, tokens CSS |

## Cuidados críticos

- **Coluna pública em `stores` → atualizar o GRANT do `anon`.** Ao adicionar uma coluna lida pelo catálogo público (`STORE_COLS` em `lib/server/catalog.ts`), crie também uma migration `grant select (nova_coluna) on public.stores to anon`. No Postgres colunas novas não herdam grant por coluna → sem isso a vitrine `/{slug}` dá 404. Detalhe em [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) (seção Supabase).

- **`orders` / `order_items` nunca recebem grant para `anon` — o inverso do cuidado acima.** As duas tabelas são fechadas para o papel `anon` (`revoke all`, nenhuma policy) e `authenticated` só tem `select` + `update (status)` em `orders`: o lojista lê os pedidos da própria loja e nada mais. **Toda escrita passa pela service role** (`lib/supabase/admin.ts`, `import "server-only"`), dentro da Server Action `registrarPedido`, que valida o payload e recalcula preço e total a partir de `products.price_cents`. Conceder qualquer privilégio ao `anon` — ou aceitar valor monetário do cliente — abriria a injeção de pedido falso e poluiria o histórico e o faturamento do painel. `SUPABASE_SERVICE_ROLE_KEY` jamais pode virar `NEXT_PUBLIC_*` nem ser logada.
