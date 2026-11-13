import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";
import { cancelUnpaidOrder } from "@/lib/payments";
import { refreshShipment } from "@/lib/shipments";
import { logIntegration } from "@/lib/logger";
import { isSuperFreteConfigured } from "@/lib/integrations/superfrete";
import { isMercadoPagoConfigured } from "@/lib/integrations/mercadopago";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/**
 * Tarefas agendadas (Vercel Cron ou qualquer agendador com o header
 * Authorization: Bearer CRON_SECRET):
 *   /api/cron/expire-orders  — cancela pedidos não pagos após 60 min e devolve estoque
 *   /api/cron/sync-tracking  — atualiza rastreamento das etiquetas emitidas/postadas
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/cron/[job]">) {
  if (!authorized(req)) return Response.json({ ok: false }, { status: 401 });
  const { job } = await ctx.params;
  const db = createAdminClient();

  if (job === "expire-orders") {
    if (!isMercadoPagoConfigured()) return Response.json({ ok: true, skipped: "mercadopago_not_configured" });
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: orders } = await db
      .from("orders")
      .select("id")
      .eq("status", "awaiting_payment")
      .neq("payment_status", "approved")
      .lt("created_at", cutoff)
      .limit(50);
    let cancelled = 0;
    for (const o of orders ?? []) {
      try {
        if (await cancelUnpaidOrder(o.id, "Pagamento não confirmado no prazo")) cancelled++;
      } catch (e) {
        await logIntegration({ provider: "system", operation: "expire_order", level: "error", orderId: o.id, message: String(e) });
      }
    }
    return Response.json({ ok: true, checked: orders?.length ?? 0, cancelled });
  }

  if (job === "sync-tracking") {
    if (!isSuperFreteConfigured()) return Response.json({ ok: true, skipped: "superfrete_not_configured" });
    const { data: shipments } = await db
      .from("shipments")
      .select("id")
      .in("status", ["in_cart", "released", "posted"])
      .not("superfrete_order_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(40);
    let updated = 0;
    for (const s of shipments ?? []) {
      try {
        await refreshShipment(s.id);
        updated++;
      } catch {
        /* falha já registrada em integration_logs */
      }
    }
    return Response.json({ ok: true, updated });
  }

  return Response.json({ ok: false, error: "job desconhecido" }, { status: 404 });
}
