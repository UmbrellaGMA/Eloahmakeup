import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin, Truck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { ProductImage } from "@/components/store/ProductImage";
import { OrderTimeline } from "@/components/store/OrderTimeline";
import {
  formatCep,
  formatDate,
  formatPrice,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  shipmentStatusLabel,
} from "@/lib/format";
import type { Order, OrderItem, Payment, Shipment, ShipmentTrackingEvent } from "@/lib/types";

export const metadata: Metadata = { title: "Detalhes do pedido", robots: { index: false } };

export default async function OrderDetailPage({ params }: PageProps<"/conta/pedidos/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/conta/pedidos/${id}`);
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!order) notFound();
  const o = order as Order;

  const [{ data: items }, { data: payments }, { data: shipments }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase
      .from("payments")
      .select("id, method, status, status_detail, amount, installments, card_brand, card_last_four, approved_at, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("shipments")
      .select("id, service_name, status, tracking_code, tracking_url, posted_at, delivered_at, created_at")
      .eq("order_id", id)
      .neq("status", "error")
      .order("created_at", { ascending: false }),
  ]);
  const shipment = (shipments?.[0] ?? null) as Shipment | null;
  const { data: tracking } = shipment
    ? await supabase.from("shipment_tracking").select("*").eq("shipment_id", shipment.id).order("occurred_at", { ascending: false })
    : { data: [] };
  const a = o.shipping_address;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/conta/pedidos" className="text-xs font-semibold text-lilac-700">← Meus pedidos</Link>
          <h1 className="heading-display mt-2 text-4xl">Pedido #{o.order_number}</h1>
          <p className="text-sm text-ink-muted">Realizado em {formatDate(o.created_at, true)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
          <Badge tone={paymentStatusTone[o.payment_status]}>Pagamento {paymentStatusLabel[o.payment_status].toLowerCase()}</Badge>
        </div>
      </div>

      <div className="card p-6"><OrderTimeline status={o.status} /></div>

      {o.status === "awaiting_payment" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-lilac-50 p-5">
          <p className="text-sm text-lilac-900">Este pedido aguarda pagamento.</p>
          <Link href={`/checkout/pedido/${o.id}`} className={buttonClass("primary", "sm")}>Pagar agora</Link>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Truck className="h-4 w-4 text-lilac-700" /> Envio e rastreamento</h2>
          <p className="mt-2 text-sm text-ink-muted">{o.shipping_service_name} ({o.shipping_carrier}) · prazo de até {o.shipping_days} dias úteis após a postagem</p>
          {shipment ? (
            <>
              <p className="mt-4 text-sm">Status: <strong>{shipmentStatusLabel[shipment.status]}</strong></p>
              {shipment.tracking_code && (
                <p className="mt-1 text-sm">
                  Código de rastreio: <strong className="font-mono">{shipment.tracking_code}</strong>
                  {shipment.tracking_url && (
                    <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-lilac-700 underline">
                      rastrear <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              )}
              {(tracking ?? []).length > 0 && (
                <ol className="mt-5 space-y-4 border-l border-line pl-5">
                  {((tracking ?? []) as ShipmentTrackingEvent[]).map((t) => (
                    <li key={t.id} className="relative">
                      <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-lilac-500 ring-4 ring-white" />
                      <p className="text-sm font-medium">{t.description ?? t.status}</p>
                      <p className="text-xs text-ink-muted">{formatDate(t.occurred_at, true)}{t.location ? ` · ${t.location}` : ""}</p>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              {o.payment_status === "approved" ? "Seu pedido está sendo preparado. O código de rastreio aparecerá aqui após a postagem." : "O envio é preparado após a confirmação do pagamento."}
            </p>
          )}
        </section>

        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-lilac-700" /> Endereço de entrega</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {a.recipient_name}<br />
            {a.street}, {a.number}{a.complement ? ` - ${a.complement}` : ""}<br />
            {a.district} · {a.city}/{a.state}<br />
            CEP {formatCep(a.postal_code)}
          </p>
          <h3 className="mt-6 font-semibold">Pagamento</h3>
          {((payments ?? []) as Payment[]).length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nenhuma tentativa de pagamento.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {((payments ?? []) as Payment[]).map((p) => (
                <li key={p.id}>
                  {p.method === "pix" ? "Pix" : `Cartão ${p.card_brand ?? ""} ${p.card_last_four ? `•••• ${p.card_last_four}` : ""} (${p.installments}x)`} ·{" "}
                  <strong className="text-ink">{paymentStatusLabel[p.status]}</strong> · {formatDate(p.created_at, true)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-6">
        <h2 className="font-semibold">Itens</h2>
        <ul className="mt-4 divide-y divide-line">
          {((items ?? []) as OrderItem[]).map((i) => (
            <li key={i.id} className="flex gap-4 py-4 text-sm">
              <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg bg-cream">
                <ProductImage src={i.image_url} alt={i.product_name} sizes="64px" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{i.product_name}</p>
                <p className="text-xs text-ink-muted">{i.variant_name ? `${i.variant_name} · ` : ""}SKU {i.sku} · {i.quantity} × {formatPrice(i.unit_price)}</p>
              </div>
              <span className="font-semibold">{formatPrice(i.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-4 max-w-xs space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
          {Number(o.discount_total) > 0 && <div className="flex justify-between text-success"><dt>Desconto</dt><dd>-{formatPrice(o.discount_total)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-muted">Frete</dt><dd>{formatPrice(o.shipping_total)}</dd></div>
          <div className="flex justify-between font-bold"><dt>Total</dt><dd>{formatPrice(o.total)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
