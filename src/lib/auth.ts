import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Usuário autenticado (validado no servidor do Supabase), ou null. */
export const getUser = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getAdminRole = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle();
  return (data?.role as "owner" | "admin" | "editor" | undefined) ?? null;
});

export async function requireUser(next = "/conta") {
  const user = await getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

/** Para páginas: redireciona quem não é administrador. */
export async function requireAdminPage() {
  const user = await requireUser("/admin");
  const role = await getAdminRole();
  if (!role) redirect("/?acesso=negado");
  return { user, role };
}

/** Para rotas de API e Server Actions: lança erro 401/403. */
export async function assertAdmin() {
  const user = await getUser();
  if (!user) throw new AppError("Faça login para continuar.", 401, "UNAUTHENTICATED");
  const role = await getAdminRole();
  if (!role) throw new AppError("Acesso restrito a administradores.", 403, "FORBIDDEN");
  return { user, role };
}

export async function assertUser() {
  const user = await getUser();
  if (!user) throw new AppError("Faça login para continuar.", 401, "UNAUTHENTICATED");
  return user;
}
