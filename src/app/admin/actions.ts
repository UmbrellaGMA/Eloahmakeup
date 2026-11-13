"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { onlyDigits, slugify } from "@/lib/format";

export type ActionResult = { ok?: boolean; error?: string; id?: string; message?: string } | undefined;

function fail(e: unknown): ActionResult {
  if (e instanceof AppError) return { error: e.message };
  const msg = (e as { message?: string })?.message ?? "";
  const code = (e as { code?: string })?.code;
  if (code === "23505") return { error: "Já existe um registro com esse identificador (slug/SKU/código)." };
  if (code === "23514") return { error: "Valores inválidos. Verifique os campos (ex.: preço promocional deve ser menor que o preço)." };
  if (/^[A-Z_]+: /.test(msg)) return { error: msg.replace(/^[A-Z_]+: /, "") };
  console.error("[admin]", e);
  return { error: "Não foi possível salvar. Verifique os dados e tente novamente." };
}

function revalidateStore() {
  revalidatePath("/", "layout");
}

const num = (v: FormDataEntryValue | null) => {
  if (v === null || v === "") return null;
  const s = String(v).trim();
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : NaN;
};
const money = (v: FormDataEntryValue | null) => {
  if (v === null || v === "") return null;
  const s = String(v).trim();
  // aceita "59,90", "59.90" e "1.234,56"
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const str = (v: FormDataEntryValue | null) => (v === null ? null : String(v).trim() || null);

// -----------------------------------------------------------------------------
// Produtos
// -----------------------------------------------------------------------------
const productSchema = z
  .object({
    name: z.string().min(2, "Nome obrigatório").max(160),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug inválido"),
    sku: z.string().min(1, "SKU obrigatório").max(64),
    brand: z.string().max(80).nullable(),
    category_id: z.uuid().nullable(),
    short_description: z.string().max(300).nullable(),
    description: z.string().max(20000).nullable(),
    price: z.number({ error: "Preço inválido" }).positive("Preço deve ser maior que zero"),
    promo_price: z.number().positive().nullable(),
    weight_grams: z.number().int().min(1, "Peso mínimo 1 g").max(30000),
    height_cm: z.number().min(0.4).max(100),
    width_cm: z.number().min(8, "Largura mínima 8 cm (Correios)").max(100),
    length_cm: z.number().min(13, "Comprimento mínimo 13 cm (Correios)").max(100),
    status: z.enum(["draft", "active", "archived"]),
    is_featured: z.boolean(),
    is_new: z.boolean(),
    tags: z.array(z.string()).max(20),
    seo_title: z.string().max(70).nullable(),
    seo_description: z.string().max(170).nullable(),
  })
  .refine((d) => d.promo_price == null || d.promo_price < d.price, { message: "O preço promocional deve ser menor que o preço", path: ["promo_price"] });

export async function saveProduct(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const id = str(fd.get("id"));
    const name = str(fd.get("name")) ?? "";
    const parsed = productSchema.safeParse({
      name,
      slug: slugify(str(fd.get("slug")) ?? name),
      sku: (str(fd.get("sku")) ?? "").toUpperCase(),
      brand: str(fd.get("brand")),
      category_id: str(fd.get("category_id")),
      short_description: str(fd.get("short_description")),
      description: str(fd.get("description")),
      price: money(fd.get("price")),
      promo_price: money(fd.get("promo_price")),
      weight_grams: num(fd.get("weight_grams")),
      height_cm: num(fd.get("height_cm")),
      width_cm: num(fd.get("width_cm")),
      length_cm: num(fd.get("length_cm")),
      status: fd.get("status"),
      is_featured: fd.get("is_featured") === "on",
      is_new: fd.get("is_new") === "on",
      tags: (str(fd.get("tags")) ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      seo_title: str(fd.get("seo_title")),
      seo_description: str(fd.get("seo_description")),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const supabase = await createClient();
    let productId = id;
    if (id) {
      const { error } = await supabase.from("products").update(parsed.data).eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("products").insert(parsed.data).select("id").single();
      if (error) throw error;
      productId = data.id;
    }

    // Estoque do produto simples
    const stock = num(fd.get("stock"));
    if (stock !== null && Number.isInteger(stock) && stock >= 0) {
      await supabase.from("inventory").update({ quantity: stock }).eq("product_id", productId!).is("variant_id", null);
    }
    const threshold = num(fd.get("low_stock_threshold"));
    if (threshold !== null && Number.isInteger(threshold) && threshold >= 0) {
      await supabase.from("inventory").update({ low_stock_threshold: threshold }).eq("product_id", productId!);
    }

    revalidateStore();
    revalidatePath("/admin/produtos");
    return { ok: true, id: productId!, message: "Produto salvo!" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
    if ((count ?? 0) > 0) {
      // Preserva histórico de pedidos: arquiva em vez de excluir
      await supabase.from("products").update({ status: "archived" }).eq("id", id);
      revalidateStore();
      return { ok: true, message: "Produto com vendas foi arquivado (não excluído) para preservar o histórico." };
    }
    const { data: imgs } = await supabase.from("product_images").select("storage_path").eq("product_id", id);
    const paths = (imgs ?? []).map((i) => i.storage_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("products").remove(paths);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    revalidateStore();
    revalidatePath("/admin/produtos");
    return { ok: true, message: "Produto excluído." };
  } catch (e) {
    return fail(e);
  }
}

export async function setProductStatus(id: string, status: "draft" | "active" | "archived"): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("products").update({ status }).eq("id", id);
    if (error) throw error;
    revalidateStore();
    revalidatePath("/admin/produtos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addProductImage(productId: string, url: string, storagePath: string, alt: string | null): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
    const { error } = await supabase.from("product_images").insert({ product_id: productId, url, storage_path: storagePath, alt, position: count ?? 0 });
    if (error) throw error;
    revalidateStore();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeProductImage(imageId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data } = await supabase.from("product_images").select("storage_path").eq("id", imageId).single();
    if (data?.storage_path) await supabase.storage.from("products").remove([data.storage_path]);
    await supabase.from("product_images").delete().eq("id", imageId);
    revalidateStore();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderProductImages(ids: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    await Promise.all(ids.map((id, position) => supabase.from("product_images").update({ position }).eq("id", id)));
    revalidateStore();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const variantSchema = z.object({
  id: z.uuid().nullable(),
  product_id: z.uuid(),
  name: z.string().min(1, "Nome da variação obrigatório").max(80),
  sku: z.string().min(1, "SKU da variação obrigatório").max(64),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  price: z.number().positive().nullable(),
  promo_price: z.number().positive().nullable(),
  is_active: z.boolean(),
  stock: z.number().int().min(0),
});

export async function saveVariant(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = variantSchema.safeParse({
      id: str(fd.get("id")),
      product_id: str(fd.get("product_id")),
      name: str(fd.get("name")),
      sku: (str(fd.get("sku")) ?? "").toUpperCase(),
      color_hex: str(fd.get("color_hex")),
      price: money(fd.get("price")),
      promo_price: money(fd.get("promo_price")),
      is_active: fd.get("is_active") === "on",
      stock: num(fd.get("stock")) ?? 0,
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, stock, ...row } = parsed.data;
    const supabase = await createClient();
    let variantId = id;
    if (id) {
      const { error } = await supabase.from("product_variants").update(row).eq("id", id);
      if (error) throw error;
    } else {
      const { count } = await supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", row.product_id);
      const { data, error } = await supabase.from("product_variants").insert({ ...row, position: count ?? 0 }).select("id").single();
      if (error) throw error;
      variantId = data.id;
    }
    await supabase.from("inventory").update({ quantity: stock }).eq("variant_id", variantId!);
    revalidateStore();
    return { ok: true, message: "Variação salva!" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteVariant(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) throw error;
    revalidateStore();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStock(inventoryId: string, quantity: number, threshold?: number): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!Number.isInteger(quantity) || quantity < 0) return { error: "Quantidade inválida." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("inventory")
      .update({ quantity, ...(threshold != null ? { low_stock_threshold: threshold } : {}) })
      .eq("id", inventoryId);
    if (error) throw error;
    revalidatePath("/admin/estoque");
    revalidateStore();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// -----------------------------------------------------------------------------
// Categorias
// -----------------------------------------------------------------------------
export async function saveCategory(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const name = str(fd.get("name")) ?? "";
    const parsed = z
      .object({
        id: z.uuid().nullable(),
        name: z.string().min(2, "Nome obrigatório").max(80),
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug inválido"),
        parent_id: z.uuid().nullable(),
        description: z.string().max(500).nullable(),
        image_url: z.url().nullable(),
        position: z.number().int(),
        is_active: z.boolean(),
        show_in_menu: z.boolean(),
      })
      .safeParse({
        id: str(fd.get("id")),
        name,
        slug: slugify(str(fd.get("slug")) ?? name),
        parent_id: str(fd.get("parent_id")),
        description: str(fd.get("description")),
        image_url: str(fd.get("image_url")),
        position: num(fd.get("position")) ?? 0,
        is_active: fd.get("is_active") === "on",
        show_in_menu: fd.get("show_in_menu") === "on",
      });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, ...row } = parsed.data;
    if (id && row.parent_id === id) return { error: "Uma categoria não pode ser mãe de si mesma." };
    const supabase = await createClient();
    const { error } = id ? await supabase.from("categories").update(row).eq("id", id) : await supabase.from("categories").insert(row);
    if (error) throw error;
    revalidateStore();
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Categoria salva!" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
    revalidateStore();
    revalidatePath("/admin/categorias");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// -----------------------------------------------------------------------------
// Pedidos — somente status operacional (o banco bloqueia o restante)
// -----------------------------------------------------------------------------
export async function setOrderStatus(orderId: string, status: "paid" | "preparing" | "ready_to_ship" | "delivered"): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) throw error;
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/pedidos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveOrderNotes(orderId: string, notes: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("orders").update({ admin_notes: notes.slice(0, 5000) || null }).eq("id", orderId);
    if (error) throw error;
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, message: "Notas salvas." };
  } catch (e) {
    return fail(e);
  }
}

// -----------------------------------------------------------------------------
// Cupons
// -----------------------------------------------------------------------------
export async function saveCoupon(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const dt = (v: FormDataEntryValue | null) => (str(v) ? new Date(String(v)).toISOString() : null);
    const parsed = z
      .object({
        id: z.uuid().nullable(),
        code: z.string().regex(/^[A-Z0-9_-]{3,32}$/, "Código: 3-32 caracteres, letras, números, _ ou -"),
        description: z.string().max(200).nullable(),
        type: z.enum(["percentage", "fixed"]),
        value: z.number().positive("Valor deve ser maior que zero"),
        min_order_value: z.number().min(0),
        max_uses: z.number().int().positive().nullable(),
        max_uses_per_user: z.number().int().positive().nullable(),
        starts_at: z.string().nullable(),
        expires_at: z.string().nullable(),
        is_active: z.boolean(),
      })
      .refine((d) => d.type !== "percentage" || d.value <= 100, { message: "Percentual máximo é 100%" })
      .safeParse({
        id: str(fd.get("id")),
        code: (str(fd.get("code")) ?? "").toUpperCase(),
        description: str(fd.get("description")),
        type: fd.get("type"),
        value: money(fd.get("value")),
        min_order_value: money(fd.get("min_order_value")) ?? 0,
        max_uses: num(fd.get("max_uses")),
        max_uses_per_user: num(fd.get("max_uses_per_user")),
        starts_at: dt(fd.get("starts_at")),
        expires_at: dt(fd.get("expires_at")),
        is_active: fd.get("is_active") === "on",
      });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, ...row } = parsed.data;
    const supabase = await createClient();
    const { error } = id ? await supabase.from("coupons").update(row).eq("id", id) : await supabase.from("coupons").insert(row);
    if (error) throw error;
    revalidatePath("/admin/cupons");
    return { ok: true, message: "Cupom salvo!" };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleCoupon(id: string, active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    await supabase.from("coupons").update({ is_active: active }).eq("id", id);
    revalidatePath("/admin/cupons");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { count } = await supabase.from("coupon_usages").select("id", { count: "exact", head: true }).eq("coupon_id", id);
    if ((count ?? 0) > 0) {
      await supabase.from("coupons").update({ is_active: false }).eq("id", id);
      revalidatePath("/admin/cupons");
      return { ok: true, message: "Cupom já utilizado: foi desativado em vez de excluído." };
    }
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/cupons");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// -----------------------------------------------------------------------------
// Banners
// -----------------------------------------------------------------------------
export async function saveBanner(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const dt = (v: FormDataEntryValue | null) => (str(v) ? new Date(String(v)).toISOString() : null);
    const parsed = z
      .object({
        id: z.uuid().nullable(),
        title: z.string().min(1, "Título obrigatório").max(120),
        subtitle: z.string().max(240).nullable(),
        eyebrow: z.string().max(60).nullable(),
        cta_label: z.string().max(40).nullable(),
        link_url: z.string().max(500).refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Link deve começar com / ou http").nullable(),
        image_url: z.url().nullable(),
        image_path: z.string().nullable(),
        mobile_image_url: z.url().nullable(),
        mobile_image_path: z.string().nullable(),
        theme: z.enum(["dark", "light"]),
        position: z.number().int(),
        is_active: z.boolean(),
        starts_at: z.string().nullable(),
        ends_at: z.string().nullable(),
      })
      .safeParse({
        id: str(fd.get("id")),
        title: str(fd.get("title")),
        subtitle: str(fd.get("subtitle")),
        eyebrow: str(fd.get("eyebrow")),
        cta_label: str(fd.get("cta_label")),
        link_url: str(fd.get("link_url")),
        image_url: str(fd.get("image_url")),
        image_path: str(fd.get("image_path")),
        mobile_image_url: str(fd.get("mobile_image_url")),
        mobile_image_path: str(fd.get("mobile_image_path")),
        theme: fd.get("theme") ?? "dark",
        position: num(fd.get("position")) ?? 0,
        is_active: fd.get("is_active") === "on",
        starts_at: dt(fd.get("starts_at")),
        ends_at: dt(fd.get("ends_at")),
      });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { id, ...row } = parsed.data;
    const supabase = await createClient();
    const { error } = id ? await supabase.from("banners").update(row).eq("id", id) : await supabase.from("banners").insert(row);
    if (error) throw error;
    revalidateStore();
    revalidatePath("/admin/banners");
    return { ok: true, message: "Banner salvo!" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBanner(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const supabase = await createClient();
    const { data } = await supabase.from("banners").select("image_path, mobile_image_path").eq("id", id).single();
    const paths = [data?.image_path, data?.mobile_image_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("banners").remove(paths);
    await supabase.from("banners").delete().eq("id", id);
    revalidateStore();
    revalidatePath("/admin/banners");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// -----------------------------------------------------------------------------
// Configurações
// -----------------------------------------------------------------------------
export async function saveSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await assertAdmin();
    const optUrl = z.url("URL inválida").nullable();
    const parseJson = <T,>(v: FormDataEntryValue | null, fallback: T): T => {
      try {
        return v ? (JSON.parse(String(v)) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    const parsed = z
      .object({
        store_name: z.string().min(2).max(80),
        tagline: z.string().max(200).nullable(),
        logo_url: optUrl,
        whatsapp: z.string().nullable(),
        email: z.email("E-mail inválido").nullable(),
        phone: z.string().nullable(),
        instagram_url: optUrl,
        facebook_url: optUrl,
        tiktok_url: optUrl,
        company_name: z.string().max(160).nullable(),
        cnpj: z.string().max(20).nullable(),
        origin_name: z.string().max(160).nullable(),
        origin_postal_code: z.string().regex(/^\d{8}$/, "CEP de origem inválido").nullable(),
        origin_street: z.string().max(200).nullable(),
        origin_number: z.string().max(20).nullable(),
        origin_complement: z.string().max(120).nullable(),
        origin_district: z.string().max(120).nullable(),
        origin_city: z.string().max(120).nullable(),
        origin_state: z.string().regex(/^[A-Z]{2}$/, "UF inválida").nullable(),
        origin_document: z.string().nullable(),
        max_installments: z.number().int().min(1).max(12),
        min_installment_value: z.number().min(1),
        free_shipping_min: z.number().positive().nullable(),
        announcement: z.string().max(500).nullable(),
        testimonials: z.array(z.object({ name: z.string().min(1), text: z.string().min(1), city: z.string().optional(), rating: z.number().min(1).max(5).optional() })).max(12),
        instagram_posts: z.array(z.object({ image_url: z.url(), link_url: z.string(), caption: z.string().optional() })).max(12),
      })
      .safeParse({
        store_name: str(fd.get("store_name")),
        tagline: str(fd.get("tagline")),
        logo_url: str(fd.get("logo_url")),
        whatsapp: onlyDigits(str(fd.get("whatsapp"))) || null,
        email: str(fd.get("email")),
        phone: onlyDigits(str(fd.get("phone"))) || null,
        instagram_url: str(fd.get("instagram_url")),
        facebook_url: str(fd.get("facebook_url")),
        tiktok_url: str(fd.get("tiktok_url")),
        company_name: str(fd.get("company_name")),
        cnpj: str(fd.get("cnpj")),
        origin_name: str(fd.get("origin_name")),
        origin_postal_code: onlyDigits(str(fd.get("origin_postal_code"))) || null,
        origin_street: str(fd.get("origin_street")),
        origin_number: str(fd.get("origin_number")),
        origin_complement: str(fd.get("origin_complement")),
        origin_district: str(fd.get("origin_district")),
        origin_city: str(fd.get("origin_city")),
        origin_state: str(fd.get("origin_state"))?.toUpperCase() ?? null,
        origin_document: onlyDigits(str(fd.get("origin_document"))) || null,
        max_installments: num(fd.get("max_installments")) ?? 6,
        min_installment_value: money(fd.get("min_installment_value")) ?? 20,
        free_shipping_min: money(fd.get("free_shipping_min")),
        announcement: str(fd.get("announcement")),
        testimonials: parseJson(fd.get("testimonials"), []),
        instagram_posts: parseJson(fd.get("instagram_posts"), []),
      });
    if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
    const supabase = await createClient();
    const { error } = await supabase.from("store_settings").update(parsed.data).eq("id", 1);
    if (error) throw error;
    revalidateStore();
    return { ok: true, message: "Configurações salvas!" };
  } catch (e) {
    return fail(e);
  }
}
