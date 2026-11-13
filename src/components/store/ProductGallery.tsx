"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Expand, X } from "lucide-react";
import type { ProductImage as Img } from "@/lib/types";
import { ProductImage } from "./ProductImage";

export function ProductGallery({ images, name, activeUrl }: { images: Pick<Img, "id" | "url" | "alt">[]; name: string; activeUrl?: string | null }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Quando uma variação tem imagem própria, ela assume a posição principal
  const list = activeUrl && !images.some((i) => i.url === activeUrl) ? [{ id: "variant", url: activeUrl, alt: name }, ...images] : images;
  const forced = activeUrl ? list.findIndex((i) => i.url === activeUrl) : -1;
  const current = forced >= 0 && index === 0 ? forced : Math.min(index, Math.max(list.length - 1, 0));
  const main = list[current];

  if (!list.length) {
    return (
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-cream">
        <ProductImage src={null} alt={name} />
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      {list.length > 1 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto lg:w-20 lg:flex-col">
          {list.map((img, i) => (
            <button
              key={img.id}
              onClick={() => {
                setIndex(i);
                scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: "smooth" });
              }}
              aria-label={`Ver imagem ${i + 1}`}
              className={`relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl bg-cream ring-2 transition lg:w-20 ${i === current ? "ring-lilac-500" : "ring-transparent hover:ring-line"}`}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Desktop: zoom no hover */}
      <div
        className="relative hidden aspect-[4/5] flex-1 cursor-zoom-in overflow-hidden rounded-[var(--radius-card)] bg-cream lg:block"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
        onClick={() => setLightbox(true)}
      >
        <Image
          src={main.url}
          alt={main.alt ?? name}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover transition-transform duration-200"
          style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
        <span className="pointer-events-none absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-soft">
          <Expand className="h-4 w-4" />
        </span>
      </div>

      {/* Mobile: carrossel com swipe */}
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[var(--radius-card)] lg:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== current) setIndex(i);
        }}
      >
        {list.map((img, i) => (
          <button key={img.id} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-cream" onClick={() => { setIndex(i); setLightbox(true); }} aria-label="Ampliar imagem">
            <Image src={img.url} alt={img.alt ?? name} fill priority={i === 0} sizes="100vw" className="object-cover" />
          </button>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[90] flex animate-fade-in items-center justify-center bg-ink/95" role="dialog" aria-modal="true" aria-label="Imagem ampliada" onClick={() => setLightbox(false)}>
          <button className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
          <div className="relative h-[85dvh] w-[92vw] max-w-4xl">
            <Image src={main.url} alt={main.alt ?? name} fill sizes="92vw" quality={90} className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
