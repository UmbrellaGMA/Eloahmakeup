import Link from "next/link";
import { LogoSymbol } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      <LogoSymbol className="h-16 w-16" />
      <p className="eyebrow mt-8">Erro 404</p>
      <h1 className="heading-display mt-3 text-5xl">Página não encontrada</h1>
      <p className="mt-3 max-w-sm text-sm text-ink-muted">O endereço pode ter mudado ou o produto não está mais disponível.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-lilac-700">Ir para o início</Link>
        <Link href="/produtos" className="rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold hover:border-ink">Ver produtos</Link>
      </div>
    </div>
  );
}
