import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LOT C — la racine marketing cimolace.space tombe dans l'ASSISTANT IMMERSIF (le nouvel OS
  // d'entrée Cimolace). Migration douce : seule la HOME redirige ; /blog, /docs, /engines, /mbolo,
  // /liri, /contact… restent servis par le site marketing. 307 (temporaire) = réversible, non caché.
  async redirects() {
    return [
      { source: "/", destination: "https://app.cimolace.space/creer-organisation/agent", permanent: false },
    ];
  },
};

export default nextConfig;
