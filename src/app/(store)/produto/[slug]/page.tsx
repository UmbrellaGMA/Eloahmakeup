import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ProductPurchase } from "@/components/store/ProductPurchase";
import { ProductRail } from "@/components/store/ProductRail";
import { getCategories, getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { effectivePrice } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import { jsonLd as toJsonLd } from "@/lib/safe";

export const revalidate = 120;

export async function generateMetadata({ params }: PageProps<"/produto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Produto não encontrado", robots: { index: false } };
  const description = p.seo_description ?? p.short_description ?? `${p.name} — compre na Eloah Make Up.`;
  return {
    title: p.seo_title ?? p.name,
    description,
    alternates: { canonical: `/produto/${p.slug}` },
    openGraph: {
      type: "website",
      siteName: "Eloah Make Up",
      locale: "pt_BR",
      url: `/produto/${p.slug}`,
      title: p.seo_title ?? p.name,
      description,
      images: p.images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt ?? p.name })),
    },
  };
}

/** Validade informada ao Google para o preço (a página é revalidada a cada 2 minutos). */
function priceValidUntil() {
  return new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
}

export default async function ProductPage({ params }: PageProps<"/produto/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [related, categories] = await Promise.all([getRelatedProducts(product), getCategories()]);

  const cat = product.category;
  const parent = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id) : null;
  const prices = effectivePrice(product);
  const totalStock = product.inventory
    .filter((i) => (product.has_variants ? i.variant_id !== null : i.variant_id === null))
    .reduce((s, i) => s + i.quantity, 0);

  const url = `${publicEnv.siteUrl}/produto/${product.slug}`;
  const nextYear = priceValidUntil();
  const activeVariants = product.variants.filter((v) => v.is_active);
  const variantPrices = activeVariants.map((v) => effectivePrice(product, v).final);
  const shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BR" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 15, unitCode: "DAY" },
    },
  };
  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "BR",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7,
    returnMethod: "https://schema.org/ReturnByMail",
    merchantReturnLink: `${publicEnv.siteUrl}/institucional/trocas-e-devolucoes`,
  };
  const baseOffer = {
    url,
    priceCurrency: "BRL",
    priceValidUntil: nextYear,
    availability: totalStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: "Eloah Make Up", url: publicEnv.siteUrl },
    shippingDetails,
    hasMerchantReturnPolicy: returnPolicy,
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#produto`,
    url,
    name: product.name,
    sku: product.sku,
    description: product.seo_description ?? product.short_description ?? product.description ?? undefined,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: product.brand ?? "Eloah Make Up" },
    category: cat?.name,
    ...(product.weight_grams ? { weight: { "@type": "QuantitativeValue", value: product.weight_grams, unitCode: "GRM" } } : {}),
    offers:
      variantPrices.length > 1 && Math.min(...variantPrices) !== Math.max(...variantPrices)
        ? {
            "@type": "AggregateOffer",
            ...baseOffer,
            lowPrice: Math.min(...variantPrices).toFixed(2),
            highPrice: Math.max(...variantPrices).toFixed(2),
            offerCount: variantPrices.length,
          }
        : { "@type": "Offer", ...baseOffer, price: prices.final.toFixed(2) },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />
      <div className="container-page pb-10 pt-6">
        <Breadcrumbs
          items={[
            { label: "Início", href: "/" },
            ...(parent ? [{ label: parent.name, href: `/categoria/${parent.slug}` }] : []),
            ...(cat ? [{ label: cat.name, href: `/categoria/${cat.slug}` }] : []),
            { label: product.name },
          ]}
        />
        <div className="mt-6">
          <ProductPurchase product={product} />
        </div>

        {product.description && (
          <section className="mx-auto mt-20 max-w-3xl border-t border-line pt-12">
            <h2 className="heading-display text-3xl">Descrição</h2>
            <div className="prose-eloah mt-5 whitespace-pre-line text-[15px] text-ink-muted">{product.description}</div>
            <dl className="mt-8 grid grid-cols-2 gap-4 rounded-2xl bg-cream p-6 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-ink-muted">Peso</dt><dd className="font-semibold">{product.weight_grams} g</dd></div>
              <div><dt className="text-xs text-ink-muted">Altura</dt><dd className="font-semibold">{Number(product.height_cm)} cm</dd></div>
              <div><dt className="text-xs text-ink-muted">Largura</dt><dd className="font-semibold">{Number(product.width_cm)} cm</dd></div>
              <div><dt className="text-xs text-ink-muted">Comprimento</dt><dd className="font-semibold">{Number(product.length_cm)} cm</dd></div>
            </dl>
          </section>
        )}
      </div>
      <ProductRail eyebrow="Combine com" title="Você também vai amar" products={related} />
    </>
  );
}
