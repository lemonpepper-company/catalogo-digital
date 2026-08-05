# Roteiro de teste — Assinatura self-service (Asaas)

**Ambiente:** sandbox do Asaas
**Escopo:** PR #78 — modelagem de assinatura, cobrança e checkout
**Tempo estimado:** ~30 min para o essencial (blocos 1, 3 e 6), ~1 h para tudo

Este roteiro valida o que os testes automatizados não alcançam: o ciclo real de
cobrança, ponta a ponta. Os 1159 testes da suíte cobrem lógica e contratos com
mocks — nenhum deles fala com o Asaas.

---

## Pré-requisitos

### 1. Variáveis de ambiente

`.env.local` na raiz da worktree, com as sete variáveis do `.env.example`:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` — **Supabase local** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` de `npx supabase status` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` de `npx supabase status` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| `ASAAS_BASE_URL` | `https://api-sandbox.asaas.com/v3` |
| `ASAAS_API_KEY` | chave de **sandbox** |
| `ASAAS_WEBHOOK_TOKEN` | string aleatória que você escolhe |

> **O banco precisa ser o local.** Este roteiro força vencimento de cobrança e
> rebaixamento de plano — operações destrutivas do ponto de vista do lojista.
> Apontar para o Supabase remoto significa fazer isso em cima de dados reais.
> Confira antes de começar:
>
> ```bash
> grep NEXT_PUBLIC_SUPABASE_URL .env.local   # tem que ser 127.0.0.1
> npx supabase status                        # tem que estar rodando
> ```
>
> As migrations desta branch **não estão no banco remoto** — só rodam no push
> para a `main`. Localmente, `npx supabase db reset` aplica todas.

> **Armadilha conhecida:** a chave do Asaas começa com `$`. O Next.js expande
> `.env*` com `dotenv-expand`, que interpreta `$algo` como referência a outra
> variável — a chave vira string vazia **em silêncio**. Escape com `\`:
> `ASAAS_API_KEY=\$aact_hmlg_...`
>
> O sintoma é um `401` do Asaas num request que parece ter a chave certa.

### 2. Túnel e webhook

```bash
cloudflared tunnel --url http://localhost:3000
```

No painel do Asaas (**Integrações → Webhooks**), cadastre
`https://<url-do-tunel>/api/webhooks/asaas` com o mesmo valor de
`ASAAS_WEBHOOK_TOKEN` e **marque os seis eventos**:

- `CHECKOUT_PAID`
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`
- `PAYMENT_OVERDUE`
- `PAYMENT_REFUNDED`
- `PAYMENT_CHARGEBACK_REQUESTED`

> **Se algo "simplesmente não acontecer" durante o teste, suspeite daqui
> primeiro.** Evento não marcado não gera erro em lugar nenhum — o webhook
> apenas nunca chega. Sem `PAYMENT_RECEIVED`, por exemplo, nenhuma assinatura
> Pix promove: o Pix pula `PAYMENT_CONFIRMED` e dispara só `RECEIVED`.

### 3. Query de inspeção

Use a cada verificação de banco:

```bash
npx supabase db query "select plan, plan_expires_at, subscription_status, billing_cycle, pending_plan, asaas_customer_id, asaas_subscription_id from public.stores where slug = '<seu-slug>';" -o csv
```

---

## Bloco 1 — Assinatura por cartão

| # | Ação | Esperado | ✓ |
|---|---|---|---|
| 1.1 | Loja Free em `/painel/assinatura`, escolher **Pro mensal** no cartão | Se a loja não tem endereço, abre a modal de CEP com autofill do ViaCEP. Nenhum texto técnico na tela | ☐ |
| 1.2 | Preencher CEP e número | Rua, bairro e cidade preenchem sozinhos; campos editáveis | ☐ |
| 1.3 | Confirmar | Redireciona para o checkout hospedado do Asaas | ☐ |
| 1.4 | **Antes de pagar**, conferir o banco | `pending_plan = 'pro'`, `plan` ainda `free`, `billing_cycle = 'monthly'` | ☐ |
| 1.5 | Pagar com cartão de teste do sandbox | Volta para `/painel/assinatura?status=ok` | ☐ |
| 1.6 | Conferir o banco | `plan = 'pro'`, `pending_plan = null`, `subscription_status = 'active'`, `plan_expires_at` ≈ 1 mês à frente, `asaas_subscription_id` preenchido | ☐ |
| 1.7 | Abrir a vitrine `/{slug}` | Limites do Pro: mais de 50 produtos visíveis, galeria com 5 fotos, destaques sem corte | ☐ |

> **O passo 1.4 é o mais importante deste bloco.** Sem `pending_plan` gravado
> antes do pagamento, o webhook não sabe para qual plano promover — o lojista
> paga e continua no Free. Foi um bug real, corrigido durante a implementação.

---

## Bloco 2 — Assinatura por Pix e a modal de documento

O Pix não passa pelo checkout hospedado (o Asaas só aceita cartão em cobrança
recorrente), então a assinatura é criada pela nossa API e exige CPF/CNPJ.

| # | Ação | Esperado | ✓ |
|---|---|---|---|
| 2.1 | Loja **sem** `document`, escolher Pix e clicar em assinar | Abre a modal de CPF/CNPJ. **Nenhum texto técnico visível** — nem `DOCUMENTO_NECESSARIO`, nem mensagem crua do Asaas | ☐ |
| 2.2 | Digitar um CPF com dígito verificador errado | Erro nosso, imediato, sem chamada ao Asaas | ☐ |
| 2.3 | Digitar CPF válido e confirmar | Salva e **refaz a assinatura sozinho** — sem precisar clicar em "assinar" de novo | ☐ |
| 2.4 | Após criar | Tela mostra o link de pagamento do Pix; banco com `asaas_subscription_id` e `pending_plan`, `plan` ainda `free` | ☐ |
| 2.5 | Pagar a cobrança Pix | Promove o plano (via `PAYMENT_RECEIVED`) | ☐ |
| 2.6 | Navegar pelo painel com Pix em aberto | Banner de cobrança pendente aparece **sem travar o carregamento** das páginas | ☐ |

---

## Bloco 3 — Degradação automática

**O bloco mais importante do roteiro.** É o que prova que cobrança, modelagem e
truncamento da vitrine formam um ciclo fechado.

| # | Ação | Esperado | ✓ |
|---|---|---|---|
| 3.1 | No sandbox, marcar a cobrança do ciclo como vencida | `subscription_status = 'past_due'`, `plan_expires_at` = vencimento **+ 3 dias** | ☐ |
| 3.2 | Abrir a vitrine | **Continua no plano pago.** A graça é acesso de verdade, não só aviso | ☐ |
| 3.3 | Abrir o painel | Aviso de cobrança falhada com a data limite | ☐ |
| 3.4 | Forçar o fim da graça (comando abaixo) | — | ☐ |
| 3.5 | Abrir a vitrine | **Cai para Free sozinha:** 8 produtos, 1 foto por produto, sem destaques, tema padrão | ☐ |
| 3.6 | Se a loja tiver domínio próprio | Passa a redirecionar (307) para `/{slug}` | ☐ |
| 3.7 | Conferir o banco | Nada foi apagado — produtos, fotos e categorias continuam lá | ☐ |

```bash
npx supabase db query "update public.stores set plan_expires_at = now() - interval '1 minute' where slug = '<seu-slug>';"
```

> Nenhum job roda para isso acontecer. O rebaixamento é derivado na leitura, a
> cada request — por isso o passo 3.5 é imediato, sem esperar nada.

---

## Bloco 4 — Troca de plano

| # | Ação | Esperado | ✓ |
|---|---|---|---|
| 4.1 | Com Starter ativo, fazer upgrade para Pro | Cobrança avulsa criada, com o link de pagamento exibido na tela | ☐ |
| 4.2 | **Antes de pagar** | `pending_plan = 'pro'`, `plan` **ainda** `starter` | ☐ |
| 4.3 | Conferir o valor da cobrança | Proporcional ao que resta do ciclo — não os R$ 30,00 cheios da diferença | ☐ |
| 4.4 | Pagar | `plan = 'pro'`, `pending_plan = null` | ☐ |
| 4.5 | Com Pro ativo, fazer downgrade para Starter | `pending_plan = 'starter'`, **nenhuma cobrança**, `plan` segue `pro` | ☐ |
| 4.6 | Abrir a vitrine após o downgrade | Ainda com limites do Pro — downgrade só vale na virada do ciclo | ☐ |
| 4.7 | Tela de assinatura | Anuncia "muda para Starter em {data}" | ☐ |

---

## Bloco 5 — Cancelamento

| # | Ação | Esperado | ✓ |
|---|---|---|---|
| 5.1 | Cancelar a assinatura | `subscription_status = 'canceled'`, `plan_expires_at` **intacto**, `pending_plan = null` | ☐ |
| 5.2 | Abrir a vitrine | Continua no plano pago | ☐ |
| 5.3 | Tela de assinatura | "Sua assinatura termina em {data}" | ☐ |
| 5.4 | Forçar a data a passar | Cai para Free | ☐ |

---

## Bloco 6 — Resiliência do webhook

Estes usam `curl` direto contra a rota local. Substitua `<TOKEN>` pelo valor de
`ASAAS_WEBHOOK_TOKEN`.

| # | Ação | Esperado | ✓ |
|---|---|---|---|
| 6.1 | Requisição com token errado | `401`, nada gravado | ☐ |
| 6.2 | Mesmo `PAYMENT_OVERDUE` enviado três vezes | `plan_expires_at` **idêntico** nas três — não acumula 9 dias de graça | ☐ |
| 6.3 | Evento inexistente (`EVENTO_QUALQUER`) | `200`, nada gravado | ☐ |
| 6.4 | `dueDate` inválido | `200`, com log de erro no servidor | ☐ |

```bash
# 6.1 — token errado
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/asaas \
  -H "asaas-access-token: errado" -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_CONFIRMED","payment":{"dueDate":"2026-09-01"}}'

# 6.2 — idempotência (rodar 3x e comparar plan_expires_at entre as execuções)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/asaas \
  -H "asaas-access-token: <TOKEN>" -H "Content-Type: application/json" \
  -d '{"event":"PAYMENT_OVERDUE","payment":{"dueDate":"2026-09-01","externalReference":"<store-id>"}}'

# 6.3 — evento não tratado
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/asaas \
  -H "asaas-access-token: <TOKEN>" -H "Content-Type: application/json" \
  -d '{"event":"EVENTO_QUALQUER","payment":{"dueDate":"2026-09-01","externalReference":"<store-id>"}}'
```

> **Por que 200 para evento desconhecido?** A entrega do Asaas é *at-least-once*,
> mas **15 respostas não-2xx consecutivas pausam a fila** do lado deles — os
> eventos continuam sendo gerados e param de ser entregues até reativação manual.
> Responder erro para um evento que não nos interessa congelaria o estado de
> assinatura de toda a base, em silêncio.

---

## Ordem sugerida

**Essencial (~30 min):** blocos 1 → 3 → 6.
**Completo:** acrescentar 2, 4 e 5.

Se só houver tempo para um cenário, faça o **3.5**: é o que amarra as três
entregas — cobrança, modelagem de acesso e truncamento da vitrine.

## Ao encontrar um problema

Anote o número do cenário, o estado do banco (saída da query de inspeção) e o
log do servidor. Os três suspeitos mais prováveis, nesta ordem:

1. **Evento não marcado** no cadastro do webhook — sintoma: nada acontece, sem erro
2. **`ASAAS_API_KEY` sem escape do `$`** — sintoma: `401` do Asaas
3. **Token divergente** entre `.env.local` e o painel — sintoma: `401` na nossa rota
