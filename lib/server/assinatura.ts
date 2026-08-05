import "server-only";
import { cache } from "react";
import { buscarCobrancaEmAberto } from "@/lib/asaas/subscriptions";

export interface PixPendente {
  invoiceUrl: string;
  dueDate: string;
}

/**
 * Cobrança Pix em aberto da assinatura, se houver — usada tanto no banner
 * global do painel quanto no card da página de Assinatura. cache() dedupa
 * as duas chamadas dentro da mesma navegação (o layout e a página rodam no
 * mesmo request quando o lojista acessa /painel/assinatura direto), evitando
 * duas consultas ao Asaas pela mesma coisa.
 *
 * Cartão não usa isso: o Asaas tenta o cartão salvo sozinho, sem ação do
 * lojista. Best-effort — Asaas fora do ar não pode derrubar o painel
 * inteiro, só faz o aviso não aparecer.
 */
export const getPixPendente = cache(
  async (
    asaasSubscriptionId: string | null,
    subscriptionStatus: string | null
  ): Promise<PixPendente | null> => {
    if (!asaasSubscriptionId || subscriptionStatus === "canceled") return null;

    try {
      const cobranca = await buscarCobrancaEmAberto(asaasSubscriptionId);
      if (cobranca?.billingType !== "PIX") return null;
      return { invoiceUrl: cobranca.invoiceUrl, dueDate: cobranca.dueDate };
    } catch (e) {
      console.error("[getPixPendente] falha ao buscar cobrança Pix em aberto:", e);
      return null;
    }
  }
);
