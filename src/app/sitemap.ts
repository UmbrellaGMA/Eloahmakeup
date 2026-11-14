import type { MetadataRoute } from "next";
import { getAllProductSlugs, getCategories } from "@/lib/catalog";
import { publicEnv } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const [products, categories] = await Promise.all([getAllProductSlugs(), getCategories()]);
  const lastProduct = products.reduce((d, p) => (p.updated_at > d ? p.updated_at : d), "");
  const now = lastProduct ? new Date(lastProduct) : new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/produtos`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/produtos?promocao=1`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/produtos?lancamentos=1`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/produtos?ordem=mais-vendidos`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...categories.map((c) => ({
      url: `${base}/categoria/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: c.parent_id ? 0.7 : 0.8,
      ...(c.image_url ? { images: [c.image_url] } : {}),
    })),
    ...products.map((p) => ({
      url: `${base}/produto/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: p.images.slice(0, 5),
    })),
    ...["sobre", "trocas-e-devolucoes", "politica-de-privacidade", "termos-de-uso"].map((s) => ({
      url: `${base}/institucional/${s}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
