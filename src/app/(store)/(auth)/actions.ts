"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mergeGuestCart } from "@/lib/cart";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";
import { onlyDigits } from "@/lib/format";
import { safeNextPath } from "@/lib/safe";

export type AuthState = { error?: string; success?: string } | undefined;

function safeNext(v: FormDataEntryValue | null) {
  return safeNextPath(v);
}

function translate(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (/already registered|already been registered/i.test(message)) return "Este e-mail já está cadastrado. Faça login ou recupere sua senha.";
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (/password should be|weak password/i.test(message)) return "Senha fraca. Use ao menos 8 caracteres com letras e números.";
  return "Não foi possível concluir. Tente novamente.";
}

const notConfigured: AuthState = { error: "Autenticação indisponível: loja em configuração." };

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return notConfigured;
  const parsed = z
    .object({ email: z.email("E-mail inválido"), password: z.string().min(1, "Informe a senha") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: translate(error.message) };
  await mergeGuestCart(data.user.id).catch(() => undefined);
  redirect(safeNext(formData.get("next")));
}

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .regex(/[A-Za-z]/, "A senha deve conter letras")
  .regex(/\d/, "A senha deve conter números");

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return notConfigured;
  const parsed = z
    .object({
      full_name: z.string().trim().min(5, "Informe seu nome completo").max(160),
      email: z.email("E-mail inválido"),
      phone: z.string().transform(onlyDigits).refine((v) => v.length === 0 || (v.length >= 10 && v.length <= 11), "Telefone inválido"),
      password: passwordSchema,
      accepts_marketing: z.boolean(),
      terms: z.literal(true, { error: "Aceite os termos para continuar" }),
    })
    .safeParse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      phone: formData.get("phone") ?? "",
      password: formData.get("password"),
      accepts_marketing: formData.get("accepts_marketing") === "on",
      terms: formData.get("terms") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone || null, accepts_marketing: parsed.data.accepts_marketing },
    },
  });
  if (error) return { error: translate(error.message) };
  // Supabase retorna usuário sem identidades quando o e-mail já existe (proteção contra enumeração)
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha." };
  }
  if (data.session) {
    await mergeGuestCart(data.user!.id).catch(() => undefined);
    redirect(next);
  }
  return { success: "Conta criada! Enviamos um link de confirmação para o seu e-mail." };
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return notConfigured;
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "E-mail inválido" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/redefinir-senha`,
  });
  // Mesma resposta para e-mails existentes ou não (evita enumeração)
  return { success: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha." };
}

export async function updatePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return notConfigured;
  const pw = passwordSchema.safeParse(formData.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  if (formData.get("password") !== formData.get("confirm")) return { error: "As senhas não conferem." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Link expirado. Solicite a recuperação novamente." };
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { error: translate(error.message) };
  redirect("/conta?senha=atualizada");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
