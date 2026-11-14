import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/store/CatalogView";
import { getCategoryBySlug } from "@/lib/catalog";
import { LANDINGS, catalogSeo } from "@/lib/seo";

export async function generateMetadata({ params, searchParams }: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "Categoria não encontrada", robots: { index: false } };
  const seo = catalogSeo(`/categoria/${cat.slug}`, sp);
  const title = `${cat.name}${seo.landing ? ` — ${LANDINGS[seo.landing].title}` : ""}`;
  const description =
    (cat.description ? `${cat.description} ` : "") +
    `Compre ${cat.name.toLowerCase()} na Eloah Make Up com Pix ou em até 6x no cartão e entrega para todo o Brasil.`;
  return {
    title: seo.page > 1 ? `${title} — página ${seo.page}` : title,
    description: description.slice(0, 160),
    alternates: { canonical: seo.canonical },
    robots: seo.index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${title} | Eloah Make Up`,
      description: description.slice(0, 160),
      url: seo.canonical,
      type: "website",
      siteName: "Eloah Make Up",
      locale: "pt_BR",
      ...(cat.image_url ? { images: [cat.image_url] } : {}),
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categoria/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  return <CatalogView title={category.name} description={category.description} category={category} searchParams={sp} basePath={`/categoria/${slug}`} />;
}
