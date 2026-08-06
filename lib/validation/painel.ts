import { z } from "zod";
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from "@/lib/data";
import { stripWwwPrefix } from "@/lib/domain-routing";

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
  description: z.string().max(500, "Descrição muito longa").nullable(),
  monogram: z.string().max(3, "Monograma deve ter no máximo 3 letras").nullable(),
  instagram: z.string().max(100, "Instagram muito longo").nullable(),
  paymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)),
  deliveryMethods: z.array(z.enum(DELIVERY_METHOD_VALUES)),
  analyticsId: z.string().nullable(),
  pixelId: z.string().nullable(),
  messageTemplate: z.string().max(2000, "Mensagem muito longa").nullable(),
  // Dígito verificador validado em updateStoreSettings via validarDocumento —
  // aqui só passa a string bruta adiante. Opcional: fixtures/chamadas antigas
  // de storeSettingsSchema não mandam essa chave.
  document: z.string().nullable().optional(),
  // CEP, número, rua, bairro e cidade são a entrada do lojista — o CEP só
  // sugere rua/bairro/cidade no cliente (nem todo CEP tem esses três dados
  // no ViaCEP), quem decide o que é salvo é o formulário. Opcionais pelo
  // mesmo motivo do document: só viram obrigatórios juntos em
  // updateStoreSettings, na hora de assinar.
  postalCode: z.string().nullable().optional(),
  addressNumber: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  addressProvince: z.string().nullable().optional(),
  addressCity: z.string().nullable().optional(),
});

export const personalizacaoSchema = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  fontPairing: z.string().min(1),
  backgroundPalette: z.string().min(1),
  cornerStyle: z.string().min(1),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida")
    .nullable(),
  gridDensity: z.enum(["padrao", "compacto"]),
});

// Hostname puro: sem protocolo, sem path, sem porta. Ex: "boutiquedaana.com.br".
// Remove um "www." líder após validar o formato — apex é o valor canônico
// salvo (ver stripWwwPrefix em lib/domain-routing.ts, também usado pelo
// middleware para casar os dois formatos com a mesma loja).
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    "Domínio inválido — use o formato exemplo.com.br, sem http:// e sem barras"
  )
  .transform(stripWwwPrefix)
  .nullable();

export function canDeleteCategory(productCount: number): boolean {
  return productCount === 0;
}
