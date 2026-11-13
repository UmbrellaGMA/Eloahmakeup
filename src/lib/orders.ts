import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, fromDbError } from "@/lib/errors";
import { buildCartView, resolveCart } from "@/lib/cart";
import { quoteForItems } from "@/lib/shipping";
import { logIntegration } from "@/lib/logger";
import { notifyOrder } from "@/lib/notifications";
import type { ShippingAddressSnapshot } from "@/lib/types";

export interface PlaceOrderInput {
  userId: string;
  email: string;
  customer: { name: string; cpf: string; phone: string };
  address: ShippingAddressSnapshot;
  shippingServiceId: number;
  paymentMethod: "pix" | "credit_card";
  notes?: string | null;
  saveAddress?: boolean;
}

/**
 * Cria o pedido:
 *  1. Valida o carrinho do usuário (preços/estoque do banco)
 *  2. Recota o frete na SuperFrete pelo servidor (o valor do navegador é ignorado)
 *  3. Chama place_order (transação atômica no Postgres)
 */
export async function placeOrder(input: PlaceOrderInput) {
  const db = createAdminClient();
  const { cartId } = await resolveCart(false);
  if (!cartId) throw new AppError("Seu carrinho está vazio.", 400, "CART_EMPTY");
  const cart = await buildCartView(cartId, input.userId);
  if (!cart.items.length) throw new AppError("Seu carrinho está vazio.", 400, "CART_EMPTY");
  if (cart.has_issues) throw new AppError("Revise o carrinho: há itens indisponíveis ou sem estoque suficiente.", 409, "CART_ISSUES");

  const options = await quoteForItems(
    input.address.postal_code,
    cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
  );
  const selected = options.find((o) => o.service_id === input.shippingServiceId);
  if (!selected) {
    throw new AppError("A modalidade de frete escolhida não está mais disponível. Recalcule o frete.", 409, "SHIPPING_UNAVAILABLE");
  }

  const { data: cartRow } = await db.from("carts").select("coupon_code").eq("id", cartId).single();

  const { data: order, error } = await db.rpc("place_order", {
    p_user_id: input.userId,
    p_cart_id: cartId,
    p_customer: { name: input.customer.name, email: input.email, phone: input.customer.phone, cpf: input.customer.cpf },
    p_address: input.address,
    p_shipping: {
      price: selected.price,
      service_id: selected.service_id,
      service_name: selected.name,
      carrier: selected.carrier,
      delivery_days: selected.delivery_days,
      package: selected.package,
    },
    p_coupon_code: cartRow?.coupon_code ?? null,
    p_payment_method: input.paymentMethod,
    p_notes: input.notes ?? null,
  });
  if (error) throw fromDbError(error, "Não foi possível criar o pedido.");
  const created = (Array.isArray(order) ? order[0] : order) as { id: string; order_number: number; total: number };

  // Completa o perfil com os dados informados (sem sobrescrever o que já existe)
  const { data: profile } = await db.from("profiles").select("full_name, cpf, phone").eq("id", input.userId).single();
  await db
    .from("profiles")
    .update({
      full_name: profile?.full_name || input.customer.name,
      cpf: profile?.cpf || input.customer.cpf,
      phone: profile?.phone || input.customer.phone,
    })
    .eq("id", input.userId);

  if (input.saveAddress) {
    const { count } = await db.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", input.userId);
    await db.from("addresses").insert({
      user_id: input.userId,
      label: "Entrega",
      recipient_name: input.address.recipient_name,
      phone: input.address.phone || null,
      postal_code: input.address.postal_code,
      street: input.address.street,
      number: input.address.number,
      complement: input.address.complement || null,
      district: input.address.district,
      city: input.address.city,
      state: input.address.state,
      is_default: (count ?? 0) === 0,
    });
  }

  await logIntegration({ provider: "system", operation: "order_created", orderId: created.id, message: `Pedido #${created.order_number} criado` });
  await notifyOrder(created.id, "order_created");
  return created;
}
