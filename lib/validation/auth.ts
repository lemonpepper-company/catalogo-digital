import { z } from 'zod'
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from '@/lib/data'
import { whatsappSchema } from '@/lib/validation/painel'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'
import { validarDocumento } from '@/lib/validation/documento'

export const storeSchema = z.object({
  store_name: z.string().min(2, 'Nome da loja deve ter ao menos 2 caracteres'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]{2,50}$/, 'Link inválido')
    .refine((slug) => !RESERVED_SLUGS.has(slug), 'Esse link não está disponível.'),
  whatsapp: whatsappSchema,
  monogram: z.string().max(3, 'Monograma deve ter no máximo 3 letras').nullable(),
  description: z.string().max(500, 'Descrição muito longa').nullable(),
  instagram: z.string().max(100, 'Instagram muito longo').nullable(),
  paymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)),
  deliveryMethods: z.array(z.enum(DELIVERY_METHOD_VALUES)),
  document: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || validarDocumento(v), {
      message: "CPF ou CNPJ inválido.",
    }),
})
