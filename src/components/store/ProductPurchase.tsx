"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import type { ProductWithRelations } from "@/lib/types";
import { effectivePrice } from "@/lib/format";
import { useStore } from "@/components/providers/StoreProvider";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "./PriceTag";
import { QuantityStepper } from "./CartDrawer";
import { FavoriteButton } from "./FavoriteButton";
import { ShippingCalculator } from "./ShippingCalculator";
import { ProductGallery } from "./ProductGallery";

export function ProductPurchase({ product }: { product: ProductWithRelations }) {
  const router = useRouter();
  const { addToCart } = useStore();
  const variants = product.variants;
  const [variantId, setVariantId] = useState<string | null>(variants.length === 1 ? variants[0].id : null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"add" | "buy" | null>(null);
  const [needVariant, setNeedVariant] = useState(false);

  const variant = variants.find((v) => v.id === variantId) ?? null;
  const prices = effectivePrice(product, variant);

  const stock = useMemo(() => {
    if (product.has_variants) {
      if (!variantId) return variants.some((v) => (product.inventory.find((i) => i.variant_id === v.id)?.quantity ?? 0) > 0) ? null : 0;
      return product.inventory.find((i) => i.variant_id === variantId)?.quantity ?? 0;
    }
    return product.inventory.find((i) => i.variant_id === null)?.quantity ?? 0;
  }, [product, variantId, variants]);

  const outOfStock = stock === 0;
  const maxQty = stock == null ? 99 : Math.max(1, Math.min(99, stock));

  const submit = async (mode: "add" | "buy") => {
    if (product.has_variants && !variantId) {
      setNeedVariant(true);
      return;
    }
    setBusy(mode);
    const ok = await addToCart(product.id, variantId, qty);
    setBusy(null);
    if (ok && mode === "buy") router.push("/checkout");
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      <ProductGallery images={product.images} name={product.name} activeUrl={variant?.image_url} />

      <div className="lg:sticky lg:top-36 lg:self-start">
        {product.brand && <p className="eyebrow">{product.brand}</p>}
        <h1 className="heading-display mt-2 text-[2.1rem] leading-tight sm:text-[2.6rem]">{product.name}</h1>
        <p className="mt-2 text-xs text-ink-muted">SKU: {variant?.sku ?? product.sku}</p>

        <div className="mt-6 flex items-end gap-3">
          <PriceTag price={prices.regular} promoPrice={prices.onSale ? prices.final : null} size="lg" />
          {prices.onSale && <span className="mb-2 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">-{prices.discountPercent}%</span>}
        </div>

        {product.short_description && <p className="mt-6 text-[15px] leading-relaxed text-ink-muted">{product.short_description}</p>}

        {variants.length > 0 && (
          <div className="mt-8">
            <p className="text-sm font-semibold">
              {variants.some((v) => v.color_hex) ? "Cor" : "Opção"}:{" "}
              <span className="font-normal text-ink-muted">{variant?.name ?? "selecione"}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {variants.map((v) => {
                const vStock = product.inventory.find((i) => i.variant_id === v.id)?.quantity ?? 0;
                const active = v.id === variantId;
                return v.color_hex ? (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVariantId(v.id);
                      setNeedVariant(false);
                      setQty(1);
                    }}
                    title={`${v.name}${vStock <= 0 ? " (esgotado)" : ""}`}
                    aria-label={v.name}
                    aria-pressed={active}
                    className={`relative h-10 w-10 rounded-full ring-2 ring-offset-2 transition ${active ? "ring-ink" : "ring-transparent hover:ring-line"} ${vStock <= 0 ? "opacity-40" : ""}`}
                    style={{ backgroundColor: v.color_hex }}
                  >
                    {vStock <= 0 && <span className="absolute left-1/2 top-1/2 h-px w-12 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-ink/60" />}
                  </button>
                ) : (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVariantId(v.id);
                      setNeedVariant(false);
                      setQty(1);
                    }}
                    aria-pressed={active}
                    className={`min-w-12 rounded-full border px-4 py-2.5 text-sm font-medium transition ${active ? "border-ink bg-ink text-white" : "border-line hover:border-ink"} ${vStock <= 0 ? "text-ink-muted line-through" : ""}`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
            {needVariant && <p className="mt-2 text-sm text-danger">Selecione uma opção para continuar.</p>}
          </div>
        )}

        <div className="mt-8">
          {outOfStock ? (
            <p className="rounded-xl bg-cream px-4 py-3 text-sm font-medium text-ink-muted">Produto esgotado no momento{product.has_variants && variantId ? " nesta opção" : ""}.</p>
          ) : (
            stock != null &&
            stock <= 5 && (
              <p className="mb-3 text-sm font-semibold text-lilac-700">
                {stock === 1 ? "Última unidade!" : `Restam apenas ${stock} unidades`}
              </p>
            )
          )}
          {!outOfStock && (
            <div className="flex flex-wrap items-center gap-3">
              <QuantityStepper value={qty} max={maxQty} onChange={(v) => setQty(Math.max(1, Math.min(v, maxQty)))} size="md" />
              <Button size="lg" className="min-w-[200px] flex-1" loading={busy === "add"} onClick={() => submit("add")}>
                <ShoppingBag className="h-[18px] w-[18px]" /> Adicionar à sacola
              </Button>
            </div>
          )}
          {!outOfStock && (
            <Button variant="lilac" size="lg" className="mt-3 w-full" loading={busy === "buy"} onClick={() => submit("buy")}>
              Comprar agora
            </Button>
          )}
          <div className="mt-4 flex justify-center">
            <FavoriteButton productId={product.id} withLabel className="rounded-full px-4 py-2 hover:bg-lilac-50" />
          </div>
        </div>

        <ul className="mt-6 space-y-2 border-t border-line pt-6 text-sm text-ink-muted">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-lilac-600" /> Pagamento seguro via Mercado Pago (Pix e cartão)</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-lilac-600" /> Envio com código de rastreamento</li>
        </ul>

        <div className="mt-6">
          <ShippingCalculator productId={product.id} quantity={qty} />
        </div>
      </div>
    </div>
  );
}
