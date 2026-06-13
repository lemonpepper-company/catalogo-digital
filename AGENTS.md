# AGENTS.md — Catálogo Digital

Contexto inicial para agentes de IA trabalhando neste projeto.

## O que é este projeto

**Catálogo Digital** é um SaaS de assinatura para lojistas de moda criarem uma vitrine online premium e venderem via WhatsApp. Não há carrinho — o cliente clica "Comprar" e cai direto no WhatsApp do lojista com a mensagem do pedido pré-preenchida.

## Regras de arquitetura de código

- **Pages limpas** — arquivos `page.tsx` não contêm lógica; apenas compõem layout e passam props estáticas
- **Custom hooks** — toda lógica de estado, efeitos e derivações fica em hooks (`use-*.ts`); pages e componentes apenas consomem

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Superfícies, arquivos-chave, estado atual, roadmap de backend |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Regras de frontend, convenções de componentes, estilos, stack |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Paleta, tipografia, espaçamento, componentes, tokens CSS |
