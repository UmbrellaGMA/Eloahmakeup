import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "Eloah Make Up — Maquiagens e acessórios",
    template: "%s | Eloah Make Up",
  },
  description:
    "Loja online de maquiagens e acessórios de beleza: bases, batons, paletas de sombras, pincéis, esponjas e necessaires. Pague com Pix ou em até 6x no cartão e receba em todo o Brasil.",
  applicationName: "Eloah Make Up",
  keywords: [
    "Eloah Make Up",
    "maquiagem",
    "loja de maquiagem online",
    "make up",
    "batom",
    "base líquida",
    "paleta de sombras",
    "pincéis de maquiagem",
    "esponja de maquiagem",
    "acessórios de beleza",
  ],
  category: "beauty",
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Eloah Make Up",
    url: "/",
    title: "Eloah Make Up — Maquiagens e acessórios",
    description: "Maquiagens e acessórios de beleza com curadoria Eloah Make Up. Pix ou até 6x no cartão, entrega em todo o Brasil.",
  },
  twitter: { card: "summary_large_image", title: "Eloah Make Up — Maquiagens e acessórios" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  // Google Search Console: defina GOOGLE_SITE_VERIFICATION na Vercel com o código fornecido pelo Google
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#0f0c13",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} antialiased`}>
      <body className="min-h-dvh bg-white">{children}</body>
    </html>
  );
}
