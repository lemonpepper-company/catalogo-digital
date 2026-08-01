# Modelagem de assinatura: `plan_expires_at` e `subscription_status`

**Data:** 2026-08-01
**Status:** Aprovado para planejamento

## Objetivo

`stores.trial_ends_at` acumulou três significados ao longo do tempo. Nasceu como prazo do trial de 14 dias, virou "liberação manual expira em" ([get_effective_plan](../../../supabase/migrations/20260725100200_get_effective_plan_function.sql)) e está hoje **nulo em todas as lojas**, zerado pela migration [20260725000000](../../../supabase/migrations/20260725000000_backfill_null_trial_ends_at.sql).

Com o checkout self-service entrando, a coluna ganharia um quarto significado — "fim do período pago" — e mais um implícito, o período de graça de 3 dias. Um campo que significa cinco coisas é um campo que o suporte não consegue ler: olha-se a data e não se sabe qual caso é.

Esta spec substitui `trial_ends_at` por um modelo explícito e prepara o terreno para a integração de cobrança, **sem** integrar gateway nenhum. Nada aqui é visível para o lojista; nada aqui depende da conta Asaas ou da confirmação das taxas.

## Escopo

**Dentro:**
- Cinco colunas novas em `stores`: `plan_expires_at`, `subscription_status`, `billing_cycle`, `asaas_customer_id`, `asaas_subscription_id`.
- Reescrita de `get_effective_plan` (SQL) e de `getEffectivePlan`/`getPlanLimits` (TypeScript) sobre `plan_expires_at`.
- GRANT de `update` das colunas novas para `service_role`.
- Remoção da coluna `trial_ends_at` e renomeação de `trialEndsAt` → `planExpiresAt` nos 28 arquivos que a referenciam.
- Verificações de privilégio em SQL, no espírito de `.github/workflows/supabase-migrations-check.yml`.

**Fora desta rodada (Spec 2B — cobrança e checkout):**
- Cliente Asaas, criação de assinatura, rota de webhook.
- Página de assinatura, preços em `app/page.tsx`, troca de destino dos sete CTAs de upsell.
- Cálculo do proporcional no upgrade e lógica de dunning.
- Escrita real das colunas novas — nesta spec elas nascem e ficam inertes.

**Fora de qualquer rodada:**
- Trial dos planos pagos. Decisão de produto: o Free permanente é a porta de entrada. Sem estado `trialing`; se um trial for adotado no futuro, ele entra como estado novo sem refazer esta modelagem.
- Tabela de histórico de assinaturas ou faturas. Se auditoria de cobrança virar necessidade, uma `subscription_events` append-only escrita só pelo webhook resolve sem tocar no caminho de leitura.

## Contexto que restringe o desenho

1. **Não existe trigger de colunas admin-only.** A migration [20260728110000](../../../supabase/migrations/20260728110000_replace_trigger_with_column_revoke.sql) removeu `enforce_admin_only_store_columns` e trocou por GRANT/REVOKE declarativo: `revoke insert, update on stores from authenticated` seguido de grants nominais. **Coluna nova nasce não-gravável por `authenticated`** — basta não adicioná-la à lista.
2. **`anon` tem `select` por coluna** em `stores` ([20260709000000](../../../supabase/migrations/20260709000000_restringe_colunas_publicas_stores.sql)), então coluna nova nasce invisível para o público. É a pegadinha documentada no `AGENTS.md` funcionando a favor.
3. **`authenticated` tem `select` da tabela inteira** ([20260616031248](../../../supabase/migrations/20260616031248_init_auth.sql)). Em Postgres, grant de tabela cobre colunas futuras — o painel lê o estado da assinatura sem migration adicional.
4. **`service_role` tem `update` apenas em colunas nominais.** Hoje `(plan, trial_ends_at)` e `(custom_domain, custom_domain_verified)`. Coluna nova exige GRANT explícito, ou o webhook falha com `permission denied` — e, como toda a suíte mocka o Supabase, a suíte fica verde. É o cuidado crítico do `AGENTS.md`.
5. **`get_effective_plan` é `security definer` com EXECUTE para `anon`**, e `getPublicCatalog` a chama **fora** do `unstable_cache`, a cada request de vitrine. Qualquer custo adicionado ali é pago no caminho mais quente do sistema.

## Estratégia

### Colunas

| Coluna | Tipo | Significado |
|---|---|---|
| `plan_expires_at` | `timestamptz null` | Quando o acesso ao plano contratado termina. `null` = não expira |
| `subscription_status` | `text null` | `active` \| `past_due` \| `canceled`. `null` = nunca assinou |
| `billing_cycle` | `text null` | `monthly` \| `annual` |
| `asaas_customer_id` | `text null` | Identificador do cliente no Asaas |
| `asaas_subscription_id` | `text null` | Identificador da assinatura no Asaas |

`subscription_status` e `billing_cycle` levam `check` constraint. As duas colunas de ID ficam livres — formato de terceiro não é contrato nosso.

**`plan` passa a significar "plano contratado" e nunca é rebaixado por código.** Falha de cobrança, cancelamento e expiração mexem só em status e data. Reativar é estender `plan_expires_at`; nenhum caminho de código precisa reconstruir "o que essa loja era antes".

**O vocabulário de status é nosso, não o do Asaas.** A tradução dos eventos do gateway acontece num único ponto do webhook (Spec 2B). Trocar de gateway, ou o Asaas renomear estados, não move nada fora dali.

**Três estados, deliberadamente.** Não existe `expired`: expiração é comparação de data. Um estado que precisa de job agendado para ficar correto é um estado que vai ficar errado — **nada neste modelo depende de cron**, e tudo que é temporal é derivado na leitura, como o sistema já funciona.

`billing_cycle` não estava nas decisões originais de produto, mas é necessário: sem ele não há como calcular proporcional no upgrade nem exibir "renova em" corretamente.

### Regra de derivação

`getEffectivePlan(plan, planExpiresAt)` — mesma aridade de hoje, segundo parâmetro renomeado:

```
plan === 'free'          → 'free'
planExpiresAt === null   → plan     (liberação manual indeterminada)
planExpiresAt > agora    → plan
planExpiresAt <= agora   → 'free'
```

**`subscription_status` não entra na derivação.** Ele é informativo: alimenta o painel ("sua cobrança falhou, atualize o pagamento" / "sua assinatura termina em 12 de agosto"). Acesso é decidido só por data.

Isso mantém `get_effective_plan` tão barato quanto hoje — troca o nome de uma coluna e nada mais. A restrição 5 acima é a razão: essa função roda a cada request de vitrine.

**O período de graça é uma data, não um estado.** Na falha de cobrança, o webhook (Spec 2B) grava `subscription_status = 'past_due'` e empurra `plan_expires_at` em 3 dias. A vitrine segue no ar sem que a regra de leitura conheça o conceito de graça. Quando o pagamento entra, o webhook regrava a data com o próximo vencimento vindo do Asaas — não há acúmulo de dias ao longo do tempo.

### Ordem da migration

O Postgres **não rastreia dependências dentro do corpo de funções SQL**. Um `drop column trial_ends_at` antes da reescrita das funções passa sem erro e as deixa quebradas só em runtime.

**São duas funções, não uma.** Além de `get_effective_plan`, a `resolve_custom_domain` ([20260730020000, linha 32](../../../supabase/migrations/20260730020000_resolve_custom_domain.sql)) replica a mesma regra de expiração inline — ela nasceu na Spec 1 justamente para devolver o plano efetivo ao middleware numa única chamada. Esquecer dela quebra o domínio próprio de todas as lojas Pro, e o middleware faz *fail-open*: o erro é logado e o visitante vê a landing da Vtrine no domínio do lojista, sem 500 e sem alarme.

A superfície combinada das duas é toda a leitura pública: vitrine por slug e vitrine por domínio próprio.

Ordem obrigatória:

1. `alter table` adicionando as cinco colunas
2. `create or replace function public.get_effective_plan` sobre `plan_expires_at`
3. `create or replace function public.resolve_custom_domain` sobre `plan_expires_at`
4. `grant update (...) on public.stores to service_role`
5. `alter table public.stores drop column trial_ends_at`

Migrations do Supabase rodam em transação: ou tudo entra na ordem certa, ou nada entra.

A implementação pode dividir isso em duas migrations — passos 1 a 4 numa, o `drop` noutra — desde que o `drop` venha depois. Separar tem uma vantagem: entre as duas, a aplicação continua funcionando com qualquer uma das colunas, o que dá margem para o deploy do TypeScript acontecer no meio sem janela de quebra.

Nenhum backfill é necessário — `trial_ends_at` está nulo em todas as linhas desde [20260725000000](../../../supabase/migrations/20260725000000_backfill_null_trial_ends_at.sql), e `plan_expires_at` nulo significa exatamente a mesma coisa que aquele nulo significava: não expira.

### Renomeação em TypeScript

67 referências a `trial_ends_at`/`trialEndsAt` em 28 arquivos, quase todas `getPlanLimits(store.plan, store.trialEndsAt)` nas páginas do painel e nas Server Actions. A forma das funções não muda — só o nome e o significado do segundo parâmetro — então é renomeação mecânica.

Feita de uma vez. Manter as duas colunas convivendo, uma viva e uma morta com o nome enganoso, é o problema que esta spec existe para resolver.

Pontos que mudam de forma, não só de nome:
- `lib/types.ts` — `trialEndsAt` → `planExpiresAt` em `Store`/`StoreSettings`.
- `lib/server/store.ts:114` — a lista de colunas do `select` (string literal) e o mapeamento em `lib/server/store.ts:62`.
- `lib/plan-limits.ts` — `getEffectivePlan` e `getPlanLimits`.

**`subscription_status`, `billing_cycle` e os dois IDs do Asaas não entram nos tipos TypeScript nesta spec.** Existem só no banco até a Spec 2B, quando algo passa a lê-los. Adicioná-los ao `select` e aos tipos agora seria carregar campos que nenhum código consome.

## Tratamento de erro

`get_effective_plan` continua devolvendo o plano já resolvido, nunca dados crus. `getPublicCatalog` já trata erro da RPC lançando e propagando ([server/catalog.ts](../../../lib/server/catalog.ts)); nada muda ali.

Valor inválido em `subscription_status` ou `billing_cycle` é barrado pelo `check` no banco. Não há validação equivalente em TypeScript: a única escrita virá do webhook com service role (Spec 2B), e um valor fora do vocabulário deve falhar alto na fronteira do banco, não ser normalizado silenciosamente.

## Testes

**`__tests__/plan-limits.test.ts`** — os quatro ramos da derivação:
- `plan = 'free'` → `'free'`, independente da data.
- `planExpiresAt` nulo → mantém o plano contratado (liberação manual indeterminada).
- `planExpiresAt` no futuro → mantém.
- `planExpiresAt` no passado → `'free'`.

Mais um caso que hoje não existe e trava o desenho do período de graça:
- `subscription_status = 'past_due'` com `planExpiresAt` no futuro → **mantém o plano**. Prova que a graça funciona sem que a regra de leitura conheça o conceito.

**Verificações de privilégio**, no espírito de `.github/workflows/supabase-migrations-check.yml`:

| Verificação | Esperado |
|---|---|
| `has_column_privilege('service_role', 'public.stores', 'plan_expires_at', 'update')` | `t` |
| `has_column_privilege('authenticated', 'public.stores', 'plan_expires_at', 'update')` | `f` |
| `has_column_privilege('anon', 'public.stores', 'subscription_status', 'select')` | `f` |

As duas últimas não protegem contra um erro que estamos prestes a cometer — protegem contra alguém, meses à frente, adicionar a coluna ao grant de `authenticated` "para o painel poder editar" e reabrir a auto-promoção a Pro.

**Restante da suíte** acompanha a renomeação. Os arquivos afetados incluem `catalog.test.ts`, `PainelLayout.test.tsx`, `DashboardPage.test.tsx`, `ConfiguracoesClient.test.tsx`, `PedidosPage.test.tsx`, `PersonalizacaoClient.test.tsx`, `update-order-status.test.ts`, `update-custom-domain.test.ts`, `catalog-url.test.ts` e `ConfiguracoesMensagem.test.tsx`.

## Riscos

**A renomeação é ampla e mecânica.** 28 arquivos é onde erro de digitação passa despercebido. O TypeScript pega a maioria (o campo some do tipo), mas o `select` de colunas em `lib/server/store.ts:114` é string literal — errar ali só falha em runtime. Vale conferência explícita dessa linha.

**A coluna some antes de ter substituta em uso.** Entre esta spec e a 2B, as cinco colunas ficam inertes: escritas por ninguém, lidas por ninguém além de `get_effective_plan`. É intencional — a modelagem entra em produção sem depender da conta Asaas nem da confirmação das taxas —, mas significa que o valor real só aparece na Spec 2B.
