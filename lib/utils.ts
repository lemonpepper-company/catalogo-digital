export function parsePrice(price: string): number {
  return parseFloat(price.replace(/R\$\s*/, "").trim().replace(",", "."));
}

export function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function buildWhatsAppMessage(
  items: Array<{
    product: { name: string; price: string };
    size: string | null;
    color: string | null;
    qty: number;
  }>
): string {
  const total = items.reduce(
    (s, it) => s + parsePrice(it.product.price) * it.qty,
    0
  );
  const lines = ["Olá! Gostaria de fazer um pedido:", ""];
  items.forEach((it, i) => {
    const unit = parsePrice(it.product.price);
    lines.push(`${String(i + 1).padStart(2, "0")}. ${it.product.name}`);
    lines.push(
      `    Quantidade: ${it.qty}x | Valor unitário: ${formatMoney(unit)}`
    );
    if (it.size) lines.push(`    Tamanho: ${it.size}`);
    if (it.color) lines.push(`    Cor: ${it.color}`);
    lines.push(`    Subtotal: ${formatMoney(unit * it.qty)}`);
    lines.push("");
  });
  lines.push("━━━━━━━━━━━━━━━━━");
  lines.push(`*Total: ${formatMoney(total)}*`);
  lines.push("━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
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
