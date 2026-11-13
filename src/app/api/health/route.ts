import { createAdminClient } from "@/lib/supabase/admin";
import { integrations } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/**
 * Verificação de saúde do site. Faz uma consulta leve ao banco — o que
 * também mantém o projeto Supabase (plano grátis) ativo — e não expõe dados.
 * Usado pelo agendamento do GitHub (.github/workflows/keepalive.yml) e por
 * monitores externos (UptimeRobot, cron-job.org etc.).
 */
export async function GET() {
  const started = Date.now();
  if (!integrations.supabaseAdmin) return Response.json({ ok: false, db: "not_configured" }, { status: 503 });
  try {
    const { error } = await createAdminClient().from("store_settings").select("id", { head: true, count: "exact" }).eq("id", 1);
    if (error) throw error;
    return Response.json({ ok: true, db: "ok", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
