"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Banner } from "@/lib/types";
import { Logo } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/Button";

/** Mesmas proporções dos banners: celular 1080×880 · computador 1920×440. */
const HERO_BOX = "relative w-full aspect-[27/22] md:aspect-[48/11]";

/** Exibido enquanto não há banners cadastrados no painel: fundo liso com a logo. */
function BrandHero() {
  return (
    <section className={`${HERO_BOX} bg-ink`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-4 text-center md:gap-8">
        <Logo tone="light" size="lg" priority className="!h-24 md:!h-28 lg:!h-32" />
        <Link href="/produtos" className={buttonClass("light", "lg")}>
          Ver produtos <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

/**
 * Carrossel de banners: somente a imagem enviada no painel, sem texto
 * sobreposto e sem degradê. O banner inteiro é clicável quando tem link.
 * Tamanhos: computador 1920×440 px · celular 1080×880 px (sem imagem de
 * celular, a de computador é recortada pelo centro).
 */
export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const slides = banners.filter((b) => b.image_url || b.mobile_image_url);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;
  const go = useCallback((dir: number) => setIndex((i) => (i + dir + total) % total), [total]);

  useEffect(() => {
    if (total < 2 || paused) return;
    const t = setInterval(() => go(1), 6500);
    return () => clearInterval(t);
  }, [total, paused, go]);

  if (!total) return <BrandHero />;

  return (
    <section
      className="relative overflow-hidden bg-cream"
      aria-roledescription="carrossel"
      aria-label="Destaques"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={HERO_BOX}>
        {slides.map((b, i) => {
          const active = i === index;
          const desktop = b.image_url ?? b.mobile_image_url!;
          const mobile = b.mobile_image_url ?? b.image_url!;
          const content = (
            <>
              <Image src={desktop} alt={b.title} fill priority={i === 0} sizes="100vw" className="hidden object-cover md:block" />
              <Image src={mobile} alt={b.title} fill priority={i === 0} sizes="100vw" className="object-cover md:hidden" />
            </>
          );
          return (
            <div
              key={b.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${active ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"}`}
              aria-hidden={!active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${total}`}
            >
              {b.link_url ? (
                <Link href={b.link_url} className="block h-full w-full" tabIndex={active ? 0 : -1} aria-label={b.title}>
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <>
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-ink/30 px-3 py-2 backdrop-blur-sm">
            {slides.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setIndex(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-7 bg-white" : "w-1.5 bg-white/60 hover:bg-white"}`}
              />
            ))}
          </div>
          <button onClick={() => go(-1)} aria-label="Banner anterior" className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow-soft backdrop-blur transition hover:bg-white md:flex">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button onClick={() => go(1)} aria-label="Próximo banner" className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow-soft backdrop-blur transition hover:bg-white md:flex">
            <ArrowRight className="h-5 w-5" />
          </button>
        </>
      )}
    </section>
  );
}
