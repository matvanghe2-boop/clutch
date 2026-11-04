import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Un package-lock.json traîne dans le dossier utilisateur : on fixe la racine du projet.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
  // Les pages lisent l'instantané sur disque à chaque requête : il doit être
  // embarqué dans les fonctions déployées, quoi qu'en déduise le traçage.
  outputFileTracingIncludes: { "/**": ["./data/snapshot.json"] },
  async headers() {
    return [
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
