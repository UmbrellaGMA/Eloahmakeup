import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/format";

export const cepSchema = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v.length === 8, "CEP inválido");

export const cpfSchema = z
  .string()
  .transform(onlyDigits)
  .refine(isValidCpf, "CPF inválido");

export const phoneSchema = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v.length >= 10 && v.length <= 11, "Telefone inválido");

export const addressSchema = z.object({
  recipient_name: z.string().trim().min(3, "Informe o nome do destinatário").max(160),
  postal_code: cepSchema,
  street: z.string().trim().min(2, "Informe o endereço").max(200),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(120).optional().nullable(),
  district: z.string().trim().min(2, "Informe o bairro").max(120),
  city: z.string().trim().min(2, "Informe a cidade").max(120),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF inválida"),
  phone: z.string().transform(onlyDigits).optional().nullable(),
});

export const addToCartSchema = z.object({
  product_id: z.uuid(),
  variant_id: z.uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(99).default(1),
});

export const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(5, "Informe o nome completo").max(160),
    cpf: cpfSchema,
    phone: phoneSchema,
  }),
  address: addressSchema,
  shipping_service_id: z.number().int().positive(),
  payment_method: z.enum(["pix", "credit_card"]),
  notes: z.string().max(500).optional().nullable(),
  save_address: z.boolean().optional(),
});

export const cardPaymentSchema = z.object({
  order_id: z.uuid(),
  token: z.string().min(10).max(200),
  installments: z.number().int().min(1).max(12),
  payment_method_id: z.string().min(2).max(40),
  issuer_id: z.union([z.string(), z.number()]).nullable().optional(),
  payer: z
    .object({
      email: z.email().optional(),
      identification: z.object({ type: z.string(), number: z.string() }).nullable().optional(),
    })
    .default({}),
});

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
