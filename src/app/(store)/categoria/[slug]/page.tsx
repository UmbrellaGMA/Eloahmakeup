import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/store/CatalogView";
import { getCategoryBySlug } from "@/lib/catalog";

export async function generateMetadata({ params }: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "Categoria não encontrada" };
  return {
    title: cat.name,
    description: cat.description ?? `${cat.name} Eloah Make Up — compre online com Pix ou cartão.`,
    alternates: { canonical: `/categoria/${cat.slug}` },
    openGraph: { title: `${cat.name} | Eloah Make Up`, images: cat.image_url ? [cat.image_url] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categoria/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  return <CatalogView title={category.name} description={category.description} category={category} searchParams={sp} basePath={`/categoria/${slug}`} />;
}
