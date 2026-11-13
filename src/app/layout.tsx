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
    "Maquiagens e acessórios de beleza com curadoria Eloah Make Up. Pague com Pix ou cartão em até 6x e receba em todo o Brasil.",
  applicationName: "Eloah Make Up",
  keywords: ["maquiagem", "make up", "batom", "base", "pincéis", "acessórios de beleza", "Eloah Make Up"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Eloah Make Up",
    title: "Eloah Make Up — Maquiagens e acessórios",
    description: "Maquiagens e acessórios de beleza com curadoria Eloah Make Up.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
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
