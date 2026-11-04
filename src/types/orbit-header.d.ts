// Déclare <orbit-header> auprès de TypeScript : c'est un Web Component défini à
// l'exécution par le script du réseau Orbit (public/orbit-header.js), que JSX
// ne peut pas connaître seul.
//
// React 19 a sorti les types JSX du namespace global : il faut augmenter
// `react` lui-même, un `declare global { namespace JSX }` n'est plus vu.
import type React from "react";

type OrbitHeaderProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  "app-name"?: string;
  theme?: "space" | "music" | "finance" | "media" | "travel" | "video" | "study" | "gaming" | "esport" | "default";
  accent?: string;
  "accent-var"?: string;
  "hub-url"?: string;
  github?: string;
  links?: string;
  badge?: string;
  appearance?: "auto" | "light" | "dark";
  solid?: boolean;
  static?: boolean;
  compact?: boolean;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "orbit-header": OrbitHeaderProps;
    }
  }
}

export {};
