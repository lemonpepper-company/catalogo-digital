# Catálogo Digital

SaaS de assinatura para lojistas de moda criarem uma vitrine online premium e converterem visitantes em compradores **via WhatsApp**. Não há carrinho: o WhatsApp é o checkout.

## Visão geral

O sistema tem duas superfícies:

| Superfície | Rota | Audiência |
|---|---|---|
| **Catálogo público (Vitrine)** | `/catalogo` | Cliente final — mobile-first |
| **Painel do lojista** | `/painel/**` | Lojista (B2B) — desktop-first |

### Tema visual

**Bold Minimal Premium.** Obsidian (`#0D0D0D`) como âncora, Gold Dust (`#C9A96E`) como único accent (reservado ao CTA de compra), neutros quentes Ivory/Linen, muito espaço em branco. Sem gradientes, sem box-shadow.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript** (strict mode)
- **Tailwind CSS v3** (sem CSS Modules nem styled-components)
- **Lucide React** (ícones outline)
- **Vitest + Testing Library** (testes unitários)

## Estrutura do projeto

```
app/
  landing/            # Landing page de marketing
  login/              # Login do lojista
  cadastro/           # Criação de conta
  planos/             # Página de planos
  catalogo/           # Vitrine pública (mobile-first)
  painel/
    page.tsx          # Dashboard
    produtos/         # Listagem, novo produto, edição
    categorias/       # Gestão de categorias
    configuracoes/    # Identidade, cor de destaque, integrações
components/
  ui/                 # Primitivos reutilizáveis (Button, Badge, Pill, Input…)
  catalogo/           # Componentes específicos da vitrine
  painel/             # Componentes específicos do painel
lib/
  data.ts             # Mock data (produtos, loja)
  types.ts            # Tipos TypeScript
  utils.ts            # parsePrice, formatMoney, buildWhatsAppMessage, cn
__tests__/            # Suíte de testes unitários
```

## Pré-requisitos

- Node.js 20.9+
- npm, yarn ou pnpm

## Instalação

```bash
npm install
```

## Executar em desenvolvimento

```bash
npm run dev
```

Acesse em [http://localhost:3000](http://localhost:3000). O root redireciona para `/landing`.

### Rotas principais

| Rota | Descrição |
|---|---|
| `/landing` | Landing page de marketing |
| `/catalogo` | Vitrine pública — Ateliê Mira (mock) |
| `/painel` | Dashboard do lojista |
| `/painel/produtos` | Listagem de produtos |
| `/painel/produtos/novo` | Cadastro de produto |
| `/painel/produtos/[id]` | Edição de produto |
| `/painel/categorias` | Gestão de categorias |
| `/painel/configuracoes` | Configurações da loja |
| `/login` | Tela de login |
| `/cadastro` | Tela de criação de conta |
| `/planos` | Planos de assinatura |

## Build de produção

```bash
npm run build
npm run start
```

## Testes

### Executar todos os testes

```bash
npm test
```

### Modo watch (interativo)

```bash
npm test -- --watch
```

### Interface visual (Vitest UI)

```bash
npm run test:ui
```

### Cobertura de código

```bash
npm run test:coverage
```

Os relatórios de cobertura são gerados em `coverage/`.

### O que está coberto

| Arquivo de teste | O que testa |
|---|---|
| `__tests__/utils.test.ts` | `parsePrice`, `formatMoney`, `buildWhatsAppMessage`, `cn` |
| `__tests__/Button.test.tsx` | Variantes, eventos, estado disabled |
| `__tests__/Pill.test.tsx` | Estado active/inactive, callbacks |
| `__tests__/data.test.ts` | Integridade dos dados mock (STORE, PRODUCTS) |

## Lint

```bash
npm run lint
```

## Navegação mockada

Toda a navegação está mockada. Não há chamadas de API reais — os dados são servidos por `lib/data.ts`. O backend será implementado posteriormente.

Comportamentos mockados:
- Login / cadastro: links navegam diretamente para `/painel`
- Salvar produto, configurações: exibe toast de sucesso sem persistência
- Excluir produto: remove do estado local (React state)
- Link do catálogo: usa `navigator.clipboard` para copiar
- Pedido via WhatsApp: abre `https://wa.me/...` real com a mensagem montada

## Design tokens

Os tokens ficam em `app/globals.css` como variáveis CSS. O `tailwind.config.ts` mapeia as mesmas cores e espaçamentos como classes utilitárias.

Cores principais:

| Token | Valor | Uso |
|---|---|---|
| `obsidian` | `#0D0D0D` | Botões primários, textos, navbar |
| `gold` | `#C9A96E` | CTA de compra — use com extrema parcimônia |
| `ivory` | `#F9F9F7` | Background da página |
| `linen` | `#F0EDE8` | Cards, inputs, superfícies |
| `graphite` | `#3D3D3D` | Textos secundários, preços |
| `sand` | `#E2DFDA` | Bordas, divisores |

## Fontes

**Sora** (display, headings, botões) + **DM Sans** (body, descrições, preços), carregadas via `next/font/google`. Para auto-hospedagem, substitua os `@font-face` em `app/globals.css`.

## Ícones

**Lucide React** — outline, ~2px stroke. Substitua pelo seu set de ícones se necessário.
