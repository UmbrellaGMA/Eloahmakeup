import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { listProducts, getCategories, type ProductQuery, type ProductSort } from "@/lib/catalog";
import type { Category } from "@/lib/types";
import { ProductGrid } from "./ProductCard";
import { CatalogFilters, SortSelect } from "./CatalogFilters";
import { Breadcrumbs } from "./Breadcrumbs";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseCatalogQuery(sp: SearchParams): ProductQuery {
  const num = (v?: string) => (v && /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined);
  const sortRaw = one(sp.ordem);
  const bestSellers = one(sp["mais-vendidos"]) === "1";
  return {
    q: one(sp.q)?.slice(0, 80),
    minPrice: num(one(sp.min)),
    maxPrice: num(one(sp.max)),
    onSale: one(sp.promocao) === "1",
    isNew: one(sp.lancamentos) === "1",
    bestSellers,
    sort: (sortRaw as ProductSort) ?? (bestSellers ? "mais-vendidos" : undefined),
    page: Number(one(sp.pagina)) || 1,
    perPage: 24,
  };
}

function pageHref(base: string, sp: SearchParams, page: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val && k !== "pagina") p.set(k, val);
  }
  if (page > 1) p.set("pagina", String(page));
  return `${base}${p.size ? `?${p}` : ""}`;
}

export async function CatalogView({
  title,
  description,
  category,
  searchParams,
  basePath,
}: {
  title: string;
  description?: string | null;
  category?: Category | null;
  searchParams: SearchParams;
  basePath: string;
}) {
  const query = { ...parseCatalogQuery(searchParams), categorySlug: category?.slug };
  const [result, categories] = await Promise.all([listProducts(query), getCategories()]);
  const parent = category?.parent_id ? categories.find((c) => c.id === category.parent_id) : null;

  const crumbs = [
    { label: "Início", href: "/" },
    ...(parent ? [{ label: parent.name, href: `/categoria/${parent.slug}` }] : []),
    { label: category ? category.name : "Produtos" },
  ];

  return (
    <div className="container-page pb-20 pt-6">
      <Breadcrumbs items={crumbs} />
      <header className="mb-8 mt-6 border-b border-line pb-8">
        <h1 className="heading-display text-4xl sm:text-5xl">{query.q ? `Resultados para “${query.q}”` : title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </header>

      <div className="flex gap-12">
        <Suspense>
          <CatalogFilters mode="sidebar" categories={categories} currentCategory={category?.slug} />
        </Suspense>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Suspense>
              <CatalogFilters mode="mobile" categories={categories} currentCategory={category?.slug} />
            </Suspense>
            <p className="hidden text-sm text-ink-muted sm:block">
              {result.total} {result.total === 1 ? "produto" : "produtos"}
            </p>
            <Suspense>
              <SortSelect />
            </Suspense>
          </div>

          {result.items.length === 0 ? (
            <div className="flex flex-col items-center rounded-[var(--radius-card)] bg-cream px-6 py-20 text-center">
              <SearchX className="h-10 w-10 text-lilac-500" strokeWidth={1.4} />
              <p className="heading-display mt-4 text-2xl">Nenhum produto encontrado</p>
              <p className="mt-2 max-w-sm text-sm text-ink-muted">Tente ajustar os filtros ou buscar por outro termo.</p>
              <Link href="/produtos" className="link-underline mt-6 text-sm font-semibold">
                Ver todos os produtos
              </Link>
            </div>
          ) : (
            <ProductGrid products={result.items} />
          )}

          {result.pages > 1 && (
            <nav className="mt-14 flex items-center justify-center gap-2" aria-label="Paginação">
              {result.page > 1 && (
                <Link href={pageHref(basePath, searchParams, result.page - 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line hover:border-ink" aria-label="Página anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              )}
              {Array.from({ length: result.pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === result.pages || Math.abs(p - result.page) <= 1)
                .map((p, i, arr) => (
                  <span key={p} className="flex items-center gap-2">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="text-ink-muted">…</span>}
                    <Link
                      href={pageHref(basePath, searchParams, p)}
                      aria-current={p === result.page ? "page" : undefined}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold ${p === result.page ? "bg-ink text-white" : "border border-line hover:border-ink"}`}
                    >
                      {p}
                    </Link>
                  </span>
                ))}
              {result.page < result.pages && (
                <Link href={pageHref(basePath, searchParams, result.page + 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line hover:border-ink" aria-label="Próxima página">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
