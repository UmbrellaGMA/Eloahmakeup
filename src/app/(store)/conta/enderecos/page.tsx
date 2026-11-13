import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";
import { AddressManager } from "../AccountForms";

export const metadata: Metadata = { title: "Endereços", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/conta/enderecos");
  const supabase = await createClient();
  const { data } = await supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at");
  return (
    <div>
      <h1 className="heading-display mb-8 text-4xl">Endereços</h1>
      <AddressManager addresses={(data ?? []) as Address[]} />
    </div>
  );
}
