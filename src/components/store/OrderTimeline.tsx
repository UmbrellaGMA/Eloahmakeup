import { Check, Package, PackageCheck, Receipt, Truck, Wallet, X } from "lucide-react";
import type { OrderStatus } from "@/lib/types";

const FLOW: { status: OrderStatus; label: string; Icon: typeof Check }[] = [
  { status: "awaiting_payment", label: "Pedido realizado", Icon: Receipt },
  { status: "paid", label: "Pagamento aprovado", Icon: Wallet },
  { status: "preparing", label: "Em preparação", Icon: Package },
  { status: "shipped", label: "Enviado", Icon: Truck },
  { status: "delivered", label: "Entregue", Icon: PackageCheck },
];

const ORDER: OrderStatus[] = ["awaiting_payment", "paid", "preparing", "ready_to_ship", "shipped", "delivered"];

export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-danger">
        <X className="h-5 w-5" /> Pedido cancelado
      </div>
    );
  }
  const idx = ORDER.indexOf(status === "ready_to_ship" ? "preparing" : status);
  return (
    <ol className="grid grid-cols-5 gap-1">
      {FLOW.map((s, i) => {
        const stepIdx = ORDER.indexOf(s.status);
        const done = idx >= stepIdx;
        return (
          <li key={s.status} className="flex flex-col items-center text-center">
            <div className="relative flex w-full items-center justify-center">
              {i > 0 && <span className={`absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2 ${done ? "bg-lilac-500" : "bg-line"}`} />}
              <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${done ? "bg-lilac-600 text-white" : "bg-cream text-ink-muted"}`}>
                <s.Icon className="h-[18px] w-[18px]" />
              </span>
            </div>
            <span className={`mt-2 text-[11px] font-semibold leading-tight sm:text-xs ${done ? "text-ink" : "text-ink-muted"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
