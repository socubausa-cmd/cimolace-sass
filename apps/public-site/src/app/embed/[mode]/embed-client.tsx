"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Client iframe — charge le widget JS et le mounte dans la page.
 *
 * Astuce d'intégration : on monte une <div> ciblée et on injecte
 * dynamiquement le script embed.js (le même qu'en Mode C.1). Le script
 * lit data-tenant / data-mode, appelle /v1/medos/embed/token (CORS contre
 * l'Origin de l'iframe = le domaine cimolace), et rend le widget.
 *
 * En mode iframe, l'Origin est cimolace.com — donc cimolace.com doit être
 * dans tenant_domains du tenant cible. C'est fait automatiquement à
 * l'activation MEDOS (à câbler dans le provisioning).
 *
 * Cache : on hide le header/footer global de public-site via une feuille
 * de style injectée — la page iframe doit être full-bleed.
 */
export function EmbedClient({
  mode,
  tenant,
  primary,
}: {
  mode: string;
  tenant: string;
  primary: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "https://api.cimolace.space";

  useEffect(() => {
    if (!ref.current || scriptLoaded) return;

    const script = document.createElement("script");
    script.src = "/medos/v1/embed.js";
    script.setAttribute("data-tenant", tenant);
    script.setAttribute("data-mode", mode);
    script.setAttribute("data-api-base", apiBase);
    script.setAttribute("data-target", "#medos-iframe-mount");
    script.setAttribute("data-primary-color", primary);
    script.async = true;
    document.body.appendChild(script);
    setScriptLoaded(true);

    // Notifier le parent que le widget est prêt
    const readyTimer = setTimeout(() => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: "medos:ready" }, "*");
      }
    }, 100);

    // Auto-resize : envoie la hauteur au parent
    const ro = new ResizeObserver(() => {
      const h = document.body.scrollHeight;
      if (window.parent !== window) {
        window.parent.postMessage({ type: "medos:height", height: h }, "*");
      }
    });
    ro.observe(document.body);

    return () => {
      clearTimeout(readyTimer);
      ro.disconnect();
    };
  }, [mode, tenant, primary, apiBase, scriptLoaded]);

  return (
    <>
      {/*
        Hide the global cimolace.com chrome — this page must be full-bleed
        for iframe usage. We can't strip the root layout, so we override CSS.
      */}
      <style>{`
        body { background: transparent !important; }
        body > header, body > footer, body > nav { display: none !important; }
        body[data-medos-embed] { padding: 0 !important; margin: 0 !important; }
        main { padding: 0 !important; }
      `}</style>
      <main
        style={{
          minHeight: "100vh",
          background: "transparent",
          padding: 16,
        }}
      >
        <div id="medos-iframe-mount" ref={ref} />
      </main>
    </>
  );
}
