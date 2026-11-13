import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, isSuperFreteConfigured } from "@/lib/integrations/superfrete";
import { refreshShipment } from "@/lib/shipments";
import { logIntegration } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Webhook SuperFrete (order.released, order.posted, order.delivered...).
 * Valida X-ME-Signature e, em seguida, consulta o pedido na API — o status
 * final sempre vem da consulta, nunca do corpo recebido.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isSuperFreteConfigured()) return Response.json({ ok: false }, { status: 503 });

  const valid = verifyWebhookSignature(raw, req.headers.get("x-me-signature") ?? req.headers.get("x-superfrete-signature"));
  if (!valid) {
    await logIntegration({ provider: "superfrete", operation: "webhook", level: "warn", message: "Assinatura inválida ou segredo não configurado" });
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: { event?: string; data?: { id?: string; status?: string; updated_at?: string } } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const sfId = body.data?.id;
  if (!sfId) return Response.json({ ok: true, ignored: true });

  const db = createAdminClient();
  const eventKey = `${body.event}:${sfId}:${body.data?.status}:${body.data?.updated_at ?? ""}`;
  const ins = await db
    .from("webhook_events")
    .insert({ provider: "superfrete", event_key: eventKey, event_type: body.event, resource_id: sfId, signature_valid: true, payload: body })
    .select("id")
    .single();
  if (ins.error?.code === "23505") return Response.json({ ok: true, duplicate: true });

  const { data: shipment } = await db.from("shipments").select("id").eq("superfrete_order_id", sfId).maybeSingle();
  if (!shipment) {
    await db.from("webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() }).eq("id", ins.data!.id);
    return Response.json({ ok: true, ignored: true });
  }
  try {
    await refreshShipment(shipment.id);
    await db.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", ins.data!.id);
    return Response.json({ ok: true });
  } catch (e) {
    await db.from("webhook_events").update({ status: "failed", error: String(e).slice(0, 1000) }).eq("id", ins.data!.id);
    return Response.json({ ok: false }, { status: 500 });
  }
}
