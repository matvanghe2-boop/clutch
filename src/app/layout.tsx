import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Clutch", template: "%s · Clutch" },
  description: "Mes équipes esport : prochains matchs, résultats, poules et brackets.",
  // Installée depuis Safari : plein écran, barre d'état transparente sur le fond sombre.
  appleWebApp: { capable: true, title: "Clutch", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  // Nécessaire pour que env(safe-area-inset-*) ait une valeur sur iPhone.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geist.variable} ${barlow.variable} min-h-dvh font-sans antialiased`}>
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
