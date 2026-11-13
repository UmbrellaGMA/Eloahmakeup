import { createClient } from "@/lib/supabase/server";
import type { Coupon } from "@/lib/types";
import { PageHeader } from "../ui";
import { CouponManager } from "./CouponManager";

export const metadata = { title: "Cupons" };

export default async function CouponsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Cupons" description="Descontos percentuais ou fixos, com validade, limite de uso e valor mínimo." />
      <CouponManager coupons={(data ?? []) as Coupon[]} now={new Date().getTime()} />
    </>
  );
}
