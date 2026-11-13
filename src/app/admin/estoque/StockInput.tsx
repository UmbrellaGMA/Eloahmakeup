"use client";

import { useState, useTransition } from "react";
import { updateStock } from "../actions";
import { notify } from "../ui";

export function StockInput({ id, quantity, threshold }: { id: string; quantity: number; threshold: number }) {
  const [value, setValue] = useState(String(quantity));
  const [saved, setSaved] = useState(quantity);
  const [pending, start] = useTransition();
  const dirty = Number(value) !== saved;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = Number(value);
        start(async () => {
          const r = await updateStock(id, q);
          if (r?.error) notify(r.error, "error");
          else {
            setSaved(q);
            notify("Estoque atualizado");
          }
        });
      }}
    >
      <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className={`field !w-24 !py-2 ${saved <= threshold ? "border-amber-300" : ""}`} aria-label="Quantidade" />
      {dirty && <button disabled={pending} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "..." : "Salvar"}</button>}
      <span className="text-[11px] text-ink-muted">alerta ≤ {threshold}</span>
    </form>
  );
}
