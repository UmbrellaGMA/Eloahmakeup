import Link from "next/link";
import { Heart, LayoutGrid, LogOut, MapPin, Package, ShieldCheck, UserRound } from "lucide-react";
import { requireUser, getAdminRole } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: LayoutProps<"/conta">) {
  const user = await requireUser("/conta");
  const role = await getAdminRole();
  const links = [
    { href: "/conta", label: "Visão geral", Icon: LayoutGrid },
    { href: "/conta/pedidos", label: "Meus pedidos", Icon: Package },
    { href: "/conta/enderecos", label: "Endereços", Icon: MapPin },
    { href: "/conta/dados", label: "Dados pessoais", Icon: UserRound },
    { href: "/favoritos", label: "Favoritos", Icon: Heart },
  ];
  return (
    <div className="container-page grid gap-10 pb-20 pt-10 lg:grid-cols-[240px_1fr]">
      <aside>
        <p className="eyebrow">Minha conta</p>
        <p className="mt-2 truncate text-sm text-ink-muted">{user.email}</p>
        <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {links.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-lilac-50">
              <Icon className="h-4 w-4 text-lilac-700" /> {label}
            </Link>
          ))}
          {role && (
            <Link href="/admin" className="flex shrink-0 items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white">
              <ShieldCheck className="h-4 w-4" /> Painel administrativo
            </Link>
          )}
          <form action={signOut}>
            <button className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-red-50 hover:text-danger">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
