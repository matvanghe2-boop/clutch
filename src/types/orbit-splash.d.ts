// Déclare <orbit-splash> auprès de TypeScript : c'est un Web Component défini à
// l'exécution par le script du réseau Orbit (public/orbit-splash.js). Même
// remarque que pour le header sur les types JSX de React 19.
import type React from "react";

type OrbitSplashProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  "app-name"?: string;
  theme?: "space" | "music" | "finance" | "media" | "travel" | "video" | "study" | "gaming" | "esport" | "default";
  accent?: string;
  "accent-var"?: string;
  tagline?: string;
  duration?: string | number;
  once?: "session" | "always";
  appearance?: "auto" | "light" | "dark";
  manual?: boolean;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "orbit-splash": OrbitSplashProps;
    }
  }
}

export {};
