import { NextRequest } from "next/server";
import { assertUser } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { placeOrder } from "@/lib/orders";
import { checkoutSchema, firstIssue } from "@/lib/validation";
import { isMercadoPagoConfigured } from "@/lib/integrations/mercadopago";

export const dynamic = "force-dynamic";

/** Cria o pedido a partir do carrinho do usuário autenticado. */
export async function POST(req: NextRequest) {
  try {
    const user = await assertUser();
    if (!isMercadoPagoConfigured()) {
      throw new AppError(
        "Pagamentos ainda não estão habilitados nesta loja. Volte em breve!",
        503,
        "MERCADOPAGO_NOT_CONFIGURED",
      );
    }
    const parsed = checkoutSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError(firstIssue(parsed.error), 400, "INVALID");
    const d = parsed.data;
    const order = await placeOrder({
      userId: user.id,
      email: user.email!,
      customer: d.customer,
      address: {
        recipient_name: d.address.recipient_name,
        postal_code: d.address.postal_code,
        street: d.address.street,
        number: d.address.number,
        complement: d.address.complement ?? null,
        district: d.address.district,
        city: d.address.city,
        state: d.address.state,
        phone: d.address.phone || d.customer.phone,
      },
      shippingServiceId: d.shipping_service_id,
      paymentMethod: d.payment_method,
      notes: d.notes,
      saveAddress: d.save_address,
    });
    return Response.json({ order_id: order.id, order_number: order.order_number });
  } catch (e) {
    return errorResponse(e);
  }
}
