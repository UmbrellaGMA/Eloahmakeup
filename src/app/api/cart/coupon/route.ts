import { NextRequest } from "next/server";
import { z } from "zod";
import { applyCoupon } from "@/lib/cart";
import { AppError, errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().trim().max(32).nullable() });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("Cupom inválido.", 400, "INVALID");
    const code = parsed.data.code?.trim() || null;
    if (code && !/^[A-Za-z0-9_-]{3,32}$/.test(code)) throw new AppError("Cupom inválido.", 400, "INVALID");
    return Response.json(await applyCoupon(code));
  } catch (e) {
    return errorResponse(e);
  }
}
