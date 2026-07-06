import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LOT C — l'ASSISTANT IMMERSIF est servi À cimolace.space (l'URL RESTE cimolace.space) via un
  // proxy (rewrite) vers l'app (app.cimolace.space). Migration douce : seule la HOME + les chemins
  // de l'assistant (/creer-organisation/*, /assets/*) sont proxifiés ; /blog, /docs, /engines,
  // /mbolo, /liri, /contact… restent servis par le site marketing.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "https://app.cimolace.space/creer-organisation/agent" },
        { source: "/creer-organisation/:path*", destination: "https://app.cimolace.space/creer-organisation/:path*" },
        { source: "/assets/:path*", destination: "https://app.cimolace.space/assets/:path*" },
      ],
    };
  },
};

export default nextConfig;
