"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, Tag, X } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { CartLineItem, FreeShippingProgress } from "@/components/store/CartDrawer";
import { ShippingCalculator } from "@/components/store/ShippingCalculator";
import { buttonClass } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";

export function CouponBox() {
  const { cart, applyCoupon } = useStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  if (!cart) return null;
  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-success">
          <Tag className="h-4 w-4" /> {cart.coupon.code} aplicado (-{formatPrice(cart.discount)})
        </span>
        <button onClick={() => applyCoupon(null)} className="rounded-full p-1 text-ink-muted hover:bg-white" aria-label="Remover cupom">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        if (await applyCoupon(code.trim())) setCode("");
        setBusy(false);
      }}
    >
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Cupom de desconto" aria-label="Cupom de desconto" className="field !py-2.5 uppercase" maxLength={32} />
      <button disabled={busy || !code.trim()} className="h-11 shrink-0 rounded-xl border border-ink px-4 text-sm font-semibold transition hover:bg-ink hover:text-white disabled:opacity-40">
        Aplicar
      </button>
    </form>
  );
}

export function CartPageClient() {
  const { cart, cartLoading } = useStore();

  if (cartLoading) {
    return (
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
        <div className="skeleton h-72" />
      </div>
    );
  }

  if (!cart?.items.length) {
    return (
      <div className="flex flex-col items-center rounded-[var(--radius-card)] bg-cream px-6 py-24 text-center">
        <ShoppingBag className="h-12 w-12 text-lilac-500" strokeWidth={1.3} />
        <h2 className="heading-display mt-5 text-3xl">Sua sacola está vazia</h2>
        <p className="mt-2 text-sm text-ink-muted">Que tal começar pelos nossos lançamentos?</p>
        <Link href="/produtos?lancamentos=1" className={buttonClass("primary", "lg", "mt-8")}>
          Ver lançamentos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        <FreeShippingProgress subtotal={cart.total_before_shipping} min={cart.free_shipping_min} />
        <ul className="divide-y divide-line">
          {cart.items.map((i) => (
            <CartLineItem key={i.id} item={i} />
          ))}
        </ul>
        <div className="mt-6 max-w-md">
          <ShippingCalculator title="Calcular frete do pedido" />
        </div>
      </div>

      <aside className="h-fit rounded-[var(--radius-card)] bg-cream p-6 lg:sticky lg:top-36">
        <h2 className="heading-display text-2xl">Resumo</h2>
        <div className="mt-5">
          <CouponBox />
          {cart.coupon_error && <p className="mt-2 text-xs text-danger">{cart.coupon_error}</p>}
        </div>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink-muted">Subtotal ({cart.count} {cart.count === 1 ? "item" : "itens"})</dt><dd className="font-medium">{formatPrice(cart.subtotal)}</dd></div>
          {cart.discount > 0 && <div className="flex justify-between text-success"><dt>Desconto</dt><dd>-{formatPrice(cart.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-muted">Frete</dt><dd className="text-ink-muted">calculado no checkout</dd></div>
          <div className="flex justify-between border-t border-line pt-4 text-base"><dt className="font-semibold">Total</dt><dd className="font-bold">{formatPrice(cart.total_before_shipping)}</dd></div>
        </dl>
        {cart.has_issues && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-danger">Ajuste os itens sinalizados para continuar.</p>}
        <Link
          href="/checkout"
          aria-disabled={cart.has_issues}
          className={buttonClass("primary", "lg", `mt-6 w-full ${cart.has_issues ? "pointer-events-none opacity-40" : ""}`)}
        >
          Finalizar compra
        </Link>
        <Link href="/produtos" className="mt-3 block text-center text-sm font-medium text-ink-muted hover:text-ink">
          Continuar comprando
        </Link>
      </aside>
    </div>
  );
}
