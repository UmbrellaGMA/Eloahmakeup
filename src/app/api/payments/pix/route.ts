import { NextRequest } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { getOrCreatePixPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Gera (ou reaproveita) o Pix do pedido. O valor vem do banco. */
export async function POST(req: NextRequest) {
  try {
    const user = await assertUser();
    const parsed = z.object({ order_id: z.uuid() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("Pedido inválido.", 400, "INVALID");
    const payment = await getOrCreatePixPayment(parsed.data.order_id, user.id);
    return Response.json({
      payment_id: payment.id,
      status: payment.status,
      qr_code: payment.pix_qr_code,
      qr_code_base64: payment.pix_qr_code_base64,
      ticket_url: payment.pix_ticket_url,
      expires_at: payment.expires_at,
      amount: payment.amount,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
