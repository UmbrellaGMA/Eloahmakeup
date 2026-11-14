import type { Metadata } from "next";
import { CatalogView } from "@/components/store/CatalogView";
import { LANDINGS, catalogSeo } from "@/lib/seo";

export async function generateMetadata({ searchParams }: PageProps<"/produtos">): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : null;
  const seo = catalogSeo("/produtos", sp);
  const base = seo.landing ? LANDINGS[seo.landing] : null;
  const title = q ? `Busca: ${q}` : (base?.title ?? "Maquiagens e acessórios — todos os produtos");
  const description =
    base?.description ??
    "Compre maquiagens e acessórios de beleza na Eloah Make Up: bases, batons, paletas, pincéis e mais. Pague com Pix ou em até 6x no cartão e receba em todo o Brasil.";
  return {
    title: seo.page > 1 ? `${title} — página ${seo.page}` : title,
    description,
    alternates: { canonical: seo.canonical },
    robots: seo.index && !q ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: `${title} | Eloah Make Up`, description, url: seo.canonical, type: "website", siteName: "Eloah Make Up", locale: "pt_BR", images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Eloah Make Up — maquiagens e acessórios" }] },
  };
}

export default async function ProductsPage({ searchParams }: PageProps<"/produtos">) {
  const sp = await searchParams;
  const { landing } = catalogSeo("/produtos", sp);
  const title = landing ? LANDINGS[landing].title : "Todos os produtos";
  return <CatalogView title={title} searchParams={sp} basePath="/produtos" />;
}
