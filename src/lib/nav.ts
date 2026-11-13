import type { Category } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
  highlight?: boolean;
}

export function buildNav(categories: Category[]): NavItem[] {
  const roots = categories.filter((c) => !c.parent_id && c.show_in_menu);
  return [
    ...roots.map((r) => ({
      label: r.name,
      href: `/categoria/${r.slug}`,
      children: categories.filter((c) => c.parent_id === r.id && c.show_in_menu).map((c) => ({ label: c.name, href: `/categoria/${c.slug}` })),
    })),
    { label: "Lançamentos", href: "/produtos?lancamentos=1" },
    { label: "Mais vendidos", href: "/produtos?ordem=mais-vendidos" },
    { label: "Ofertas", href: "/produtos?promocao=1", highlight: true },
  ];
}
