import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import { PageHeader } from "../ui";
import { CategoryManager } from "./CategoryManager";

export const metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const supabase = await createClient();
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("*").order("position"),
    supabase.from("products").select("category_id"),
  ]);
  const countMap: Record<string, number> = {};
  for (const p of counts ?? []) if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] ?? 0) + 1;
  return (
    <>
      <PageHeader title="Categorias" description="Organize o catálogo e o menu da loja." />
      <CategoryManager categories={(data ?? []) as Category[]} counts={countMap} />
    </>
  );
}
