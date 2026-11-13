"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { formatCep, formatPrice, onlyDigits } from "@/lib/format";
import type { ShippingOption } from "@/lib/types";

type QuoteResponse = { options: (ShippingOption & { original_price?: number })[]; free_shipping: boolean };

export function useShippingQuote() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QuoteResponse | null>(null);
  const quote = async (body: { postal_code: string; product_id?: string; quantity?: number }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shipping/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Não foi possível calcular o frete.");
      if (!j.options?.length) throw new Error("Nenhuma modalidade de entrega disponível para este CEP.");
      setData(j);
      return j as QuoteResponse;
    } catch (e) {
      setData(null);
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, data, quote, reset: () => setData(null) };
}

export function ShippingOptionsList({
  options,
  selected,
  onSelect,
}: {
  options: (ShippingOption & { original_price?: number })[];
  selected?: number | null;
  onSelect?: (o: ShippingOption) => void;
}) {
  return (
    <ul className="space-y-2">
      {options.map((o) => {
        const Comp = onSelect ? "button" : "div";
        const active = selected === o.service_id;
        return (
          <li key={o.service_id}>
            <Comp
              {...(onSelect ? { type: "button" as const, onClick: () => onSelect(o) } : {})}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                active ? "border-lilac-500 bg-lilac-50 ring-2 ring-lilac-100" : "border-line bg-white"
              } ${onSelect ? "hover:border-lilac-300" : ""}`}
            >
              <span className="flex items-center gap-3">
                {onSelect && <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${active ? "border-lilac-600 bg-lilac-600 shadow-[inset_0_0_0_3px_white]" : "border-line"}`} />}
                <span>
                  <span className="font-semibold">{o.name}</span>
                  <span className="block text-xs text-ink-muted">
                    {o.carrier} · até {o.delivery_days} {o.delivery_days === 1 ? "dia útil" : "dias úteis"}
                  </span>
                </span>
              </span>
              <span className="text-right font-semibold">
                {o.price === 0 ? (
                  <span className="text-success">Grátis</span>
                ) : (
                  formatPrice(o.price)
                )}
                {o.original_price != null && o.price === 0 && <span className="block text-[11px] font-normal text-ink-muted line-through">{formatPrice(o.original_price)}</span>}
              </span>
            </Comp>
          </li>
        );
      })}
    </ul>
  );
}

/** Calculadora de frete por CEP (página do produto / carrinho). */
export function ShippingCalculator({ productId, quantity = 1, title = "Calcular frete e prazo" }: { productId?: string; quantity?: number; title?: string }) {
  const [cep, setCep] = useState("");
  const { loading, error, data, quote } = useShippingQuote();

  return (
    <div className="rounded-2xl border border-line p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Truck className="h-4 w-4 text-lilac-600" /> {title}
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (onlyDigits(cep).length === 8) void quote({ postal_code: cep, product_id: productId, quantity });
        }}
      >
        <input
          value={formatCep(cep)}
          onChange={(e) => setCep(e.target.value)}
          inputMode="numeric"
          placeholder="00000-000"
          aria-label="CEP"
          className="field !py-2.5"
          maxLength={9}
        />
        <button disabled={loading || onlyDigits(cep).length !== 8} className="h-11 shrink-0 rounded-xl bg-ink px-5 text-sm font-semibold text-white transition hover:bg-lilac-700 disabled:opacity-40">
          {loading ? "..." : "Calcular"}
        </button>
      </form>
      <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-ink-muted underline">
        Não sei meu CEP
      </a>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {data && (
        <div className="mt-4">
          <ShippingOptionsList options={data.options} />
        </div>
      )}
    </div>
  );
}
