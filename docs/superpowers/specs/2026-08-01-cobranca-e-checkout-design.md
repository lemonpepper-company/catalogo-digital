# Cobrança e checkout self-service com Asaas

**Data:** 2026-08-01
**Status:** Aprovado para planejamento

## Objetivo

Hoje o lojista não tem como pagar. Os planos são liberados à mão, direto no banco, e os sete pontos de upsell do produto levam a uma conversa no WhatsApp. Isso não fecha na economia do produto: a margem líquida por assinante Starter é de R$ 23–25/mês, e uma venda que consome 30–40 minutos de atendimento gasta mais de um mês de margem antes de qualquer suporte.

Esta spec fecha o ciclo: o lojista assina sozinho, o gateway cobra, e o acesso sobe e desce sem ninguém no meio.

A [Spec 2A](2026-08-01-modelagem-assinatura-design.md) já deixou o estado modelado (`plan_expires_at`, `subscription_status`, `billing_cycle`, `asaas_customer_id`, `asaas_subscription_id`) e as duas funções `security definer` derivando acesso de `plan_expires_at`. Nada aqui muda a regra de leitura — esta spec só passa a **escrever** aquele estado, e o faz por um único caminho.

## Decisões de produto herdadas

Fechadas em conversa anterior, registradas aqui para não serem rediscutidas:

- Starter R$ 29,90/mês ou R$ 299/ano; Pro R$ 59,90/mês ou R$ 599/ano.
- Upgrade cobra proporcional; downgrade só na virada do ciclo.
- Cancelamento mantém acesso até o fim do período pago.
- Falha de pagamento dá 3 dias de graça antes de cair para Free.
- Sem trial dos planos pagos — o Free permanente é a porta de entrada.
- Sem clientes pagantes hoje, logo sem grandfathering.

## Duas descobertas que mudaram o desenho

Ambas vieram da documentação oficial durante o design, e ambas contrariam premissas que estavam valendo.

### Pix Automático não entra no lançamento

A escolha do Asaas foi justificada pela taxa do Pix Automático (~1% contra ~6% de cartão via Stripe). Só que **Pix Automático e Assinaturas são produtos distintos**: em Assinaturas o Asaas controla a recorrência; em Pix Automático (Jornada 3) *"cabe à integração criar cada nova cobrança"*, respeitando uma janela de 2 a 10 dias úteis antes de cada vencimento.

Isso exigiria Vercel Cron (o projeto não tem `vercel.json`), idempotência de criação de cobrança e tratamento de autorização revogada — e criaria uma superfície de falha nova, em que cron que não roda é receita que não entra, silenciosamente.

A R$ 29,90, a diferença entre ~1% e ~4% é R$ 0,90 por assinante/mês. Com 50 assinantes, R$ 45/mês — menos do que custa manter um pipeline de cobrança agendada. **Pix Automático fica para uma spec futura, quando o volume justificar.**

Consequência prática: `CREDIT_CARD` é débito automático de verdade; `PIX` gera uma cobrança por ciclo que o lojista paga.

### O Asaas não faz proporcional

Atualizar uma assinatura muda `value`, `cycle` e `billingType`, mas *"alterações de valor e forma de pagamento afetam somente cobranças futuras"*. Não há pro rata automático.

O proporcional do upgrade é código nosso: atualizar a assinatura (vale do próximo ciclo), criar uma **cobrança avulsa** com a diferença do ciclo corrente, e trocar o plano só quando essa cobrança confirmar.

### Anual é à vista

Assinatura no Asaas não aceita `installmentCount` — parcelamento existe só em cobrança avulsa. Anual no cartão é R$ 299 ou R$ 599 numa fatura só.

Parcelar em 12x seria comercialmente melhor, mas deixaria de ser assinatura: viraria cobrança avulsa parcelada, sem renovação automática, exigindo rotina de renovação e aviso. Como não há assinantes ainda, o anual é hipótese — **lança à vista**, e o parcelado é revisto com dados se a adoção for baixa.

## Escopo

**Dentro:**
- Migration adicionando `pending_plan` em `stores`, com `grant update` para `service_role` e a checagem no guard de privilégios do CI.
- `lib/asaas/` — client HTTP, operações de assinatura, tradução pura de eventos.
- `app/api/webhooks/asaas/route.ts` — recebe, autentica e aplica.
- Server Actions de assinar, trocar de plano e cancelar.
- Página `/painel/assinatura`.
- Preços em `app/page.tsx` e redirecionamento dos sete CTAs de upsell.
- `.env.example` documentando as variáveis novas.

**Fora desta rodada:**
- Pix Automático e qualquer cobrança agendada.
- Anual parcelado.
- Histórico de faturas no painel — o lojista consulta no Asaas. Se virar necessidade, uma tabela `subscription_events` append-only escrita pelo webhook resolve sem tocar no caminho de leitura.
- Cupom, desconto e período promocional.
- E-mail transacional de cobrança — o Asaas já envia os dele.

**Pré-requisito externo:** o drop de `trial_ends_at` (Spec 2A) deve ser mergeado antes ou depois desta spec, nunca no mesmo PR. `supabase-migrations.yml` aplica migrations no push para a main independente do deploy da Vercel.

## Arquitetura

### Módulos

**`lib/asaas/client.ts`** — HTTP sobre `fetch`, com `import "server-only"`. Lê `ASAAS_API_KEY` e `ASAAS_BASE_URL`. Não conhece assinatura, plano nem loja.

**`lib/asaas/subscriptions.ts`** — criar cliente, criar assinatura, atualizar, cancelar, criar cobrança avulsa. Fala Asaas, não fala Vtrine.

**`lib/asaas/events.ts`** — **puro, sem I/O.** Recebe o corpo de um evento e devolve a mudança pretendida: `{ subscriptionStatus, planExpiresAt, plan }`. É onde o vocabulário do Asaas vira o nosso. Testável sem rede e sem banco.

**`app/api/webhooks/asaas/route.ts`** — autentica, chama `events.ts`, aplica com service role.

### A regra que governa tudo

**O webhook é a única coisa que escreve `plan`, `plan_expires_at` e `subscription_status`.** Server Actions criam recursos no Asaas e gravam apenas identificadores (`asaas_customer_id`, `asaas_subscription_id`) — nunca estado de acesso.

Sem isso, nós e o gateway divergem, e "esse lojista pagou?" passa a ter duas respostas. É também o que a Spec 2A já preparou: a service role tem `update` exatamente nessas colunas e `authenticated` não tem nenhuma.

## Fluxo de assinatura

**Nenhum dado de cartão passa pelo Vtrine.** Sem tokenização, sem campo de cartão, sem exceção.

**Cartão** — Server Action cria um checkout hospedado (`chargeTypes: ["RECURRENT"]`) e devolve a URL; o lojista paga no Asaas e volta pelo `callback`. O Asaas cria a assinatura e cobra sozinho daí em diante.

**Pix** — confirmado no sandbox em 2026-08-02: o checkout recorrente **não aceita Pix**. `POST /v3/checkouts` com `chargeTypes: ["RECURRENT"]` e Pix em `billingTypes` responde 400 — *"O método de pagamento CREDIT_CARD é o único método de pagamento permitido para operações RECURRENT"* —, sozinho ou acompanhado do cartão. O Asaas exige `DETACHED` para Pix.

Portanto Pix segue outro caminho: criar a assinatura direto em `POST /v3/subscriptions` com `billingType: PIX`. O Asaas gera uma cobrança por ciclo e o lojista paga cada uma; não há checkout hospedado envolvido. Nenhum dado sensível nos toca em nenhuma das duas formas.

**São dois caminhos de código, e isso é estrutural, não acidental.** Cartão passa por checkout hospedado e o lojista sai do site; Pix é criado pela API e o lojista recebe uma cobrança. A página de assinatura precisa refletir essa diferença — no cartão, "você será redirecionado"; no Pix, "geramos sua cobrança mensal".

**Upgrade** — atualizar a assinatura no Asaas, criar a cobrança avulsa da diferença proporcional, e trocar o plano **só quando o webhook confirmar**. Um caminho para cartão e Pix. Nunca existe plano liberado sem pagamento correspondente.

**Cancelamento** não gera cobrança: cancela a assinatura no Asaas e deixa `plan_expires_at` intacto. O acesso cai sozinho quando a data chega — a regra da Spec 2A já faz isso, sem código novo.

**Downgrade precisa de uma coluna nova.** A Spec 2A modelou o plano em vigor, não uma mudança futura, e "downgrade só na virada" é exatamente isso: a loja segue Pro até o fim do ciclo pago e vira Starter depois. Gravar `plan = 'starter'` no pedido derrubaria o Pro na hora, porque `getEffectivePlan` devolve `plan` enquanto a data não venceu. Não gravar nada deixa o webhook do próximo ciclo sem saber que o plano mudou.

Esta spec adiciona **`pending_plan text null`** em `stores`, com `check (pending_plan in ('free','starter','pro'))`:

- No pedido de downgrade: atualiza a assinatura no Asaas e grava `pending_plan`.
- No `PAYMENT_CONFIRMED` seguinte: se houver `pending_plan`, ele vira `plan` e a coluna é limpa.
- Cancelar o downgrade antes da virada é limpar `pending_plan` e restaurar o valor da assinatura.

A alternativa considerada e descartada foi o webhook deduzir o plano pelo `value` da cobrança. Funciona, mas amarra a resolução de plano à tabela de preços — mudar R$ 59,90 no futuro quebraria a promoção de plano de todo mundo, e o sintoma apareceria longe da causa.

A coluna segue as mesmas regras das da Spec 2A: `grant update` só para `service_role`, nada para `authenticated` ou `anon`, e a mesma verificação no guard de privilégios do CI.

## Webhook

**Autenticação** no padrão de [app/api/admin/revalidate/route.ts](../../../app/api/admin/revalidate/route.ts): token comparado com `timingSafeEqual`, nunca `===`. O header é **`asaas-access-token`**, e o valor é o token configurado ao registrar o webhook no Asaas.

**A fila do Asaas pausa sozinha.** A entrega é *at-least-once*, mas **15 respostas não-2xx consecutivas interrompem a sincronização**: os eventos continuam sendo gerados e enfileirados, e param de ser enviados até reativação manual no painel. Um bug na rota não causa atraso — congela o estado de assinatura de toda a base, em silêncio, até alguém perceber.

Duas consequências de desenho: responder `200` para qualquer evento não tratado (já previsto acima) deixa de ser cortesia e vira proteção; e o erro de escrita precisa ser logado de forma visível, porque é a única pista antes da fila parar.

**Correlação** por `externalReference`, gravado com o `store.id` na criação da assinatura. Mais robusto que mapear por `asaas_customer_id` e imune a cliente duplicado no Asaas.

**Idempotência.** O Asaas reenvia eventos. Quase todas as escritas são absolutas e reenviar não muda nada. A exceção é o período de graça: descrito como *"empurra `plan_expires_at` em 3 dias"*, ele é relativo — reenviar `PAYMENT_OVERDUE` duas vezes daria seis dias.

**A graça é calculada a partir do vencimento da cobrança, não do valor atual da coluna:** `plan_expires_at = dueDate + 3 dias`. Absoluto, e reenviar não altera o resultado.

**Eventos tratados**, de uma lista com mais de vinte:

| Evento | Efeito |
|---|---|
| `PAYMENT_CONFIRMED` | `active`; `plan_expires_at = dueDate + ciclo`; aplica `pending_plan` se houver |
| `PAYMENT_OVERDUE` | `past_due`; `plan_expires_at = dueDate + 3 dias` |
| `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED` | `canceled`; acesso encerra imediatamente |
| cancelamento da assinatura | `canceled`; `plan_expires_at` intacto |

Todo o resto responde `200` e é ignorado. Devolver erro para evento que não interessa faz o Asaas reenviar em loop.

**`PAYMENT_CONFIRMED`, não `PAYMENT_RECEIVED`.** Confirmado é o cliente ter pago; recebido é o dinheiro cair na conta, o que leva dias. Liberar só no recebido puniria o lojista por latência bancária.

## Máquina de estados

Acesso continua derivado só de `plan` + `plan_expires_at`. Nenhum estado novo entra na regra de leitura.

```
sem assinatura   → status null,      plan free
assina           → status active,    plan contratado, expires = venc + ciclo
renova           → status active,    expires estendido
falha            → status past_due,  expires = venc + 3d      ← vitrine no ar
paga em atraso   → status active,    expires = venc + ciclo
graça vence      → status past_due,  expires no passado       ← cai para free sozinho
cancela          → status canceled,  expires intacto          ← usa até o fim
upgrade          → só após webhook confirmar a cobrança proporcional
downgrade        → pending_plan gravado; vira plan no próximo PAYMENT_CONFIRMED
```

**Nenhuma transição depende de job agendado.** "Graça vence" e "cancelamento chega ao fim" não são eventos — são a data passando, e a leitura já trata isso.

## UI

**`/painel/assinatura`** — plano atual, status legível (*"renova em 12 de setembro"*, *"cobrança falhou — regularize até 15 de agosto"*, *"termina em 30 de agosto"*), os quatro botões de contratação (Starter/Pro × mensal/anual) e cancelar. É a única superfície do painel que fala de dinheiro.

**Os sete CTAs:**

| Arquivo | Destino |
|---|---|
| [components/painel/RecursoBloqueado.tsx:17](../../../components/painel/RecursoBloqueado.tsx) | `/painel/assinatura` |
| [components/painel/UpsellHint.tsx:9](../../../components/painel/UpsellHint.tsx) | `/painel/assinatura` |
| [app/painel/layout.tsx:27](../../../app/painel/layout.tsx) | `/painel/assinatura` |
| [components/loja/DominioField.tsx:24](../../../components/loja/DominioField.tsx) | `/painel/assinatura` |
| [app/painel/produtos/ProdutosClient.tsx:114](../../../app/painel/produtos/ProdutosClient.tsx) — banner de ocultos | `/painel/assinatura` |
| [app/painel/produtos/ProdutosClient.tsx:143](../../../app/painel/produtos/ProdutosClient.tsx) — importação | `/painel/assinatura` |
| [app/page.tsx:378](../../../app/page.tsx) e [:420](../../../app/page.tsx) — cards de plano | `/cadastro` |

A linha 143 tem o número `5535999931678` cravado na URL, fora de `lib/contact` — some junto.

Os dois da landing vão para `/cadastro`: quem está deslogado não tem loja e não pode assinar. Depois do cadastro, o painel leva à assinatura.

`app/page.tsx` troca "Sob consulta" por R$ 29,90 e R$ 59,90, com o anual como "R$ 24,92/mês, cobrado anualmente" — o lojista compara mensalidade com mensalidade.

`UpsellHint` e `RecursoBloqueado` recebem `whatsappMessage` como prop hoje; o parâmetro perde sentido e sai da interface dos dois.

## Tratamento de erro

Falha de rede ao criar assinatura no Asaas devolve erro à Server Action e nada é gravado — o lojista vê a mensagem e tenta de novo. Como nenhum estado de acesso é escrito fora do webhook, uma criação parcial não deixa a loja num plano que ela não pagou.

Webhook com token inválido responde `401` sem tocar no banco. Webhook com payload de evento desconhecido responde `200` e ignora.

Se o webhook falhar ao gravar (banco indisponível), a rota responde erro para que o Asaas reenvie. É o único caso em que queremos reenvio — e a idempotência absoluta descrita acima é o que torna isso seguro.

`ASAAS_API_KEY` ausente faz `lib/asaas/client.ts` lançar na primeira chamada, no mesmo espírito de [lib/supabase/admin.ts](../../../lib/supabase/admin.ts). Nunca com prefixo `NEXT_PUBLIC_`, nunca logada.

## Teste

### Local, antes do deploy

`ASAAS_BASE_URL` apontando para o sandbox e `ASAAS_API_KEY` em `.env.local`. O projeto não tem `.env.example`; esta spec cria um, documentando as três variáveis novas (as duas mais o segredo do webhook).

O webhook precisa de URL pública: túnel (`cloudflared tunnel --url http://localhost:3000` ou ngrok) com a URL registrada no painel sandbox do Asaas. É o único passo que depende de configuração manual.

Roteiro completo:

1. Assinar com cartão de teste do sandbox.
2. Ver `PAYMENT_CONFIRMED` chegar.
3. Conferir `plan`, `plan_expires_at` e `subscription_status` no banco.
4. Conferir que a vitrine liberou os limites do plano.
5. Forçar cobrança vencida no sandbox; ver `past_due` e a graça de 3 dias.
6. Deixar a data passar e confirmar que a vitrine cai para Free sozinha.

O passo 6 é o mais valioso e o mais fácil de pular: é a prova de que o rebaixamento automático funciona ponta a ponta, ligando as três specs.

### Automatizados

Nenhum toca a rede.

`lib/asaas/events.ts` é puro, então cada evento vira teste direto — incluindo o reenvio do mesmo `PAYMENT_OVERDUE` duas vezes produzindo a mesma data.

A rota de webhook é testada com payloads gravados e Supabase mockado, no padrão de `__tests__/registrar-pedido.test.ts`: token inválido → 401; evento desconhecido → 200 sem escrita; `PAYMENT_CONFIRMED` → colunas corretas.

A página `/painel/assinatura` ganha testes de renderização por estado (`active`, `past_due`, `canceled`, sem assinatura), e os sete CTAs ganham asserção de destino — nenhum `wa.me` restante em superfície de upsell.

## Spike — concluído em 2026-08-02

As duas perguntas em aberto foram respondidas antes de qualquer código.

**1. O checkout recorrente aceita Pix?** Não. Verificado contra `POST https://api-sandbox.asaas.com/v3/checkouts`:

| `billingTypes` com `chargeTypes: ["RECURRENT"]` | Resultado |
|---|---|
| `["CREDIT_CARD"]` | `200` — devolve `id` e `link` do checkout hospedado |
| `["PIX"]` | `400` — *"CREDIT_CARD é o único método permitido para operações RECURRENT"* |
| `["CREDIT_CARD","PIX"]` | `400` — mesmo erro |

**2. Qual o header de autenticação do webhook?** `asaas-access-token`, confirmado na documentação oficial.

O spike também trouxe um fato não perguntado e relevante: a fila de webhooks pausa após 15 respostas não-2xx consecutivas (ver seção Webhook).

## Riscos

**Dois caminhos de cobrança dobram a superfície de teste.** O spike confirmou que cartão e Pix não compartilham fluxo: um é checkout hospedado, o outro é criação direta de assinatura. Cada transição da máquina de estados — assinar, renovar, falhar, upgrade — precisa ser exercitada nos dois, e a página de assinatura tem duas narrativas diferentes para o lojista.

**Cobrança proporcional não paga.** Se o lojista pede upgrade, gera a cobrança avulsa e nunca paga, a assinatura já foi atualizada no Asaas para o valor novo enquanto o plano local segue no antigo. O próximo ciclo cobra o valor do plano novo e o webhook então promove. É uma inconsistência temporária aceitável — o lojista paga o novo e recebe o novo —, mas precisa estar visível na página de assinatura para não parecer erro.

**Sandbox não é produção.** Comportamento de risco antifraude, captura de cartão e prazos de confirmação diferem. O roteiro local valida a lógica, não a operação real de cobrança.
