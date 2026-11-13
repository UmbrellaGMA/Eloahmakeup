"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useStore } from "@/components/providers/StoreProvider";
import type { NavItem } from "@/lib/nav";

function SearchForm({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        if (!term) return;
        router.push(`/produtos?q=${encodeURIComponent(term)}`);
        onDone?.();
      }}
      className="relative w-full"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        type="search"
        placeholder="O que você procura hoje?"
        aria-label="Buscar produtos"
        className="h-11 w-full rounded-full border border-line bg-cream pl-5 pr-12 text-sm outline-none transition placeholder:text-ink-muted/70 focus:border-lilac-300 focus:bg-white focus:ring-4 focus:ring-lilac-100"
      />
      <button type="submit" aria-label="Buscar" className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white transition hover:bg-lilac-700">
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

export function Header({ nav, announcement }: { nav: NavItem[]; announcement: string[] }) {
  const { cart, setCartOpen } = useStore();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fecha menus ao navegar
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  const count = cart?.count ?? 0;
  const marquee = [...announcement, ...announcement];

  return (
    <>
      {announcement.length > 0 && (
        <div className="overflow-hidden bg-ink text-white">
          <div className="flex w-max animate-marquee gap-12 py-2 text-[11px] font-medium uppercase tracking-[0.25em]">
            {marquee.map((t, i) => (
              <span key={i} className="flex items-center gap-12 whitespace-nowrap">
                {t}
                <span className="text-lilac-300">✦</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow ${scrolled ? "border-line shadow-[0_8px_24px_-18px_rgba(15,12,19,0.35)]" : "border-transparent"}`}>
        <div className="container-page relative flex h-[72px] items-center gap-4 lg:h-[84px]">
          <button className="-ml-2 flex h-10 w-10 items-center justify-center lg:hidden" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
            <Menu className="h-6 w-6" strokeWidth={1.6} />
          </button>

          {/* No celular a logo fica no centro exato da tela, independente dos ícones laterais */}
          <Link href="/" aria-label="Eloah Make Up — página inicial" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:static lg:translate-x-0 lg:translate-y-0 lg:shrink-0">
            <Logo size="md" priority className="!h-10 lg:!h-12" />
          </Link>

          <div className="mx-8 hidden max-w-xl flex-1 lg:block">
            <SearchForm />
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <button className="flex h-10 w-10 items-center justify-center lg:hidden" aria-label="Buscar" onClick={() => setSearchOpen((v) => !v)}>
              <Search className="h-[21px] w-[21px]" strokeWidth={1.6} />
            </button>
            <Link href="/conta" className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition hover:bg-lilac-50 sm:flex" aria-label="Minha conta">
              <User className="h-[21px] w-[21px]" strokeWidth={1.6} />
              <span className="hidden xl:inline">Minha conta</span>
            </Link>
            <Link href="/favoritos" className="hidden h-10 w-10 items-center justify-center rounded-full transition hover:bg-lilac-50 sm:flex" aria-label="Favoritos">
              <Heart className="h-[21px] w-[21px]" strokeWidth={1.6} />
            </Link>
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-lilac-50"
              aria-label={`Carrinho com ${count} ${count === 1 ? "item" : "itens"}`}
            >
              <ShoppingBag className="h-[21px] w-[21px]" strokeWidth={1.6} />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-lilac-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="container-page animate-fade-in pb-4 lg:hidden">
            <SearchForm autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        )}

        <nav className="hidden border-t border-line lg:block" aria-label="Categorias">
          <ul className="container-page flex h-12 items-center justify-center gap-10">
            <li>
              <Link href="/" className={`link-underline flex items-center gap-1 text-[13px] font-semibold uppercase tracking-[0.14em] ${pathname === "/" ? "text-lilac-700" : ""}`}>
                Início
              </Link>
            </li>
            {nav.map((item) => (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className={`link-underline flex items-center gap-1 text-[13px] font-semibold uppercase tracking-[0.14em] ${item.highlight ? "text-lilac-600" : ""}`}
                >
                  {item.label}
                  {item.children && item.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 transition group-hover:rotate-180" />}
                </Link>
                {item.children && item.children.length > 0 && (
                  <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition duration-200 group-hover:visible group-hover:opacity-100">
                    <ul className="min-w-[220px] rounded-2xl border border-line bg-white p-2 shadow-lift">
                      <li>
                        <Link href={item.href} className="block rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-lilac-50">
                          Ver tudo em {item.label}
                        </Link>
                      </li>
                      {item.children.map((c) => (
                        <li key={c.href}>
                          <Link href={c.href} className="block rounded-xl px-4 py-2.5 text-sm text-ink-muted hover:bg-lilac-50 hover:text-ink">
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm animate-slide-in-left flex-col bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Logo size="sm" />
              <button onClick={() => setMenuOpen(false)} aria-label="Fechar menu" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-lilac-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <Link href="/" className="block py-3.5 text-[15px] font-semibold uppercase tracking-[0.12em]">
                Início
              </Link>
              {nav.map((item) => (
                <div key={item.href} className="border-t border-line/70">
                  {item.children && item.children.length > 0 ? (
                    <>
                      <button
                        className="flex w-full items-center justify-between py-3.5 text-[15px] font-semibold uppercase tracking-[0.12em]"
                        onClick={() => setExpanded((e) => (e === item.href ? null : item.href))}
                        aria-expanded={expanded === item.href}
                      >
                        {item.label}
                        <ChevronDown className={`h-4 w-4 transition ${expanded === item.href ? "rotate-180" : ""}`} />
                      </button>
                      {expanded === item.href && (
                        <div className="animate-fade-in pb-3 pl-3">
                          <Link href={item.href} className="block py-2 text-sm font-semibold text-lilac-700">
                            Ver tudo
                          </Link>
                          {item.children.map((c) => (
                            <Link key={c.href} href={c.href} className="block py-2 text-sm text-ink-muted">
                              {c.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link href={item.href} className={`block py-3.5 text-[15px] font-semibold uppercase tracking-[0.12em] ${item.highlight ? "text-lilac-600" : ""}`}>
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-5">
              <Link href="/conta" className="flex items-center justify-center gap-2 rounded-full border border-line py-3 text-sm font-semibold">
                <User className="h-4 w-4" /> Minha conta
              </Link>
              <Link href="/favoritos" className="flex items-center justify-center gap-2 rounded-full border border-line py-3 text-sm font-semibold">
                <Heart className="h-4 w-4" /> Favoritos
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
