import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatPrice, orderStatusLabel, orderStatusTone, paymentStatusLabel, paymentStatusTone } from "@/lib/format";
import type { Order } from "@/lib/types";

export function OrderList({ orders }: { orders: Pick<Order, "id" | "order_number" | "created_at" | "total" | "status" | "payment_status">[] }) {
  if (!orders.length) {
    return (
      <div className="rounded-[var(--radius-card)] bg-cream p-10 text-center">
        <p className="heading-display text-2xl">Você ainda não fez pedidos</p>
        <Link href="/produtos" className="mt-3 inline-block text-sm font-semibold text-lilac-700 underline">Começar a comprar</Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/conta/pedidos/${o.id}`} className="flex items-center gap-4 p-5 transition hover:bg-cream">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Pedido #{o.order_number}</p>
              <p className="text-xs text-ink-muted">{formatDate(o.created_at, true)}</p>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
              <Badge tone={paymentStatusTone[o.payment_status]}>Pagamento {paymentStatusLabel[o.payment_status].toLowerCase()}</Badge>
            </div>
            <span className="font-semibold">{formatPrice(o.total)}</span>
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
