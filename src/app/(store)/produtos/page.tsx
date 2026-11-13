import type { Metadata } from "next";
import { CatalogView } from "@/components/store/CatalogView";

export async function generateMetadata({ searchParams }: PageProps<"/produtos">): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : null;
  return {
    title: q ? `Busca: ${q}` : "Todos os produtos",
    description: "Maquiagens e acessórios Eloah Make Up. Filtre por categoria, preço, promoções e lançamentos.",
    alternates: { canonical: "/produtos" },
    robots: q ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({ searchParams }: PageProps<"/produtos">) {
  const sp = await searchParams;
  const title = sp.promocao === "1" ? "Ofertas" : sp.lancamentos === "1" ? "Lançamentos" : sp.ordem === "mais-vendidos" ? "Mais vendidos" : "Todos os produtos";
  return <CatalogView title={title} searchParams={sp} basePath="/produtos" />;
}
