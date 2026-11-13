import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv, integrations } from "@/lib/server-env";
import { formatPrice } from "@/lib/format";
import type { EmailKind } from "@/lib/email/templates";
import type { Order } from "@/lib/types";

/** Avisos que o app do painel pode receber (chaves das preferências do aparelho). */
export const PUSH_EVENTS = {
  order_created: "Pedido criado (aguardando pagamento)",
  new_sale: "Venda aprovada",
  order_cancelled: "Pedido cancelado",
  shipped: "Pedido enviado / rastreio gerado",
  delivered: "Pedido entregue (concluído)",
  refunded: "Reembolso",
} as const;
export type PushEvent = keyof typeof PUSH_EVENTS;

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

let configured = false;
function setup() {
  if (configured) return true;
  if (!integrations.push) return false;
  webpush.setVapidDetails(serverEnv.vapidSubject, serverEnv.vapidPublicKey, serverEnv.vapidPrivateKey);
  configured = true;
  return true;
}

/** Envia para os aparelhos inscritos (opcionalmente filtrando por tipo de aviso). */
export async function sendPush(payload: PushPayload, opts: { event?: PushEvent; subscriptionIds?: string[] } = {}) {
  if (!setup()) return { sent: 0, failed: 0 };
  const db = createAdminClient();
  let q = db.from("push_subscriptions").select("id, endpoint, p256dh, auth, preferences, failures");
  if (opts.subscriptionIds?.length) q = q.in("id", opts.subscriptionIds);
  const { data: subs } = await q;
  let sent = 0;
  let failed = 0;
  await Promise.all(
    (subs ?? [])
      .filter((s) => !opts.event || (s.preferences as Record<string, boolean>)?.[opts.event] !== false)
      .map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24, urgency: "high", topic: payload.tag?.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "") || undefined },
          );
          sent++;
          await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString(), failures: 0 }).eq("id", s.id);
        } catch (e) {
          failed++;
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410: o aparelho removeu o app ou revogou a permissão
          if (status === 404 || status === 410 || s.failures >= 5) await db.from("push_subscriptions").delete().eq("id", s.id);
          else await db.from("push_subscriptions").update({ failures: s.failures + 1 }).eq("id", s.id);
        }
      }),
  );
  return { sent, failed };
}

const EVENT_FOR_KIND: Partial<Record<EmailKind, PushEvent>> = {
  order_created: "order_created",
  new_sale: "new_sale",
  order_cancelled: "order_cancelled",
  shipped: "shipped",
  delivered: "delivered",
  refunded: "refunded",
};

function message(event: PushEvent, o: Order): PushPayload {
  const n = `#${o.order_number}`;
  const who = o.customer_name.split(" ")[0];
  const total = formatPrice(o.total);
  const url = `/admin/pedidos/${o.id}`;
  switch (event) {
    case "order_created":
      return { title: `🛍️ Novo pedido ${n}`, body: `${who} · ${total} · aguardando pagamento (${o.payment_method === "pix" ? "Pix" : "cartão"})`, url, tag: `order-${n}` };
    case "new_sale":
      return { title: `💜 Venda aprovada ${n}`, body: `${who} pagou ${total}. Hora de separar o pedido!`, url, tag: `order-${n}` };
    case "order_cancelled":
      return { title: `Pedido ${n} cancelado`, body: `${who} · ${total} · pagamento não confirmado`, url, tag: `order-${n}` };
    case "shipped":
      return { title: `📦 Pedido ${n} enviado`, body: `Rastreio gerado para ${who}.`, url, tag: `order-${n}` };
    case "delivered":
      return { title: `✅ Pedido ${n} entregue`, body: `${who} recebeu o pedido. Pedido concluído!`, url, tag: `order-${n}` };
    case "refunded":
      return { title: `Reembolso do pedido ${n}`, body: `${total} devolvido para ${who}.`, url, tag: `order-${n}` };
  }
}

/**
 * Notifica os administradores sobre um evento do pedido — uma única vez
 * (registro em notifications com recipient "push:admins"). Nunca lança erro.
 */
export async function notifyAdminsPush(orderId: string, kind: EmailKind) {
  const event = EVENT_FOR_KIND[kind];
  if (!event || !integrations.push || !integrations.supabaseAdmin) return;
  try {
    const db = createAdminClient();
    const claim = await db
      .from("notifications")
      .insert({ order_id: orderId, kind, channel: "push", recipient: "push:admins", attempts: 1 })
      .select("id")
      .single();
    if (claim.error) return; // já enviado (ou em envio) para este pedido/evento
    const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return;
    const { sent, failed } = await sendPush(message(event, order as Order), { event });
    await db
      .from("notifications")
      .update({ status: sent > 0 || failed === 0 ? "sent" : "failed", sent_at: new Date().toISOString(), error: failed ? `${failed} aparelho(s) falharam` : null })
      .eq("id", claim.data.id);
  } catch (e) {
    console.error("[push]", e);
  }
}
