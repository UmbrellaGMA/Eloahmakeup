import { HeroCarousel } from "@/components/store/HeroCarousel";
import { Benefits, CategoryShowcase, InstagramSection, Testimonials } from "@/components/store/HomeSections";
import { ProductRail } from "@/components/store/ProductRail";
import { Newsletter } from "@/components/store/Newsletter";
import { ButtonLink } from "@/components/ui/Button";
import { getActiveBanners, getCategories, getStoreSettings, listProducts } from "@/lib/catalog";
import { publicEnv } from "@/lib/env";
import { jsonLd as toJsonLd } from "@/lib/safe";

export const revalidate = 120;

export default async function HomePage() {
  const [banners, categories, settings, featured, newest, best, sale] = await Promise.all([
    getActiveBanners(),
    getCategories(),
    getStoreSettings(),
    listProducts({ featured: true, perPage: 12 }),
    listProducts({ isNew: true, sort: "novidades", perPage: 12 }),
    listProducts({ bestSellers: true, sort: "mais-vendidos", perPage: 12 }),
    listProducts({ onSale: true, perPage: 12 }),
  ]);

  const catalogEmpty = !featured.total && !newest.total && !best.total && !sale.total;
  const fallback = catalogEmpty ? null : await listProducts({ perPage: 12, sort: "novidades" });

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.store_name,
    url: publicEnv.siteUrl,
    logo: `${publicEnv.siteUrl}/icon.svg`,
    sameAs: [settings.instagram_url, settings.facebook_url, settings.tiktok_url].filter(Boolean),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(orgJsonLd) }} />
      <HeroCarousel banners={banners} />
      <Benefits settings={settings} />

      <ProductRail eyebrow="Acabou de chegar" title="Novidades" products={newest.items} href="/produtos?lancamentos=1" />
      <ProductRail eyebrow="Seleção Eloah" title="Destaques da semana" products={featured.items} href="/produtos" />

      {sale.items.length > 0 && (
        <div className="bg-cream">
          <ProductRail eyebrow="Por tempo limitado" title="Ofertas especiais" products={sale.items} href="/produtos?promocao=1" hrefLabel="Ver todas as ofertas" />
        </div>
      )}

      <ProductRail eyebrow="As queridinhas" title="Mais vendidos" products={best.items} href="/produtos?ordem=mais-vendidos" />

      {!newest.items.length && !featured.items.length && fallback && (
        <ProductRail eyebrow="Catálogo" title="Nossos produtos" products={fallback.items} href="/produtos" />
      )}

      {catalogEmpty && (
        <section className="container-page py-20 text-center">
          <p className="eyebrow">Em breve</p>
          <h2 className="heading-display mt-3 text-4xl">Nossa coleção está chegando</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">Estamos preparando cada detalhe. Cadastre-se no Clube Eloah para ser avisada do lançamento.</p>
          <ButtonLink href="/produtos" variant="outline" className="mt-8">
            Ver catálogo
          </ButtonLink>
        </section>
      )}

      <Testimonials items={settings.testimonials} />
      <InstagramSection url={settings.instagram_url} posts={settings.instagram_posts} />
      <CategoryShowcase categories={categories} />
      <Newsletter />
    </>
  );
}
