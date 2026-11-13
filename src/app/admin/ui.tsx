"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Toasts simples do painel (evento global). */
export function notify(message: string, tone: "success" | "error" = "success") {
  window.dispatchEvent(new CustomEvent("admin-toast", { detail: { message, tone } }));
}

export function AdminToaster() {
  const [items, setItems] = useState<{ id: number; message: string; tone: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const handler = (e: Event) => {
      const { message, tone } = (e as CustomEvent).detail;
      const id = ++n;
      setItems((i) => [...i, { id, message, tone }]);
      setTimeout(() => setItems((i) => i.filter((x) => x.id !== id)), 4500);
    };
    window.addEventListener("admin-toast", handler);
    return () => window.removeEventListener("admin-toast", handler);
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`max-w-sm animate-fade-up rounded-xl px-4 py-3 text-sm font-medium shadow-lift ${t.tone === "error" ? "bg-danger text-white" : "bg-ink text-white"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="heading-display text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = "", actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-bold uppercase tracking-wider text-ink-muted">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function FormMessage({ state }: { state?: { error?: string; message?: string; ok?: boolean } }) {
  if (!state?.error && !state?.message) return null;
  return <p className={`rounded-xl px-4 py-3 text-sm ${state.error ? "bg-red-50 text-danger" : "bg-emerald-50 text-success"}`}>{state.error ?? state.message}</p>;
}
