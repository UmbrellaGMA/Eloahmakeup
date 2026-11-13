import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "../ui";
import { StockInput } from "./StockInput";

export const metadata = { title: "Estoque" };

type Row = {
  id: string;
  quantity: number;
  low_stock_threshold: number;
  variant_id: string | null;
  product: { id: string; name: string; sku: string; status: string; has_variants: boolean };
  variant: { name: string; sku: string } | null;
};

export default async function StockPage({ searchParams }: PageProps<"/admin/estoque">) {
  const sp = await searchParams;
  const onlyLow = sp.baixo === "1";
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory")
    .select("id, quantity, low_stock_threshold, variant_id, product:products!inner(id, name, sku, status, has_variants), variant:product_variants(name, sku)")
    .neq("product.status", "archived")
    .order("quantity")
    .limit(500);
  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => (r.product.has_variants ? r.variant_id : !r.variant_id))
    .filter((r) => !onlyLow || r.quantity <= r.low_stock_threshold);

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Ajuste quantidades. Pedidos reservam estoque na criação e devolvem ao serem cancelados."
        actions={
          <Link href={onlyLow ? "/admin/estoque" : "/admin/estoque?baixo=1"} className={buttonClass(onlyLow ? "primary" : "outline", "md")}>
            {onlyLow ? "Mostrar todos" : "Somente estoque baixo"}
          </Link>
        }
      />
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr><th className="p-4">Produto</th><th className="p-4">SKU</th><th className="p-4">Status</th><th className="p-4">Quantidade</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={r.quantity <= r.low_stock_threshold ? "bg-amber-50/50" : ""}>
                <td className="p-4"><Link href={`/admin/produtos/${r.product.id}`} className="font-medium hover:text-lilac-700">{r.product.name}{r.variant ? ` — ${r.variant.name}` : ""}</Link></td>
                <td className="p-4 font-mono text-xs">{r.variant?.sku ?? r.product.sku}</td>
                <td className="p-4 text-ink-muted">{r.product.status === "active" ? "Ativo" : "Rascunho"}</td>
                <td className="p-4"><StockInput id={r.id} quantity={r.quantity} threshold={r.low_stock_threshold} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="p-10 text-center text-ink-muted">Nada por aqui.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
