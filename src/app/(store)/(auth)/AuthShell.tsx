import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container-page grid min-h-[70vh] items-center gap-12 py-12 lg:grid-cols-2">
      <div className="hidden items-center justify-center lg:flex">
        <Logo size="lg" priority className="!h-36 xl:!h-44" />
      </div>
      <div className="mx-auto w-full max-w-md">
        <h1 className="heading-display text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
