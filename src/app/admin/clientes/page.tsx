import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClass } from "@/components/ui/Button";
import { formatDate, formatPhone } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { PageHeader } from "../ui";

export const metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/clientes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.replace(/[%,()]/g, " ").trim() : "";
  const supabase = await createClient();
  let req = supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(200);
  if (q) req = req.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,cpf.ilike.%${q.replace(/\D/g, "") || q}%`);
  const { data, count } = await req;
  const ids = (data ?? []).map((p) => p.id);
  const { data: orders } = ids.length
    ? await supabase.from("orders").select("user_id, total, payment_status").in("user_id", ids)
    : { data: [] };
  const agg: Record<string, { n: number; spent: number }> = {};
  for (const o of orders ?? []) {
    agg[o.user_id] ??= { n: 0, spent: 0 };
    agg[o.user_id].n++;
    if (o.payment_status === "approved") agg[o.user_id].spent += Number(o.total);
  }
  return (
    <>
      <PageHeader title="Clientes" description={`${count ?? 0} clientes cadastrados`} />
      <form className="mb-5 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Nome, e-mail ou CPF" className="field max-w-sm !py-2.5" />
        <button className={buttonClass("outline", "md")}>Buscar</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr><th className="p-4">Cliente</th><th className="p-4">Telefone</th><th className="p-4">Cadastro</th><th className="p-4">Pedidos</th><th className="p-4 text-right">Total comprado</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {((data ?? []) as Profile[]).map((p) => (
              <tr key={p.id} className="hover:bg-cream/60">
                <td className="p-4"><Link href={`/admin/clientes/${p.id}`} className="font-semibold hover:text-lilac-700">{p.full_name ?? "—"}</Link><p className="text-xs text-ink-muted">{p.email}</p></td>
                <td className="p-4 text-ink-muted">{formatPhone(p.phone) || "—"}</td>
                <td className="p-4 text-ink-muted">{formatDate(p.created_at)}</td>
                <td className="p-4">{agg[p.id]?.n ?? 0}</td>
                <td className="p-4 text-right font-semibold">{(agg[p.id]?.spent ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={5} className="p-10 text-center text-ink-muted">Nenhum cliente encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
