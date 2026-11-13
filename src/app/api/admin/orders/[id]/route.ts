import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { cancelUnpaidOrder, reconcileOrderPayments, refundOrder } from "@/lib/payments";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["refund", "cancel_unpaid", "reconcile"]) });

/**
 * Ações financeiras do administrador. Todas passam pela API do Mercado Pago:
 * não existe forma de "aprovar" um pagamento manualmente.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/orders/[id]">) {
  try {
    const { user } = await assertAdmin();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("Pedido inválido.", 400, "INVALID");
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("Ação inválida.", 400, "INVALID");

    let result: unknown = { ok: true };
    if (parsed.data.action === "refund") result = { status: await refundOrder(id, user.id) };
    if (parsed.data.action === "cancel_unpaid") {
      const ok = await cancelUnpaidOrder(id, "Cancelado pelo administrador");
      if (!ok) throw new AppError("O pedido não pôde ser cancelado (pode ter sido pago).", 409, "NOT_CANCELLABLE");
    }
    if (parsed.data.action === "reconcile") await reconcileOrderPayments(id);

    revalidatePath(`/admin/pedidos/${id}`);
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
