"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ProductCardData } from "@/lib/types";
import { ProductCard } from "./ProductCard";

/** Vitrine horizontal com rolagem (snap) — padrão mobile-first. */
export function ProductRail({
  eyebrow,
  title,
  products,
  href,
  hrefLabel = "Ver todos",
}: {
  eyebrow?: string;
  title: string;
  products: ProductCardData[];
  href?: string;
  hrefLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="container-page py-14 sm:py-20">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="heading-display mt-2 text-3xl sm:text-[2.6rem]">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {href && (
            <Link href={href} className="link-underline mr-2 hidden text-sm font-semibold sm:inline">
              {hrefLabel}
            </Link>
          )}
          <button onClick={() => scroll(-1)} aria-label="Anterior" className="hidden h-11 w-11 items-center justify-center rounded-full border border-line transition hover:border-ink sm:flex">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll(1)} aria-label="Próximo" className="hidden h-11 w-11 items-center justify-center rounded-full border border-line transition hover:border-ink sm:flex">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:-mx-6 sm:gap-6 sm:px-6 lg:mx-0 lg:px-0">
        {products.map((p, i) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc(25%-18px)]">
            <ProductCard product={p} priority={i < 2} />
          </div>
        ))}
      </div>
      {href && (
        <div className="mt-8 text-center sm:hidden">
          <Link href={href} className="link-underline text-sm font-semibold">
            {hrefLabel}
          </Link>
        </div>
      )}
    </section>
  );
}
