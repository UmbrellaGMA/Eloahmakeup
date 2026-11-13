"use client";

import { LogoSymbol } from "@/components/brand/Logo";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <LogoSymbol className="h-14 w-14" />
      <h1 className="heading-display mt-6 text-4xl">Algo não saiu como esperado</h1>
      <p className="mt-3 max-w-sm text-sm text-ink-muted">Tivemos um problema ao carregar esta página. Tente novamente em instantes.</p>
      <button onClick={reset} className="mt-8 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-lilac-700">
        Tentar novamente
      </button>
    </div>
  );
}
