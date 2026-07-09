# Remediação de Segurança — Catálogo Digital

**Origem:** relatório de análise de segurança (SAST) de 06/07/2026, escopo: revisão estática + configuração + modelagem de ameaças.

**Como usar este documento:** cada achado tem um checkbox. Vamos trabalhar em partes — ao concluir e verificar um item, marque `[x]` e anote a data/commit na coluna de notas.

---

## 🔴 Altas (Prioridade 1 — antes do lançamento)

- [ ] **ALTA-01** — Credencial no `.env.local`
  Arquivo: `.env.local`
  ⚠️ **Nota de verificação:** `git log --all --full-history -- .env.local` não retorna nada e o arquivo não está em `git ls-files` — nunca foi commitado. Não é necessário rotacionar a chave por exposição no repo. A única exposição real é a chave ter sido colada em texto claro no PDF/relatório salvo em `~/Downloads`; avaliar se vale rotacionar por essa via.
  Ação restante: adicionar scanner de segredos ao CI (`gitleaks` ou `trufflehog`) como prevenção futura.

- [x] **ALTA-02** — Ausência de Content Security Policy (CSP)
  Arquivos: `next.config.mjs`, `__tests__/next-config.test.ts`
  Feito: header CSP via `next.config.mjs` (`default-src 'self'`, allowlist para GA/Speed Insights/Supabase, `unsafe-eval` só em dev para HMR/React DevTools). Verificado no dev server: header presente na resposta, sem erros de console, home carrega normalmente.

- [x] **ALTA-03** — Sem rate limiting em `/api/slug/check`
  Arquivos: `app/api/slug/check/route.ts`, `app/(auth)/cadastro/page.tsx`, `lib/server/slug-suggest.ts`
  **Revisão do achado:** a causa raiz não era só a ausência de rate limit — o endpoint só é usado no passo "step=loja" do cadastro, que só deveria ser alcançável por quem já confirmou a conta, mas a página não tinha nenhuma verificação de sessão. Defesa é **autenticação** (rota retorna 401 sem sessão; página `/cadastro?step=loja` redireciona para `/login` sem sessão) + loop de sugestão de slug reduzido de até 12 queries sequenciais para no máximo 2 (`.in()` com os 9 candidatos de uma vez).
  Rate limiting via Upstash Redis foi implementado e depois removido a pedido — decidimos que a autenticação já cobre o risco por ora; fica registrado como possível melhoria futura se o abuso por usuários autenticados vier a ser um problema real.

- [x] **ALTA-04** — Sem validação de MIME/tamanho no upload de imagens
  Arquivos: `lib/server/upload.ts`, `lib/server/image-signature.ts`
  Feito: validação por magic bytes (JPEG/PNG/GIF/WEBP) em vez de confiar no `file.type` do cliente, limite de 5MB, `contentType` do Storage definido pelo tipo detectado (não pelo declarado). Cobre todos os callers (`produtos.ts`, `auth.ts`, `store.ts`) por ser um único ponto de upload.

---

## 🟠 Médias (Prioridade 2 — após lançamento inicial)

- [x] **MEDIA-01** — Open redirect via `?next=` no login
  Arquivos: `app/actions/auth.ts`, `lib/auth/safe-redirect.ts`
  Feito: `getSafeRedirect()` usa o parser de URL nativo (`new URL(next, base).origin === base`) em vez de `startsWith('/')`, fechando os bypasses via barra invertida (`/\evil.com`, `\\evil.com`) citados no relatório. 9 testes cobrindo os casos.

- [x] **MEDIA-02** — Faltam headers HTTP essenciais
  Arquivo: `next.config.mjs`
  Feito: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. Verificado na resposta real do dev server.

- [x] **MEDIA-03** — RLS de `stores` expõe todas as colunas ao público
  Arquivo: `supabase/migrations/20260709000000_restringe_colunas_publicas_stores.sql`
  ✅ **Confirmado real:** a policy `using (true)` permitia leitura de `owner_id`, `plan`, `trial_ends_at` via PostgREST direto com o papel `anon` — testado com `psql`/`curl` contra o Supabase local antes e depois do fix.
  **Revisão do achado:** não usei `is_active = true` na policy (a sugestão do relatório) porque o app depende de conseguir ler lojas inativas para mostrar o estado "loja pausada" (`lib/catalog.ts:resolveCatalog`, status `hidden`) — restringir por linha quebraria essa UX. A policy de linha (`using (true)`) ficou como estava; a correção foi por **coluna**: `revoke select` do `anon` na tabela inteira + `grant select` só nas 15 colunas que o catálogo público já usa (`STORE_COLS` em `lib/server/catalog.ts`), excluindo `owner_id`, `plan`, `trial_ends_at`, `created_at`. Testado ponta a ponta via REST local: a query real do app continua funcionando, `select owner_id` e `select *` retornam `42501 permission denied`.
  ⚠️ **Residual fora de escopo:** um lojista autenticado ainda consegue ler `owner_id`/`plan`/`trial_ends_at` de **outras** lojas ativas (o grant amplo de `authenticated` não é restringido por essa migration, só o de `anon` — o relatório fala especificamente de leitura *anônima*). Fechar isso por completo exigiria mover o catálogo público pra uma view dedicada; não fiz por não ser o que o achado pedia, mas fica registrado aqui se quiser revisitar.

- [ ] **MEDIA-04** — MFA (TOTP) desabilitado
  Arquivo: `supabase/config.toml` (linhas 310-312)
  Ação: habilitar `enroll_enabled`/`verify_enabled` para TOTP; oferecer como opcional para lojistas.

- [x] **MEDIA-05** — Senha do usuário de seed hardcoded
  Arquivo: `supabase/seed.sql`
  **Revisão do achado:** não dava pra usar variável de ambiente de fato — `seed.sql` é executado como SQL puro pela CLI do Supabase (`supabase db reset`), sem interpolação de env vars do processo Node. Também não havia necessidade real de senha alguma: o usuário de seed só existe pra satisfazer o FK `stores.owner_id`, ninguém loga com ele (o link "Ver um catálogo" da landing é o catálogo público, sem sessão). Troquei `crypt('demo-seed', ...)` por `crypt(gen_random_uuid()::text, ...)` — senha aleatória a cada reset, nunca persistida em texto claro. Testado no Supabase local: a senha antiga (`demo-seed`) não bate mais com o hash gerado.

- [ ] **MEDIA-06** — Google Analytics ID hardcoded
  Arquivo: `app/layout.tsx` (linhas 90, 98)
  Ação: mover `G-01EYR8VF7D` para `NEXT_PUBLIC_GA_ID`.

- [ ] **MEDIA-07** — `secure_password_change = false`
  Arquivo: `supabase/config.toml` (linha 228)
  Ação: habilitar `secure_password_change = true` em produção.

---

## 🟡 Baixas (melhorias incrementais)

- [ ] **BAIXA-01** — CSRF em `selectPlan` sem FormData explícito
  Arquivo: `app/actions/auth.ts` (linha 225)
  Risco documentado como baixo (Server Actions do Next.js já têm proteção CSRF built-in).

- [ ] **BAIXA-02** — Sem `.max()` em campos de texto livre
  Arquivo: `lib/validation/painel.ts`
  Ação: adicionar limites (`description` 500, `messageTemplate` 2000, `instagram` 100, etc.).

- [ ] **BAIXA-03** — Sem validação de formato do WhatsApp no servidor
  Arquivos: `lib/validation/painel.ts`, `app/actions/auth.ts`
  Ação: adicionar regex de validação de telefone.

- [ ] **BAIXA-04** — `dangerouslyAllowLocalIP` em dev
  Arquivo: `next.config.mjs` (linhas 10-19)
  Já documentado e restrito a não-produção; sem ação necessária além de manter comentário explicativo.

---

## ℹ️ Informativo (roadmap de compliance)

- [ ] **INFO-01** — CAPTCHA disponível mas não habilitado
  Arquivo: `supabase/config.toml` (linhas 213-218)

- [ ] **INFO-02** — GA sem banner de consentimento LGPD
  Arquivo: `app/layout.tsx` (linhas 89-100)

---

## Pontos positivos já implementados (não requerem ação)

`supabase.auth.getUser()` em vez de `getSession()`, cookies httpOnly via `@supabase/ssr`, middleware com dupla verificação, Zod em todas as Server Actions, RLS habilitado nas tabelas, isolamento por `store_id`, slug validado por regex, upload restrito por `store_id`, senha com requisitos mínimos, reset de senha com resposta neutra.
