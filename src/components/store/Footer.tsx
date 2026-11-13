import Link from "next/link";
import { CreditCard, Mail, Phone, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { FacebookIcon, InstagramIcon, PixIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/SocialIcons";
import type { Category, StoreSettings } from "@/lib/types";
import { formatPhone } from "@/lib/format";

export function Footer({ settings, categories }: { settings: StoreSettings; categories: Category[] }) {
  const roots = categories.filter((c) => !c.parent_id);
  const socials = [
    settings.instagram_url && { href: settings.instagram_url, label: "Instagram", Icon: InstagramIcon },
    settings.tiktok_url && { href: settings.tiktok_url, label: "TikTok", Icon: TikTokIcon },
    settings.facebook_url && { href: settings.facebook_url, label: "Facebook", Icon: FacebookIcon },
    settings.whatsapp && { href: `https://wa.me/55${settings.whatsapp.replace(/\D/g, "")}`, label: "WhatsApp", Icon: WhatsAppIcon },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof InstagramIcon }[];

  return (
    <footer className="border-t border-line bg-cream">
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink-muted">{settings.tagline ?? "Maquiagem que revela a sua melhor versão."}</p>
          {socials.length > 0 && (
            <div className="mt-6 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition hover:border-lilac-400 hover:text-lilac-700">
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Loja</h3>
          <ul className="mt-5 space-y-3 text-sm text-ink-muted">
            {roots.map((c) => (
              <li key={c.id}>
                <Link href={`/categoria/${c.slug}`} className="hover:text-ink">
                  {c.name}
                </Link>
              </li>
            ))}
            <li><Link href="/produtos?lancamentos=1" className="hover:text-ink">Lançamentos</Link></li>
            <li><Link href="/produtos?ordem=mais-vendidos" className="hover:text-ink">Mais vendidos</Link></li>
            <li><Link href="/produtos?promocao=1" className="hover:text-ink">Ofertas</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Ajuda</h3>
          <ul className="mt-5 space-y-3 text-sm text-ink-muted">
            <li><Link href="/conta/pedidos" className="hover:text-ink">Meus pedidos</Link></li>
            <li><Link href="/institucional/trocas-e-devolucoes" className="hover:text-ink">Trocas e devoluções</Link></li>
            <li><Link href="/institucional/politica-de-privacidade" className="hover:text-ink">Política de privacidade</Link></li>
            <li><Link href="/institucional/termos-de-uso" className="hover:text-ink">Termos de uso</Link></li>
            <li><Link href="/institucional/sobre" className="hover:text-ink">Sobre a Eloah</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Atendimento</h3>
          <ul className="mt-5 space-y-3 text-sm text-ink-muted">
            {settings.whatsapp && (
              <li className="flex items-center gap-2">
                <WhatsAppIcon className="h-4 w-4" />
                <a href={`https://wa.me/55${settings.whatsapp.replace(/\D/g, "")}`} className="hover:text-ink">{formatPhone(settings.whatsapp)}</a>
              </li>
            )}
            {settings.phone && (
              <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> {formatPhone(settings.phone)}</li>
            )}
            {settings.email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> <a href={`mailto:${settings.email}`} className="hover:text-ink">{settings.email}</a>
              </li>
            )}
          </ul>
          <h3 className="mt-8 text-xs font-bold uppercase tracking-[0.2em]">Pagamento seguro</h3>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2"><PixIcon className="h-4 w-4 text-lilac-700" /> Pix</span>
            <span className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2"><CreditCard className="h-4 w-4 text-lilac-700" /> Cartão de crédito</span>
            <span className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2"><ShieldCheck className="h-4 w-4 text-lilac-700" /> Mercado Pago</span>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings.company_name || settings.store_name}
            {settings.cnpj ? ` · CNPJ ${settings.cnpj}` : ""}. Todos os direitos reservados.
          </p>
          <p>Envios por SuperFrete · Pagamentos por Mercado Pago</p>
        </div>
      </div>
    </footer>
  );
}
