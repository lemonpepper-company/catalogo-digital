import { z } from "zod";

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

export const storeSettingsSchema = z.object({
  name: z.string().min(2, "Nome da loja é obrigatório"),
  whatsapp: z.string().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  description: z.string().nullable(),
  monogram: z.string().max(3, "Monograma deve ter no máximo 3 letras").nullable(),
  analyticsId: z.string().nullable(),
  pixelId: z.string().nullable(),
  messageTemplate: z.string().nullable(),
});

export function canDeleteCategory(productCount: number): boolean {
  return productCount === 0;
}
