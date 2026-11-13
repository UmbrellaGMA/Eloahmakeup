"use client";

import { formatPrice, installmentInfo } from "@/lib/format";
import { useStore } from "@/components/providers/StoreProvider";

export function PriceTag({
  price,
  promoPrice,
  size = "md",
  showInstallments = true,
}: {
  price: number;
  promoPrice: number | null;
  size?: "sm" | "md" | "lg";
  showInstallments?: boolean;
}) {
  const { installments } = useStore();
  const onSale = promoPrice != null && promoPrice < price;
  const final = onSale ? promoPrice! : price;
  const inst = installmentInfo(final, installments.max, installments.min);
  const big = { sm: "text-base", md: "text-lg", lg: "text-3xl" }[size];
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        {onSale && <span className="text-xs text-ink-muted line-through">{formatPrice(price)}</span>}
        <span className={`font-semibold tracking-tight text-ink ${big}`}>{formatPrice(final)}</span>
      </div>
      {showInstallments && inst.count > 1 && (
        <span className="text-xs text-ink-muted">
          ou em até <strong className="font-semibold text-ink">{inst.count}x</strong> no cartão
        </span>
      )}
    </div>
  );
}
