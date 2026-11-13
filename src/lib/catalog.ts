import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { normalizeSearch } from "@/lib/format";
import type {
  Banner,
  Category,
  InventoryRow,
  ProductCardData,
  ProductImage,
  ProductWithRelations,
  StoreSettings,
} from "@/lib/types";

const CARD_SELECT =
  "id, name, slug, brand, price, promo_price, is_new, has_variants, sales_count, created_at, category:categories(slug), images:product_images(url, alt, position), inventory(quantity, variant_id)";

type RawCardRow = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  price: number;
  promo_price: number | null;
  is_new: boolean;
  has_variants: boolean;
  sales_count: number;
  category: { slug: string } | null;
  images: Pick<ProductImage, "url" | "alt" | "position">[];
  inventory: Pick<InventoryRow, "quantity" | "variant_id">[];
};

export function toCard(row: RawCardRow): ProductCardData {
  const imgs = [...(row.images ?? [])].sort((a, b) => a.position - b.position);
  const stockRows = (row.inventory ?? []).filter((i) => (row.has_variants ? i.variant_id !== null : i.variant_id === null));
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    price: Number(row.price),
    promo_price: row.promo_price != null ? Number(row.promo_price) : null,
    is_new: row.is_new,
    has_variants: row.has_variants,
    sales_count: row.sales_count,
    image: imgs[0]?.url ?? null,
    image_alt: imgs[0]?.alt ?? null,
    second_image: imgs[1]?.url ?? null,
    in_stock: stockRows.some((i) => i.quantity > 0),
    category_slug: row.category?.slug ?? null,
  };
}

async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error("[catalog]", e);
    return fallback;
  }
}

export const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  store_name: "Eloah Make Up",
  tagline: "Maquiagem que revela a sua melhor versão.",
  logo_url: null,
  whatsapp: null,
  email: null,
  phone: null,
  instagram_url: null,
  facebook_url: null,
  tiktok_url: null,
  company_name: null,
  cnpj: null,
  origin_name: null,
  origin_postal_code: null,
  origin_street: null,
  origin_number: null,
  origin_complement: null,
  origin_district: null,
  origin_city: null,
  origin_state: null,
  origin_document: null,
  max_installments: 6,
  min_installment_value: 20,
  free_shipping_min: null,
  announcement: null,
  testimonials: [],
  instagram_posts: [],
};

export const getStoreSettings = cache(() =>
  safe(DEFAULT_SETTINGS, async () => {
    const { data, error } = await createPublicClient().from("store_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as StoreSettings;
  }),
);

export const getCategories = cache(() =>
  safe<Category[]>([], async () => {
    const { data, error } = await createPublicClient()
      .from("categories")
      .select("id, parent_id, name, slug, description, image_url, position, is_active, show_in_menu")
      .eq("is_active", true)
      .order("position");
    if (error) throw error;
    return (data ?? []) as Category[];
  }),
);

export const getCategoryBySlug = cache(async (slug: string) => {
  const cats = await getCategories();
  return cats.find((c) => c.slug === slug) ?? null;
});

export const getActiveBanners = cache(() =>
  safe<Banner[]>([], async () => {
    const { data, error } = await createPublicClient().from("banners").select("*").order("position");
    if (error) throw error;
    return (data ?? []) as Banner[];
  }),
);

export type ProductSort = "relevancia" | "novidades" | "mais-vendidos" | "menor-preco" | "maior-preco" | "nome";

export interface ProductQuery {
  q?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  isNew?: boolean;
  bestSellers?: boolean;
  featured?: boolean;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
  ids?: string[];
}

export async function listProducts(query: ProductQuery = {}) {
  const perPage = Math.min(Math.max(query.perPage ?? 24, 1), 60);
  const page = Math.max(query.page ?? 1, 1);
  return safe({ items: [] as ProductCardData[], total: 0, page, perPage, pages: 0 }, async () => {
    const supabase = createPublicClient();
    let req = supabase.from("products").select(CARD_SELECT, { count: "exact" }).eq("status", "active");

    if (query.categorySlug) {
      const cats = await getCategories();
      const root = cats.find((c) => c.slug === query.categorySlug);
      if (!root) return { items: [], total: 0, page, perPage, pages: 0 };
      const ids = [root.id, ...cats.filter((c) => c.parent_id === root.id).map((c) => c.id)];
      req = req.in("category_id", ids);
    }
    if (query.ids?.length) req = req.in("id", query.ids);
    if (query.q) {
      const term = normalizeSearch(query.q);
      if (term) req = req.ilike("search_text", `%${term.split(/\s+/).join("%")}%`);
    }
    if (query.onSale) req = req.not("promo_price", "is", null);
    if (query.isNew) req = req.eq("is_new", true);
    if (query.featured) req = req.eq("is_featured", true);
    if (query.bestSellers) req = req.gt("sales_count", 0);
    // Filtro de preço sobre o preço efetivo (promocional quando houver)
    if (query.minPrice != null || query.maxPrice != null) {
      const promo: string[] = [];
      const full: string[] = ["promo_price.is.null"];
      if (query.minPrice != null && Number.isFinite(query.minPrice)) {
        promo.push(`promo_price.gte.${query.minPrice}`);
        full.push(`price.gte.${query.minPrice}`);
      }
      if (query.maxPrice != null && Number.isFinite(query.maxPrice)) {
        promo.push(`promo_price.lte.${query.maxPrice}`);
        full.push(`price.lte.${query.maxPrice}`);
      }
      if (promo.length) req = req.or(`and(${promo.join(",")}),and(${full.join(",")})`);
    }

    switch (query.sort) {
      case "novidades":
        req = req.order("created_at", { ascending: false });
        break;
      case "mais-vendidos":
        req = req.order("sales_count", { ascending: false });
        break;
      case "menor-preco":
        req = req.order("price", { ascending: true });
        break;
      case "maior-preco":
        req = req.order("price", { ascending: false });
        break;
      case "nome":
        req = req.order("name", { ascending: true });
        break;
      default:
        req = req.order("is_featured", { ascending: false }).order("sales_count", { ascending: false }).order("created_at", { ascending: false });
    }

    const from = (page - 1) * perPage;
    const { data, error, count } = await req.range(from, from + perPage - 1);
    if (error) throw error;
    let items = ((data ?? []) as unknown as RawCardRow[]).map(toCard);
    // Ordenação por preço efetivo (o banco ordena pelo preço cheio)
    if (query.sort === "menor-preco" || query.sort === "maior-preco") {
      const eff = (p: ProductCardData) => p.promo_price ?? p.price;
      items = items.sort((a, b) => (query.sort === "menor-preco" ? eff(a) - eff(b) : eff(b) - eff(a)));
    }
    const total = count ?? items.length;
    return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
  });
}

export const getProductBySlug = cache((slug: string) =>
  safe<ProductWithRelations | null>(null, async () => {
    const { data, error } = await createPublicClient()
      .from("products")
      .select(
        "*, category:categories(id, name, slug, parent_id), images:product_images(*), variants:product_variants(*), inventory(*)",
      )
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const p = data as ProductWithRelations;
    p.images = [...(p.images ?? [])].sort((a, b) => a.position - b.position);
    p.variants = [...(p.variants ?? [])].filter((v) => v.is_active).sort((a, b) => a.position - b.position);
    return p;
  }),
);

export async function getRelatedProducts(product: ProductWithRelations, limit = 8) {
  const res = await listProducts({ categorySlug: product.category?.slug, perPage: limit + 1, sort: "mais-vendidos" });
  return res.items.filter((p) => p.id !== product.id).slice(0, limit);
}

export async function getAllProductSlugs() {
  return safe<{ slug: string; updated_at: string }[]>([], async () => {
    const { data, error } = await createPublicClient().from("products").select("slug, updated_at").eq("status", "active");
    if (error) throw error;
    return data ?? [];
  });
}
