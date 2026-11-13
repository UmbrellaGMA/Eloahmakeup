import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, ProductWithRelations } from "@/lib/types";
import { PageHeader } from "../../ui";
import { ProductEditor } from "../ProductEditor";

export const metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: PageProps<"/admin/produtos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*, images:product_images(*), variants:product_variants(*), inventory(*)").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("position"),
  ]);
  if (!product) notFound();
  const p = product as ProductWithRelations;
  p.variants = [...(p.variants ?? [])].sort((a, b) => a.position - b.position);
  return (
    <>
      <Link href="/admin/produtos" className="text-xs font-semibold text-lilac-700">← Produtos</Link>
      <PageHeader
        title={p.name}
        description={`SKU ${p.sku}`}
        actions={p.status === "active" ? <Link href={`/produto/${p.slug}`} target="_blank" className="text-sm font-semibold text-lilac-700 underline">Ver na loja</Link> : undefined}
      />
      <ProductEditor key={p.updated_at} product={p} categories={(categories ?? []) as Category[]} />
    </>
  );
}
