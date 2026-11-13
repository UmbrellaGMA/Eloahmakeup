"use client";

import { Heart } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";

export function FavoriteButton({ productId, className = "", withLabel = false }: { productId: string; className?: string; withLabel?: boolean }) {
  const { favorites, toggleFavorite } = useStore();
  const active = favorites.has(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleFavorite(productId);
      }}
      aria-pressed={active}
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={`inline-flex items-center justify-center gap-2 transition ${className}`}
    >
      <Heart className={`h-[18px] w-[18px] transition ${active ? "fill-lilac-500 text-lilac-500 scale-110" : "text-ink"}`} strokeWidth={1.6} />
      {withLabel && <span className="text-sm font-medium">{active ? "Favoritado" : "Favoritar"}</span>}
    </button>
  );
}
