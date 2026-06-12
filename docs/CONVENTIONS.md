# Convenções de código — Catálogo Digital

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
