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
