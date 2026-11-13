import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const parsed = z
      .object({ email: z.email("E-mail inválido").max(160), website: z.string().max(0).optional() })
      .safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "E-mail inválido", 400, "INVALID");
    const db = createAdminClient();
    const { error } = await db.from("newsletter_subscribers").insert({ email: parsed.data.email.toLowerCase() });
    if (error && error.code !== "23505") throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
