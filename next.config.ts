import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Un package-lock.json traîne dans le dossier utilisateur : on fixe la racine du projet.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
  async headers() {
    return [
      {
        // Le navigateur doit toujours revérifier le service worker : c'est lui
        // qui décide de ce qui est servi hors connexion.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
