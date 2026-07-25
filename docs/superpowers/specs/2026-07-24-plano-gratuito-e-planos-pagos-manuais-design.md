# Plano gratuito + volta dos planos pagos (com liberação manual) — Design

**Data:** 2026-07-24
**Status:** Aprovado para planejamento de implementação

## Contexto

O projeto está hoje em "modo demo" (ver `docs/roadmap/Escopo.md` §0 e §6, `docs/ARCHITECTURE.md`): toda loja nova nasce direto com `plan = 'starter'`, sem tela de escolha, `trial_ends_at = null` (indeterminado), e a seção de preços da landing e a página `/escolha-de-plano` ficaram ocultas/inacessíveis, sem cobrança nenhuma.

Este ciclo de validação continua sem gateway de pagamento. A mudança agora é:

1. Introduzir um terceiro nível, **Free**, como porta de entrada permanente e automática no cadastro.
2. Trazer Starter e Pro de volta para a landing page — mas com CTA **"Fale conosco"** em vez de checkout automático, já que a decisão de liberar esses planos continua manual (você avalia e libera o acesso por um período, direto no Supabase).
3. Garantir que os limites de cada plano são realmente aplicados no código (hoje só produtos/categorias/fotos são checados — o resto é só texto de marketing desatualizado).

## Modelo de planos

| | **Free** | **Starter** | **Pro** |
|---|---|---|---|
| Produtos | 8 | 30 | Ilimitado |
| Categorias | 1 | 5 | Ilimitado |
| Fotos por produto | 1 | 3 | 5 |
| Personalização (cor de destaque + capa) | ✅ | ✅ | ✅ |
| Mensagem de pedido customizada (WhatsApp) | ✅ | ✅ | ✅ |
| Formas de pagamento/entrega configuráveis | ✅ | ✅ | ✅ |
| Preço exibido na landing | "Grátis" | "Sob consulta" | "Sob consulta" |
| CTA na landing | "Começar grátis" → `/cadastro` | "Fale conosco" → WhatsApp | "Fale conosco" → WhatsApp |

Decisão deliberada: só produtos/categorias/fotos diferenciam os planos. Personalização, mensagem de pedido e formas de pagamento/entrega já são liberadas hoje pra qualquer loja no código e continuam assim — não valia a pena prender atrás de paywall nesta fase. Isso também corrige promessas de marketing que nunca foram implementadas (ex.: "Domínio próprio", "Destaques e relatórios" do Pro antigo) — saem da lista de features exibida.

## Cadastro

`createStore` (em `app/actions/auth.ts`) passa a gravar `plan: 'free'` em vez de `'starter'` na criação da loja. O fluxo de cadastro continua sem etapa de escolha de plano no meio — a loja nasce pronta e utilizável no Free, sem trial e sem cobrança. Quem quiser Starter/Pro decide depois, pela landing ou pelo aviso no painel.

## Landing page

A seção de preços (hoje comentada em `app/page.tsx`, texto "Em breve") volta ativa com **3 cards** (Free, Starter, Pro) no lugar dos 2 antigos. Free mostra "Grátis"; Starter e Pro mostram "Sob consulta" (sem valor fixo, já que a liberação é negociada manualmente nesta fase).

### CTA "Fale conosco"

Starter e Pro abrem `https://wa.me/5535999931678` (mesmo número já usado no `WhatsAppFloatingButton.tsx` existente) com mensagem pré-preenchida específica do plano:

- Starter: *"Olá! Quero saber mais sobre o plano Starter da Vtrine."*
- Pro: *"Olá! Quero saber mais sobre o plano Pro da Vtrine."*

Free usa o CTA "Começar grátis", linkando para `/cadastro` (mesmo padrão dos outros CTAs de cadastro já presentes na landing).

## Remoção da página `/escolha-de-plano`

Com o cadastro sempre indo direto pro Free e os planos pagos vivendo só na landing (via "Fale conosco"), a página `/escolha-de-plano` fica sem nenhum link apontando pra ela. Ela é **removida**, junto com o código morto associado:

- Rota `app/(auth)/escolha-de-plano/` (page, `PlanosContent.tsx`, `data.ts` local).
- Server Action `selectPlan` em `app/actions/auth.ts`.
- Checagens de `plan` nulo em `middleware.ts` (bloco "Escolha de plano" inteiro, e os redirects condicionais em `/login` e `/painel` que dependiam de `store.plan` ser nulo).
- Redirect condicional em `app/auth/callback/route.ts` (`store.plan ? '/painel' : '/escolha-de-plano'` → sempre `/painel` depois que a loja existe).
- Entrada `/escolha-de-plano` em `app/robots.ts`.

## Expiração de planos pagos liberados manualmente

`trial_ends_at` passa a representar **até quando um Starter/Pro liberado manualmente vale**:

- `null` = indeterminado, nunca expira. É o valor que todas as lojas atuais (criadas em modo demo) já têm — nenhuma delas é afetada por essa mudança.
- Uma data futura = acesso pago válido até lá.
- Uma data no passado = acesso pago expirado.

**Mecânica de rebaixamento — calculada na hora, sem gravar nada no banco:** o valor da coluna `plan` não muda sozinho quando a data vence. Toda vez que o sistema precisa saber os limites de uma loja (criar produto, criar categoria, decidir o aviso do painel), ele calcula um "plano efetivo": se `plan` é `starter`/`pro` **e** `trial_ends_at` já passou, usa os limites do Free só para aquela checagem — sem cron job, sem estado persistido. Nenhum produto/categoria existente é apagado ou desativado; só a criação de itens além do limite Free fica bloqueada até você renovar a data ou atualizar o `plan` no Supabase.

Renovar ou trocar de plano continua sendo uma edição manual direto na tabela `stores` do Supabase (campos `plan` e `trial_ends_at`) — sem tela ou Server Action de admin nesta fase, dado o volume baixo de clientes em validação.

## Painel — aviso de upgrade

A faixa "Trial Pro" no topo do painel (`app/painel/layout.tsx`) está morta hoje (`showTrialBanner = !store.plan`, e `plan` nunca é nulo em modo demo). Ela é reaproveitada: lojas com plano efetivo Free (seja porque nasceram assim, seja porque um Starter/Pro expirou) veem um aviso discreto — *"Você está no plano Free · Fale conosco para liberar mais produtos"* — com link pro mesmo WhatsApp usado na landing. Lojas Starter/Pro com acesso válido não veem nada ali.

## Termos de Uso

A seção "4. Planos e pagamento" de `app/termos-de-uso/page.tsx` está desatualizada — ainda cita trial de 14 dias, preços fixos (R$ 49/R$ 99) e cobrança recorrente mensal com política de reembolso, nada disso reflete o modelo atual nem o novo. É reescrita para:

- A Vtrine Digital oferece um plano gratuito (Free), disponível automaticamente na criação da conta, com limites de produtos, categorias e fotos.
- Os planos Starter e Pro, com limites ampliados, são disponibilizados mediante contato direto com a Vtrine Digital para avaliação e liberação de acesso.
- A ativação dos planos pagos é feita manualmente, sem cobrança automática. As condições de pagamento são combinadas diretamente com o lojista no momento da liberação.
- A Vtrine Digital pode revisar os limites e as condições de cada plano a qualquer momento, mediante aviso prévio.

Também é ajustada a seção "5. Suspensão e cancelamento", que hoje cita "Inadimplência superior a 30 dias após o vencimento da fatura" como motivo de suspensão — outra referência a cobrança automática que não existe neste modelo. Passa a citar violação destes Termos e uso abusivo da plataforma como motivos de suspensão, sem menção a fatura/inadimplência.

## Enforcement técnico

- `lib/plan-limits.ts`: `Plan` passa a ser `"free" | "starter" | "pro"` (sem usar `null` como sentinela de "em trial" — todo store sempre tem um plano explícito agora). Adiciona `FREE_LIMITS` (8/1/1). A função de limites recebe `plan` + `trialEndsAt` e aplica a lógica de rebaixamento descrita acima.
- `lib/types.ts` (`StoreSettings.plan`) e demais tipagens que referenciam `Plan` acompanham a mudança (deixa de aceitar `null`).
- Migration nova: relaxar o `check (plan in ('starter', 'pro'))` da tabela `stores` (`supabase/migrations/20260616031248_init_auth.sql`) para incluir `'free'`. Não envolve nenhuma coluna nova exposta ao público — `plan` não está em `STORE_COLS`/grant do `anon` (não é lido pelo catálogo público), então a regra de GRANT do `AGENTS.md` não se aplica aqui.
- `__tests__/plan-limits.test.ts`: reescrito para os 3 planos + cenários de rebaixamento (paga com `trial_ends_at` no passado cai pra Free; paga com `trial_ends_at` nulo ou futuro mantém os limites do plano).

## Fora de escopo (não incluído agora)

- Aviso de contagem regressiva no painel antes de um plano pago manual expirar (o lojista só percebe quando tenta ultrapassar o limite Free).
- Qualquer automação de cobrança/gateway de pagamento — permanece como está, revisitado só depois da validação (ver `docs/roadmap/Escopo.md` §6 e §11).
- Tela/Server Action de admin para liberar planos — liberação continua manual via Supabase.
