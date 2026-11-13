import { NextRequest } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { reconcileOrderPayments } from "@/lib/payments";
import { isMercadoPagoConfigured } from "@/lib/integrations/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Status do pedido para a tela de pagamento (polling).
 * Se ainda pendente, consulta a API do Mercado Pago (reconciliação) — o
 * status nunca é aceito a partir do navegador.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/status">) {
  try {
    const user = await assertUser();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("Pedido inválido.", 400, "INVALID");
    const supabase = await createClient();

    const read = () =>
      supabase.from("orders").select("id, status, payment_status, updated_at").eq("id", id).eq("user_id", user.id).maybeSingle();

    let { data: order } = await read();
    if (!order) throw new AppError("Pedido não encontrado.", 404, "NOT_FOUND");

    const reconcile = req.nextUrl.searchParams.get("reconcile") === "1";
    if (reconcile && order.payment_status !== "approved" && order.status === "awaiting_payment" && isMercadoPagoConfigured()) {
      await reconcileOrderPayments(id);
      ({ data: order } = await read());
    }
    return Response.json({ status: order!.status, payment_status: order!.payment_status });
  } catch (e) {
    return errorResponse(e);
  }
}
