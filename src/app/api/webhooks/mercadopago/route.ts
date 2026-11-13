import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, isMercadoPagoConfigured, verifyWebhookSignature } from "@/lib/integrations/mercadopago";
import { syncPaymentFromProvider } from "@/lib/payments";
import { logIntegration } from "@/lib/logger";
import { serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago.
 * 1. Valida a assinatura (x-signature) com MERCADOPAGO_WEBHOOK_SECRET
 * 2. Consulta o pagamento na API (o corpo da notificação nunca é confiável)
 * 3. Deduplica pelo estado do pagamento (webhook_events)
 * 4. Atualiza pagamento e pedido
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: { type?: string; action?: string; data?: { id?: string | number }; id?: string | number } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    /* corpo inválido: tratamos pelos query params */
  }
  const url = req.nextUrl;
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(url.searchParams.get("data.id") ?? body.data?.id ?? url.searchParams.get("id") ?? "");

  if (!isMercadoPagoConfigured()) {
    return Response.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  const signatureValid = verifyWebhookSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId: url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null),
  });

  if (serverEnv.mercadoPagoWebhookSecret && !signatureValid) {
    await logIntegration({ provider: "mercadopago", operation: "webhook", level: "warn", message: `Assinatura inválida (data.id=${dataId})` });
    return Response.json({ ok: false }, { status: 401 });
  }

  if (type !== "payment" || !/^\d+$/.test(dataId)) {
    return Response.json({ ok: true, ignored: true });
  }

  const db = createAdminClient();
  try {
    const payment = await getPayment(dataId);
    const eventKey = `payment:${payment.id}:${payment.status}:${payment.date_last_updated}`;

    const { data: existing } = await db.from("webhook_events").select("id, status, attempts").eq("provider", "mercadopago").eq("event_key", eventKey).maybeSingle();
    if (existing?.status === "processed") {
      return Response.json({ ok: true, duplicate: true });
    }
    let eventId = existing?.id as string | undefined;
    if (existing) {
      await db.from("webhook_events").update({ attempts: existing.attempts + 1 }).eq("id", existing.id);
    } else {
      const ins = await db
        .from("webhook_events")
        .insert({
          provider: "mercadopago",
          event_key: eventKey,
          event_type: body.action ?? type,
          resource_id: String(payment.id),
          signature_valid: signatureValid,
          payload: body,
        })
        .select("id")
        .single();
      if (ins.error?.code === "23505") return Response.json({ ok: true, duplicate: true });
      eventId = ins.data?.id;
    }

    try {
      const orderId = await syncPaymentFromProvider(payment, "webhook");
      await db
        .from("webhook_events")
        .update({ status: orderId ? "processed" : "ignored", processed_at: new Date().toISOString(), error: null })
        .eq("id", eventId!);
    } catch (e) {
      await db.from("webhook_events").update({ status: "failed", error: String(e).slice(0, 1000) }).eq("id", eventId!);
      throw e;
    }
    return Response.json({ ok: true });
  } catch (e) {
    await logIntegration({ provider: "mercadopago", operation: "webhook", level: "error", message: `Falha ao processar pagamento ${dataId}: ${String(e)}` });
    // 500 faz o Mercado Pago reenviar a notificação depois
    return Response.json({ ok: false }, { status: 500 });
  }
}
