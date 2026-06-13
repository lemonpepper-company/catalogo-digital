# Convenções de código — Catálogo Digital

## Regras de frontend

- **Mobile-first** — estilize para mobile primeiro; use breakpoints (`md:`, `lg:`) para adaptar ao desktop
- **Sem lógica nos templates** — componentes de UI não buscam dados; dados descem via props ou são carregados no Server Component pai
- **Sem estado global desnecessário** — preferir estado local (`useState`) ou URL state; zustand/context só se realmente compartilhado entre árvores distantes
- **Acessibilidade mínima** — todo elemento interativo tem `aria-label` ou texto visível; imagens têm `alt`; foco visível nunca removido sem substituto
- **Sem animações desnecessárias** — transições máximo `200ms ease`; nada de animate-spin, bounce ou pulse sem propósito funcional
- **Ícones** — sempre Lucide React, outline, stroke `~2px`; nunca importar o pacote inteiro (`import { X } from 'lucide-react'`)
- **Imagens** — usar `next/image` para imagens de conteúdo; nunca `<img>` direto

## Páginas (`app/**/page.tsx`)

- Arquivos de page devem ser limpos — **sem lógica**: nenhum `useState`, `useEffect`, fetch, handler, formatação ou cálculo
- Responsabilidade única: composição de layout e passagem de props estáticas para componentes filhos
- Toda lógica de estado, efeitos colaterais e derivações vai em **custom hooks** (`hooks/use-*.ts` ou co-locado no feature folder)

## Custom Hooks

- Isolar em hooks toda lógica reutilizável ou que envolva estado, efeitos, fetching ou derivações
- Nomear com prefixo `use-` (ex: `use-product-list.ts`, `use-checkout.ts`)
- Um hook por arquivo; não agrupar hooks não relacionados

## Componentes

- Server Components por padrão; `"use client"` apenas onde há interatividade
- Sem comentários no código exceto para lógica não-óbvia

## Estilos

- Tailwind para todo estilo — nunca CSS inline para valores que têm token
- Cores e espaçamentos sempre pelos tokens definidos em `tailwind.config.ts` e `app/globals.css`
- Sem `box-shadow` em lugar nenhum — elevação via cor de superfície (linen sobre ivory)
- Transições máximo 200ms ease

## Stack

- Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind CSS v3
- Node.js 20.9+
- Sem CSS Modules, sem styled-components
- Lucide React para ícones (outline, ~2px stroke)
- Vitest + Testing Library para testes unitários
