import type { StoreOrder, StoreOrderItem } from "@/lib/types";

export const ORDER_STATUSES = ["pendente", "confirmado", "cancelado"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const MAX_ORDER_LINES = 20;
export const MAX_QTY = 99;
export const CUSTOMER_NAME_MAX = 60;
export const CUSTOMER_NAME_MIN = 2;

export const ORDER_CODE_LENGTH = 6;
export const ORDER_CODE_PATTERN = /^[A-Z0-9]{6}$/;

const ORDER_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ORDER_CODE_HEX_PER_CHAR = 5;

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (ORDER_STATUSES as readonly unknown[]).includes(value);
}

export interface RequestedItem {
  productId: string;
  size: string | null;
  color: string | null;
  qty: number;
}

export interface ProductPriceRow {
  id: string;
  name: string;
  price_cents: number;
}

export interface ResolvedItem {
  productId: string;
  productName: string;
  unitPriceCents: number;
  qty: number;
  size: string | null;
  color: string | null;
}

export interface OrderItemRow {
  product_name: string;
  unit_price_cents: number;
  qty: number;
  size: string | null;
  color: string | null;
}

export interface OrderRow {
  id: string;
  created_at: string;
  customer_name: string | null;
  payment_method: string | null;
  delivery_method: string | null;
  delivery_address: string | null;
  items_count: number;
  total_cents: number;
  status: OrderStatus;
  order_items?: OrderItemRow[] | null;
}

/**
 * O nome do cliente é obrigatório (ORD-31): menos de 2 caracteres depois do
 * trim() não é nome — devolve null e quem chama rejeita o pedido. Acima de 60 é
 * truncado, nunca rejeitado (edge case da spec).
 */
export function sanitizeCustomerName(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length < CUSTOMER_NAME_MIN) return null;
  return trimmed.slice(0, CUSTOMER_NAME_MAX);
}

export function isValidCustomerName(raw: string | null | undefined): boolean {
  return sanitizeCustomerName(raw) !== null;
}

/**
 * Código curto do pedido derivado do `client_order_id` (ORD-32): 6 blocos de 5
 * dígitos hex do uuid, cada bloco reduzido mod 36 no alfabeto [0-9A-Z]. É puro e
 * determinístico de propósito — o código entra na mensagem do WhatsApp antes de
 * qualquer ida ao servidor, então não pode depender da resposta da gravação
 * (AD-008), e reenviar a mesma sacola precisa reproduzir o mesmo código.
 *
 * A mesma regra está reescrita em SQL no backfill de
 * `supabase/migrations/20260728100000_orders_code.sql`.
 */
export function deriveOrderCode(clientOrderId: string): string {
  const hex = clientOrderId.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  let code = "";
  for (let i = 0; i < ORDER_CODE_LENGTH; i++) {
    const block = hex.slice(i * ORDER_CODE_HEX_PER_CHAR, (i + 1) * ORDER_CODE_HEX_PER_CHAR);
    const value = parseInt(block, 16);
    const index = (Number.isNaN(value) ? 0 : value) % ORDER_CODE_ALPHABET.length;
    code += ORDER_CODE_ALPHABET[index];
  }
  return code;
}

/**
 * O preço vem sempre da linha de produto do banco — nenhum valor monetário do
 * cliente é lido. Item sem produto correspondente (inexistente, inativo ou de
 * outra loja, já filtrados na query) é descartado.
 */
export function resolveOrderItems(
  requested: RequestedItem[],
  products: ProductPriceRow[]
): { items: ResolvedItem[]; totalCents: number; itemsCount: number } {
  const byId = new Map(products.map((p) => [p.id, p]));

  const items: ResolvedItem[] = [];
  for (const line of requested) {
    const product = byId.get(line.productId);
    if (!product) continue;
    items.push({
      productId: product.id,
      productName: product.name,
      unitPriceCents: product.price_cents,
      qty: line.qty,
      size: line.size,
      color: line.color,
    });
  }

  const totalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);
  const itemsCount = items.reduce((sum, i) => sum + i.qty, 0);

  return { items, totalCents, itemsCount };
}

function mapOrderItemRow(row: OrderItemRow): StoreOrderItem {
  return {
    productName: row.product_name,
    unitPriceCents: row.unit_price_cents,
    qty: row.qty,
    size: row.size,
    color: row.color,
  };
}

export function mapOrderRow(row: OrderRow): StoreOrder {
  return {
    id: row.id,
    createdAt: row.created_at,
    customerName: row.customer_name,
    paymentMethod: row.payment_method,
    deliveryMethod: row.delivery_method,
    deliveryAddress: row.delivery_address,
    itemsCount: row.items_count,
    totalCents: row.total_cents,
    status: row.status,
    items: (row.order_items ?? []).map(mapOrderItemRow),
  };
}

export function newClientOrderId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}
