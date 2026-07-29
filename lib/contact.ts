/** Número de WhatsApp comercial da Vtrine Digital (não é o WhatsApp do lojista). */
export const VTRINE_WHATSAPP_NUMBER = "5535999931678";

/** Monta o link "wa.me" do WhatsApp comercial da Vtrine Digital com a mensagem informada. */
export function vtrineWhatsAppHref(message: string): string {
  return `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const SUPPORT_WHATSAPP_MESSAGE =
  "Olá! Preciso de suporte com minha loja na Vtrine Digital.";
