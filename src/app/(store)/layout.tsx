import { StoreProvider } from "@/components/providers/StoreProvider";
import { Header } from "@/components/store/Header";
import { buildNav } from "@/lib/nav";
import { CartDrawer } from "@/components/store/CartDrawer";
import { Footer } from "@/components/store/Footer";
import { WhatsAppIcon } from "@/components/ui/SocialIcons";
import { getCategories, getStoreSettings } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [settings, categories] = await Promise.all([getStoreSettings(), getCategories()]);

  const announcement = settings.announcement
    ? settings.announcement.split("|").map((s) => s.trim()).filter(Boolean)
    : [
        "Enviamos para todo o Brasil",
        `Parcele em até ${settings.max_installments}x no cartão`,
        "Pague com Pix",
        ...(settings.free_shipping_min ? [`Frete grátis acima de ${formatPrice(settings.free_shipping_min)}`] : []),
      ];

  return (
    <StoreProvider installments={{ max: settings.max_installments, min: Number(settings.min_installment_value) }}>
      <Header nav={buildNav(categories)} announcement={announcement} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer settings={settings} categories={categories} />
      <CartDrawer />
      {settings.whatsapp && (
        <a
          href={`https://wa.me/55${settings.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fale conosco pelo WhatsApp"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-lift transition hover:scale-105 hover:bg-lilac-700"
        >
          <WhatsAppIcon className="h-6 w-6" />
        </a>
      )}
    </StoreProvider>
  );
}
