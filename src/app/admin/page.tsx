import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice, orderStatusLabel, orderStatusTone, paymentStatusLabel, paymentStatusTone } from "@/lib/format";
import { integrations } from "@/lib/server-env";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, Panel } from "./ui";
import { RevenueChart } from "./RevenueChart";
import type { Order } from "@/lib/types";

type Stats = {
  revenue_total: number;
  revenue_period: number;
  sales_count: number;
  orders_total: number;
  orders_pending: number;
  orders_paid: number;
  orders_shipped: number;
  products_total: number;
  products_active: number;
  customers_total: number;
  low_stock: number;
  average_ticket: number;
  daily: { day: string; revenue: number; orders: number }[];
};

function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <div className="h-full rounded-2xl border border-line bg-white p-5 transition hover:border-lilac-300">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-2 text-[1.7rem] font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const [{ data: stats, error }, { data: recent }, { data: lowStock }, { count: devices }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats", { p_days: 30 }),
    supabase.from("orders").select("id, order_number, customer_name, total, status, payment_status, created_at").order("created_at", { ascending: false }).limit(8),
    supabase
      .from("inventory")
      .select("id, quantity, low_stock_threshold, variant_id, product:products!inner(id, name, status, has_variants), variant:product_variants(name)")
      .eq("product.status", "active")
      .lte("quantity", 5)
      .order("quantity")
      .limit(8),
    // RLS: retorna somente os aparelhos do próprio administrador
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
  ]);
  const s = (stats ?? {}) as Stats;

  const lowRows = ((lowStock ?? []) as unknown as {
    id: string;
    quantity: number;
    low_stock_threshold: number;
    variant_id: string | null;
    product: { id: string; name: string; has_variants: boolean };
    variant: { name: string } | null;
  }[]).filter((r) => (r.product.has_variants ? r.variant_id : !r.variant_id) && r.quantity <= r.low_stock_threshold);

  return (
    <>
      <PageHeader title="Dashboard" description="Visão geral da operação da loja." />
      {error && <p className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-danger">Não foi possível carregar as estatísticas: {error.message}</p>}

      {(!integrations.mercadoPago || !integrations.superFrete) && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Integrações pendentes: {!integrations.mercadoPago && <strong>Mercado Pago </strong>}
            {!integrations.superFrete && <strong>SuperFrete</strong>}. O checkout só fica disponível após configurar as credenciais.{" "}
            <Link href="/admin/integracoes" className="font-semibold underline">Ver integrações</Link>
          </p>
        </div>
      )}

      {integrations.push && !devices && (
        <Link href="/admin/app" className="mb-6 flex items-center gap-3 rounded-2xl border border-lilac-200 bg-lilac-50 p-4 text-sm text-lilac-900 transition hover:border-lilac-400">
          <Bell className="h-5 w-5 shrink-0" />
          <span>
            <strong>Nenhum celular recebendo avisos de pedidos.</strong> Instale o app Eloah Admin no iPhone e ative as notificações →
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Faturamento total" value={formatPrice(s.revenue_total)} hint={`${formatPrice(s.revenue_period)} nos últimos 30 dias`} />
        <Stat label="Vendas aprovadas" value={s.sales_count ?? 0} hint={`Ticket médio ${formatPrice(s.average_ticket)}`} />
        <Stat label="Pedidos realizados" value={s.orders_total ?? 0} href="/admin/pedidos" />
        <Stat label="Aguardando pagamento" value={s.orders_pending ?? 0} href="/admin/pedidos?status=awaiting_payment" />
        <Stat label="Pagos a enviar" value={s.orders_paid ?? 0} hint="Pago, em preparação ou pronto" href="/admin/pedidos?status=paid" />
        <Stat label="Enviados / entregues" value={s.orders_shipped ?? 0} href="/admin/pedidos?status=shipped" />
        <Stat label="Produtos" value={`${s.products_active ?? 0} / ${s.products_total ?? 0}`} hint="ativos / cadastrados" href="/admin/produtos" />
        <Stat label="Estoque baixo" value={s.low_stock ?? 0} hint={`${s.customers_total ?? 0} clientes cadastrados`} href="/admin/estoque?baixo=1" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Faturamento aprovado — últimos 30 dias">
          {s.daily?.length ? <RevenueChart data={s.daily} /> : <p className="text-sm text-ink-muted">Sem dados ainda.</p>}
        </Panel>
        <Panel title="Estoque baixo" actions={<Link href="/admin/estoque?baixo=1" className="text-xs font-semibold text-lilac-700">Ver tudo</Link>}>
          {lowRows.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted"><CheckCircle2 className="h-4 w-4 text-success" /> Nenhum produto com estoque baixo.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {lowRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/produtos/${r.product.id}`} className="min-w-0 truncate hover:text-lilac-700">
                    {r.product.name}{r.variant ? ` — ${r.variant.name}` : ""}
                  </Link>
                  <Badge tone={r.quantity === 0 ? "danger" : "warning"}>{r.quantity} un.</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Pedidos recentes" className="mt-6" actions={<Link href="/admin/pedidos" className="text-xs font-semibold text-lilac-700">Ver todos</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-ink-muted">
              <tr><th className="pb-3">Pedido</th><th className="pb-3">Cliente</th><th className="pb-3">Data</th><th className="pb-3">Pagamento</th><th className="pb-3">Status</th><th className="pb-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {((recent ?? []) as Order[]).map((o) => (
                <tr key={o.id} className="hover:bg-cream">
                  <td className="py-3"><Link href={`/admin/pedidos/${o.id}`} className="font-semibold hover:text-lilac-700">#{o.order_number}</Link></td>
                  <td className="py-3">{o.customer_name}</td>
                  <td className="py-3 text-ink-muted">{formatDate(o.created_at, true)}</td>
                  <td className="py-3"><Badge tone={paymentStatusTone[o.payment_status]}>{paymentStatusLabel[o.payment_status]}</Badge></td>
                  <td className="py-3"><Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge></td>
                  <td className="py-3 text-right font-semibold">{formatPrice(o.total)}</td>
                </tr>
              ))}
              {!recent?.length && <tr><td colSpan={6} className="py-6 text-center text-ink-muted">Nenhum pedido ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
