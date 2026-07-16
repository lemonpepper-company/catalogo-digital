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
- Toda lógica de estado, efeitos colaterais e derivações vai em **custom hooks** (`use-*.ts` co-locado na feature folder)

## Custom Hooks

- Isolar em hooks toda lógica reutilizável ou que envolva estado, efeitos, fetching ou derivações
- Nomear com prefixo `use-` (ex: `use-produto-form.ts`, `use-cadastro-form.ts`)
- Um hook por arquivo; não agrupar hooks não relacionados
- Hooks de formulário com Server Action usam `useActionState` — nunca `useState` + `fetch` manual

## Server Actions (`app/actions/*.ts`)

- Toda mutação de dados passa por Server Action — nunca Route Handler para operações autenticadas
- Sempre validar com **Zod** antes de tocar no banco; retornar `{ error: string }` em caso de falha
- Zod v4: usar `.error.issues[0].message` (não `.errors`)
- Verificar sessão com `supabase.auth.getUser()` no início de toda action que exige autenticação
- `redirect()` ao final de actions que concluem com sucesso — nunca retornar a URL para o cliente redirecionar
- Não usar `try/catch` em volta de `redirect()` — ele lança internamente por design

```ts
// Padrão de Server Action
'use server'
export async function createFoo(prev: State, formData: FormData): Promise<State> {
  const result = schema.safeParse(Object.fromEntries(formData))
  if (!result.success) return { error: result.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase.from('tabela').insert({ ...result.data })
  if (error) return { error: 'Mensagem amigável.' }

  redirect('/destino')
}
```

## Hooks de formulário com Server Action

```ts
// use-foo-form.ts — co-locado na feature folder
'use client'
import { useActionState } from 'react'
import { createFoo } from '@/app/actions/foo'

type FormState = { error: string } | null

export function useFooForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createFoo, null)
  return { state, action, pending }
}
```

## Componentes

- Server Components por padrão; `"use client"` apenas onde há interatividade
- Sem comentários no código exceto para lógica não-óbvia
- `useSearchParams()` requer `<Suspense>` no componente pai — sempre extrair para filho quando necessário

## Supabase

- **Client-side**: `createBrowserClient` via `lib/supabase/client.ts`
- **Server-side**: `createServerClient` via `lib/supabase/server.ts` (cookies httpOnly)
- Nunca usar `supabase.auth.getSession()` para verificar autenticação — usar `getUser()` (valida o JWT no servidor)
- Operações autenticadas usam a **anon key** + RLS; nunca expor a `service_role` key no cliente
- **Coluna pública em `stores` exige GRANT ao `anon`.** O catálogo público é lido pelo papel `anon`, que tem GRANT de SELECT **por coluna** (`supabase/migrations/20260709000000_restringe_colunas_publicas_stores.sql`). No Postgres, colunas novas **não** herdam esse grant. Ao adicionar uma coluna que entre em `STORE_COLS` (`lib/server/catalog.ts`), crie também uma migration `grant select (nova_coluna) on public.stores to anon` — senão o SELECT do anon dá *permission denied* e a vitrine `/{slug}` cai em 404 (o painel, papel `authenticated`, não acusa).
- **Não engula o `error` do Supabase** em leituras server-side. Distinga "linha inexistente" (`data` null, `error` null → 404/estado vazio legítimo) de erro real de banco (`error` preenchido → logar e propagar). Engolir o `error` transforma uma falha de privilégio/schema num 404 enganoso (ver `fetchPublicCatalog` em `lib/server/catalog.ts`).

## Estilos

- Tailwind para todo estilo — nunca CSS inline para valores que têm token
- Cores e espaçamentos sempre pelos tokens definidos em `tailwind.config.ts` e `app/globals.css`
- Sem `box-shadow` em lugar nenhum — elevação via cor de superfície (linen sobre ivory)
- Transições máximo 200ms ease

## Stack

- Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind CSS v3
- Supabase Auth com `@supabase/ssr ^0.12` para sessão via cookies
- Zod v4 para validação em Server Actions
- Vitest + Testing Library para testes unitários
- Node.js 20.9+
- Sem CSS Modules, sem styled-components
- Lucide React para ícones (outline, ~2px stroke)
