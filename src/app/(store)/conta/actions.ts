"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { addressSchema } from "@/lib/validation";
import { isValidCpf, onlyDigits } from "@/lib/format";

export type FormState = { error?: string; success?: string } | undefined;

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      full_name: z.string().trim().min(5, "Informe seu nome completo").max(160),
      phone: z.string().transform(onlyDigits).refine((v) => !v || (v.length >= 10 && v.length <= 11), "Telefone inválido"),
      cpf: z.string().transform(onlyDigits).refine((v) => !v || isValidCpf(v), "CPF inválido"),
      birth_date: z.string().optional(),
      accepts_marketing: z.boolean(),
    })
    .safeParse({
      full_name: formData.get("full_name"),
      phone: formData.get("phone") ?? "",
      cpf: formData.get("cpf") ?? "",
      birth_date: (formData.get("birth_date") as string) || undefined,
      accepts_marketing: formData.get("accepts_marketing") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      cpf: parsed.data.cpf || null,
      birth_date: parsed.data.birth_date || null,
      accepts_marketing: parsed.data.accepts_marketing,
    })
    .eq("id", user.id);
  if (error) return { error: "Não foi possível salvar. Tente novamente." };
  revalidatePath("/conta", "layout");
  return { success: "Dados atualizados!" };
}

export async function saveAddress(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = formData.get("id") as string | null;
  const parsed = addressSchema
    .extend({ label: z.string().trim().max(40).optional(), is_default: z.boolean() })
    .safeParse({
      label: formData.get("label") || undefined,
      recipient_name: formData.get("recipient_name"),
      postal_code: formData.get("postal_code"),
      street: formData.get("street"),
      number: formData.get("number"),
      complement: formData.get("complement") || null,
      district: formData.get("district"),
      city: formData.get("city"),
      state: formData.get("state"),
      phone: formData.get("phone") || null,
      is_default: formData.get("is_default") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const row = { ...parsed.data, phone: parsed.data.phone || null, user_id: user.id };
  const { error } = id
    ? await supabase.from("addresses").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("addresses").insert(row);
  if (error) return { error: "Não foi possível salvar o endereço." };
  revalidatePath("/conta/enderecos");
  return { success: "Endereço salvo!" };
}

export async function deleteAddress(formData: FormData) {
  const user = await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/conta/enderecos");
}

export async function setDefaultAddress(formData: FormData) {
  const user = await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: true }).eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/conta/enderecos");
}
