import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS } from "@/lib/catalog";
import type { StoreSettings } from "@/lib/types";
import { PageHeader } from "../ui";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("store_settings").select("*").eq("id", 1).maybeSingle();
  return (
    <>
      <PageHeader title="Configurações" description="Dados da loja, contato, redes sociais e origem dos envios." />
      <SettingsForm settings={{ ...DEFAULT_SETTINGS, ...(data ?? {}) } as StoreSettings} />
    </>
  );
}
