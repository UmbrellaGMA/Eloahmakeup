import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { formatCep, formatCpf, formatDate, formatPhone, formatPrice, orderStatusLabel, orderStatusTone, paymentStatusLabel, paymentStatusTone } from "@/lib/format";
import type { Address, Order, Profile } from "@/lib/types";
import { PageHeader, Panel } from "../../ui";

export const metadata = { title: "Cliente" };

export default async function CustomerDetail({ params }: PageProps<"/admin/clientes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: profile }, { data: addresses }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("addresses").select("*").eq("user_id", id),
    supabase.from("orders").select("id, order_number, created_at, total, status, payment_status").eq("user_id", id).order("created_at", { ascending: false }),
  ]);
  if (!profile) notFound();
  const p = profile as Profile;
  const spent = ((orders ?? []) as Order[]).filter((o) => o.payment_status === "approved").reduce((s, o) => s + Number(o.total), 0);

  return (
    <>
      <Link href="/admin/clientes" className="text-xs font-semibold text-lilac-700">← Clientes</Link>
      <PageHeader title={p.full_name ?? p.email ?? "Cliente"} description={`Cliente desde ${formatDate(p.created_at)}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-6">
          <Panel title="Dados">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ink-muted">E-mail</dt><dd>{p.email}</dd></div>
              <div><dt className="text-xs text-ink-muted">Telefone</dt><dd>{formatPhone(p.phone) || "—"}</dd></div>
              <div><dt className="text-xs text-ink-muted">CPF</dt><dd>{p.cpf ? formatCpf(p.cpf) : "—"}</dd></div>
              <div><dt className="text-xs text-ink-muted">Marketing</dt><dd>{p.accepts_marketing ? "Aceita receber" : "Não aceita"}</dd></div>
              <div><dt className="text-xs text-ink-muted">Total comprado</dt><dd className="font-semibold">{formatPrice(spent)}</dd></div>
            </dl>
          </Panel>
          <Panel title="Endereços">
            {!addresses?.length ? <p className="text-sm text-ink-muted">Nenhum endereço salvo.</p> : (
              <ul className="space-y-3 text-sm">
                {(addresses as Address[]).map((a) => (
                  <li key={a.id} className="rounded-xl bg-cream p-3">
                    <p className="font-semibold">{a.label ?? a.recipient_name} {a.is_default && <Badge tone="lilac">Padrão</Badge>}</p>
                    <p className="text-ink-muted">{a.street}, {a.number}{a.complement ? ` - ${a.complement}` : ""} · {a.district} · {a.city}/{a.state} · {formatCep(a.postal_code)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel title={`Pedidos (${orders?.length ?? 0})`}>
          <ul className="divide-y divide-line text-sm">
            {((orders ?? []) as Order[]).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link href={`/admin/pedidos/${o.id}`} className="font-semibold hover:text-lilac-700">#{o.order_number}</Link>
                <span className="text-ink-muted">{formatDate(o.created_at)}</span>
                <Badge tone={paymentStatusTone[o.payment_status]}>{paymentStatusLabel[o.payment_status]}</Badge>
                <Badge tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</Badge>
                <span className="font-semibold">{formatPrice(o.total)}</span>
              </li>
            ))}
            {!orders?.length && <li className="py-6 text-center text-ink-muted">Nenhum pedido.</li>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
