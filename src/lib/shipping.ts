import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { quoteShipping, type QuoteProduct } from "@/lib/integrations/superfrete";
import { integrations } from "@/lib/server-env";
import type { ShippingOption } from "@/lib/types";

type ItemRef = { product_id: string; quantity: number; unit_price?: number };

/** Monta a lista de produtos (dimensões/peso do cadastro) para a cotação. */
export async function buildQuoteProducts(items: ItemRef[]): Promise<{ products: QuoteProduct[]; insurance: number }> {
  if (!items.length) throw new AppError("Nenhum item para cotar.", 400, "EMPTY");
  const db = createAdminClient();
  const ids = [...new Set(items.map((i) => i.product_id))];
  const { data, error } = await db
    .from("products")
    .select("id, weight_grams, height_cm, width_cm, length_cm, price, promo_price")
    .in("id", ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  let insurance = 0;
  const products = items.map((i) => {
    const p = byId.get(i.product_id);
    if (!p) throw new AppError("Produto não encontrado para cotação.", 404, "NOT_FOUND");
    insurance += Number(i.unit_price ?? p.promo_price ?? p.price) * i.quantity;
    return {
      quantity: i.quantity,
      height: Number(p.height_cm),
      width: Number(p.width_cm),
      length: Number(p.length_cm),
      weight: Number(p.weight_grams) / 1000,
    };
  });
  return { products, insurance: Math.round(insurance * 100) / 100 };
}

export async function getOriginPostalCode() {
  const db = createAdminClient();
  const { data } = await db.from("store_settings").select("origin_postal_code, free_shipping_min").eq("id", 1).maybeSingle();
  return { origin: data?.origin_postal_code ?? "", freeShippingMin: data?.free_shipping_min != null ? Number(data.free_shipping_min) : null };
}

export async function quoteForItems(postalCode: string, items: ItemRef[]): Promise<ShippingOption[]> {
  if (!integrations.supabaseAdmin) throw new AppError("Loja em configuração.", 503, "NOT_CONFIGURED");
  const [{ products, insurance }, { origin }] = await Promise.all([buildQuoteProducts(items), getOriginPostalCode()]);
  return quoteShipping({ fromPostalCode: origin, toPostalCode: postalCode, products, insuranceValue: insurance });
}
