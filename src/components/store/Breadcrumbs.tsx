import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { jsonLd as toJsonLd } from "@/lib/safe";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: `${publicEnv.siteUrl}${it.href}` } : {}),
    })),
  };
  return (
    <nav aria-label="Trilha de navegação">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {it.href ? (
              <Link href={it.href} className="hover:text-ink">
                {it.label}
              </Link>
            ) : (
              <span className="font-medium text-ink" aria-current="page">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
