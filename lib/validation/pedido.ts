import { z } from "zod";
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from "@/lib/data";
import {
  CUSTOMER_NAME_MIN,
  MAX_ORDER_LINES,
  MAX_QTY,
  ORDER_CODE_PATTERN,
} from "@/lib/orders";

// Nenhum campo monetário: preço e total são recalculados no servidor a partir de
// products.price_cents. As colunas opcionais aceitam null ("não informado") —
// um pedido nunca é descartado por causa de um campo em branco.
export const orderItemPayloadSchema = z.object({
  productId: z.string().guid("Produto inválido"),
  size: z.string().nullish(),
  color: z.string().nullish(),
  qty: z
    .number()
    .int("Quantidade inválida")
    .min(1, "Quantidade inválida")
    .max(MAX_QTY, "Quantidade inválida"),
});

export const orderPayloadSchema = z.object({
  slug: z.string().min(1, "Loja inválida"),
  clientOrderId: z.string().guid("Identificador de pedido inválido"),
  // Nome obrigatório (ORD-31.4): o teto de 60 não entra aqui porque nome longo é
  // truncado por sanitizeCustomerName, não rejeitado.
  customerName: z
    .string()
    .refine((value) => value.trim().length >= CUSTOMER_NAME_MIN, "Informe seu nome"),
  // Código derivado no cliente (ORD-32.1): só o formato é validado — a origem do
  // valor é o client_order_id, que o servidor já valida como uuid.
  code: z.string().regex(ORDER_CODE_PATTERN, "Código de pedido inválido"),
  payment: z.enum(PAYMENT_METHOD_VALUES).nullish(),
  delivery: z.enum(DELIVERY_METHOD_VALUES).nullish(),
  address: z.string().nullish(),
  items: z
    .array(orderItemPayloadSchema)
    .min(1, "Sacola vazia")
    .max(MAX_ORDER_LINES, "Pedido com itens demais"),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;
