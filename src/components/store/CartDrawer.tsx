"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { formatPrice } from "@/lib/format";
import type { CartLine } from "@/lib/types";
import { ProductImage } from "./ProductImage";
import { buttonClass } from "@/components/ui/Button";

export function QuantityStepper({
  value,
  max = 99,
  onChange,
  size = "sm",
}: {
  value: number;
  max?: number;
  onChange: (v: number) => void;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9" : "h-12";
  return (
    <div className={`inline-flex ${h} items-center rounded-full border border-line`}>
      <button type="button" className="flex h-full w-9 items-center justify-center rounded-l-full hover:bg-lilac-50 disabled:opacity-30" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Diminuir quantidade">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className="flex h-full w-9 items-center justify-center rounded-r-full hover:bg-lilac-50 disabled:opacity-30" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Aumentar quantidade">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function CartLineItem({ item, compact }: { item: CartLine; compact?: boolean }) {
  const { updateItem, removeItem } = useStore();
  return (
    <li className="flex gap-4 py-5">
      <Link href={`/produto/${item.slug}`} className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl bg-cream sm:w-24">
        <ProductImage src={item.image} alt={item.name} sizes="96px" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/produto/${item.slug}`} className="line-clamp-2 text-sm font-medium leading-snug hover:text-lilac-700">
              {item.name}
            </Link>
            {item.variant_name && <p className="mt-0.5 text-xs text-ink-muted">{item.variant_name}</p>}
          </div>
          <button onClick={() => removeItem(item.id)} className="shrink-0 rounded-full p-1.5 text-ink-muted transition hover:bg-red-50 hover:text-danger" aria-label={`Remover ${item.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {item.issue && <p className="mt-1 text-xs font-semibold text-danger">{item.issue}</p>}
        <div className={`mt-auto flex items-end justify-between gap-2 ${compact ? "pt-2" : "pt-3"}`}>
          <QuantityStepper value={item.quantity} max={Math.max(1, Math.min(99, item.available))} onChange={(v) => updateItem(item.id, v)} />
          <div className="text-right">
            {item.regular_price > item.unit_price && <p className="text-[11px] text-ink-muted line-through">{formatPrice(item.regular_price * item.quantity)}</p>}
            <p className="text-sm font-semibold">{formatPrice(item.line_total)}</p>
          </div>
        </div>
      </div>
    </li>
  );
}

export function FreeShippingProgress({ subtotal, min }: { subtotal: number; min: number | null }) {
  if (!min) return null;
  const pct = Math.min(100, (subtotal / min) * 100);
  const missing = Math.max(0, min - subtotal);
  return (
    <div className="rounded-2xl bg-lilac-50 p-4">
      <p className="text-xs font-medium text-lilac-900">
        {missing > 0 ? (
          <>
            Faltam <strong>{formatPrice(missing)}</strong> para você ganhar <strong>frete grátis</strong>
          </>
        ) : (
          <>Parabéns! Você ganhou <strong>frete grátis</strong> ✦</>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-gradient-to-r from-lilac-400 to-lilac-600 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen } = useStore();

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cartOpen, setCartOpen]);

  if (!cartOpen) return null;
  const items = cart?.items ?? [];

  return (
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label="Carrinho">
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[440px] animate-slide-in-right flex-col bg-white shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="heading-display text-2xl">
            Sua sacola <span className="font-sans text-sm font-medium text-ink-muted">({cart?.count ?? 0})</span>
          </h2>
          <button onClick={() => setCartOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-lilac-50" aria-label="Fechar carrinho">
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-lilac-50">
              <ShoppingBag className="h-8 w-8 text-lilac-600" strokeWidth={1.4} />
            </div>
            <p className="heading-display text-2xl">Sua sacola está vazia</p>
            <p className="text-sm text-ink-muted">Explore nossas novidades e encontre sua próxima make favorita.</p>
            <Link href="/produtos" onClick={() => setCartOpen(false)} className={buttonClass("primary", "md", "mt-2")}>
              Explorar produtos
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="pt-5">
                <FreeShippingProgress subtotal={cart!.total_before_shipping} min={cart!.free_shipping_min} />
              </div>
              <ul className="divide-y divide-line">
                {items.map((i) => (
                  <CartLineItem key={i.id} item={i} compact />
                ))}
              </ul>
            </div>
            <div className="border-t border-line px-6 py-5">
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Subtotal</span>
                <span className="font-semibold">{formatPrice(cart!.subtotal)}</span>
              </div>
              {cart!.coupon && (
                <div className="mt-1 flex justify-between text-sm text-success">
                  <span>Cupom {cart!.coupon.code}</span>
                  <span>-{formatPrice(cart!.discount)}</span>
                </div>
              )}
              <p className="mt-1 text-xs text-ink-muted">Frete calculado no carrinho ou no checkout.</p>
              <div className="mt-4 grid gap-2">
                <Link href="/checkout" onClick={() => setCartOpen(false)} className={buttonClass("primary", "lg", "w-full")}>
                  Finalizar compra
                </Link>
                <Link href="/carrinho" onClick={() => setCartOpen(false)} className={buttonClass("outline", "md", "w-full")}>
                  Ver sacola completa
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
