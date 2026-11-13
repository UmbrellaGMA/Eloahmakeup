import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { AppError, errorResponse, fromDbError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Lista os IDs favoritados (vazio para visitantes). */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return Response.json({ ids: [], authenticated: false });
    const supabase = await createClient();
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id);
    return Response.json({ ids: (data ?? []).map((f) => f.product_id), authenticated: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Alterna favorito. Usa a sessão do usuário (RLS garante a posse). */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) throw new AppError("Entre na sua conta para salvar favoritos.", 401, "UNAUTHENTICATED");
    const parsed = z.object({ product_id: z.uuid() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("Produto inválido.", 400, "INVALID");
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("product_id", parsed.data.product_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", parsed.data.product_id);
      if (error) throw fromDbError(error);
      return Response.json({ favorited: false });
    }
    const { error } = await supabase.from("favorites").insert({ user_id: user.id, product_id: parsed.data.product_id });
    if (error) throw fromDbError(error);
    return Response.json({ favorited: true });
  } catch (e) {
    return errorResponse(e);
  }
}
