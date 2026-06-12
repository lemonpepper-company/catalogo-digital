# Arquitetura — Catálogo Digital

## Duas superfícies

1. **Catálogo público** (`/catalogo`) — vitrine para o cliente final, mobile-first. Sempre público, sem login. Grid de produtos + filtro por categoria + detalhe do produto com seleção de variação.

2. **Painel do lojista** (`/painel`) — área administrativa desktop-first. Dashboard, Produtos (listagem/cadastro/edição), Categorias, Configurações.

## Arquivos importantes

| Arquivo | Propósito |
|---|---|
| `lib/data.ts` | Mock data (STORE, PRODUCTS) |
| `lib/types.ts` | Tipos TypeScript do domínio |
| `lib/utils.ts` | parsePrice, formatMoney, buildWhatsAppMessage |
| `app/globals.css` | Tokens CSS como custom properties |
| `tailwind.config.ts` | Mapeamento dos tokens para classes Tailwind |
| `components/ui/` | Primitivos reutilizáveis (Button, Badge, Pill, Input, Switch…) |
| `docs/DESIGN_SYSTEM.md` | Design system completo |

## Estado atual

- Toda navegação é **mockada** — dados de `lib/data.ts`, sem backend
- Sem autenticação real — login/cadastro redirecionam direto ao painel
- Toasts, modais e toggles funcionam com React state local
- Backend será implementado em etapa posterior

## Ao implementar o backend

Substitua os dados de `lib/data.ts` por chamadas de API (Server Components, Route Handlers ou Server Actions). A tipagem em `lib/types.ts` já representa o contrato esperado.
