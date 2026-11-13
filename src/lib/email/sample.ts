import "server-only";
import type { Order, OrderItem } from "@/lib/types";

/** Pedido fictício usado apenas na prévia dos modelos de e-mail do painel. */
export function sampleOrder(): { order: Order; items: OrderItem[] } {
  const now = new Date().toISOString();
  const order: Order = {
    id: "00000000-0000-4000-8000-000000000000",
    order_number: 1024,
    user_id: "00000000-0000-4000-8000-000000000001",
    status: "paid",
    payment_status: "approved",
    customer_name: "Maria Exemplo",
    customer_email: "cliente@exemplo.com",
    customer_phone: "11999990000",
    customer_cpf: null,
    shipping_address: {
      recipient_name: "Maria Exemplo",
      postal_code: "01001000",
      street: "Praça da Sé",
      number: "100",
      complement: "Apto 12",
      district: "Sé",
      city: "São Paulo",
      state: "SP",
      phone: null,
    },
    subtotal: 139.8,
    discount_total: 13.98,
    shipping_total: 21.16,
    total: 146.98,
    coupon_code: "BEMVINDA10",
    shipping_service_id: 1,
    shipping_service_name: "PAC",
    shipping_carrier: "Correios",
    shipping_days: 5,
    shipping_package: null,
    payment_method: "pix",
    notes: null,
    admin_notes: null,
    paid_at: now,
    shipped_at: null,
    delivered_at: null,
    cancelled_at: null,
    created_at: now,
    updated_at: now,
  };
  const items: OrderItem[] = [
    { id: "i1", order_id: order.id, product_id: null, variant_id: null, product_name: "Batom Matte Veludo", variant_name: "Nude Rosé", sku: "EX-1", image_url: null, unit_price: 39.9, quantity: 1, total: 39.9 },
    { id: "i2", order_id: order.id, product_id: null, variant_id: null, product_name: "Paleta de Sombras Ametista — 12 cores", variant_name: null, sku: "EX-2", image_url: null, unit_price: 99.9, quantity: 1, total: 99.9 },
  ];
  return { order, items };
}
