"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BadgePercent, Boxes, ExternalLink, FolderTree, Image as ImageIcon, LayoutDashboard, Menu, Package, PlugZap, Settings, ShoppingCart, Users, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const LINKS = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", Icon: ShoppingCart },
  { href: "/admin/produtos", label: "Produtos", Icon: Package },
  { href: "/admin/categorias", label: "Categorias", Icon: FolderTree },
  { href: "/admin/estoque", label: "Estoque", Icon: Boxes },
  { href: "/admin/clientes", label: "Clientes", Icon: Users },
  { href: "/admin/cupons", label: "Cupons", Icon: BadgePercent },
  { href: "/admin/banners", label: "Banners", Icon: ImageIcon },
  { href: "/admin/configuracoes", label: "Configurações", Icon: Settings },
  { href: "/admin/integracoes", label: "Integrações", Icon: PlugZap },
];

export function AdminNav({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {LINKS.map(({ href, label, Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            <Icon className="h-[18px] w-[18px]" /> {label}
          </Link>
        );
      })}
      <Link href="/" target="_blank" className="mt-4 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/60 hover:text-white">
        <ExternalLink className="h-[18px] w-[18px]" /> Ver loja
      </Link>
    </nav>
  );
  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <Logo tone="light" size="sm" />
        <button onClick={() => setOpen(true)} className="text-white" aria-label="Abrir menu">
          <Menu className="h-6 w-6" />
        </button>
      </div>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-ink lg:flex">
        <div className="px-6 py-6"><Logo tone="light" size="sm" /></div>
        {nav}
        <div className="border-t border-white/10 px-6 py-4 text-xs text-white/50">
          <p className="truncate">{email}</p>
          <p className="mt-0.5 uppercase tracking-wider text-lilac-300">{role}</p>
        </div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 animate-slide-in-left flex-col bg-ink">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo tone="light" size="sm" />
              <button onClick={() => setOpen(false)} className="text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
