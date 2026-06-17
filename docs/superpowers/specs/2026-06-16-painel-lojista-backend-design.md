# Painel do lojista — backend real (Escopo 3.2)

**Data:** 2026-06-16
**Status:** Aprovado para planejamento

## Objetivo

Conectar as quatro telas do painel do lojista (Dashboard, Produtos, Categorias, Configurações), hoje totalmente mockadas a partir de `lib/data.ts` com estado React local, a um backend real no Supabase. Ao fim desta rodada o painel persiste dados de verdade, faz upload de fotos, e aplica os limites de plano.

## Escopo

**Dentro:**
- Schema de banco para produtos, categorias e ajustes da loja (migrations + RLS).
- Camada de leitura via Server Components e mutações via Server Actions.
- Upload de fotos via Supabase Storage (múltiplas fotos: 3 Starter / 5 Pro).
- Enforcement de limites de plano (Starter: 30 produtos / 5 categorias / 3 fotos), no servidor e na UI. Durante o trial valem os limites Pro.
- Refactor dos hooks do painel para consumir dados reais.

**Fora desta rodada:**
- Catálogo público (`/catalogo`) continua lendo `lib/data.ts` — conectar é a rodada 3.3.
- Bloqueio retroativo / forçar remoção de produtos ao cair para Starter (entra com pagamento).
- Suíte de integração contra o Supabase.
- Leitura pública (anon) de produtos/categorias — entra com 3.3.

## Estado atual (ponto de partida)

- **Auth já tem backend:** tabelas `profiles` + `stores`, RLS, middleware protegendo `/painel` por sessão/loja/plano. Fluxo cadastro→loja→plano→painel funcional.
- `stores` hoje: `id, owner_id, name, slug, plan, trial_ends_at, is_active, created_at`.
- **Telas do painel prontas mas mockadas:** hooks `use-dashboard`, `use-produtos`, `use-produto-form`, `use-categorias`, `use-configuracoes` leem de `lib/data.ts` e guardam estado só em React local — nada persiste.
- Sem tabelas para produtos, categorias ou ajustes da loja.
- `lib/supabase/{client,server}.ts` e helpers de auth já existem.

## Arquitetura

**Opção escolhida: Server Components (leitura) + Server Actions (escrita).**

Cada `page.tsx` vira Server Component que busca dados via Supabase server client e passa como props para o Client component existente. Os hooks mantêm o estado de UI e os toasts, recebem os dados iniciais por prop e chamam Server Actions para mutações. RLS cuida da autorização; limites de plano são validados no servidor (autoritativo). Sem rotas de API para operações autenticadas.

Segue as convenções já formalizadas em `docs/CONVENTIONS.md` e `docs/ARCHITECTURE.md` (após implementação de auth):
- **Server Actions ficam em `app/actions/*.ts`** (diretório central, como o já existente `app/actions/auth.ts`) — não co-locadas na feature folder.
- **Hooks de formulário usam `useActionState`** (nunca `useState` + fetch manual). A action retorna `{ error: string }` em falha e faz `redirect()` no sucesso quando o fluxo navega; para mutações que permanecem na mesma tela (toggle, delete, criação inline) usa `revalidatePath` e retorna estado para o toast.
- **Validação com Zod v4**: `safeParse` + `result.error.issues[0].message` (não `.errors`).
- **Toda action autenticada chama `supabase.auth.getUser()` no início** (nunca `getSession()`); usa anon key + RLS, jamais a `service_role` no cliente.
- `useSearchParams()` exige `<Suspense>` no pai (relevante caso algum filtro de painel use query params).

Mantém a convenção do projeto: páginas limpas, lógica nos hooks `use-*.ts`.

## 1. Modelo de dados (migrations)

### Estende `stores` (ajustes da loja, 1:1)
```
+ whatsapp          text
+ accent_color      text   default '#C9A96E'
+ logo_url          text
+ description       text
+ monogram          text          -- iniciais do logo textual
+ analytics_id      text
+ pixel_id          text
+ message_template  text          -- null = usa o padrão MSG_DEFAULT
```

### Nova `categories`
```
id         uuid pk default gen_random_uuid()
store_id   uuid not null references stores(id) on delete cascade
name       text not null
position   int  default 0
created_at timestamptz default now()
unique(store_id, name)
```

### Nova `products`
```
id          uuid pk default gen_random_uuid()
store_id    uuid not null references stores(id) on delete cascade
name        text not null
price_cents int  not null
description text
category_id uuid references categories(id) on delete restrict   -- null permitido
sizes       text[] default '{}'
sold_sizes  text[] default '{}'
colors      jsonb  default '[]'    -- [{label,hex}]
images      text[] default '{}'    -- URLs do Storage; [0] = capa
stock       int    default 0
is_active   boolean default true
is_new      boolean default false
created_at  timestamptz default now()
```

> `category_id ... on delete restrict`: o banco bloqueia excluir categoria com produtos vinculados. A UI também valida antes, pela contagem.

### RLS
- `products` e `categories`: política "own store only" — `store_id` pertence a uma `stores` cujo `owner_id = auth.uid()` (subquery/EXISTS). `for all` com `using` + `with check`.
- Grants para `authenticated`. Sem acesso `anon` nesta rodada.

### Storage
- Bucket `product-images`, leitura pública.
- Escrita/atualização/remoção só por `authenticated`, restrita à pasta da própria loja: path `{store_id}/{uuid}.{ext}`.
- Logo da loja também vai para o bucket (path `{store_id}/logo/...` ou similar).

## 2. Camada de acesso

### Helper central — `lib/server/store.ts`
- `getCurrentStore()`: resolve a loja do usuário logado (`owner_id = auth.uid()`), retorna id + settings. Borda de segurança (o middleware já garante presença de loja+plano).

### Leitura (Server Components)
- `painel/page.tsx` → contagens (ativos, esgotados, total) + slug.
- `produtos/page.tsx` → lista de produtos + contagem para badge de limite.
- `produtos/[id]/page.tsx` e `produtos/novo/page.tsx` → produto (edição) + categorias da loja.
- `categorias/page.tsx` → categorias + contagem de produtos por categoria (group by).
- `configuracoes/page.tsx` → settings da loja.

### Server Actions (`"use server"`, em `app/actions/`, com zod + `getUser()` + enforcement)
| Action | Arquivo |
|---|---|
| `createProduct` / `updateProduct` / `deleteProduct` / `toggleProductActive` | `app/actions/produtos.ts` |
| `createCategory` / `renameCategory` / `deleteCategory` (guard de contagem) | `app/actions/categorias.ts` |
| `updateStoreSettings` | `app/actions/store.ts` |

- Cada action começa verificando `supabase.auth.getUser()` e resolvendo a loja (`getCurrentStore()`); valida o input com Zod v4 (`result.error.issues[0].message`).
- Upload de fotos: o form envia arquivos; a action faz upload no Storage, monta o array `images`, persiste. No update remove do Storage as imagens descartadas. `deleteProduct` limpa as imagens do produto.
- **Contrato de retorno (convenção do projeto):** falha → `{ error: string }`; sucesso → `redirect()` (fluxos que navegam, ex.: salvar produto) ou `revalidatePath(...)` + estado nulo/ok (mutações in-place, ex.: toggle/delete na lista, criação inline de categoria). Os hooks de formulário consomem isso via `useActionState`.

## 3. Limites de plano

### Helper puro — `lib/plan-limits.ts`
```ts
type Plan = "starter" | "pro" | null;
getPlanLimits(plan, trialActive) → {
  maxProducts: number;    // starter:30  | pro/trial: Infinity
  maxCategories: number;  // starter:5   | pro/trial: Infinity
  maxPhotos: number;      // starter:3   | pro/trial: 5
}
```
- Regra: trial ativo (`plan = null` e `trial_ends_at` futuro) ou `plan = "pro"` → limites Pro; `starter` → limites Starter.

### Enforcement
1. **Servidor (autoritativo):** `createProduct` / `createCategory` / upload de foto checam limite antes de inserir; estouro → `{ error: "..." }` com a mensagem de upgrade.
2. **UI (preventiva):** página recebe `count` + `limit`; ao atingir:
   - Produtos: botão "Novo produto" desabilitado + mensagem de upgrade.
   - Categorias: mesmo tratamento no "Nova categoria".
   - Form: bloqueia foto além de `maxPhotos`.

### Caso de borda (Escopo §6)
Quem cadastrou >30 produtos no trial e escolher Starter: nesta rodada o enforcement só impede *novas* criações acima do limite; não há remoção forçada nem bloqueio do painel. Bloqueio mais duro fica para quando o pagamento for ligado.

## 4. Wiring das telas

Padrão: `page.tsx` busca → props → Client component → hook recebe `initial*`, mantém UI/toasts, e dispara mutações via Server Actions. Hooks de formulário (form de produto, configurações) usam `useActionState`; mutações in-place (toggle, delete, criação inline) chamam a action e contam com `revalidatePath` para re-buscar. `lib/data.ts` não é mais importado pelo painel (segue no catálogo).

- **Dashboard** (`use-dashboard`): contagens reais; link do catálogo montado de `slug` + `NEXT_PUBLIC_SITE_URL`; copiar link. Banner de trial já real no `layout.tsx`.
- **Produtos** (`use-produtos`): lista por prop; `toggleActive`/`removeProduct` viram actions; badge de limite; estado vazio.
- **Form de produto** (`use-produto-form`): create/edit reais; upload pro Storage (respeita `maxPhotos`); sizes/cores/categoria com criação inline (`createCategory`); stock, visibilidade, esgotado; salvar/excluir via action; preço com máscara → cents.
- **Categorias** (`use-categorias`): lista + contagem reais; create/rename via action; delete bloqueado quando `count > 0` (UI avisa; banco garante com `restrict`).
- **Configurações** (`use-configuracoes`): carrega settings reais; salva accent/logo/whatsapp/GA/Pixel/descrição/template; preview client-side; upload do logo.

### Tipos (`lib/types.ts`)
- `Product` ganha `images: string[]`, `categoryId: string | null`, `priceCents: number`.
- Novo tipo para settings da loja.
- Mantidos como contrato.

## 5. Testes e verificação

- **Vitest (puro):** `getPlanLimits`, conversão preço↔cents, guard de exclusão de categoria, schemas zod.
- **Server Actions / DB:** verificação manual; RLS validado (action roda sob a sessão do usuário). Sem integração automatizada nesta rodada.
- Migrations aplicadas localmente via Supabase CLI; bucket + policies criados por migration SQL.

## Decisões registradas

- Preço armazenado em **centavos (int)**, não string `"R$ ..."`.
- Múltiplas fotos como coluna **`images text[]`** (capa = `images[0]`), não tabela separada.
- Ajustes da loja **estendem `stores`** (1:1), sem tabela de settings separada.
- Categoria com produtos: **exclusão bloqueada** (banco `restrict` + UI).
- Catálogo público segue mockado nesta rodada.
