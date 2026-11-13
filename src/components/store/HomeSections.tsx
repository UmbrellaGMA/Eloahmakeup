import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BadgePercent, CreditCard, Flame, Gem, Quote, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";
import type { Category, InstagramPost, StoreSettings, Testimonial } from "@/lib/types";
import { InstagramIcon, PixIcon } from "@/components/ui/SocialIcons";
import { formatPrice } from "@/lib/format";

export function Benefits({ settings }: { settings: StoreSettings }) {
  const items = [
    { Icon: Truck, title: "Entrega para todo o Brasil", text: settings.free_shipping_min ? `Frete grátis acima de ${formatPrice(settings.free_shipping_min)}` : "Correios via SuperFrete com rastreio" },
    { Icon: CreditCard, title: `Até ${settings.max_installments}x no cartão`, text: "Pagamento processado pelo Mercado Pago" },
    { Icon: PixIcon, title: "Pague com Pix", text: "Aprovação imediata e QR Code na hora" },
    { Icon: ShieldCheck, title: "Compra 100% segura", text: "Seus dados protegidos de ponta a ponta" },
  ];
  return (
    <section className="border-b border-line bg-white">
      <div className="container-page grid grid-cols-2 gap-y-6 py-8 lg:grid-cols-4">
        {items.map(({ Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3 px-2 sm:items-center sm:px-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lilac-50 text-lilac-700">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold leading-tight">{title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Vitrine de categorias: Maquiagens, Acessórios, Lançamentos, Mais vendidos, Ofertas */
export function CategoryShowcase({ categories }: { categories: Category[] }) {
  const roots = categories.filter((c) => !c.parent_id).slice(0, 2);
  const tiles = [
    ...roots.map((c, i) => ({
      key: c.id,
      title: c.name,
      text: c.description ?? "",
      href: `/categoria/${c.slug}`,
      image: c.image_url,
      Icon: i === 0 ? Sparkles : Gem,
      big: true,
    })),
    { key: "new", title: "Lançamentos", text: "As novidades que acabaram de chegar", href: "/produtos?lancamentos=1", image: null, Icon: Star, big: false },
    { key: "best", title: "Mais vendidos", text: "As favoritas das nossas clientes", href: "/produtos?ordem=mais-vendidos", image: null, Icon: Flame, big: false },
    { key: "sale", title: "Ofertas", text: "Preços especiais por tempo limitado", href: "/produtos?promocao=1", image: null, Icon: BadgePercent, big: false },
  ];
  return (
    <section className="container-page py-14 sm:py-20">
      <div className="mb-10 text-center">
        <p className="eyebrow">Navegue por</p>
        <h2 className="heading-display mt-2 text-3xl sm:text-[2.6rem]">Categorias em destaque</h2>
      </div>
      <div className="grid gap-4 sm:gap-5 md:grid-cols-6">
        {tiles.map(({ key, title, text, href, image, Icon, big }, i) => (
          <Link
            key={key}
            href={href}
            className={`group relative flex overflow-hidden rounded-[var(--radius-card)] ${big ? "min-h-[260px] md:col-span-3 md:min-h-[340px]" : "min-h-[170px] md:col-span-2"} ${
              i === 0 ? "bg-ink text-white" : i === 1 ? "bg-lilac-100" : "bg-cream"
            }`}
          >
            {image && <Image src={image} alt={title} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />}
            {image && <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />}
            {!image && (
              <Icon
                className={`absolute -bottom-6 -right-6 transition duration-700 group-hover:rotate-12 group-hover:scale-110 ${big ? "h-48 w-48" : "h-28 w-28"} ${i === 0 ? "text-lilac-500/30" : "text-lilac-300/50"}`}
                strokeWidth={1}
              />
            )}
            <div className={`relative mt-auto p-6 sm:p-8 ${image ? "text-white" : ""}`}>
              <h3 className={`heading-display ${big ? "text-4xl" : "text-2xl"} ${i === 0 || image ? "!text-white" : ""}`}>{title}</h3>
              {text && <p className={`mt-1.5 max-w-xs text-sm ${i === 0 || image ? "text-white/70" : "text-ink-muted"}`}>{text}</p>}
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em]">
                Explorar <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  if (!items?.length) return null;
  return (
    <section className="bg-lilac-50/60 py-16 sm:py-24">
      <div className="container-page">
        <div className="mb-10 text-center">
          <p className="eyebrow">Quem usa, ama</p>
          <h2 className="heading-display mt-2 text-3xl sm:text-[2.6rem]">O que dizem nossas clientes</h2>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
          {items.slice(0, 6).map((t, i) => (
            <figure key={i} className="card w-[85%] shrink-0 snap-start p-7 md:w-auto">
              <Quote className="h-7 w-7 text-lilac-400" />
              <div className="mt-3 flex gap-0.5">
                {Array.from({ length: Math.max(1, Math.min(5, t.rating ?? 5)) }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-lilac-500 text-lilac-500" />
                ))}
              </div>
              <blockquote className="mt-4 text-[15px] leading-relaxed text-ink">“{t.text}”</blockquote>
              <figcaption className="mt-5 text-sm font-semibold">
                {t.name}
                {t.city && <span className="font-normal text-ink-muted"> · {t.city}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function InstagramSection({ url, posts }: { url: string | null; posts: InstagramPost[] }) {
  if (!url && !posts?.length) return null;
  const handle = url?.replace(/\/$/, "").split("/").pop();
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="mb-10 flex flex-col items-center text-center">
        <InstagramIcon className="h-7 w-7 text-lilac-600" />
        <h2 className="heading-display mt-3 text-3xl sm:text-[2.6rem]">Siga a Eloah no Instagram</h2>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="link-underline mt-2 text-sm font-semibold text-lilac-700">
            @{handle}
          </a>
        )}
      </div>
      {posts?.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-6">
          {posts.slice(0, 6).map((p, i) => (
            <a key={i} href={p.link_url || url || "#"} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-2xl bg-cream">
              <Image src={p.image_url} alt={p.caption ?? "Post do Instagram"} fill sizes="(max-width:768px) 33vw, 16vw" className="object-cover transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 flex items-center justify-center bg-ink/0 transition group-hover:bg-ink/40">
                <InstagramIcon className="h-7 w-7 text-white opacity-0 transition group-hover:opacity-100" />
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
