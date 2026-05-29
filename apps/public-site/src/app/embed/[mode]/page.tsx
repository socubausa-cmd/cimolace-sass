import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmbedClient } from "./embed-client";

/**
 * Route iframe MEDOS (Mode C.2).
 *
 * URL : /embed/<mode>?tenant=<slug>&primary=<hex>
 *
 * Sert le widget MEDOS en pleine page, prévu pour être inséré dans une
 * `<iframe src=...>` côté site client. Avantage vs widget JS : isolation
 * totale (CSP, CSS), zéro impact sur le site host.
 *
 * Sécurité :
 *  - L'auth se fait côté client : la page appelle POST /v1/medos/embed/token
 *    avec son Origin (= le site host via fenêtre parent). Si le host est
 *    whitelisté dans tenant_domains, le token est délivré.
 *  - Pas de token dans l'URL pour cette version (préviendrait des fuites de
 *    logs). Le sub_patient_id pour cas avancés sera passé via postMessage.
 *
 * Communication parent ↔ iframe via postMessage :
 *  - parent → iframe : { type: 'medos:theme', primary: '#hex' }
 *  - iframe → parent : { type: 'medos:ready' }
 *  - iframe → parent : { type: 'medos:height', height: 720 }
 *  - iframe → parent : { type: 'medos:event', name: 'note-read', payload: ... }
 */

const VALID_MODES = [
  "patient-portal",
  "consent-form",
  "intake-form",
  "health-tracker",
  "appointment-booker",
] as const;

type Mode = (typeof VALID_MODES)[number];

function isValidMode(s: string): s is Mode {
  return (VALID_MODES as readonly string[]).includes(s);
}

// Title is intentionally generic — the iframe sits inside the tenant's
// site and the parent page already carries the tenant brand in the
// browser tab. No "Cimolace" / "MEDOS" mention here so an inspect-element
// curious patient doesn't see infrastructure brand names.
export const metadata: Metadata = {
  title: "Mon espace patient",
  description: "Portail patient sécurisé",
  robots: { index: false, follow: false },
};

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ tenant?: string; primary?: string }>;
}) {
  const { mode } = await params;
  const sp = await searchParams;

  if (!isValidMode(mode)) {
    notFound();
  }

  const tenant = sp.tenant ?? "";
  const primary = sp.primary ?? "4f46e5";

  if (!tenant) {
    return (
      <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          Paramètre <code>tenant</code> manquant
        </h1>
        <p style={{ marginTop: 8, color: "#6b7280" }}>
          URL attendue :
          <br />
          <code>
            /embed/{mode}?tenant=&lt;slug&gt;
          </code>
        </p>
      </main>
    );
  }

  return <EmbedClient mode={mode} tenant={tenant} primary={`#${primary}`} />;
}
