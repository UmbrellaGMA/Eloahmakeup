import type { ReactNode } from "react";
import { LogoSymbol } from "@/components/brand/Logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container-page grid min-h-[70vh] items-center gap-12 py-12 lg:grid-cols-2">
      <div className="relative hidden h-full min-h-[520px] overflow-hidden rounded-[2rem] bg-ink lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_70%_20%,rgba(157,112,213,0.5)_0%,transparent_65%)]" />
        <LogoSymbol className="absolute right-12 top-12 h-24 w-24" tone="light" />
        <p className="eyebrow relative !text-lilac-300">Eloah Make Up</p>
        <p className="heading-display relative mt-3 text-5xl leading-tight !text-white">
          Sua beleza,
          <br />
          <em className="text-lilac-300">do seu jeito.</em>
        </p>
        <p className="relative mt-4 max-w-sm text-sm text-white/65">Acompanhe pedidos, salve favoritos e finalize suas compras com mais rapidez.</p>
      </div>
      <div className="mx-auto w-full max-w-md">
        <h1 className="heading-display text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
