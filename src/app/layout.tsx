import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist } from "next/font/google";
import Script from "next/script";
import { MotionRoot } from "@/components/Motion";
import { PullToRefresh } from "@/components/PullToRefresh";
import { NavSkeleton, SiteFooter, SiteHeader } from "@/components/site";
import { markSvg } from "@/lib/brand-mark";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

/**
 * Active les entrées avant le premier affichage, et les retire si le JavaScript du site ne
 * démarre pas à temps (réseau coupé, erreur) : une animation ne doit jamais cacher le contenu.
 */
const MOTION_BOOT =
  "(function(){var h=document.documentElement;h.classList.add('motion');setTimeout(function(){if(!h.hasAttribute('data-motion-ready'))h.classList.remove('motion')},6000);" +
  // Les couleurs de l'équipe préférée, posées avant le premier affichage : pas d'éclair aux couleurs par défaut.
  "try{var f=JSON.parse(localStorage.getItem('clutch:fav')||'null');if(f&&f.a){h.style.setProperty('--fav-a',f.a);h.style.setProperty('--fav-b',f.b||f.a);h.setAttribute('data-fav',f.id)}}catch(e){}})()";

/** La passe de secours tourne après l'envoi de la page (voir SiteHeader) : elle a besoin de temps. */
export const maxDuration = 300;

export const metadata: Metadata = {
  title: { default: "Clutch", template: "%s · Clutch" },
  description: "Mes équipes esport : prochains matchs, résultats, poules et brackets.",
  // Installée depuis Safari : plein écran, barre d'état transparente sur le fond sombre.
  appleWebApp: { capable: true, title: "Clutch", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#07090d",
  // Nécessaire pour que env(safe-area-inset-*) ait une valeur sur iPhone.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // L'écran d'ouverture Orbit bloque le défilement (style sur <html>) avant l'hydratation.
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geist.variable} ${barlow.variable} min-h-dvh font-sans antialiased`}>
        {/* Avant le premier affichage : sans ce script, tout reste visible et rien n'est caché en attendant d'entrer. */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
        <div className="ambient" aria-hidden>
          <canvas className="scene" />
        </div>
        <MotionRoot />
        <div id="fx-layer" aria-hidden />
        <PullToRefresh mark={markSvg({ rounded: true, id: "tirer" })} />
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
        <main className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
          <NavSkeleton />
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
