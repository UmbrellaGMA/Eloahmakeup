import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/catalog";
import { formatPrice, formatCep } from "@/lib/format";
import { STATUS_DETAIL_MESSAGES } from "@/lib/integrations/mercadopago";
import type { Order, OrderItem } from "@/lib/types";
import { ProductImage } from "@/components/store/ProductImage";
import { OrderTimeline } from "@/components/store/OrderTimeline";
import { buttonClass } from "@/components/ui/Button";
import { PaymentClient } from "./PaymentClient";

export const metadata: Metadata = { title: "Pagamento do pedido", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPaymentPage({ params, searchParams }: PageProps<"/checkout/pedido/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/checkout/pedido/${id}`);
  const supabase = await createClient();
  const [{ data: order }, { data: items }, { data: lastPayment }, settings] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("payments").select("status, status_detail, method").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    getStoreSettings(),
  ]);
  if (!order) notFound();
  const o = order as Order;
  const paid = o.payment_status === "approved";
  const awaiting = o.status === "awaiting_payment";
  const initialMethod = (sp.metodo === "credit_card" ? "credit_card" : o.payment_method) ?? "pix";
  const rejectedMsg =
    lastPayment?.status === "rejected" ? (STATUS_DETAIL_MESSAGES[lastPayment.status_detail ?? ""] ?? "O último pagamento foi recusado. Tente novamente.") : null;
  const cardPending = !paid && lastPayment?.method === "credit_card" && lastPayment.status === "pending";

  return (
    <div className="bg-cream/60">
      <div className="container-page grid gap-8 pb-20 pt-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <div className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
            {paid ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-success" strokeWidth={1.5} />
                <h1 className="heading-display mt-4 text-4xl">Pagamento aprovado!</h1>
                <p className="mt-2 text-sm text-ink-muted">
                  Pedido <strong className="text-ink">#{o.order_number}</strong> confirmado. Enviamos os detalhes para {o.customer_email}.
                </p>
              </div>
            ) : o.status === "cancelled" ? (
              <div className="text-center">
                <XCircle className="mx-auto h-14 w-14 text-danger" strokeWidth={1.5} />
                <h1 className="heading-display mt-4 text-4xl">Pedido cancelado</h1>
                <p className="mt-2 text-sm text-ink-muted">O pagamento não foi confirmado dentro do prazo. Você pode fazer um novo pedido quando quiser.</p>
              </div>
            ) : cardPending ? (
              <div className="text-center">
                <Clock className="mx-auto h-14 w-14 text-warning" strokeWidth={1.5} />
                <h1 className="heading-display mt-4 text-4xl">Pagamento em análise</h1>
                <p className="mt-2 text-sm text-ink-muted">O Mercado Pago está analisando seu pagamento. Você será avisada assim que for aprovado.</p>
              </div>
            ) : (
              <>
                <p className="eyebrow">Pedido #{o.order_number} criado</p>
                <h1 className="heading-display mt-2 text-3xl sm:text-4xl">Conclua o pagamento</h1>
                <p className="mt-2 text-sm text-ink-muted">
                  Total a pagar: <strong className="text-ink">{formatPrice(o.total)}</strong>. O pedido é confirmado somente após a aprovação do Mercado Pago.
                </p>
              </>
            )}
            {(paid || o.status !== "awaiting_payment") && (
              <div className="mt-8">
                <OrderTimeline status={o.status} />
              </div>
            )}
            {(paid || o.status === "cancelled" || cardPending) && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href={`/conta/pedidos/${o.id}`} className={buttonClass("primary")}>Acompanhar pedido</Link>
                <Link href="/produtos" className={buttonClass("outline")}>Continuar comprando</Link>
              </div>
            )}
          </div>

          {awaiting && !paid && !cardPending && (
            <div className="rounded-[var(--radius-card)] bg-white p-6 sm:p-8">
              <PaymentClient
                orderId={o.id}
                total={Number(o.total)}
                email={o.customer_email}
                initialMethod={initialMethod}
                maxInstallments={settings.max_installments}
                lastRejected={rejectedMsg}
              />
            </div>
          )}
        </div>

        <aside className="h-fit rounded-[var(--radius-card)] border border-line bg-white p-6">
          <h2 className="heading-display text-2xl">Pedido #{o.order_number}</h2>
          <ul className="mt-5 space-y-4">
            {((items ?? []) as OrderItem[]).map((i) => (
              <li key={i.id} className="flex gap-3 text-sm">
                <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                  <ProductImage src={i.image_url} alt={i.product_name} sizes="56px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2">{i.product_name}</p>
                  <p className="text-xs text-ink-muted">{i.variant_name ? `${i.variant_name} · ` : ""}Qtd. {i.quantity}</p>
                </div>
                <span className="font-medium">{formatPrice(i.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
            {Number(o.discount_total) > 0 && <div className="flex justify-between text-success"><dt>Desconto {o.coupon_code}</dt><dd>-{formatPrice(o.discount_total)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-muted">Frete ({o.shipping_service_name})</dt><dd>{Number(o.shipping_total) === 0 ? "Grátis" : formatPrice(o.shipping_total)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd>{formatPrice(o.total)}</dd></div>
          </dl>
          <div className="mt-5 rounded-xl bg-cream p-4 text-xs text-ink-muted">
            <p className="font-semibold text-ink">Entrega</p>
            <p className="mt-1">
              {o.shipping_address.recipient_name} · {o.shipping_address.street}, {o.shipping_address.number} · {o.shipping_address.city}/{o.shipping_address.state} · {formatCep(o.shipping_address.postal_code)}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
