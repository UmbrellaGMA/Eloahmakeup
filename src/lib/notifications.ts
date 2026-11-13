import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv, integrations } from "@/lib/server-env";
import { publicEnv } from "@/lib/env";
import { getStoreSettings } from "@/lib/catalog";
import { logIntegration } from "@/lib/logger";
import { renderEmail, type EmailKind } from "@/lib/email/templates";
import { notifyAdminsPush } from "@/lib/push";
import type { Order, OrderItem } from "@/lib/types";

const MAX_ATTEMPTS = 3;

async function sendViaResend(to: string, subject: string, html: string, text: string, idempotencyKey: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: serverEnv.emailFrom,
      to: [to],
      subject,
      html,
      text,
      ...(serverEnv.emailReplyTo ? { reply_to: serverEnv.emailReplyTo } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(json.message ?? `Resend ${res.status}`);
  return json.id ?? null;
}

/**
 * Envia um aviso do pedido uma única vez por (pedido, tipo, destinatário).
 * Nunca lança erro: falhas ficam registradas em notifications/integration_logs
 * e não interrompem pagamento, webhook ou emissão de etiqueta.
 */
export async function notifyOrder(orderId: string, kind: EmailKind) {
  // Aviso no app do painel (push), independente do e-mail
  await notifyAdminsPush(orderId, kind);
  if (!integrations.email || !integrations.supabaseAdmin) return;
  try {
    const db = createAdminClient();
    const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return;
    const o = order as Order;
    const recipient = kind === "new_sale" ? serverEnv.storeNotifyEmail : o.customer_email;
    if (!recipient) return;

    // Reserva o aviso (a restrição única impede duplicidade)
    const ins = await db.from("notifications").insert({ order_id: orderId, kind, recipient, attempts: 1 }).select("id").single();
    let notificationId = ins.data?.id as string | undefined;
    if (ins.error) {
      if (ins.error.code !== "23505") throw ins.error;
      const { data: existing } = await db.from("notifications").select("id, status, attempts").eq("order_id", orderId).eq("kind", kind).eq("recipient", recipient).single();
      if (!existing || existing.status !== "failed" || existing.attempts >= MAX_ATTEMPTS) return;
      await db.from("notifications").update({ status: "pending", attempts: existing.attempts + 1 }).eq("id", existing.id);
      notificationId = existing.id;
    }

    const [{ data: items }, settings, { data: shipment }] = await Promise.all([
      db.from("order_items").select("*").eq("order_id", orderId),
      getStoreSettings(),
      kind === "shipped"
        ? db.from("shipments").select("tracking_code, tracking_url, service_name").eq("order_id", orderId).not("status", "in", "(cancelled,error)").order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const email = renderEmail(kind, {
      order: o,
      items: (items ?? []) as OrderItem[],
      siteUrl: publicEnv.siteUrl,
      logoUrl: `${publicEnv.supabaseUrl}/storage/v1/object/public/branding/email/logo-lilas.png`,
      storeName: settings.store_name,
      whatsapp: settings.whatsapp,
      tracking: shipment ? { code: shipment.tracking_code, url: shipment.tracking_url, service: shipment.service_name } : null,
    });

    try {
      const providerId = await sendViaResend(recipient, email.subject, email.html, email.text, `${orderId}:${kind}:${recipient}`);
      await db.from("notifications").update({ status: "sent", provider_id: providerId, error: null, sent_at: new Date().toISOString() }).eq("id", notificationId!);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.from("notifications").update({ status: "failed", error: message.slice(0, 1000) }).eq("id", notificationId!);
      await logIntegration({ provider: "system", operation: `email_${kind}`, level: "warn", orderId, message });
    }
  } catch (e) {
    console.error("[notifications]", e);
  }
}

/** Decide quais avisos disparar após uma mudança de status financeiro. */
export async function notifyAfterPaymentChange(orderId: string, before: Pick<Order, "status" | "payment_status"> | null) {
  const db = createAdminClient();
  const { data: after } = await db.from("orders").select("status, payment_status").eq("id", orderId).maybeSingle();
  if (!after) return;
  if (after.payment_status === "approved" && before?.payment_status !== "approved") {
    await Promise.all([notifyOrder(orderId, "payment_approved"), notifyOrder(orderId, "new_sale")]);
  } else if (after.payment_status === "refunded" && before?.payment_status !== "refunded") {
    await notifyOrder(orderId, "refunded");
  } else if (after.status === "cancelled" && before?.status !== "cancelled") {
    await notifyOrder(orderId, "order_cancelled");
  } else if (after.payment_status === "rejected" && before?.payment_status !== "rejected") {
    await notifyOrder(orderId, "payment_rejected");
  }
}
