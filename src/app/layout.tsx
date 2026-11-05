import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist } from "next/font/google";
import Script from "next/script";
import { SiteFooter, SiteHeader } from "@/components/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

/** La passe de secours tourne après l'envoi de la page (voir SiteHeader) : elle a besoin de temps. */
export const maxDuration = 300;

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
    // L'écran d'ouverture Orbit bloque le défilement (style sur <html>) avant l'hydratation.
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geist.variable} ${barlow.variable} min-h-dvh font-sans antialiased`}>
        {/*
          Signature du réseau Orbit : écran d'ouverture et header, avec le
          pingouin esport. Copies servies depuis public/ (et mises en cache par
          le service worker), pas depuis le hub : l'appli installée s'ouvre
          aussi hors connexion. Après une évolution dans Orbit, recopier les
          deux fichiers.
          « beforeInteractive » : chargé plus tard, le splash laisserait voir la
          page avant de la couvrir.
        */}
        <Script src="/orbit-splash.js" strategy="beforeInteractive" />
        {/*
          L'élément est servi tel quel mais React n'en vérifie pas le contenu :
          dès le deuxième chargement dans un onglet, le script le retire avant
          l'hydratation (une seule mise en scène par onglet). Rendu par React,
          il manquerait alors à l'appel et React reconstruirait toute la page.
        */}
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: '<orbit-splash app-name="Clutch" theme="esport"></orbit-splash>' }} />
        <Script src="/orbit-header.js" strategy="afterInteractive" />
        {/* Sur iPhone, en appli, la barre d'état chevauche le haut de page : le header Orbit s'en écarte. */}
        <div className="pt-[env(safe-area-inset-top)]">
          {/* `static` : il défile avec la page, l'en-tête de Clutch reste seul collé en haut. */}
          <orbit-header app-name="Clutch" theme="esport" compact static />
        </div>
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
