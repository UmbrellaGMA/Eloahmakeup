import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/store/ProductCard";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getUser();
  let products: Awaited<ReturnType<typeof listProducts>>["items"] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false });
    const ids = (data ?? []).map((f) => f.product_id as string);
    if (ids.length) products = (await listProducts({ ids, perPage: 60 })).items;
  }

  return (
    <div className="container-page pb-20 pt-10">
      <h1 className="heading-display mb-8 text-4xl sm:text-5xl">Meus favoritos</h1>
      {!user ? (
        <div className="flex flex-col items-center rounded-[var(--radius-card)] bg-cream px-6 py-20 text-center">
          <Heart className="h-10 w-10 text-lilac-500" strokeWidth={1.4} />
          <p className="heading-display mt-4 text-2xl">Entre para ver seus favoritos</p>
          <p className="mt-2 text-sm text-ink-muted">Salve produtos e acesse de qualquer dispositivo.</p>
          <Link href="/entrar?next=/favoritos" className={buttonClass("primary", "md", "mt-6")}>
            Entrar na minha conta
          </Link>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center rounded-[var(--radius-card)] bg-cream px-6 py-20 text-center">
          <Heart className="h-10 w-10 text-lilac-500" strokeWidth={1.4} />
          <p className="heading-display mt-4 text-2xl">Nenhum favorito ainda</p>
          <p className="mt-2 text-sm text-ink-muted">Toque no coração dos produtos que você amar.</p>
          <Link href="/produtos" className={buttonClass("primary", "md", "mt-6")}>
            Explorar produtos
          </Link>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
