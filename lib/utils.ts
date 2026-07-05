import { PAYMENT_METHODS, DELIVERY_METHODS } from "@/lib/data";

export function parsePrice(price: string): number {
  return parseFloat(price.replace(/R\$\s*/, "").trim().replace(",", "."));
}

export function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

type WhatsAppItem = {
  product: { name: string; price: string };
  size: string | null;
  color: string | null;
  qty: number;
};

export const WHATSAPP_GREETING = "Olá! Gostaria de fazer um pedido:";
const WHATSAPP_SEPARATOR = "━━━━━━━━━━━━━━━━━";

export interface OrderInfo {
  payment?: string | null;
  delivery?: string | null;
  address?: string | null;
}

export function formatPaymentLine(payment?: string | null): string {
  const method = PAYMENT_METHODS.find((m) => m.value === payment);
  return method ? `Forma de pagamento: ${method.label}` : "";
}

export function formatDeliveryLine(delivery?: string | null, address?: string | null): string {
  const method = DELIVERY_METHODS.find((m) => m.value === delivery);
  if (!method) return "";
  if (method.value === "entrega" && address?.trim()) {
    return `Entrega: ${method.label} — ${address.trim()}`;
  }
  return `Entrega: ${method.label}`;
}

// {pagamento}/{entrega} podem resolver para string vazia quando a loja não
// configurou aquele grupo — colapsa as quebras de linha extras que sobram.
function collapseBlankLines(message: string): string {
  return message.replace(/\n{3,}/g, "\n\n").trim();
}

export function cartTotal(items: WhatsAppItem[]): number {
  return items.reduce((s, it) => s + parsePrice(it.product.price) * it.qty, 0);
}

// Bloco numerado de itens (usado no {itens} do template e no formato padrão).
export function formatItemsBlock(items: WhatsAppItem[]): string {
  return items
    .map((it, i) => {
      const unit = parsePrice(it.product.price);
      const lines = [
        `${String(i + 1).padStart(2, "0")}. ${it.product.name}`,
        `    Quantidade: ${it.qty}x | Valor unitário: ${formatMoney(unit)}`,
      ];
      if (it.size) lines.push(`    Tamanho: ${it.size}`);
      if (it.color) lines.push(`    Cor: ${it.color}`);
      lines.push(`    Subtotal: ${formatMoney(unit * it.qty)}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildWhatsAppMessage(items: WhatsAppItem[], order?: OrderInfo): string {
  const total = cartTotal(items);
  const pagamento = formatPaymentLine(order?.payment);
  const entrega = formatDeliveryLine(order?.delivery, order?.address);
  const message = `${WHATSAPP_GREETING}\n\n${formatItemsBlock(items)}\n\n${pagamento}\n\n${entrega}\n\n${WHATSAPP_SEPARATOR}\n*Total: ${formatMoney(total)}*\n${WHATSAPP_SEPARATOR}`;
  return collapseBlankLines(message);
}

// Normaliza um número de WhatsApp para o formato do wa.me: só dígitos, com código do país BR (55).
// - remove espaços, parênteses, hífens e o "+"
// - números locais (10 fixo, 11 móvel) ganham o 55 na frente
// - números que já têm o 55 (12/13 dígitos) são mantidos
export function normalizeWhatsapp(input: string | null | undefined): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits === "") return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

// Renderiza a mensagem a partir do template da loja. Template nulo/vazio → formato padrão (§8).
// Variáveis desconhecidas ({foo}) são mantidas literais.
export function renderWhatsAppMessage(
  template: string | null | undefined,
  items: WhatsAppItem[],
  order?: OrderInfo
): string {
  const trimmed = template?.trim();
  if (!trimmed) return buildWhatsAppMessage(items, order);
  const rendered = trimmed
    .replaceAll("{saudacao}", WHATSAPP_GREETING)
    .replaceAll("{itens}", formatItemsBlock(items))
    .replaceAll("{total}", formatMoney(cartTotal(items)))
    .replaceAll("{pagamento}", formatPaymentLine(order?.payment))
    .replaceAll("{entrega}", formatDeliveryLine(order?.delivery, order?.address));
  return collapseBlankLines(rendered);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function parseReaisToCents(input: string): number {
  const cleaned = input.replace(/R\$\s*/, "").replace(/\./g, "").trim();
  if (cleaned === "") return NaN;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(",", ".")
    : cleaned;
  const reais = parseFloat(normalized);
  if (Number.isNaN(reais)) return NaN;
  return Math.round(reais * 100);
}

export function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

// Máscara de moeda para inputs: mantém só os dígitos e preenche da direita
// para a esquerda como centavos (ex: "2899" -> "28,99").
export function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toFixed(2).replace(".", ",");
}
