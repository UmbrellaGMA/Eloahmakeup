import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { logIntegration } from "@/lib/logger";
import { publicEnv } from "@/lib/env";
import {
  cancelPayment,
  createCardPayment,
  createPixPayment,
  getPayment,
  mapPaymentStatus,
  refundPayment,
  STATUS_DETAIL_MESSAGES,
  type MPPayment,
} from "@/lib/integrations/mercadopago";
import type { Order, Payment } from "@/lib/types";
import { notifyAfterPaymentChange, notifyOrder } from "@/lib/notifications";

const PAYMENT_PUBLIC_COLUMNS =
  "id, order_id, provider_payment_id, method, status, status_detail, amount, installments, card_brand, card_last_four, pix_qr_code, pix_qr_code_base64, pix_ticket_url, expires_at, approved_at, refunded_amount, created_at";

/**
 * Grava o estado de um pagamento CONSULTADO NA API do Mercado Pago e
 * sincroniza o pedido. É a única porta de entrada de status financeiro.
 */
export async function syncPaymentFromProvider(mp: MPPayment, source: string) {
  const db = createAdminClient();
  const orderId = mp.external_reference ?? (mp.metadata?.order_id as string | undefined) ?? null;
  if (!orderId) {
    await logIntegration({ provider: "mercadopago", operation: "sync", level: "warn", message: `Pagamento ${mp.id} sem external_reference` });
    return null;
  }
  const { data: order } = await db.from("orders").select("id, total, payment_status, status").eq("id", orderId).maybeSingle();
  if (!order) {
    await logIntegration({ provider: "mercadopago", operation: "sync", level: "warn", message: `Pedido ${orderId} não encontrado (pagamento ${mp.id})` });
    return null;
  }

  let status = mapPaymentStatus(mp.status);

  // Defesa: valor aprovado precisa bater com o total do pedido
  if (status === "approved" && Math.abs(Number(mp.transaction_amount) - Number(order.total)) > 0.01) {
    await logIntegration({
      provider: "mercadopago",
      operation: "amount_mismatch",
      level: "error",
      orderId,
      message: `Valor aprovado (${mp.transaction_amount}) difere do total do pedido (${order.total}). Pedido NÃO foi aprovado automaticamente.`,
      details: { payment_id: mp.id },
    });
    status = "pending";
  }

  const tx = mp.point_of_interaction?.transaction_data;
  const row = {
    order_id: orderId,
    provider: "mercadopago",
    provider_payment_id: String(mp.id),
    method: mp.payment_method_id === "pix" ? "pix" : "credit_card",
    status,
    provider_status: mp.status,
    status_detail: mp.status_detail,
    amount: Number(mp.transaction_amount),
    installments: Math.max(1, Number(mp.installments ?? 1)),
    card_brand: mp.payment_type_id === "credit_card" ? mp.payment_method_id : null,
    card_last_four: mp.card?.last_four_digits ?? null,
    pix_qr_code: tx?.qr_code ?? null,
    pix_qr_code_base64: tx?.qr_code_base64 ?? null,
    pix_ticket_url: tx?.ticket_url ?? null,
    expires_at: mp.date_of_expiration,
    approved_at: mp.date_approved,
    refunded_amount: Number(mp.transaction_amount_refunded ?? 0),
    raw: mp as unknown as Record<string, unknown>,
  };

  const { data: existing } = await db.from("payments").select("id, status").eq("provider_payment_id", String(mp.id)).maybeSingle();
  const write = existing
    ? await db.from("payments").update(row).eq("id", existing.id)
    : await db.from("payments").insert({ ...row, idempotency_key: `mp-${mp.id}` });

  if (write.error) {
    if (write.error.code === "23505" && status === "approved") {
      // Segundo pagamento aprovado para o mesmo pedido: estorna automaticamente.
      await logIntegration({
        provider: "mercadopago",
        operation: "duplicate_payment",
        level: "error",
        orderId,
        message: `Pagamento duplicado ${mp.id} aprovado para pedido já pago. Solicitando estorno automático.`,
      });
      try {
        await refundPayment(mp.id, `dup-refund-${mp.id}`);
        if (existing) await db.from("payments").update({ ...row, status: "refunded" }).eq("id", existing.id);
        else await db.from("payments").insert({ ...row, status: "refunded", idempotency_key: `mp-${mp.id}` });
      } catch (e) {
        await logIntegration({ provider: "mercadopago", operation: "duplicate_refund_failed", level: "error", orderId, message: String(e) });
      }
      return orderId;
    }
    throw write.error;
  }

  // Reembolso só reflete no pedido se não restar outro pagamento aprovado
  if (status === "refunded") {
    const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("order_id", orderId).eq("status", "approved");
    if ((count ?? 0) > 0) return orderId;
  }

  const note = `${source}: pagamento ${mp.id} ${mp.status}${mp.status_detail ? ` (${mp.status_detail})` : ""}`;
  const { error } = await db.rpc("apply_payment_status", { p_order_id: orderId, p_status: status, p_note: note });
  if (error) throw error;
  await notifyAfterPaymentChange(orderId, order);
  return orderId;
}

async function loadPayableOrder(orderId: string, userId: string) {
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).eq("user_id", userId).maybeSingle();
  if (!order) throw new AppError("Pedido não encontrado.", 404, "NOT_FOUND");
  const o = order as Order;
  if (o.payment_status === "approved") throw new AppError("Este pedido já está pago.", 409, "ALREADY_PAID");
  if (o.status !== "awaiting_payment") throw new AppError("Este pedido não aceita mais pagamento.", 409, "NOT_PAYABLE");
  return o;
}

export async function getOrCreatePixPayment(orderId: string, userId: string) {
  const db = createAdminClient();
  const order = await loadPayableOrder(orderId, userId);

  // Reaproveita um Pix pendente e ainda válido (evita várias cobranças)
  const { data: pending } = await db
    .from("payments")
    .select(PAYMENT_PUBLIC_COLUMNS)
    .eq("order_id", orderId)
    .eq("method", "pix")
    .eq("status", "pending")
    .gt("expires_at", new Date(Date.now() + 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending?.pix_qr_code) return pending as Payment;

  const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("order_id", orderId);
  const mp = await createPixPayment({
    orderId,
    orderNumber: order.order_number,
    amount: Number(order.total),
    payer: { email: order.customer_email, name: order.customer_name, cpf: order.customer_cpf },
    siteUrl: publicEnv.siteUrl,
    idempotencyKey: `pix-${orderId}-${count ?? 0}`,
  });
  await logIntegration({ provider: "mercadopago", operation: "create_pix", orderId, message: `Pix ${mp.id} criado (${mp.status})` });
  await db.from("orders").update({ payment_method: "pix" }).eq("id", orderId);
  await syncPaymentFromProvider(mp, "checkout");
  const { data } = await db.from("payments").select(PAYMENT_PUBLIC_COLUMNS).eq("provider_payment_id", String(mp.id)).single();
  return data as Payment;
}

export async function payWithCard(
  orderId: string,
  userId: string,
  form: {
    token: string;
    installments: number;
    payment_method_id: string;
    issuer_id?: string | number | null;
    payer: { email?: string; identification?: { type: string; number: string } | null };
  },
  maxInstallments: number,
) {
  const db = createAdminClient();
  const order = await loadPayableOrder(orderId, userId);
  const installments = Math.min(Math.max(1, Math.floor(form.installments || 1)), maxInstallments);

  const mp = await createCardPayment({
    orderId,
    orderNumber: order.order_number,
    amount: Number(order.total), // valor sempre do banco, nunca do navegador
    token: form.token,
    installments,
    paymentMethodId: form.payment_method_id,
    issuerId: form.issuer_id,
    payer: { email: form.payer.email || order.customer_email, identification: form.payer.identification ?? null },
    siteUrl: publicEnv.siteUrl,
    idempotencyKey: `card-${orderId}-${form.token}`,
  });
  await logIntegration({
    provider: "mercadopago",
    operation: "create_card",
    orderId,
    message: `Cartão ${mp.id}: ${mp.status} (${mp.status_detail})`,
  });
  await db.from("orders").update({ payment_method: "credit_card" }).eq("id", orderId);
  await syncPaymentFromProvider(mp, "checkout");
  return {
    status: mapPaymentStatus(mp.status),
    provider_status: mp.status,
    message: STATUS_DETAIL_MESSAGES[mp.status_detail] ?? (mp.status === "rejected" ? "Pagamento recusado. Tente outro cartão." : null),
  };
}

/** Consulta a API para pagamentos pendentes do pedido (reconciliação). */
export async function reconcileOrderPayments(orderId: string) {
  const db = createAdminClient();
  const { data: pays } = await db
    .from("payments")
    .select("provider_payment_id, status")
    .eq("order_id", orderId)
    .in("status", ["pending"])
    .not("provider_payment_id", "is", null);
  for (const p of pays ?? []) {
    try {
      const mp = await getPayment(p.provider_payment_id!);
      await syncPaymentFromProvider(mp, "reconciliação");
    } catch (e) {
      await logIntegration({ provider: "mercadopago", operation: "reconcile", level: "warn", orderId, message: String(e) });
    }
  }
}

/** Cancela no MP os pagamentos pendentes e cancela o pedido (devolvendo estoque). */
export async function cancelUnpaidOrder(orderId: string, reason: string) {
  const db = createAdminClient();
  await reconcileOrderPayments(orderId);
  const { data: order } = await db.from("orders").select("status, payment_status").eq("id", orderId).single();
  if (!order || order.status !== "awaiting_payment" || order.payment_status === "approved") return false;

  const { data: pays } = await db.from("payments").select("provider_payment_id").eq("order_id", orderId).eq("status", "pending");
  for (const p of pays ?? []) {
    if (!p.provider_payment_id) continue;
    try {
      const mp = await cancelPayment(p.provider_payment_id);
      await syncPaymentFromProvider(mp, "cancelamento");
    } catch (e) {
      await logIntegration({ provider: "mercadopago", operation: "cancel_payment", level: "warn", orderId, message: String(e) });
    }
  }
  const { data: fresh } = await db.from("orders").select("status, payment_status").eq("id", orderId).single();
  if (fresh?.payment_status === "approved") return false;
  if (fresh?.status === "awaiting_payment") {
    const { error } = await db.rpc("cancel_unpaid_order", { p_order_id: orderId, p_reason: reason });
    if (error) throw error;
    await notifyOrder(orderId, "order_cancelled");
  }
  return true;
}

/** Reembolso total solicitado pelo administrador. O status é confirmado pela API. */
export async function refundOrder(orderId: string, adminId: string) {
  const db = createAdminClient();
  const { data: pay } = await db
    .from("payments")
    .select("provider_payment_id, amount")
    .eq("order_id", orderId)
    .eq("status", "approved")
    .maybeSingle();
  if (!pay?.provider_payment_id) throw new AppError("Não há pagamento aprovado para reembolsar.", 409, "NO_APPROVED_PAYMENT");
  const { data: shipment } = await db
    .from("shipments")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["posted", "delivered"])
    .maybeSingle();
  if (shipment) throw new AppError("Pedido já postado. Trate a devolução antes de reembolsar.", 409, "ALREADY_SHIPPED");

  await refundPayment(pay.provider_payment_id, `refund-${orderId}`);
  await logIntegration({ provider: "mercadopago", operation: "refund", orderId, message: `Reembolso solicitado por ${adminId}` });
  const mp = await getPayment(pay.provider_payment_id);
  await syncPaymentFromProvider(mp, "reembolso");
  return mapPaymentStatus(mp.status);
}
