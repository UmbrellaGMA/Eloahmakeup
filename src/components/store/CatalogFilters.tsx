"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Category } from "@/lib/types";

const SORTS = [
  { value: "relevancia", label: "Relevância" },
  { value: "novidades", label: "Novidades" },
  { value: "mais-vendidos", label: "Mais vendidos" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "nome", label: "Nome (A-Z)" },
];

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("pagina");
    start(() => router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { params, update, pending };
}

export function SortSelect() {
  const { params, update } = useQueryUpdater();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-muted sm:inline">Ordenar por</span>
      <select
        value={params.get("ordem") ?? "relevancia"}
        onChange={(e) => update({ ordem: e.target.value === "relevancia" ? null : e.target.value })}
        className="h-10 rounded-full border border-line bg-white px-4 pr-8 text-sm font-medium outline-none focus:border-lilac-400"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterPanel({ categories, currentCategory, onApplied }: { categories: Category[]; currentCategory?: string; onApplied?: () => void }) {
  const { params, update, pending } = useQueryUpdater();
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const roots = categories.filter((c) => !c.parent_id);
  const toggles = [
    { key: "promocao", label: "Em promoção" },
    { key: "lancamentos", label: "Lançamentos" },
    { key: "mais-vendidos", label: "Mais vendidos" },
  ];

  return (
    <div className={`space-y-8 ${pending ? "opacity-60" : ""}`}>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Categorias</h3>
        <ul className="mt-4 space-y-1">
          <li>
            <Link href={`/produtos${params.get("q") ? `?q=${encodeURIComponent(params.get("q")!)}` : ""}`} className={`block rounded-lg px-3 py-2 text-sm ${!currentCategory ? "bg-lilac-50 font-semibold text-lilac-800" : "text-ink-muted hover:text-ink"}`}>
              Todos os produtos
            </Link>
          </li>
          {roots.map((r) => (
            <li key={r.id}>
              <Link href={`/categoria/${r.slug}`} className={`block rounded-lg px-3 py-2 text-sm ${currentCategory === r.slug ? "bg-lilac-50 font-semibold text-lilac-800" : "text-ink-muted hover:text-ink"}`}>
                {r.name}
              </Link>
              <ul className="ml-3 border-l border-line pl-2">
                {categories
                  .filter((c) => c.parent_id === r.id)
                  .map((c) => (
                    <li key={c.id}>
                      <Link href={`/categoria/${c.slug}`} className={`block rounded-lg px-3 py-1.5 text-[13px] ${currentCategory === c.slug ? "font-semibold text-lilac-800" : "text-ink-muted hover:text-ink"}`}>
                        {c.name}
                      </Link>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Preço</h3>
        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ min: min || null, max: max || null });
            onApplied?.();
          }}
        >
          <input value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="R$ mín" className="field !py-2.5" aria-label="Preço mínimo" />
          <span className="text-ink-muted">–</span>
          <input value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="R$ máx" className="field !py-2.5" aria-label="Preço máximo" />
          <button className="h-11 shrink-0 rounded-xl bg-ink px-3 text-xs font-semibold text-white hover:bg-lilac-700">OK</button>
        </form>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Filtrar</h3>
        <div className="mt-4 space-y-3">
          {toggles.map((t) => {
            const active = params.get(t.key) === "1";
            return (
              <label key={t.key} className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => {
                    update({ [t.key]: active ? null : "1" });
                    onApplied?.();
                  }}
                  className="h-4 w-4 rounded accent-lilac-600"
                />
                {t.label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CatalogFilters(props: { categories: Category[]; currentCategory?: string; mode: "sidebar" | "mobile" }) {
  const [open, setOpen] = useState(false);
  if (props.mode === "sidebar") {
    return (
      <aside className="hidden w-60 shrink-0 lg:block">
        <FilterPanel {...props} />
      </aside>
    );
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium lg:hidden">
        <SlidersHorizontal className="h-4 w-4" /> Filtros
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="heading-display text-2xl">Filtros</h2>
              <button onClick={() => setOpen(false)} aria-label="Fechar filtros" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-lilac-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FilterPanel {...props} onApplied={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
