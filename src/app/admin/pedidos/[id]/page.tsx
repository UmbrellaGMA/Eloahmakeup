import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import {
  formatCep,
  formatCpf,
  formatDate,
  formatPhone,
  formatPrice,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/lib/format";
import type { Order, OrderItem, OrderStatus, PaymentStatus, Shipment, ShipmentTrackingEvent } from "@/lib/types";
import { integrations } from "@/lib/server-env";
import { PageHeader, Panel } from "../../ui";
import { OrderActions, ShipmentPanel } from "./OrderActions";

export const metadata = { title: "Pedido" };

export default async function AdminOrderDetail({ params }: PageProps<"/admin/pedidos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const o = order as Order;

  const [{ data: items }, { data: payments }, { data: shipments }, { data: history }, { data: logs }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase
      .from("payments")
      .select("id, provider_payment_id, method, status, status_detail, amount, installments, card_brand, card_last_four, approved_at, refunded_amount, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("shipments")
      .select("id, order_id, service_id, service_name, superfrete_order_id, status, provider_status, tracking_code, tracking_url, label_url, price, package, error_message, released_at, posted_at, delivered_at, cancelled_at, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("integration_logs").select("id, provider, operation, level, message, created_at").eq("order_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const shipmentList = (shipments ?? []) as Shipment[];
  const activeShipment = shipmentList.find((s) => !["cancelled", "error"].includes(s.status)) ?? null;
  const { data: tracking } = activeShipment
    ? await supabase.from("shipment_tracking").select("*").eq("shipment_id", activeShipment.id).order("occurred_at", { ascending: false })
    : { data: [] };
  const a = o.shipping_address;

  return (
    <>
      <Link href="/admin/pedidos" className="text-xs font-semibold text-lilac-700">← Pedidos</Link>
      <PageHeader
        title={`Pedido #${o.order_number}`}
        description={`Criado em ${formatDate(o.created_at, true)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={paymentStatusTone[o.payment_status]}>Pagamento: {paymentStatusLabel[o.payment_status]}</Badge>
            <Badge tone={orderStatusTone[o.status]}>Pedido: {orderStatusLabel[o.status]}</Badge>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <OrderActions order={{ id: o.id, status: o.status, payment_status: o.payment_status, admin_notes: o.admin_notes }} hasActiveShipment={Boolean(activeShipment)} mercadoPagoReady={integrations.mercadoPago} />

          <ShipmentPanel
            orderId={o.id}
            canEmit={o.payment_status === "approved" && ["paid", "preparing", "ready_to_ship"].includes(o.status)}
            shipment={activeShipment}
            history={shipmentList.filter((s) => s.id !== activeShipment?.id)}
            tracking={(tracking ?? []) as ShipmentTrackingEvent[]}
            defaultPackage={o.shipping_package}
            serviceName={o.shipping_service_name}
            superFreteReady={integrations.superFrete}
          />

          <Panel title="Itens">
            <ul className="divide-y divide-line">
              {((items ?? []) as OrderItem[]).map((i) => (
                <li key={i.id} className="flex gap-4 py-3 text-sm">
                  <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-cream">{i.image_url && <Image src={i.image_url} alt="" fill sizes="48px" className="object-cover" />}</span>
                  <div className="flex-1">
                    <p className="font-medium">{i.product_name}{i.variant_name ? ` — ${i.variant_name}` : ""}</p>
                    <p className="text-xs text-ink-muted">SKU {i.sku} · {i.quantity} × {formatPrice(i.unit_price)}</p>
                  </div>
                  <span className="font-semibold">{formatPrice(i.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="ml-auto mt-3 max-w-xs space-y-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
              {Number(o.discount_total) > 0 && <div className="flex justify-between text-success"><dt>Cupom {o.coupon_code}</dt><dd>-{formatPrice(o.discount_total)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-muted">Frete ({o.shipping_service_name})</dt><dd>{formatPrice(o.shipping_total)}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatPrice(o.total)}</dd></div>
            </dl>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Cliente">
            <p className="font-semibold">{o.customer_name}</p>
            <p className="text-sm text-ink-muted">{o.customer_email}</p>
            <p className="text-sm text-ink-muted">{formatPhone(o.customer_phone)} · CPF {formatCpf(o.customer_cpf)}</p>
            <Link href={`/admin/clientes/${o.user_id}`} className="mt-2 inline-block text-xs font-semibold text-lilac-700">Ver cliente →</Link>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-ink-muted">Entrega</h3>
            <p className="mt-1 text-sm leading-relaxed">
              {a.recipient_name}<br />{a.street}, {a.number}{a.complement ? ` - ${a.complement}` : ""}<br />{a.district} · {a.city}/{a.state}<br />CEP {formatCep(a.postal_code)}
            </p>
            {o.notes && <p className="mt-4 rounded-xl bg-cream p-3 text-sm"><strong>Obs. do cliente:</strong> {o.notes}</p>}
          </Panel>

          <Panel title="Pagamentos (Mercado Pago)">
            {!payments?.length ? (
              <p className="text-sm text-ink-muted">Nenhuma tentativa de pagamento.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.method === "pix" ? "Pix" : `Cartão ${p.card_brand ?? ""} •••• ${p.card_last_four ?? ""}`}</span>
                      <Badge tone={paymentStatusTone[p.status as PaymentStatus]}>{paymentStatusLabel[p.status as PaymentStatus]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      ID MP {p.provider_payment_id} · {formatPrice(p.amount)} {p.installments > 1 ? `em ${p.installments}x` : ""} · {p.status_detail}
                      {Number(p.refunded_amount) > 0 ? ` · reembolsado ${formatPrice(p.refunded_amount)}` : ""}
                    </p>
                    <p className="text-xs text-ink-muted">{formatDate(p.created_at, true)}{p.approved_at ? ` · aprovado ${formatDate(p.approved_at, true)}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Histórico">
            <ol className="space-y-3 border-l border-line pl-4 text-sm">
              {(history ?? []).map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-lilac-500" />
                  <p>
                    {h.to_status && h.from_status !== h.to_status && <>Pedido: <strong>{orderStatusLabel[h.to_status as OrderStatus]}</strong>. </>}
                    {h.to_payment && h.from_payment !== h.to_payment && <>Pagamento: <strong>{paymentStatusLabel[h.to_payment as PaymentStatus]}</strong>. </>}
                    {h.note}
                  </p>
                  <p className="text-xs text-ink-muted">{formatDate(h.created_at, true)} · {h.source}</p>
                </li>
              ))}
            </ol>
          </Panel>

          {!!logs?.length && (
            <Panel title="Logs de integração">
              <ul className="space-y-2 text-xs">
                {logs.map((l) => (
                  <li key={l.id} className={l.level === "error" ? "text-danger" : l.level === "warn" ? "text-amber-700" : "text-ink-muted"}>
                    <strong>{formatDate(l.created_at, true)}</strong> [{l.provider}] {l.operation}: {l.message}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
