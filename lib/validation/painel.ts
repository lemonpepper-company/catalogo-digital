import { z } from "zod";
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from "@/lib/data";

export const productSchema = z.object({
  name: z.string().min(2, "Nome do produto é obrigatório"),
  priceCents: z.number().int().positive("Preço deve ser maior que zero"),
  stock: z.number().int().min(0, "Estoque não pode ser negativo"),
  categoryId: z.string().guid().nullable(),
  description: z.string().nullable(),
});

export const categoryNameSchema = z
  .string()
  .min(2, "Nome da categoria deve ter ao menos 2 caracteres")
  .max(40, "Nome da categoria muito longo");

export const whatsappSchema = z
  .string()
  .min(1, "WhatsApp é obrigatório")
  .regex(/^\+?[0-9\s()-]{10,20}$/, "Número de WhatsApp inválido");

export const storeSettingsSchema = z.object({
  name: z.string().min(2, "Nome da loja é obrigatório"),
  whatsapp: whatsappSchema,
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  description: z.string().max(500, "Descrição muito longa").nullable(),
  monogram: z.string().max(3, "Monograma deve ter no máximo 3 letras").nullable(),
  instagram: z.string().max(100, "Instagram muito longo").nullable(),
  paymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)),
  deliveryMethods: z.array(z.enum(DELIVERY_METHOD_VALUES)),
  analyticsId: z.string().nullable(),
  pixelId: z.string().nullable(),
  messageTemplate: z.string().max(2000, "Mensagem muito longa").nullable(),
});

export function canDeleteCategory(productCount: number): boolean {
  return productCount === 0;
}
