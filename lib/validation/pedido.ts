import { z } from "zod";
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from "@/lib/data";
import { MAX_ORDER_LINES, MAX_QTY } from "@/lib/orders";

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
  customerName: z.string().nullish(),
  payment: z.enum(PAYMENT_METHOD_VALUES).nullish(),
  delivery: z.enum(DELIVERY_METHOD_VALUES).nullish(),
  address: z.string().nullish(),
  items: z
    .array(orderItemPayloadSchema)
    .min(1, "Sacola vazia")
    .max(MAX_ORDER_LINES, "Pedido com itens demais"),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;
