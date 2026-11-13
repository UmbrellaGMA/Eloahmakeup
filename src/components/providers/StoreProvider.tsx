"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import type { CartView } from "@/lib/types";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface InstallmentConfig {
  max: number;
  min: number;
}

interface StoreContextValue {
  cart: CartView | null;
  cartLoading: boolean;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, variantId: string | null, quantity?: number) => Promise<boolean>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string | null) => Promise<boolean>;
  favorites: Set<string>;
  isAuthenticated: boolean;
  toggleFavorite: (productId: string) => Promise<void>;
  toast: (message: string, tone?: ToastTone) => void;
  installments: InstallmentConfig;
}

const StoreContext = createContext<StoreContextValue | null>(null);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error ?? "Algo deu errado. Tente novamente.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as T;
}

export function StoreProvider({ children, installments }: { children: ReactNode; installments: InstallmentConfig }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartView | null>(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      setCart(await api<CartView>("/api/cart"));
    } catch {
      setCart(null);
    } finally {
      setCartLoading(false);
    }
  }, []);

  const refreshFavorites = useCallback(async () => {
    try {
      const r = await api<{ ids: string[]; authenticated: boolean }>("/api/favorites");
      setFavorites(new Set(r.ids));
      setAuthenticated(r.authenticated);
    } catch {
      /* visitante */
    }
  }, []);

  useEffect(() => {
    // Carregamento inicial do carrinho persistido no servidor
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCart();
    void refreshFavorites();
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void refreshCart();
        void refreshFavorites();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refreshCart, refreshFavorites]);

  const addToCart = useCallback(
    async (productId: string, variantId: string | null, quantity = 1) => {
      try {
        const r = await api<CartView & { notice?: string | null }>("/api/cart", {
          method: "POST",
          body: JSON.stringify({ product_id: productId, variant_id: variantId, quantity }),
        });
        setCart(r);
        setCartOpen(true);
        if (r.notice) toast(r.notice, "info");
        return true;
      } catch (e) {
        toast((e as Error).message, "error");
        return false;
      }
    },
    [toast],
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        setCart(await api<CartView>("/api/cart", { method: "PATCH", body: JSON.stringify({ item_id: itemId, quantity }) }));
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
    [toast],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      try {
        setCart(await api<CartView>(`/api/cart?item_id=${itemId}`, { method: "DELETE" }));
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
    [toast],
  );

  const applyCoupon = useCallback(
    async (code: string | null) => {
      try {
        const r = await api<CartView>("/api/cart/coupon", { method: "POST", body: JSON.stringify({ code }) });
        setCart(r);
        if (code) toast("Cupom aplicado!");
        return true;
      } catch (e) {
        toast((e as Error).message, "error");
        return false;
      }
    },
    [toast],
  );

  const toggleFavorite = useCallback(
    async (productId: string) => {
      const had = favorites.has(productId);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (had) next.delete(productId);
        else next.add(productId);
        return next;
      });
      try {
        const r = await api<{ favorited: boolean }>("/api/favorites", { method: "POST", body: JSON.stringify({ product_id: productId }) });
        toast(r.favorited ? "Adicionado aos favoritos" : "Removido dos favoritos", "info");
      } catch (e) {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (had) next.add(productId);
          else next.delete(productId);
          return next;
        });
        if ((e as { status?: number }).status === 401) {
          toast("Entre na sua conta para salvar favoritos.", "info");
          router.push(`/entrar?next=${encodeURIComponent(window.location.pathname)}`);
        } else toast((e as Error).message, "error");
      }
    },
    [favorites, router, toast],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      cart,
      cartLoading,
      cartOpen,
      setCartOpen,
      refreshCart,
      addToCart,
      updateItem,
      removeItem,
      applyCoupon,
      favorites,
      isAuthenticated,
      toggleFavorite,
      toast,
      installments,
    }),
    [cart, cartLoading, cartOpen, refreshCart, addToCart, updateItem, removeItem, applyCoupon, favorites, isAuthenticated, toggleFavorite, toast, installments],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-fade-up rounded-full px-5 py-3 text-sm font-medium shadow-lift ${
              t.tone === "error" ? "bg-danger text-white" : t.tone === "info" ? "bg-white text-ink ring-1 ring-line" : "bg-ink text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
