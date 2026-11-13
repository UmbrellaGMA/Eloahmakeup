import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderList } from "@/components/store/OrderList";

export const metadata: Metadata = { title: "Meus pedidos", robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireUser("/conta/pedidos");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, created_at, total, status, payment_status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (
    <div>
      <h1 className="heading-display mb-8 text-4xl">Meus pedidos</h1>
      <OrderList orders={data ?? []} />
    </div>
  );
}
