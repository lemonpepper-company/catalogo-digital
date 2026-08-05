import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelarAssinatura as cancelarNoAsaas } from "@/lib/asaas/subscriptions";
import {
  translateEvent,
  storeIdFromEvent,
  checkoutLinkFromEvent,
  checkoutSessionFromEvent,
  type AsaasWebhookEvent,
  type BillingCycle,
} from "@/lib/asaas/events";

// CHECKOUT_PAID chega em segundos ou nunca chega — se o evento não estiver
// marcado no cadastro do webhook (risco documentado em .env.example), o
// pagamento por checkoutSession fica órfão para sempre, e devolver 409
// indefinidamente pausaria a fila do Asaas depois de 15 tentativas — não só
// para esta loja, para a base inteira. 30min é folga generosa sobre o "chega
// em segundos" sem deixar a corrida se arrastar por muito tempo.
const LIMITE_ORFAO_MINUTOS = 30;

/**
 * Sem `dateCreated` no payload, trata como antigo (não insiste) — é mais
 * seguro devolver 200 e perder um evento raro sem essa data do que arriscar
 * pausar a fila por um cálculo de idade que não dá para fazer.
 */
function pagamentoRecente(dateCreated: string | null | undefined, agora: Date): boolean {
  if (!dateCreated) return false;
  const criado = new Date(dateCreated).getTime();
  if (Number.isNaN(criado)) return false;
  const idadeMinutos = (agora.getTime() - criado) / 60000;
  return idadeMinutos < LIMITE_ORFAO_MINUTOS;
}

function autorizado(request: Request): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado) return false;

  const recebido = request.headers.get("asaas-access-token") ?? "";
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // timingSafeEqual lança se os comprimentos diferirem — comparar antes.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Única superfície que concede ou estende acesso. Server Actions gravam
 * identificadores e pending_plan; a promoção de plano e a validade vêm daqui.
 *
 * Política de status: 200 para tudo que não seja falha nossa OU uma corrida
 * conhecida (checkoutSession órfão, ver abaixo). A entrega do Asaas é
 * at-least-once, mas 15 respostas não-2xx consecutivas PAUSAM a fila — os
 * eventos seguem sendo gerados e param de ser entregues até reativação
 * manual. Devolver erro para evento irrelevante congelaria o estado de
 * assinatura de toda a base, em silêncio.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const evento = (await request.json().catch(() => null)) as AsaasWebhookEvent | null;
  if (!evento?.event) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();

  // Checkout hospedado (cartão): o externalReference do checkout NÃO propaga
  // para a subscription/payment gerada, e checkout.customer vem null no
  // CHECKOUT_PAID (confirmado no sandbox) — então usamos checkout.id como
  // vínculo temporário em asaas_subscription_id. Ele reaparece como
  // payment.checkoutSession no evento de pagamento seguinte, que é como os
  // eventos PAYMENT_* (sem externalReference) vão se identificar; uma vez
  // casada a loja, o valor é substituído pelo id real da assinatura (abaixo).
  //
  // A entrega é at-least-once — se este CHECKOUT_PAID for reentregue DEPOIS
  // do PAYMENT_CONFIRMED já ter trocado o vínculo pelo id real, a escrita
  // sem guarda voltaria a apontar para checkout.id, quebrando o match das
  // próximas renovações. O filtro abaixo só escreve se a coluna ainda
  // estiver vazia ou já for este mesmo checkout.id — nunca sobrescreve um id
  // de assinatura real já resolvido.
  const link = checkoutLinkFromEvent(evento);
  if (link) {
    const { error } = await supabase
      .from("stores")
      .update({ asaas_subscription_id: link.checkoutId })
      .eq("id", link.storeId)
      .or(`asaas_subscription_id.is.null,asaas_subscription_id.eq.${link.checkoutId}`);
    if (error) {
      console.error(`[webhook asaas] falha ao vincular checkout da loja ${link.storeId}:`, error);
      return NextResponse.json({ error: "Falha ao gravar." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const storeId = storeIdFromEvent(evento);

  const supabaseLoja = supabase
    .from("stores")
    .select("id, billing_cycle, pending_plan, subscription_status, asaas_subscription_id");
  const checkoutSession = storeId ? null : checkoutSessionFromEvent(evento);
  type LojaRow = {
    id: string;
    billing_cycle: string | null;
    pending_plan: string | null;
    subscription_status: string | null;
    asaas_subscription_id: string | null;
  };
  let loja: LojaRow | null = null;
  // Só true quando a busca por checkoutSession não achou ninguém — sinal de
  // corrida (CHECKOUT_PAID ainda não gravou o vínculo temporário), não de
  // loja inexistente (ver uso abaixo).
  let checkoutSessionOrfao = false;
  if (storeId) {
    ({ data: loja } = await supabaseLoja.eq("id", storeId).maybeSingle());
  } else if (checkoutSession) {
    ({ data: loja } = await supabaseLoja.eq("asaas_subscription_id", checkoutSession).maybeSingle());
    if (!loja) checkoutSessionOrfao = true;
  } else if (evento.payment?.subscription) {
    // Renovação de assinatura criada via checkout hospedado: sem
    // externalReference nem checkoutSession, casa pela assinatura real já
    // vinculada no primeiro PAYMENT_CONFIRMED (ver bloco acima).
    ({ data: loja } = await supabaseLoja
      .eq("asaas_subscription_id", evento.payment.subscription)
      .maybeSingle());
  }

  if (!loja) {
    console.warn(
      `[webhook asaas] evento ${evento.event} sem loja casada (storeId=${storeId}, checkoutSession=${checkoutSession}, subscription=${evento.payment?.subscription})`
    );
    // A entrega do Asaas não garante ordem entre CHECKOUT_PAID e o
    // PAYMENT_CONFIRMED/RECEIVED seguinte — se este pagamento chegou por
    // checkoutSession e não achou loja, é porque CHECKOUT_PAID (que grava o
    // vínculo temporário) ainda não foi processado, não porque a loja não
    // existe. 200 aqui descartaria o evento para sempre (o Asaas só reenvia
    // depois de uma resposta não-2xx); 409 força o reenvio, dando tempo do
    // CHECKOUT_PAID chegar — sem isso a assinatura fica órfã: paga, mas
    // nunca promovida.
    //
    // Mas só até LIMITE_ORFAO_MINUTOS: se CHECKOUT_PAID nunca chegar (o
    // cenário mais provável é o evento não estar marcado no cadastro do
    // webhook no painel do Asaas — risco que .env.example documenta), este
    // pagamento voltaria a devolver 409 pra sempre, e 15 respostas não-2xx
    // consecutivas pausam a fila inteira — não só desta loja, da base
    // toda. Passado o limite, o dado já está perdido; preservar a fila vale
    // mais que insistir num evento que nunca vai casar.
    if (checkoutSessionOrfao) {
      if (pagamentoRecente(evento.payment?.dateCreated, new Date())) {
        return NextResponse.json({ error: "Aguardando CHECKOUT_PAID." }, { status: 409 });
      }
      console.error(
        `[webhook asaas] checkoutSession=${checkoutSession} órfão além de ${LIMITE_ORFAO_MINUTOS}min — CHECKOUT_PAID não chegou a tempo (confira se o evento está marcado no cadastro do webhook no painel do Asaas). Pagamento perdido, respondendo 200 para não pausar a fila.`
      );
      return NextResponse.json({ ok: true });
    }
    // Loja inexistente (de fato) é 200 de propósito: reenviar não faria a
    // loja aparecer, e insistir queimaria as 15 tentativas que pausam a
    // fila. Mas um PAYMENT_CONFIRMED sem loja casada é o sintoma de maior
    // gravidade deste sistema — um cliente pagou e ninguém sabe para qual
    // loja — por isso o log acima, mesmo respondendo 200.
    return NextResponse.json({ ok: true });
  }

  const cycle = (loja.billing_cycle ?? "monthly") as BillingCycle;

  // Payload malformado (ex.: dueDate inválido) faz translateEvent lançar.
  // Não é falha nossa: é dado externo não processável, e a política é a mesma
  // de "evento não tratado" — 200 sem gravar, para não queimar uma das 15
  // tentativas que pausam a fila do Asaas.
  let mudanca;
  try {
    mudanca = translateEvent(evento, cycle, new Date());
  } catch (err) {
    console.error(`[webhook asaas] payload não processável para loja ${loja.id}:`, err);
    return NextResponse.json({ ok: true });
  }
  if (!mudanca) return NextResponse.json({ ok: true });

  // A cobrança avulsa do upgrade (diferença proporcional, ver trocarPlano em
  // app/actions/assinatura.ts) não pertence a uma assinatura — não tem
  // payment.subscription, só externalReference com o storeId. ela só pode
  // PROMOVER um pending_plan já agendado; nunca deve mexer em
  // subscription_status/plan_expires_at, que são o estado da assinatura
  // recorrente de verdade, gerido pelos próprios eventos dela. Sem essa
  // guarda: confirmar essa cobrança estendia plan_expires_at um ciclo inteiro
  // a partir de amanhã (o vencimento da cobrança avulsa, não da assinatura),
  // e um estorno/chargeback dela cancelava a assinatura inteira por engano.
  const ehCobrancaAvulsa = !evento.payment?.subscription;

  // Pix nunca pago: sem cartão pra tentar de novo sozinho, o Asaas segue
  // gerando uma cobrança nova a cada ciclo indefinidamente mesmo com a
  // assinatura vencida. O acesso já foi cortado (plan_expires_at no passado
  // via getEffectivePlan), mas a assinatura fica "viva" no Asaas cobrando
  // alguém que nunca paga. Um segundo PAYMENT_OVERDUE consecutivo — a loja já
  // estava past_due quando este novo ciclo venceu de novo — é o sinal de que
  // o cliente não vai pagar: cancela no Asaas pra parar de gerar cobrança.
  const overdueRepetido =
    !ehCobrancaAvulsa &&
    evento.event === "PAYMENT_OVERDUE" &&
    loja.subscription_status === "past_due";

  if (overdueRepetido && loja.asaas_subscription_id) {
    try {
      await cancelarNoAsaas(loja.asaas_subscription_id);
    } catch (e) {
      console.error(
        `[webhook asaas] falha ao cancelar assinatura Pix nunca paga da loja ${loja.id}:`,
        e
      );
    }
  }

  const patch: Record<string, unknown> = {};

  if (!ehCobrancaAvulsa) {
    if (overdueRepetido) {
      patch.subscription_status = "canceled";
    } else {
      patch.subscription_status = mudanca.subscriptionStatus;
      patch.plan_expires_at = mudanca.planExpiresAt;
    }
  }

  // Downgrade agendado (ou upgrade pago via cobrança avulsa) vira o plano em
  // vigor quando o pagamento confirma.
  if (mudanca.applyPendingPlan && loja.pending_plan) {
    patch.plan = loja.pending_plan;
    patch.pending_plan = null;
  }

  // Casou pelo vínculo temporário de checkout (asaas_subscription_id ainda
  // guardava checkout.id, não uma assinatura) — substitui pelos identificadores
  // reais, para que a próxima renovação (sem checkoutSession) case por
  // payment.subscription normalmente.
  if (checkoutSession) {
    if (evento.payment?.customer) patch.asaas_customer_id = evento.payment.customer;
    if (evento.payment?.subscription) patch.asaas_subscription_id = evento.payment.subscription;
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("stores").update(patch).eq("id", loja.id);

  if (error) {
    // Único caso de 5xx: falha nossa, e queremos o reenvio.
    console.error(`[webhook asaas] falha ao gravar loja ${loja.id}:`, error);
    return NextResponse.json({ error: "Falha ao gravar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
