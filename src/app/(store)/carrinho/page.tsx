import type { Metadata } from "next";
import { CartPageClient } from "./CartPageClient";

export const metadata: Metadata = { title: "Sacola de compras", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page pb-20 pt-10">
      <h1 className="heading-display mb-8 text-4xl sm:text-5xl">Sua sacola</h1>
      <CartPageClient />
    </div>
  );
}
