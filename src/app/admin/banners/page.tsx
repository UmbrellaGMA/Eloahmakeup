import { createClient } from "@/lib/supabase/server";
import type { Banner } from "@/lib/types";
import { PageHeader } from "../ui";
import { BannerManager } from "./BannerManager";

export const metadata = { title: "Banners" };

export default async function BannersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("banners").select("*").order("position");
  return (
    <>
      <PageHeader title="Banners" description="Carrossel da página inicial. Sem banners ativos, a loja exibe o banner institucional." />
      <BannerManager banners={(data ?? []) as Banner[]} />
    </>
  );
}
