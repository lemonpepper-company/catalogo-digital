# AGENTS.md — Catálogo Digital

Contexto inicial para agentes de IA trabalhando neste projeto.

## O que é este projeto

**Catálogo Digital** é um SaaS de assinatura para lojistas de moda criarem uma vitrine online premium e venderem via WhatsApp. Não há carrinho — o cliente clica "Comprar" e cai direto no WhatsApp do lojista com a mensagem do pedido pré-preenchida.

## Duas superfícies

1. **Catálogo público** (`/catalogo`) — vitrine para o cliente final, mobile-first. Sempre público, sem login. Grid de produtos + filtro por categoria + detalhe do produto com seleção de variação.

2. **Painel do lojista** (`/painel`) — área administrativa desktop-first. Dashboard, Produtos (listagem/cadastro/edição), Categorias, Configurações.

## Stack

- Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind CSS v3
- Node.js 20.9+
- Sem CSS Modules, sem styled-components
- Lucide React para ícones (outline, ~2px stroke)
- Vitest + Testing Library para testes unitários

## Estado atual

- Toda navegação é **mockada** — dados de `lib/data.ts`, sem backend
- Sem autenticação real — login/cadastro redirecionam direto ao painel
- Toasts, modais e toggles funcionam com React state local
- Backend será implementado em etapa posterior

## Convenções de código

- Componentes Server por padrão; `"use client"` apenas onde há interatividade
- Sem comentários no código exceto para lógica não-óbvia
- Tailwind para todo estilo — nunca CSS inline para valores que têm token
- Cores e espaçamentos sempre pelos tokens definidos em `tailwind.config.ts` e `app/globals.css`
- Sem box-shadow em lugar nenhum — elevação via cor de superfície (linen sobre ivory)
- Transições máximo 200ms ease

## Design system

**Tema: Bold Minimal Premium.** Veja `app/globals.css` para tokens completos.

Cores críticas:
- `obsidian (#0D0D0D)` — botões primários, headings
- `gold (#C9A96E)` — único accent; reservado ao CTA de compra via WhatsApp
- `ivory (#F9F9F7)` — background geral
- `linen (#F0EDE8)` — cards, inputs, superfícies secundárias

Tipografia: **Sora** (display/600/500) + **DM Sans** (body/400/500)

## Arquivos importantes

| Arquivo | Propósito |
|---|---|
| `lib/data.ts` | Mock data (STORE, PRODUCTS) |
| `lib/types.ts` | Tipos TypeScript do domínio |
| `lib/utils.ts` | parsePrice, formatMoney, buildWhatsAppMessage |
| `app/globals.css` | Tokens CSS como custom properties |
| `tailwind.config.ts` | Mapeamento dos tokens para classes Tailwind |
| `components/ui/` | Primitivos reutilizáveis (Button, Badge, Pill, Input, Switch…) |

## Ao implementar o backend

Substitua os dados de `lib/data.ts` por chamadas de API (Server Components, Route Handlers ou Server Actions). A tipagem em `lib/types.ts` já representa o contrato esperado.
