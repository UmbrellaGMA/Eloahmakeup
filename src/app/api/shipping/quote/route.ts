import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentCart } from "@/lib/cart";
import { AppError, errorResponse } from "@/lib/errors";
import { quoteForItems, getOriginPostalCode } from "@/lib/shipping";
import { cepSchema, firstIssue } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  postal_code: cepSchema,
  // Cotação na página do produto (sem carrinho)
  product_id: z.uuid().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
});

/** Cotação de frete via SuperFrete (servidor). */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError(firstIssue(parsed.error), 400, "INVALID");
    const { postal_code, product_id, quantity } = parsed.data;

    let items: { product_id: string; quantity: number; unit_price?: number }[];
    let subtotalAfterDiscount: number | null = null;
    if (product_id) {
      items = [{ product_id, quantity: quantity ?? 1 }];
    } else {
      const cart = await getCurrentCart();
      if (!cart.items.length) throw new AppError("Seu carrinho está vazio.", 400, "CART_EMPTY");
      items = cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price }));
      subtotalAfterDiscount = cart.total_before_shipping;
    }

    const [options, { freeShippingMin }] = await Promise.all([quoteForItems(postal_code, items), getOriginPostalCode()]);
    const free = freeShippingMin != null && subtotalAfterDiscount != null && subtotalAfterDiscount >= freeShippingMin;
    return Response.json({
      postal_code,
      free_shipping: free,
      free_shipping_min: freeShippingMin,
      options: free ? options.map((o) => ({ ...o, original_price: o.price, price: 0 })) : options,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
