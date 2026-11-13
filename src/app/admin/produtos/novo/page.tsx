import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import { PageHeader } from "../../ui";
import { ProductEditor } from "../ProductEditor";

export const metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("position");
  return (
    <>
      <Link href="/admin/produtos" className="text-xs font-semibold text-lilac-700">← Produtos</Link>
      <PageHeader title="Novo produto" />
      <ProductEditor categories={(data ?? []) as Category[]} />
    </>
  );
}
