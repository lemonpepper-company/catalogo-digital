"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStore } from "@/lib/server/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  criarCliente,
  atualizarCliente,
  criarCheckoutCartao,
  criarAssinaturaPix,
  atualizarAssinatura,
  cancelarAssinatura as cancelarNoAsaas,
  criarCobrancaAvulsa,
} from "@/lib/asaas/subscriptions";
import { proporcional, type PaidPlan } from "@/lib/asaas/plans";
import { PLAN_RANK } from "@/lib/plan-limits";
import type { BillingCycle } from "@/lib/asaas/events";
import { validarDocumento, normalizarDocumento } from "@/lib/validation/documento";
import { validarCep, normalizarCep } from "@/lib/validation/cep";
import type { StoreSettings } from "@/lib/types";

export type AssinaturaState =
  | { error: string }
  // redirectUrl: cartão — sai do site, checkout hospedado do Asaas.
  // pixUrl: Pix — fica no site, é o link da cobrança pra pagar (não navega
  // sozinho, quem decide mostrar é o client).
  | { ok: true; redirectUrl?: string; pixUrl?: string }
  | null;

export type MeioPagamento = "CREDIT_CARD" | "PIX";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function amanha(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Mesmos campos em iniciarAssinatura e trocarPlano — os dois sincronizam o
 * customer no Asaas antes de cobrar, e duplicar essa montagem convida os
 * dois caminhos a divergirem (achado ao vivo: upgrade saía com bairro e
 * telefone vazios porque só iniciarAssinatura sincronizava).
 */
function montarDadosCliente(
  store: Pick<
    StoreSettings,
    "name" | "document" | "whatsapp" | "address" | "addressNumber" | "addressProvince" | "addressCity" | "addressPostalCode"
  >,
  email: string
) {
  return {
    name: store.name,
    cpfCnpj: store.document ?? "",
    email,
    phone: (store.whatsapp ?? "").replace(/\D/g, ""),
    ...(store.address
      ? {
          address: store.address,
          addressNumber: store.addressNumber ?? undefined,
          province: store.addressProvince ?? undefined,
          city: store.addressCity ?? undefined,
          postalCode: store.addressPostalCode ?? undefined,
        }
      : {}),
  };
}

/**
 * Cria a assinatura no Asaas e guarda apenas identificadores. `plan` e
 * `plan_expires_at` continuam intocados — quem concede acesso é o webhook,
 * quando o pagamento confirmar.
 */
export async function iniciarAssinatura(
  plan: PaidPlan,
  cycle: BillingCycle,
  meio: MeioPagamento
): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  // Cancelar mantém o acesso até plan_expires_at — assinar de novo no mesmo
  // plano (ou num plano menor) nesse período cobraria duas vezes o mesmo
  // intervalo. Bloquear tudo seria pior (impediria pagar mais), então só o
  // upgrade fica liberado. Data no passado significa que o período já
  // acabou, então qualquer plano segue liberado normalmente — é por isso que
  // a checagem usa plan_expires_at, não só subscription_status.
  if (
    store.subscriptionStatus === "canceled" &&
    store.planExpiresAt &&
    new Date(store.planExpiresAt) > new Date() &&
    PLAN_RANK[plan] <= PLAN_RANK[store.plan]
  ) {
    return {
      error:
        plan === store.plan
          ? "Você já tem esse plano até o fim do período atual. Aguarde para renovar."
          : "Para mudar para um plano menor, aguarde o fim do período atual.",
    };
  }

  const supabase = createAdminClient();

  try {
    // Os dois meios criam/reaproveitam o customer no Asaas antes de gerar a
    // cobrança — sem isso o checkout hospedado de cartão não tem quem
    // preencher e pede nome/CPF/endereço do zero pro lojista, mesmo já
    // tendo esses dados salvos (achado testando ao vivo: o Pix já fazia
    // isso, só o cartão não). POST /v3/customers exige cpfCnpj — sem
    // documento, devolve o código de controle que a Task 7 usa pra abrir a
    // modal de coleta.
    if (!store.document) return { error: "DOCUMENTO_NECESSARIO" };

    // O Asaas exige email e telefone no customer pra usá-lo num checkout
    // ("O campo email/phone deve existir para o customer informado") —
    // achados testando ao vivo o cartão, um de cada vez. `stores` não tem
    // coluna de email (é só auth.users), tem que buscar do usuário
    // autenticado; o telefone já existe como whatsapp da loja.
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user?.email) return { error: "E-mail da conta não encontrado." };
    if (!store.whatsapp) return { error: "WhatsApp da loja não cadastrado." };

    // Só o checkout hospedado de cartão exige endereço completo no customer
    // — o Pix nunca pediu (não passa pelo POST /v3/checkouts). Código de
    // controle igual ao DOCUMENTO_NECESSARIO, mesma modal genérica.
    if (
      meio === "CREDIT_CARD" &&
      (!store.address || !store.addressNumber || !store.addressPostalCode)
    ) {
      return { error: "ENDERECO_NECESSARIO" };
    }

    const dadosCliente = montarDadosCliente(store, user.email);

    let customerId = store.asaasCustomerId;
    if (customerId) {
      // Reaproveitar sem sincronizar repete o mesmo erro pra sempre: um
      // customer criado antes desses campos existirem (ou antes do lojista
      // cadastrar o endereço) fica com o cadastro incompleto no Asaas.
      await atualizarCliente(customerId, dadosCliente);
    } else {
      customerId = (await criarCliente({ ...dadosCliente, externalReference: store.id })).id;
    }

    if (meio === "CREDIT_CARD") {
      const checkout = await criarCheckoutCartao({
        customerId,
        plan,
        cycle,
        storeId: store.id,
        primeiroVencimento: amanha(),
        successUrl: `${siteUrl()}/painel/assinatura?status=ok`,
        cancelUrl: `${siteUrl()}/painel/assinatura?status=cancelado`,
        expiredUrl: `${siteUrl()}/painel/assinatura?status=expirado`,
      });

      // pending_plan é o único jeito do webhook saber para qual plano promover
      // quando PAYMENT_CONFIRMED chegar — sem isso a primeira assinatura nunca
      // sai do Free, mesmo com o pagamento confirmado (mesma semântica do
      // downgrade: "plano a aplicar na próxima confirmação").
      await supabase
        .from("stores")
        .update({
          asaas_customer_id: customerId,
          billing_cycle: cycle,
          pending_plan: plan,
        })
        .eq("id", store.id);
      return { ok: true, redirectUrl: checkout.link };
    }

    // Diferente do cartão (checkout hospedado só vira assinatura quando o
    // lojista termina de pagar, e expira sozinho em 60min se abandonado), o
    // Pix cria a assinatura ANTES de qualquer pagamento. Sem cancelar a
    // anterior, cada tentativa abandonada (escolheu o ciclo errado, desistiu,
    // fechou a aba) deixa uma assinatura ACTIVE órfã cobrando pra sempre —
    // achado ao vivo com duas assinaturas simultâneas pro mesmo cliente
    // (sub_3ahobfdsejuo8yrn e sub_3s4z2vt9qhjo9fts). subscription_status nulo
    // é o mesmo critério que o webhook usa pra saber que o vínculo nunca
    // chegou a funcionar (PAYMENT_CONFIRMED/RECEIVED preenche o status) — só
    // essa é seguro cancelar. Falha no cancelamento não pode travar a
    // contratação nova: o resto órfão fica, mas logado, porque é rastro de
    // assinatura que pode ter continuado cobrando.
    if (store.asaasSubscriptionId && !store.subscriptionStatus) {
      try {
        await cancelarNoAsaas(store.asaasSubscriptionId);
      } catch (e) {
        console.error(
          `[assinatura] falha ao cancelar assinatura Pix abandonada da loja ${store.id} (${store.asaasSubscriptionId}):`,
          e
        );
      }
    }

    // Pix não é aceito em chargeTypes RECURRENT (400 no sandbox), então a
    // assinatura é criada direto e o Asaas gera uma cobrança por ciclo.
    const assinatura = await criarAssinaturaPix({
      customerId,
      plan,
      cycle,
      storeId: store.id,
      primeiroVencimento: amanha(),
    });

    await supabase
      .from("stores")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: assinatura.id,
        billing_cycle: cycle,
        pending_plan: plan,
      })
      .eq("id", store.id);

    revalidatePath("/painel/assinatura");
    return { ok: true, pixUrl: assinatura.invoiceUrl ?? undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao iniciar a assinatura." };
  }
}

/**
 * Upgrade cobra a diferença proporcional e downgrade não cobra nada — mas os
 * dois só agendam via pending_plan. NUNCA gravam plan diretamente: a
 * promoção vem sempre do webhook, quando a cobrança (avulsa ou do ciclo)
 * confirmar. Sem pending_plan no upgrade, o PAYMENT_CONFIRMED da cobrança
 * avulsa não teria para qual plano promover — o lojista pagaria a diferença
 * e nunca sairia do plano antigo (mesmo bug que a Task 9 achou em
 * iniciarAssinatura, aqui no caminho de troca de plano).
 */
export async function trocarPlano(
  destino: PaidPlan,
  meio: MeioPagamento
): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };
  if (!store.asaasSubscriptionId) return { error: "Nenhuma assinatura ativa." };

  // Decisão de produto: Pro não troca para Starter — quem quiser reduzir
  // cancela e assina o menor depois. Server Action é endpoint público, o
  // bloqueio no botão do client não é bloqueio — precisa rejeitar aqui antes
  // de qualquer chamada ao Asaas.
  if (store.plan === "pro" && destino === "starter") {
    return { error: "Para mudar para um plano menor, cancele a assinatura atual." };
  }

  const cycle = (store.billingCycle ?? "monthly") as BillingCycle;
  const supabase = createAdminClient();

  try {
    // Sem isso, a fatura do upgrade sai com dados desatualizados (achado ao
    // vivo: bairro e telefone vazios) sempre que o customer foi criado antes
    // do lojista completar o cadastro — mesma sincronização que
    // iniciarAssinatura já faz antes de qualquer cobrança.
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user?.email) return { error: "E-mail da conta não encontrado." };
    if (store.asaasCustomerId) {
      await atualizarCliente(store.asaasCustomerId, montarDadosCliente(store, user.email));
    }

    await atualizarAssinatura({ subscriptionId: store.asaasSubscriptionId, plan: destino, cycle });

    const valor =
      store.plan === "free"
        ? 0
        : proporcional(store.plan as PaidPlan, destino, cycle, store.planExpiresAt ?? "", new Date());

    await supabase.from("stores").update({ pending_plan: destino }).eq("id", store.id);

    // Sem devolver e redirecionar pro invoiceUrl, a cobrança fica criada no
    // Asaas e o lojista nunca vê como pagar (mesma classe de bug que o Pix
    // teve em iniciarAssinatura). billingType usa o meio escolhido no
    // clique — não muda a assinatura recorrente em si (isso segue cobrando
    // no meio já configurado lá), só a cobrança avulsa da diferença.
    let redirectUrl: string | undefined;
    if (valor > 0) {
      const cobranca = await criarCobrancaAvulsa({
        customerId: store.asaasCustomerId!,
        valor,
        storeId: store.id,
        vencimento: amanha(),
        descricao: `Upgrade para ${destino} — diferença proporcional`,
        billingType: meio,
      });
      redirectUrl = cobranca.invoiceUrl;
    }

    revalidatePath("/painel/assinatura");
    return { ok: true, redirectUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao trocar de plano." };
  }
}

/**
 * Única escrita síncrona de estado — e ela só RESTRINGE. `plan_expires_at` fica
 * intacto: o lojista usa até o fim do período que pagou.
 *
 * Também limpa pending_plan: sem isso, cancelar com uma troca de plano
 * aguardando confirmação (iniciarAssinatura ou trocarPlano gravaram
 * pending_plan no clique, antes do pagamento) travava a UI pra sempre em
 * "Troca já em andamento" — a assinatura cancelada nunca mais gera o
 * PAYMENT_CONFIRMED/RECEIVED que normalmente limparia isso, e o lojista
 * ficava sem conseguir assinar de novo (achado ao vivo).
 */
export async function cancelarAssinatura(): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };
  if (!store.asaasSubscriptionId) return { error: "Nenhuma assinatura ativa." };

  try {
    await cancelarNoAsaas(store.asaasSubscriptionId);
    const supabase = createAdminClient();
    await supabase
      .from("stores")
      .update({ subscription_status: "canceled", pending_plan: null })
      .eq("id", store.id);
    revalidatePath("/painel/assinatura");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao cancelar." };
  }
}

/**
 * Coletado pela modal quando o lojista tenta assinar via Pix sem documento.
 * Validado aqui antes de qualquer ida ao Asaas: dígito verificador errado é
 * diagnóstico nosso, e repassar a mensagem crua do gateway seria pior. Roda
 * com o client autenticado, não a service role: `document` é dado da própria
 * loja e `authenticated` já tem grant nela, então a RLS "own store only" é a
 * fronteira correta.
 */
export async function salvarDocumento(valor: string): Promise<AssinaturaState> {
  if (!validarDocumento(valor)) return { error: "CPF ou CNPJ inválido." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ document: normalizarDocumento(valor) })
    .eq("id", store.id);

  if (error) return { error: "Não foi possível salvar o documento." };

  revalidatePath("/painel/assinatura");
  return { ok: true };
}

/**
 * Coletado pela modal quando o lojista tenta assinar via cartão sem
 * endereço — o checkout hospedado exige address/addressNumber/postalCode/
 * province/city no customer, tudo de uma vez (achado testando ao vivo). O
 * cliente sugere rua/bairro/cidade ao sair do campo CEP (app/actions/cep.ts),
 * mas nem todo CEP tem esses três dados no ViaCEP — por isso os campos são
 * editáveis e chegam aqui já prontos, sem nova consulta ao ViaCEP.
 */
export async function salvarEndereco(
  cep: string,
  numero: string,
  rua: string,
  bairro: string,
  cidade: string
): Promise<AssinaturaState> {
  if (!validarCep(cep)) return { error: "CEP inválido." };
  if (!numero.trim()) return { error: "Número é obrigatório." };
  if (!rua.trim()) return { error: "Rua é obrigatória." };
  if (!bairro.trim()) return { error: "Bairro é obrigatório." };
  if (!cidade.trim()) return { error: "Cidade é obrigatória." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({
      address: rua.trim(),
      address_number: numero.trim(),
      address_province: bairro.trim(),
      address_city: cidade.trim(),
      address_postal_code: normalizarCep(cep),
    })
    .eq("id", store.id);

  if (error) return { error: "Não foi possível salvar o endereço." };

  revalidatePath("/painel/assinatura");
  return { ok: true };
}
