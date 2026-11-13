import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { logIntegration } from "@/lib/logger";
import { publicEnv } from "@/lib/env";
import { onlyDigits } from "@/lib/format";
import {
  cancelLabel,
  checkoutLabels,
  createLabelInCart,
  getAccountInfo,
  getOrderInfo,
  getPrintUrl,
  mapSuperFreteStatus,
  SuperFreteError,
} from "@/lib/integrations/superfrete";
import type { Order, OrderItem, ShippingPackage, StoreSettings } from "@/lib/types";
import { notifyOrder } from "@/lib/notifications";

const TRACKING_LABELS: Record<string, string> = {
  in_cart: "Etiqueta criada na SuperFrete",
  released: "Etiqueta emitida — aguardando postagem",
  posted: "Objeto postado",
  delivered: "Objeto entregue ao destinatário",
  cancelled: "Etiqueta cancelada",
};

async function loadContext(orderId: string) {
  const db = createAdminClient();
  const [{ data: order }, { data: items }, { data: settings }] = await Promise.all([
    db.from("orders").select("*").eq("id", orderId).maybeSingle(),
    db.from("order_items").select("*").eq("order_id", orderId),
    db.from("store_settings").select("*").eq("id", 1).single(),
  ]);
  if (!order) throw new AppError("Pedido não encontrado.", 404, "NOT_FOUND");
  return { db, order: order as Order, items: (items ?? []) as OrderItem[], settings: settings as StoreSettings };
}

function assertOrigin(s: StoreSettings) {
  const missing = [
    ["CEP de origem", s.origin_postal_code],
    ["endereço de origem", s.origin_street],
    ["número", s.origin_number],
    ["bairro", s.origin_district],
    ["cidade", s.origin_city],
    ["UF", s.origin_state],
  ].filter(([, v]) => !v);
  if (missing.length) {
    throw new AppError(`Complete os dados de origem em Configurações: ${missing.map(([k]) => k).join(", ")}.`, 422, "ORIGIN_INCOMPLETE");
  }
}

async function addTracking(shipmentId: string, status: string, occurredAt?: string | null, raw?: unknown) {
  const db = createAdminClient();
  await db
    .from("shipment_tracking")
    .upsert(
      {
        shipment_id: shipmentId,
        status,
        description: TRACKING_LABELS[status] ?? status,
        occurred_at: occurredAt ?? new Date().toISOString(),
        raw: raw ? JSON.parse(JSON.stringify(raw)) : null,
      },
      { onConflict: "shipment_id,status,occurred_at", ignoreDuplicates: true },
    );
}

/**
 * Passo 1 + 2: cria o frete no carrinho SuperFrete e paga a etiqueta com saldo.
 * Se o saldo for insuficiente, o envio fica em "in_cart" e pode ser pago depois.
 */
export async function emitLabel(orderId: string, packageOverride?: Partial<ShippingPackage>) {
  const { db, order, items, settings } = await loadContext(orderId);
  if (order.payment_status !== "approved") throw new AppError("A etiqueta só pode ser emitida para pedidos pagos.", 409, "NOT_PAID");
  if (!["paid", "preparing", "ready_to_ship"].includes(order.status)) {
    throw new AppError("O status atual do pedido não permite emissão de etiqueta.", 409, "INVALID_STATUS");
  }
  if (!order.shipping_service_id) throw new AppError("Pedido sem modalidade de frete.", 409, "NO_SERVICE");
  assertOrigin(settings);

  const { data: active } = await db
    .from("shipments")
    .select("id, status")
    .eq("order_id", orderId)
    .not("status", "in", "(cancelled,error)")
    .maybeSingle();
  if (active && active.status !== "pending") {
    if (active.status === "in_cart") return payLabel(active.id);
    throw new AppError("Este pedido já possui etiqueta ativa.", 409, "LABEL_EXISTS");
  }

  const base = order.shipping_package ?? { height: 4, width: 12, length: 17, weight: 0.3 };
  const volumes: ShippingPackage = {
    height: Number(packageOverride?.height ?? base.height),
    width: Number(packageOverride?.width ?? base.width),
    length: Number(packageOverride?.length ?? base.length),
    weight: Number(packageOverride?.weight ?? base.weight),
  };
  if (Object.values(volumes).some((v) => !Number.isFinite(v) || v <= 0)) {
    throw new AppError("Informe dimensões e peso válidos para o pacote.", 400, "INVALID_PACKAGE");
  }

  // Checagem de saldo antes de criar
  let balance: number | null = null;
  try {
    balance = Number((await getAccountInfo()).balance ?? 0);
  } catch (e) {
    await logIntegration({ provider: "superfrete", operation: "balance", level: "warn", orderId, message: String(e) });
  }

  const addr = order.shipping_address;
  const shipmentRow = {
    order_id: orderId,
    service_id: order.shipping_service_id,
    service_name: order.shipping_service_name,
    status: "pending" as const,
    package: volumes,
  };
  const shipmentId =
    active?.id ??
    (await db.from("shipments").insert(shipmentRow).select("id").single().then((r) => {
      if (r.error) throw r.error;
      return r.data.id as string;
    }));

  let sfOrder: { id: string; price?: number; status?: string };
  try {
    sfOrder = await createLabelInCart({
      from: {
        name: settings.origin_name || settings.store_name,
        address: settings.origin_street!,
        number: settings.origin_number!,
        complement: settings.origin_complement ?? "",
        district: settings.origin_district!,
        city: settings.origin_city!,
        state_abbr: settings.origin_state!.toUpperCase(),
        postal_code: onlyDigits(settings.origin_postal_code),
        ...(settings.origin_document ? { document: onlyDigits(settings.origin_document) } : {}),
      },
      to: {
        name: addr.recipient_name || order.customer_name,
        address: addr.street,
        number: addr.number || "",
        complement: addr.complement ?? "",
        district: addr.district,
        city: addr.city,
        state_abbr: addr.state.toUpperCase(),
        postal_code: onlyDigits(addr.postal_code),
        email: order.customer_email,
        ...(order.customer_cpf ? { document: order.customer_cpf } : {}),
        ...(order.customer_phone ? { phone: onlyDigits(order.customer_phone).slice(-11) } : {}),
      },
      service: order.shipping_service_id,
      products: items.map((i) => ({
        name: i.variant_name ? `${i.product_name} - ${i.variant_name}` : i.product_name,
        quantity: i.quantity,
        unitary_value: Number(i.unit_price),
      })),
      volumes,
      insuranceValue: Number(order.subtotal) - Number(order.discount_total),
      tag: `#${order.order_number}`,
      tagUrl: `${publicEnv.siteUrl}/admin/pedidos/${orderId}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("shipments").update({ status: "error", error_message: message, raw: e instanceof SuperFreteError ? (e.details as object) : null }).eq("id", shipmentId);
    await logIntegration({ provider: "superfrete", operation: "create_label", level: "error", orderId, message, details: e instanceof SuperFreteError ? e.details : undefined });
    throw e;
  }

  await db
    .from("shipments")
    .update({
      superfrete_order_id: sfOrder.id,
      status: "in_cart",
      provider_status: sfOrder.status ?? "pending",
      price: sfOrder.price ?? null,
      error_message: null,
      raw: sfOrder,
    })
    .eq("id", shipmentId);
  await addTracking(shipmentId, "in_cart");
  await logIntegration({ provider: "superfrete", operation: "create_label", orderId, message: `Frete ${sfOrder.id} criado (R$ ${sfOrder.price ?? "?"})` });

  if (balance !== null && sfOrder.price != null && balance < Number(sfOrder.price)) {
    const msg = `Saldo insuficiente na SuperFrete (saldo R$ ${balance.toFixed(2)}, etiqueta R$ ${Number(sfOrder.price).toFixed(2)}). Adicione saldo e clique em "Pagar etiqueta".`;
    await db.from("shipments").update({ error_message: msg }).eq("id", shipmentId);
    throw new AppError(msg, 402, "SUPERFRETE_INSUFFICIENT_BALANCE");
  }
  return payLabel(shipmentId);
}

/** Paga a etiqueta (checkout SuperFrete). Só marca "released" após confirmação da API. */
export async function payLabel(shipmentId: string) {
  const db = createAdminClient();
  const { data: s } = await db.from("shipments").select("*").eq("id", shipmentId).single();
  if (!s?.superfrete_order_id) throw new AppError("Envio sem frete criado na SuperFrete.", 409, "NO_SF_ORDER");
  if (s.status !== "in_cart") throw new AppError("Esta etiqueta não está aguardando pagamento.", 409, "INVALID_STATUS");

  try {
    const res = await checkoutLabels([s.superfrete_order_id]);
    const paid = res.purchase?.orders?.find((o) => o.id === s.superfrete_order_id);
    if (!res.success && !paid) throw new SuperFreteError("A SuperFrete não confirmou a emissão da etiqueta.", 502, res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("shipments").update({ error_message: message }).eq("id", shipmentId);
    await logIntegration({ provider: "superfrete", operation: "checkout_label", level: "error", orderId: s.order_id, message });
    throw e;
  }
  // Confirma o estado real consultando a API
  return refreshShipment(shipmentId);
}

/** Consulta a SuperFrete e atualiza envio, rastreamento e status do pedido. */
export async function refreshShipment(shipmentId: string) {
  const db = createAdminClient();
  const { data: s } = await db.from("shipments").select("*").eq("id", shipmentId).single();
  if (!s?.superfrete_order_id) throw new AppError("Envio sem identificador SuperFrete.", 409, "NO_SF_ORDER");

  let info;
  try {
    info = await getOrderInfo(s.superfrete_order_id);
  } catch (e) {
    await logIntegration({ provider: "superfrete", operation: "tracking", level: "warn", orderId: s.order_id, message: String(e) });
    throw e;
  }
  const mapped = mapSuperFreteStatus(info.status);
  const update: Record<string, unknown> = {
    provider_status: info.status,
    tracking_code: info.tracking ?? s.tracking_code,
    tracking_url: info.tracking ? `https://rastreamento.correios.com.br/app/index.php?objetos=${info.tracking}` : s.tracking_url,
    label_url: info.print?.url ?? s.label_url,
    price: info.price ?? s.price,
    raw: info,
    error_message: null,
  };
  if (mapped) update.status = mapped;
  if (mapped === "released") update.released_at = s.released_at ?? info.generated_at ?? new Date().toISOString();
  if (mapped === "posted" || mapped === "delivered") update.posted_at = s.posted_at ?? info.posted_at ?? new Date().toISOString();
  if (mapped === "delivered") update.delivered_at = s.delivered_at ?? info.delivered_at ?? new Date().toISOString();
  if (mapped === "cancelled") update.cancelled_at = s.cancelled_at ?? new Date().toISOString();
  await db.from("shipments").update(update).eq("id", shipmentId);

  if (mapped && mapped !== s.status) {
    const when =
      mapped === "posted" ? info.posted_at : mapped === "delivered" ? info.delivered_at : mapped === "released" ? info.generated_at : null;
    await addTracking(shipmentId, mapped, when, info);
  }

  // Reflete no pedido (somente com confirmação da SuperFrete)
  const { data: order } = await db.from("orders").select("status").eq("id", s.order_id).single();
  if (order) {
    let next: string | null = null;
    if (mapped === "released" && ["paid", "preparing"].includes(order.status)) next = "ready_to_ship";
    if (mapped === "posted" && ["paid", "preparing", "ready_to_ship"].includes(order.status)) next = "shipped";
    if (mapped === "delivered" && ["paid", "preparing", "ready_to_ship", "shipped"].includes(order.status)) {
      if (order.status !== "shipped") await db.from("orders").update({ status: "shipped" }).eq("id", s.order_id);
      next = "delivered";
    }
    if (next) {
      const { error } = await db.from("orders").update({ status: next }).eq("id", s.order_id);
      if (error) await logIntegration({ provider: "superfrete", operation: "order_status", level: "error", orderId: s.order_id, message: error.message });
    }
  }
  // Avisos ao cliente (deduplicados por pedido/tipo)
  if (mapped === "posted" || mapped === "delivered") await notifyOrder(s.order_id, "shipped");
  if (mapped === "delivered") await notifyOrder(s.order_id, "delivered");
  const { data: fresh } = await db.from("shipments").select("*").eq("id", shipmentId).single();
  return fresh;
}

export async function labelPrintUrl(shipmentId: string) {
  const db = createAdminClient();
  const { data: s } = await db.from("shipments").select("superfrete_order_id, status, label_url").eq("id", shipmentId).single();
  if (!s?.superfrete_order_id) throw new AppError("Envio sem etiqueta.", 409, "NO_SF_ORDER");
  if (!["released", "posted"].includes(s.status)) throw new AppError("A etiqueta ainda não foi emitida.", 409, "NOT_RELEASED");
  const { url } = await getPrintUrl([s.superfrete_order_id]);
  await db.from("shipments").update({ label_url: url }).eq("id", shipmentId);
  return url;
}

export async function cancelShipment(shipmentId: string, reason: string) {
  const db = createAdminClient();
  const { data: s } = await db.from("shipments").select("*").eq("id", shipmentId).single();
  if (!s) throw new AppError("Envio não encontrado.", 404, "NOT_FOUND");
  if (["posted", "delivered", "cancelled"].includes(s.status)) {
    throw new AppError("Este envio não pode mais ser cancelado.", 409, "NOT_CANCELLABLE");
  }
  if (s.superfrete_order_id) {
    const res = await cancelLabel(s.superfrete_order_id, reason || "Cancelado pela loja");
    const ok = Object.values(res ?? {}).some((v) => v?.canceled);
    if (!ok) throw new SuperFreteError("A SuperFrete não confirmou o cancelamento.", 502, res);
  }
  await db.from("shipments").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", shipmentId);
  await addTracking(shipmentId, "cancelled");
  // Pedido volta para preparação (se estava pronto para envio)
  const { data: order } = await db.from("orders").select("status").eq("id", s.order_id).single();
  if (order?.status === "ready_to_ship") await db.from("orders").update({ status: "preparing" }).eq("id", s.order_id);
  await logIntegration({ provider: "superfrete", operation: "cancel_label", orderId: s.order_id, message: reason });
}
