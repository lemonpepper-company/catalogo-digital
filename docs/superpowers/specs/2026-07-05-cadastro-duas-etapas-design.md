# Design — Cadastro em duas etapas de verdade

**Data:** 2026-07-05
**Status:** Aprovado, aguardando plano de implementação

## Contexto

O fluxo de cadastro documentado em `docs/ARCHITECTURE.md` descreve duas etapas antes da confirmação de e-mail: dados pessoais, depois nome/slug da loja. Na implementação atual, porém, a seção "Sua loja" (nome, slug, Instagram) do `CadastroForm.tsx` é sempre renderizada, inclusive na etapa 1 — então `signUp` já recebe e grava `store_name`/`slug` nos metadados do usuário no momento do cadastro inicial. Quando o usuário confirma o e-mail, `app/auth/callback/route.ts` encontra esses metadados e cria a loja imediatamente, redirecionando direto para `/painel`.

Isso faz a etapa `/cadastro?step=loja` parecer "pulada" — na prática ela só é alcançada em dois casos residuais: login via Google OAuth (fluxo hoje oculto na UI) ou uma conta autenticada sem loja associada. Um usuário que confirma o e-mail nunca vê essa tela; um usuário que tenta logar sem ter completado o cadastro corretamente (raro, ex: conta de teste antiga) cai nela de surpresa.

**Decisão:** restaurar o fluxo de duas etapas de verdade. Etapa 1 coleta só dados pessoais; a loja só é criada depois da confirmação de e-mail, na etapa 2.

## Mudanças

### 1. `app/actions/auth.ts`

- `signUpSchema` perde os campos `store_name` e `slug` — fica apenas `full_name`, `email`, `password`, `confirm_password` (mais o refine de senhas coincidentes).
- `signUp` para de ler `store_name`/`slug` do `FormData` e para de incluí-los em `options.data` (metadados do usuário no Supabase Auth). Passa a gravar só `{ full_name }`.
- `storeSchema` e `createStore` (usados pela etapa 2) não mudam.

### 2. `app/auth/callback/route.ts`

O branch `if (meta.store_name && meta.slug) { ... cria store ... }` fica inalcançável — nenhum caminho de código passa a popular esses metadados (nem `signUp`, nem o fluxo Google OAuth, que nunca os populou). Esse branch é removido, junto com o bloco de comentário "MODO DEMO" duplicado nele (o mesmo comentário já existe em `createStore`, então nenhuma informação histórica se perde).

Lógica resultante do callback, para qualquer usuário novo (email ou Google):
```
loja já existe para este usuário?
  sim → /painel (com plano) ou /escolha-de-plano (sem plano, não ocorre em modo demo)
  não → cria profile (upsert) → redireciona para /cadastro?step=loja
```

### 3. `app/(auth)/cadastro/CadastroForm.tsx`

A seção "Sua loja" (nome da loja, link/slug, Instagram) deixa de ser sempre renderizada e passa a ficar dentro de `{stepLoja && (...)}`, simétrica à seção "Sua conta" que já usa `{!stepLoja && (...)}`. O campo Instagram, que hoje tem sua própria checagem `{stepLoja && (...)}` (adicionada numa correção anterior para evitar perda silenciosa do valor), perde essa checagem redundante — ela passa a ser garantida pelo wrapper da seção inteira.

`app/(auth)/cadastro/use-cadastro-form.ts` não muda: o hook já mantém o estado de `storeName`/`slug` independente de `stepLoja`; eles só deixam de aparecer no DOM (e portanto de serem submetidos) na etapa 1.

### 4. Resultado do fluxo

```
/cadastro (etapa 1: nome, e-mail, senha)
  → signUp (grava só full_name nos metadados)
  → /verificar-email?email=X
  → [clique no e-mail] → /auth/callback
       → sem loja: cria profile → /cadastro?step=loja
  → /cadastro?step=loja (etapa 2: nome da loja, slug, Instagram opcional)
  → createStore (cria a loja, plan='starter')
  → /painel
```

## Fora de escopo

- Contas de teste pré-existentes com metadados de loja mas sem loja criada: não precisam de migração — o middleware já redireciona qualquer conta autenticada sem loja para `/cadastro?step=loja`, que hoje já funciona corretamente via `createStore`.
- Reativação do login Google (`signInWithGoogle`): fora de escopo, permanece oculto na UI como já documentado em `docs/ARCHITECTURE.md`.

## Testes

- Novo teste de componente para `CadastroForm.tsx`: confirma que a seção "Sua loja" (nome/slug/Instagram) só renderiza quando `stepLoja=true`, e que a seção "Sua conta" só renderiza quando `stepLoja` é falsy — trava esse comportamento contra regressão futura.
- Sem testes dedicados para `signUp`/`app/auth/callback/route.ts`: mantém o padrão já existente no projeto (Server Actions e Route Handlers de autenticação não têm cobertura direta de teste).
