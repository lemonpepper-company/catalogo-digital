import { z } from "zod";

// Eventos de telemetria do catálogo público. Zero PII (ANL-06): o payload só
// carrega a loja, um identificador anônimo de visitante, o tipo do evento e —
// quando o evento é sobre um produto — o id do produto. Nenhum IP, user-agent,
// nome ou contato entra aqui.
export const EVENT_TYPE_VALUES = [
  "catalog_visit",
  "product_view",
  "add_to_bag",
  "buy_click",
] as const;

export type EventType = (typeof EVENT_TYPE_VALUES)[number];

// Eventos que falam de um produto específico exigem productId; os demais são
// sobre a loja inteira e não podem carregar produto.
const EVENT_TYPES_WITH_PRODUCT: readonly EventType[] = ["product_view", "add_to_bag"];

export const eventPayloadSchema = z
  .object({
    slug: z.string().min(1, "Loja inválida"),
    visitorId: z.string().guid("Visitante inválido"),
    eventType: z.enum(EVENT_TYPE_VALUES, { message: "Evento inválido" }),
    productId: z.string().guid("Produto inválido").nullish(),
  })
  .superRefine((payload, ctx) => {
    const exigeProduto = EVENT_TYPES_WITH_PRODUCT.includes(payload.eventType);

    if (exigeProduto && !payload.productId) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Produto obrigatório para este evento",
      });
    }

    if (!exigeProduto && payload.productId) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Este evento não aceita produto",
      });
    }
  });

export type EventPayload = z.infer<typeof eventPayloadSchema>;
