import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderList } from "@/components/store/OrderList";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default async function AccountPage({ searchParams }: PageProps<"/conta">) {
  const user = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: profile }, { data: orders }, { count: favCount }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("id, order_number, created_at, total, status, payment_status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("favorites").select("product_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const first = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div>
      {sp.senha === "atualizada" && <p className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-success">Senha atualizada com sucesso.</p>}
      <h1 className="heading-display text-4xl">Olá{first ? `, ${first}` : ""}!</h1>
      <p className="mt-2 text-sm text-ink-muted">Acompanhe seus pedidos e gerencie seus dados.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link href="/conta/pedidos" className="card p-5 transition hover:border-lilac-300">
          <p className="text-3xl font-semibold">{orders?.length ?? 0}</p>
          <p className="text-sm text-ink-muted">pedidos recentes</p>
        </Link>
        <Link href="/favoritos" className="card p-5 transition hover:border-lilac-300">
          <p className="text-3xl font-semibold">{favCount ?? 0}</p>
          <p className="text-sm text-ink-muted">favoritos</p>
        </Link>
        <Link href="/conta/enderecos" className="card p-5 transition hover:border-lilac-300">
          <p className="text-sm font-semibold">Endereços</p>
          <p className="text-sm text-ink-muted">Gerenciar entregas</p>
        </Link>
      </div>
      <h2 className="heading-display mb-4 mt-12 text-2xl">Últimos pedidos</h2>
      <OrderList orders={orders ?? []} />
    </div>
  );
}
