import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { formatDate, formatPrice, orderStatusLabel, orderStatusTone, paymentStatusLabel, paymentStatusTone } from "@/lib/format";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";
import { PageHeader } from "../ui";

export const metadata = { title: "Pedidos" };

const STATUS_FILTERS: Record<string, OrderStatus[]> = {
  awaiting_payment: ["awaiting_payment"],
  paid: ["paid", "preparing", "ready_to_ship"],
  shipped: ["shipped", "delivered"],
  cancelled: ["cancelled"],
};

export default async function AdminOrders({ searchParams }: PageProps<"/admin/pedidos">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const payment = typeof sp.pagamento === "string" ? sp.pagamento : "";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const perPage = 30;

  const supabase = await createClient();
  let req = supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_email, total, status, payment_status, payment_method, shipping_service_name, created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (q) {
    const n = Number(q.replace("#", ""));
    const safe = q.replace(/[%,()]/g, " ");
    req = Number.isInteger(n) && n > 0 ? req.eq("order_number", n) : req.or(`customer_name.ilike.%${safe}%,customer_email.ilike.%${safe}%`);
  }
  if (STATUS_FILTERS[status]) req = req.in("status", STATUS_FILTERS[status]);
  else if (status && status in orderStatusLabel) req = req.eq("status", status);
  if (payment && payment in paymentStatusLabel) req = req.eq("payment_status", payment);
  const { data, count } = await req.range((page - 1) * perPage, page * perPage - 1);
  const pages = Math.ceil((count ?? 0) / perPage);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("status", status);
    if (payment) u.set("pagamento", payment);
    if (p > 1) u.set("pagina", String(p));
    return u.size ? `?${u}` : "";
  };

  return (
    <>
      <PageHeader title="Pedidos" description={`${count ?? 0} pedidos encontrados`} />
      <form className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Nº do pedido, nome ou e-mail" className="field max-w-xs !py-2.5" />
        <select name="status" defaultValue={status} className="field max-w-[220px] !py-2.5">
          <option value="">Todos os status</option>
          <option value="awaiting_payment">Aguardando pagamento</option>
          <option value="paid">A enviar (pago/preparação/pronto)</option>
          <option value="preparing">Em preparação</option>
          <option value="ready_to_ship">Pronto para envio</option>
          <option value="shipped">Enviados/entregues</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <select name="pagamento" defaultValue={payment} className="field max-w-[200px] !py-2.5">
          <option value="">Qualquer pagamento</option>
          {(Object.keys(paymentStatusLabel) as PaymentStatus[]).map((p) => <option key={p} value={p}>{paymentStatusLabel[p]}</option>)}
        </select>
        <button className={buttonClass("outline", "md")}>Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr><th className="p-4">Pedido</th><th className="p-4">Data</th><th className="p-4">Cliente</th><th className="p-4">Pagamento</th><th className="p-4">Status</th><th className="p-4">Envio</th><th className="p-4 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {((data ?? []) as Order[]).map((o) => (
              <tr key={o.id} className="hover:bg-cream/60">
                <td className="p-4"><Link href={`/admin/pedidos/${o.id}`} className="font-semibold text-ink hover:text-lilac-700">#{o.order_number}</Link></td>
                <td className="p-4 text-ink-muted">{formatDate(o.created_at, true)}</td>
                <td className="p-4"><p className="font-medium">{o.customer_name}</p><p className="text-xs text-ink-muted">{o.customer_email}</p></td>
                <td className="p-4"><Badge tone={paymentStatusTone[o.payment_status]}>{paymentStatusLabel[o.payment_status]}</Badge><p className="mt-1 text-[11px] text-ink-muted">{o.payment_method === "pix" ? "Pix" : o.payment_method === "credit_card" ? "Cartão" : ""}</p></td>
                <td className="p-4"><Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></td>
                <td className="p-4 text-ink-muted">{o.shipping_service_name}</td>
                <td className="p-4 text-right font-semibold">{formatPrice(o.total)}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={7} className="p-10 text-center text-ink-muted">Nenhum pedido encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/admin/pedidos${qs(page - 1)}`} className={buttonClass("outline", "sm")}>Anterior</Link>}
          <span className="px-3 py-2 text-ink-muted">Página {page} de {pages}</span>
          {page < pages && <Link href={`/admin/pedidos${qs(page + 1)}`} className={buttonClass("outline", "sm")}>Próxima</Link>}
        </div>
      )}
    </>
  );
}
