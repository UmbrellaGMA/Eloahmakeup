import { NextRequest } from "next/server";
import { z } from "zod";
import { addToCart, getCurrentCart, removeCartItem, updateCartItem } from "@/lib/cart";
import { AppError, errorResponse } from "@/lib/errors";
import { addToCartSchema, firstIssue } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getCurrentCart());
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = addToCartSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError(firstIssue(parsed.error), 400, "INVALID");
    const { view, limited } = await addToCart(parsed.data.product_id, parsed.data.variant_id ?? null, parsed.data.quantity);
    return Response.json({ ...view, notice: limited ? "Quantidade ajustada ao estoque disponível." : null });
  } catch (e) {
    return errorResponse(e);
  }
}

const patchSchema = z.object({ item_id: z.uuid(), quantity: z.number().int().min(0).max(99) });

export async function PATCH(req: NextRequest) {
  try {
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError(firstIssue(parsed.error), 400, "INVALID");
    return Response.json(await updateCartItem(parsed.data.item_id, parsed.data.quantity));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("item_id") ?? "";
    if (!z.uuid().safeParse(id).success) throw new AppError("Item inválido.", 400, "INVALID");
    return Response.json(await removeCartItem(id));
  } catch (e) {
    return errorResponse(e);
  }
}
