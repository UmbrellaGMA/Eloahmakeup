import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, normalizeSearch } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "../ui";
import { ProductRowActions } from "./ProductRowActions";

export const metadata = { title: "Produtos" };

const STATUS = { active: { label: "Ativo", tone: "success" }, draft: { label: "Rascunho", tone: "neutral" }, archived: { label: "Arquivado", tone: "warning" } } as const;

export default async function AdminProducts({ searchParams }: PageProps<"/admin/produtos">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const supabase = await createClient();
  let req = supabase
    .from("products")
    .select("id, name, sku, slug, price, promo_price, status, is_featured, is_new, has_variants, sales_count, category:categories(name), images:product_images(url, position), inventory(quantity, variant_id)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) req = req.ilike("search_text", `%${normalizeSearch(q)}%`);
  if (status) req = req.eq("status", status);
  const { data } = await req;

  type Row = {
    id: string; name: string; sku: string; slug: string; price: number; promo_price: number | null; status: keyof typeof STATUS;
    is_featured: boolean; is_new: boolean; has_variants: boolean; sales_count: number;
    category: { name: string } | null; images: { url: string; position: number }[]; inventory: { quantity: number; variant_id: string | null }[];
  };

  return (
    <>
      <PageHeader title="Produtos" description="Cadastre, edite e publique o catálogo." actions={<Link href="/admin/produtos/novo" className={buttonClass("primary", "md")}><Plus className="h-4 w-4" /> Novo produto</Link>} />
      <form className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nome, SKU, marca..." className="field max-w-sm !py-2.5" />
        <select name="status" defaultValue={status} className="field max-w-[180px] !py-2.5">
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="draft">Rascunhos</option>
          <option value="archived">Arquivados</option>
        </select>
        <button className={buttonClass("outline", "md")}>Filtrar</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr><th className="p-4">Produto</th><th className="p-4">Categoria</th><th className="p-4">Preço</th><th className="p-4">Estoque</th><th className="p-4">Vendas</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {((data ?? []) as unknown as Row[]).map((p) => {
              const img = [...p.images].sort((a, b) => a.position - b.position)[0]?.url;
              const stock = p.inventory.filter((i) => (p.has_variants ? i.variant_id : !i.variant_id)).reduce((s, i) => s + i.quantity, 0);
              return (
                <tr key={p.id} className="hover:bg-cream/60">
                  <td className="p-4">
                    <Link href={`/admin/produtos/${p.id}`} className="flex items-center gap-3">
                      <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-cream">{img && <Image src={img} alt="" fill sizes="40px" className="object-cover" />}</span>
                      <span>
                        <span className="block font-semibold hover:text-lilac-700">{p.name}</span>
                        <span className="text-xs text-ink-muted">SKU {p.sku}{p.has_variants ? " · com variações" : ""}{p.is_featured ? " · destaque" : ""}{p.is_new ? " · lançamento" : ""}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="p-4 text-ink-muted">{p.category?.name ?? "—"}</td>
                  <td className="p-4">
                    {p.promo_price ? <><span className="text-xs text-ink-muted line-through">{formatPrice(p.price)}</span><br /><strong>{formatPrice(p.promo_price)}</strong></> : <strong>{formatPrice(p.price)}</strong>}
                  </td>
                  <td className="p-4"><Badge tone={stock === 0 ? "danger" : stock <= 5 ? "warning" : "neutral"}>{stock} un.</Badge></td>
                  <td className="p-4">{p.sales_count}</td>
                  <td className="p-4"><Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge></td>
                  <td className="p-4 text-right"><ProductRowActions id={p.id} slug={p.slug} status={p.status} /></td>
                </tr>
              );
            })}
            {!data?.length && <tr><td colSpan={7} className="p-10 text-center text-ink-muted">Nenhum produto encontrado. <Link href="/admin/produtos/novo" className="font-semibold text-lilac-700 underline">Cadastrar o primeiro</Link></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
