import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/catalog";
import { isMercadoPagoConfigured } from "@/lib/integrations/mercadopago";
import { isSuperFreteConfigured } from "@/lib/integrations/superfrete";
import type { Address, Profile } from "@/lib/types";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const supabase = await createClient();
  const [{ data: profile }, { data: addresses }, settings] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    getStoreSettings(),
  ]);

  return (
    <div className="bg-cream/60">
      <div className="container-page pb-20 pt-10">
        <h1 className="heading-display text-4xl sm:text-5xl">Finalizar compra</h1>
        <CheckoutClient
          email={user.email ?? ""}
          profile={(profile as Profile) ?? null}
          addresses={(addresses ?? []) as Address[]}
          maxInstallments={settings.max_installments}
          paymentsEnabled={isMercadoPagoConfigured()}
          shippingEnabled={isSuperFreteConfigured()}
        />
      </div>
    </div>
  );
}
