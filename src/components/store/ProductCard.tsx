"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import type { ProductCardData } from "@/lib/types";
import { effectivePrice } from "@/lib/format";
import { useStore } from "@/components/providers/StoreProvider";
import { FavoriteButton } from "./FavoriteButton";
import { PriceTag } from "./PriceTag";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const { addToCart } = useStore();
  const [adding, setAdding] = useState(false);
  const { onSale, discountPercent } = effectivePrice(product);
  const href = `/produto/${product.slug}`;

  return (
    <article className="group relative flex h-full w-full flex-col">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-cream">
        <ProductImage
          src={product.image}
          alt={product.image_alt ?? product.name}
          priority={priority}
          className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
        />
        {product.second_image && (
          <Image
            src={product.second_image}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover opacity-0 transition duration-700 group-hover:opacity-100"
          />
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {onSale && <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold tracking-wider text-white">-{discountPercent}% OFF</span>}
          {product.is_new && <span className="rounded-full bg-lilac-200 px-2.5 py-1 text-[10px] font-bold tracking-wider text-lilac-900">NOVO</span>}
          {!product.in_stock && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold tracking-wider text-ink-muted">ESGOTADO</span>}
        </div>
      </Link>
      <FavoriteButton
        productId={product.id}
        className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/90 shadow-soft backdrop-blur hover:bg-white"
      />

      <div className="flex flex-1 flex-col pt-3.5">
        {product.brand && <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lilac-700">{product.brand}</span>}
        <Link href={href} className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13.5px] font-medium leading-snug text-ink hover:text-lilac-700">
          {product.name}
        </Link>
        <div className="mt-2">
          <PriceTag price={product.price} promoPrice={product.promo_price} size="sm" />
        </div>
        {/* botão sempre no rodapé do card, alinhado com os vizinhos */}
        <div className="mt-auto pt-3">
          {!product.in_stock ? (
            <Link href={href} className="flex h-10 w-full items-center justify-center rounded-full border border-line text-xs font-semibold text-ink-muted">
              Ver produto
            </Link>
          ) : product.has_variants ? (
            <Link
              href={href}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink text-xs font-semibold tracking-wide text-white transition hover:bg-lilac-700"
            >
              Escolher opção
            </Link>
          ) : (
            <button
              type="button"
              disabled={adding}
              onClick={async () => {
                setAdding(true);
                await addToCart(product.id, null, 1);
                setAdding(false);
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink text-xs font-semibold tracking-wide text-white transition hover:bg-lilac-700 disabled:opacity-60"
            >
              <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
              {adding ? "Adicionando..." : "Comprar"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
