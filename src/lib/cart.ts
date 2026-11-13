import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { AppError, fromDbError } from "@/lib/errors";
import { effectivePrice } from "@/lib/format";
import { integrations } from "@/lib/server-env";
import type { CartLine, CartView } from "@/lib/types";

export const CART_COOKIE = "eloah_cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 dias

type Admin = ReturnType<typeof createAdminClient>;

function admin(): Admin {
  if (!integrations.supabaseAdmin) {
    throw new AppError("A loja ainda está em configuração. Tente novamente em breve.", 503, "NOT_CONFIGURED");
  }
  return createAdminClient();
}

async function findGuestCart(db: Admin, token: string | undefined) {
  if (!token || token.length < 32) return null;
  const { data } = await db.from("carts").select("id").eq("guest_token", token).is("user_id", null).maybeSingle();
  return data?.id as string | undefined;
}

/**
 * Une o carrinho de visitante ao carrinho da conta (após login/cadastro).
 * Quantidades são somadas respeitando o limite de 99 por item.
 */
export async function mergeGuestCart(userId: string) {
  if (!integrations.supabaseAdmin) return;
  const db = createAdminClient();
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  const guestCartId = await findGuestCart(db, token);
  if (!guestCartId) return;

  let { data: userCart } = await db.from("carts").select("id, coupon_code").eq("user_id", userId).maybeSingle();
  if (!userCart) {
    const ins = await db.from("carts").insert({ user_id: userId }).select("id, coupon_code").single();
    userCart = ins.data;
  }
  if (!userCart) return;

  const [{ data: guestItems }, { data: userItems }, { data: guestCart }] = await Promise.all([
    db.from("cart_items").select("product_id, variant_id, quantity").eq("cart_id", guestCartId),
    db.from("cart_items").select("id, product_id, variant_id, quantity").eq("cart_id", userCart.id),
    db.from("carts").select("coupon_code").eq("id", guestCartId).maybeSingle(),
  ]);

  for (const gi of guestItems ?? []) {
    const existing = (userItems ?? []).find((u) => u.product_id === gi.product_id && u.variant_id === gi.variant_id);
    if (existing) {
      await db.from("cart_items").update({ quantity: Math.min(99, existing.quantity + gi.quantity) }).eq("id", existing.id);
    } else {
      await db.from("cart_items").insert({ cart_id: userCart.id, product_id: gi.product_id, variant_id: gi.variant_id, quantity: gi.quantity });
    }
  }
  if (!userCart.coupon_code && guestCart?.coupon_code) {
    await db.from("carts").update({ coupon_code: guestCart.coupon_code }).eq("id", userCart.id);
  }
  await db.from("carts").delete().eq("id", guestCartId);
  jar.delete(CART_COOKIE);
}

/** Localiza (e opcionalmente cria) o carrinho da sessão atual. */
export async function resolveCart(create: boolean): Promise<{ cartId: string | null; userId: string | null }> {
  const db = admin();
  const user = await getUser();
  const jar = await cookies();

  if (user) {
    if (jar.get(CART_COOKIE)?.value) await mergeGuestCart(user.id);
    const { data } = await db.from("carts").select("id").eq("user_id", user.id).maybeSingle();
    if (data) return { cartId: data.id, userId: user.id };
    if (!create) return { cartId: null, userId: user.id };
    const { data: created, error } = await db.from("carts").insert({ user_id: user.id }).select("id").single();
    if (error) {
      // corrida: outro request criou o carrinho
      const again = await db.from("carts").select("id").eq("user_id", user.id).single();
      return { cartId: again.data?.id ?? null, userId: user.id };
    }
    return { cartId: created.id, userId: user.id };
  }

  const token = jar.get(CART_COOKIE)?.value;
  const existing = await findGuestCart(db, token);
  if (existing) return { cartId: existing, userId: null };
  if (!create) return { cartId: null, userId: null };

  const newToken = randomBytes(32).toString("hex");
  const { data, error } = await db.from("carts").insert({ guest_token: newToken }).select("id").single();
  if (error) throw fromDbError(error);
  jar.set(CART_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return { cartId: data.id, userId: null };
}

type RawItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  product: {
    name: string;
    slug: string;
    price: number;
    promo_price: number | null;
    status: string;
    has_variants: boolean;
    images: { url: string; position: number }[];
    inventory: { variant_id: string | null; quantity: number }[];
  } | null;
  variant: { name: string; price: number | null; promo_price: number | null; is_active: boolean; image_url: string | null } | null;
};

export async function buildCartView(cartId: string | null, userId: string | null): Promise<CartView> {
  const empty: CartView = {
    id: cartId,
    items: [],
    count: 0,
    subtotal: 0,
    coupon: null,
    coupon_error: null,
    discount: 0,
    total_before_shipping: 0,
    free_shipping_min: null,
    has_issues: false,
  };
  const db = admin();
  const { data: settings } = await db.from("store_settings").select("free_shipping_min").eq("id", 1).maybeSingle();
  empty.free_shipping_min = settings?.free_shipping_min != null ? Number(settings.free_shipping_min) : null;
  if (!cartId) return empty;

  const [{ data: cart }, { data: rows, error }] = await Promise.all([
    db.from("carts").select("coupon_code").eq("id", cartId).maybeSingle(),
    db
      .from("cart_items")
      .select(
        "id, product_id, variant_id, quantity, product:products(name, slug, price, promo_price, status, has_variants, images:product_images(url, position), inventory(variant_id, quantity)), variant:product_variants(name, price, promo_price, is_active, image_url)",
      )
      .eq("cart_id", cartId)
      .order("created_at"),
  ]);
  if (error) throw fromDbError(error);

  const items: CartLine[] = ((rows ?? []) as unknown as RawItem[]).map((r) => {
    const p = r.product;
    const v = r.variant;
    const prices = p ? effectivePrice(p, v) : { regular: 0, final: 0 };
    const stock = p?.inventory?.find((i) => i.variant_id === r.variant_id)?.quantity ?? 0;
    let issue: string | null = null;
    if (!p || p.status !== "active") issue = "Produto indisponível";
    else if (r.variant_id && !v?.is_active) issue = "Variação indisponível";
    else if (p.has_variants && !r.variant_id) issue = "Selecione uma variação";
    else if (stock <= 0) issue = "Sem estoque";
    else if (stock < r.quantity) issue = `Apenas ${stock} em estoque`;
    const image = v?.image_url ?? [...(p?.images ?? [])].sort((a, b) => a.position - b.position)[0]?.url ?? null;
    return {
      id: r.id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      name: p?.name ?? "Produto removido",
      slug: p?.slug ?? "",
      variant_name: v?.name ?? null,
      image,
      unit_price: prices.final,
      regular_price: prices.regular,
      quantity: r.quantity,
      line_total: Math.round(prices.final * r.quantity * 100) / 100,
      available: stock,
      issue,
    };
  });

  const subtotal = Math.round(items.reduce((s, i) => s + i.line_total, 0) * 100) / 100;
  let coupon: CartView["coupon"] = null;
  let couponError: string | null = null;
  if (cart?.coupon_code && subtotal > 0) {
    const { data, error: cErr } = await db.rpc("evaluate_coupon", { p_code: cart.coupon_code, p_user_id: userId, p_subtotal: subtotal });
    if (cErr) couponError = fromDbError(cErr).message;
    else if (data?.[0]) coupon = { code: data[0].code, discount: Number(data[0].discount) };
  }
  const discount = coupon?.discount ?? 0;
  return {
    ...empty,
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    subtotal,
    coupon,
    coupon_error: couponError,
    discount,
    total_before_shipping: Math.max(0, Math.round((subtotal - discount) * 100) / 100),
    has_issues: items.some((i) => i.issue),
  };
}

export async function getCurrentCart() {
  const { cartId, userId } = await resolveCart(false);
  return buildCartView(cartId, userId);
}

async function stockFor(db: Admin, productId: string, variantId: string | null) {
  let q = db.from("inventory").select("quantity").eq("product_id", productId);
  q = variantId ? q.eq("variant_id", variantId) : q.is("variant_id", null);
  const { data } = await q.maybeSingle();
  return data?.quantity ?? 0;
}

export async function addToCart(productId: string, variantId: string | null, quantity: number) {
  const db = admin();
  const { data: product } = await db
    .from("products")
    .select("id, name, status, has_variants")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.status !== "active") throw new AppError("Produto indisponível.", 404, "NOT_FOUND");
  if (product.has_variants && !variantId) throw new AppError("Selecione uma opção antes de adicionar.", 400, "VARIANT_REQUIRED");
  if (variantId) {
    const { data: variant } = await db
      .from("product_variants")
      .select("id, is_active")
      .eq("id", variantId)
      .eq("product_id", productId)
      .maybeSingle();
    if (!variant?.is_active) throw new AppError("Opção indisponível.", 404, "NOT_FOUND");
  }
  const vId = product.has_variants ? variantId : null;
  const stock = await stockFor(db, productId, vId);
  if (stock <= 0) throw new AppError("Produto sem estoque no momento.", 409, "OUT_OF_STOCK");

  const { cartId, userId } = await resolveCart(true);
  let existingQ = db.from("cart_items").select("id, quantity").eq("cart_id", cartId!).eq("product_id", productId);
  existingQ = vId ? existingQ.eq("variant_id", vId) : existingQ.is("variant_id", null);
  const { data: existing } = await existingQ.maybeSingle();

  const desired = (existing?.quantity ?? 0) + quantity;
  const finalQty = Math.min(desired, stock, 99);
  if (existing) {
    await db.from("cart_items").update({ quantity: finalQty }).eq("id", existing.id);
  } else {
    const { error } = await db.from("cart_items").insert({ cart_id: cartId, product_id: productId, variant_id: vId, quantity: finalQty });
    if (error) throw fromDbError(error);
  }
  const view = await buildCartView(cartId, userId);
  return { view, limited: finalQty < desired };
}

async function ownedItem(db: Admin, itemId: string) {
  const { cartId, userId } = await resolveCart(false);
  if (!cartId) throw new AppError("Carrinho não encontrado.", 404, "NOT_FOUND");
  const { data } = await db.from("cart_items").select("id, product_id, variant_id").eq("id", itemId).eq("cart_id", cartId).maybeSingle();
  if (!data) throw new AppError("Item não encontrado.", 404, "NOT_FOUND");
  return { item: data, cartId, userId };
}

export async function updateCartItem(itemId: string, quantity: number) {
  const db = admin();
  const { item, cartId, userId } = await ownedItem(db, itemId);
  if (quantity <= 0) {
    await db.from("cart_items").delete().eq("id", item.id);
  } else {
    const stock = await stockFor(db, item.product_id, item.variant_id);
    await db.from("cart_items").update({ quantity: Math.max(1, Math.min(quantity, stock || 1, 99)) }).eq("id", item.id);
  }
  return buildCartView(cartId, userId);
}

export async function removeCartItem(itemId: string) {
  const db = admin();
  const { item, cartId, userId } = await ownedItem(db, itemId);
  await db.from("cart_items").delete().eq("id", item.id);
  return buildCartView(cartId, userId);
}

export async function applyCoupon(code: string | null) {
  const db = admin();
  const { cartId, userId } = await resolveCart(true);
  if (!code) {
    await db.from("carts").update({ coupon_code: null }).eq("id", cartId!);
    return buildCartView(cartId, userId);
  }
  const normalized = code.trim().toUpperCase();
  const view = await buildCartView(cartId, userId);
  if (view.subtotal <= 0) throw new AppError("Adicione produtos antes de aplicar um cupom.", 400, "CART_EMPTY");
  const { error } = await db.rpc("evaluate_coupon", { p_code: normalized, p_user_id: userId, p_subtotal: view.subtotal });
  if (error) throw fromDbError(error, "Cupom inválido.");
  await db.from("carts").update({ coupon_code: normalized }).eq("id", cartId!);
  return buildCartView(cartId, userId);
}
