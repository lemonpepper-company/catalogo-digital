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

export function buildWhatsAppMessage(items: WhatsAppItem[]): string {
  const total = cartTotal(items);
  return `${WHATSAPP_GREETING}\n\n${formatItemsBlock(items)}\n\n${WHATSAPP_SEPARATOR}\n*Total: ${formatMoney(total)}*\n${WHATSAPP_SEPARATOR}`;
}

// Renderiza a mensagem a partir do template da loja. Template nulo/vazio → formato padrão (§8).
// Variáveis desconhecidas ({foo}) são mantidas literais.
export function renderWhatsAppMessage(
  template: string | null | undefined,
  items: WhatsAppItem[]
): string {
  const trimmed = template?.trim();
  if (!trimmed) return buildWhatsAppMessage(items);
  return trimmed
    .replaceAll("{saudacao}", WHATSAPP_GREETING)
    .replaceAll("{itens}", formatItemsBlock(items))
    .replaceAll("{total}", formatMoney(cartTotal(items)));
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
