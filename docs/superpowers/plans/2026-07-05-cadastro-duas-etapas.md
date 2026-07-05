# Cadastro em Duas Etapas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar o fluxo real de duas etapas no cadastro — etapa 1 coleta só dados pessoais; a loja só é criada depois que o usuário confirma o e-mail e preenche a etapa 2 (`/cadastro?step=loja`).

**Architecture:** `signUp` para de gravar `store_name`/`slug` nos metadados do usuário; `app/auth/callback/route.ts` para de ler esses metadados (branch morto removido) e sempre redireciona usuário novo para `/cadastro?step=loja`; `CadastroForm.tsx` esconde a seção "Sua loja" na etapa 1.

**Tech Stack:** Next.js 16 App Router, Supabase Auth (`@supabase/ssr`), Zod v4, Vitest + Testing Library.

## Global Constraints

- Server Actions sempre validam com Zod antes de tocar no banco; erro retorna `{ error: string }`.
- Não usar `try/catch` em volta de `redirect()`.
- Sem lógica em `page.tsx`; toda lógica de estado em hooks `use-*.ts` (já respeitado, sem mudança de hook nesta feature).
- Contas de teste pré-existentes com metadados de loja mas sem loja criada não precisam de migração — o middleware já redireciona qualquer conta autenticada sem loja para `/cadastro?step=loja`.

---

### Task 1: `signUp` para de coletar dados da loja

**Files:**
- Modify: `app/actions/auth.ts` (`signUpSchema`, `signUp`)

**Interfaces:**
- Produces: `signUpSchema` valida apenas `{ full_name, email, password, confirm_password }`. `signUp(prevState, formData)` grava só `{ full_name }` nos metadados do usuário (`supabase.auth.signUp({ ..., options: { data: { full_name }, ... } })`).

- [ ] **Step 1: Remover `store_name`/`slug` de `signUpSchema`**

Em `app/actions/auth.ts`, substituir:

```ts
const signUpSchema = z
  .object({
    full_name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: passwordSchema,
    confirm_password: z.string(),
    store_name: z.string().min(2, 'Nome da loja deve ter ao menos 2 caracteres'),
    slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'Link inválido'),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'As senhas não coincidem',
    path: ['confirm_password'],
  })
```

por:

```ts
const signUpSchema = z
  .object({
    full_name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'As senhas não coincidem',
    path: ['confirm_password'],
  })
```

- [ ] **Step 2: Atualizar `signUp` para não ler/gravar `store_name`/`slug`**

Substituir a função `signUp` inteira por:

```ts
export async function signUp(
  prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const result = signUpSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { full_name, email, password } = result.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    if (error.code === 'user_already_exists') {
      return { error: 'Esse e-mail já está cadastrado.' }
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }

  redirect(`/verificar-email?email=${encodeURIComponent(email)}`)
}
```

Não altere `storeSchema` nem `createStore` — pertencem à etapa 2 e não mudam.

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificação manual — cadastro etapa 1 ainda funciona**

Run: `npm run dev`. Em `http://localhost:3000/cadastro`, preencha nome/e-mail/senha e envie. Confirme que é redirecionado para `/verificar-email?email=...` sem erro (a seção "Sua loja" ainda aparece nesta tela por enquanto — isso só muda na Task 3 — então o formulário ainda envia `store_name`/`slug`, mas `signUp` agora simplesmente os ignora; confirme que isso não quebra o cadastro).

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth.ts
git commit -m "fix: signUp para de coletar dados da loja na etapa 1"
```

---

### Task 2: Callback de confirmação sempre leva usuário novo para a etapa 2

**Files:**
- Modify: `app/auth/callback/route.ts`

**Interfaces:**
- Consumes: nenhum metadado de loja (após a Task 1, `signUp` nunca mais grava `store_name`/`slug`; nenhum outro fluxo — nem o Google OAuth, hoje oculto — jamais gravou esses campos).
- Produces: usuário novo autenticado (sem loja) é sempre redirecionado para `/cadastro?step=loja`, após ter seu `profile` criado.

- [ ] **Step 1: Remover o branch morto de criação de loja no callback**

Em `app/auth/callback/route.ts`, substituir todo o trecho a partir de `// Verifica se loja já existe (login Google de usuário existente)` até o final da função (linha 129) por:

```ts
  // Verifica se loja já existe (usuário existente, ex.: login Google)
  const { data: store } = await supabase
    .from('stores')
    .select('plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (store) {
    return NextResponse.redirect(
      `${origin}${store.plan ? '/painel' : '/escolha-de-plano'}`
    )
  }

  // Usuário novo — cria o profile e segue para a etapa de dados da loja
  const meta = user.user_metadata ?? {}
  await supabase.from('profiles').upsert({
    id: user.id,
    full_name: meta.full_name ?? meta.name ?? '',
  })

  return NextResponse.redirect(`${origin}/cadastro?step=loja`)
}
```

Isso remove o branch `if (meta.store_name && meta.slug) { ... }` inteiro (inclusive o bloco de comentário "MODO DEMO" duplicado — o mesmo comentário já existe em `createStore`, em `app/actions/auth.ts`, então nenhuma informação se perde).

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "fix: callback sempre encaminha usuário novo para etapa de dados da loja"
```

---

### Task 3: `CadastroForm` esconde "Sua loja" na etapa 1

**Files:**
- Modify: `app/(auth)/cadastro/CadastroForm.tsx:134-188`
- Test: `__tests__/CadastroForm.test.tsx` (novo arquivo)

**Interfaces:**
- Consumes: prop `stepLoja?: boolean` (já existente); estado `storeName`, `handleStoreNameChange`, `slug`, `setSlug`, `instagram`, `setInstagram` de `useCadastroForm` (já existentes, sem mudança de assinatura).

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/CadastroForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CadastroForm } from "@/app/(auth)/cadastro/CadastroForm";

vi.mock("@/app/actions/auth", () => ({
  signUp: vi.fn(),
  createStore: vi.fn(),
}));

describe("CadastroForm — etapas do cadastro (novo)", () => {
  it("mostra 'Sua conta' e esconde 'Sua loja' na etapa 1", () => {
    render(<CadastroForm />);
    expect(screen.getByText("Sua conta")).toBeTruthy();
    expect(screen.queryByText("Sua loja")).toBeNull();
    expect(screen.queryByPlaceholderText("Ex.: Ateliê Mira")).toBeNull();
  });

  it("mostra 'Sua loja' e esconde 'Sua conta' na etapa 2 (stepLoja)", () => {
    render(<CadastroForm stepLoja />);
    expect(screen.getByText("Sua loja")).toBeTruthy();
    expect(screen.queryByText("Sua conta")).toBeNull();
    expect(screen.getByPlaceholderText("Ex.: Ateliê Mira")).toBeTruthy();
  });

  it("mostra o campo de Instagram na etapa 2", () => {
    render(<CadastroForm stepLoja />);
    expect(screen.getByPlaceholderText("seu.usuario")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/CadastroForm.test.tsx`
Expected: FAIL — hoje a seção "Sua loja" aparece mesmo na etapa 1 (primeiro teste falha).

- [ ] **Step 3: Envolver a Seção B em `{stepLoja && (...)}` e remover a checagem redundante do campo Instagram**

Em `app/(auth)/cadastro/CadastroForm.tsx`, substituir o bloco (linhas 134-188):

```tsx
            {/* Seção B: Sua loja — sempre visível */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                  Sua loja
                </h2>
                <div className="h-px bg-sand flex-1" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Nome da loja
                </label>
                <div className={inputWrap}>
                  <Store size={18} className="text-graphite flex-shrink-0" />
                  <input
                    type="text"
                    name="store_name"
                    placeholder="Ex.: Ateliê Mira"
                    autoComplete="organization"
                    className={inputBase}
                    value={storeName}
                    onChange={(e) => handleStoreNameChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Link da loja
                </label>
                <SlugInput name="slug" value={slug} onChange={setSlug} />
              </div>

              {stepLoja && (
                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Instagram <span className="text-graphite font-normal">(opcional)</span>
                  </label>
                  <div className={inputWrap}>
                    <Instagram size={18} className="text-graphite flex-shrink-0" />
                    <span className="font-body text-[15px] text-graphite flex-shrink-0">@</span>
                    <input
                      type="text"
                      name="instagram"
                      placeholder="seu.usuario"
                      autoComplete="off"
                      className={inputBase}
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
```

por:

```tsx
            {/* Seção B: Sua loja — só na etapa 2 (após confirmar e-mail) */}
            {stepLoja && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                    Sua loja
                  </h2>
                  <div className="h-px bg-sand flex-1" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Nome da loja
                  </label>
                  <div className={inputWrap}>
                    <Store size={18} className="text-graphite flex-shrink-0" />
                    <input
                      type="text"
                      name="store_name"
                      placeholder="Ex.: Ateliê Mira"
                      autoComplete="organization"
                      className={inputBase}
                      value={storeName}
                      onChange={(e) => handleStoreNameChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Link da loja
                  </label>
                  <SlugInput name="slug" value={slug} onChange={setSlug} />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Instagram <span className="text-graphite font-normal">(opcional)</span>
                  </label>
                  <div className={inputWrap}>
                    <Instagram size={18} className="text-graphite flex-shrink-0" />
                    <span className="font-body text-[15px] text-graphite flex-shrink-0">@</span>
                    <input
                      type="text"
                      name="instagram"
                      placeholder="seu.usuario"
                      autoComplete="off"
                      className={inputBase}
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/CadastroForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Rodar a suíte completa e checar tipos**

Run: `npx vitest run`
Expected: PASS em todos os arquivos (nenhuma regressão).

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Verificação manual do fluxo completo**

Run: `npm run dev`. Fluxo completo:
1. `http://localhost:3000/cadastro` — confirme que só aparece "Sua conta" (nome, e-mail, senha, confirmar senha), sem "Sua loja".
2. Preencha e envie. Confirme redirecionamento para `/verificar-email?email=...`.
3. Abra o Mailpit (`http://localhost:54324`), ache o e-mail de confirmação e clique no link.
4. Confirme que você é redirecionado para `/cadastro?step=loja`, exibindo agora "Sua loja" (nome, link, Instagram opcional), sem "Sua conta".
5. Preencha nome da loja (o slug é sugerido automaticamente) e envie. Confirme redirecionamento para `/painel`.

- [ ] **Step 7: Commit**

```bash
git add "app/(auth)/cadastro/CadastroForm.tsx" __tests__/CadastroForm.test.tsx
git commit -m "fix: esconde seção 'Sua loja' na etapa 1 do cadastro"
```

---

## Verificação final

- [ ] **Rodar a suíte completa**

Run: `npx vitest run`
Expected: todos os testes passam (novos e existentes).

- [ ] **Checar tipos do projeto inteiro**

Run: `npx tsc --noEmit`
Expected: sem erros.
