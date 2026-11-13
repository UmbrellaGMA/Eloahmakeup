import { NextRequest } from "next/server";
import { assertUser } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { payWithCard } from "@/lib/payments";
import { cardPaymentSchema, firstIssue } from "@/lib/validation";
import { getStoreSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/**
 * Recebe o token do cartão gerado pelo Card Payment Brick (os dados do
 * cartão nunca passam pelo nosso servidor) e cria o pagamento no Mercado Pago.
 * O valor cobrado é sempre o total do pedido no banco.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await assertUser();
    const parsed = cardPaymentSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError(firstIssue(parsed.error), 400, "INVALID");
    const settings = await getStoreSettings();
    const { order_id, ...form } = parsed.data;
    const result = await payWithCard(order_id, user.id, form, settings.max_installments);
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
