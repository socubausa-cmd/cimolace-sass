import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, CodeTabs } from "./CodeTabs";
import { Sidebar } from "./Sidebar";

export const metadata: Metadata = {
  title: "Documentation LIRI — Intégration développeur | Cimolace",
  description:
    "Doc complète pour intégrer LIRI : SDK JavaScript, embed widget, API REST publique, webhooks, LIRI Credits. Exemples WordPress, Wix, React, Next.js, cURL, Python.",
};

export default function LiriDocPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero ribbon */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-indigo-600">
            <Link href="/liri" className="hover:underline">
              LIRI
            </Link>
            <span>/</span>
            <span>Documentation développeur</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Intégrer LIRI dans votre application
          </h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            LIRI est le moteur live & IA de Cimolace. Il s&apos;intègre dans
            n&apos;importe quel site existant via SDK JavaScript, iframe embed, ou API
            REST. Cette doc couvre tout : quickstart, SDK, embed, API publique,
            webhooks, et facturation LIRI Credits.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a
              href="#quickstart"
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
            >
              Quickstart 5 min →
            </a>
            <a
              href="https://api.cimolace.space/docs"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Swagger API
            </a>
            <a
              href="https://embed.cimolace.space/live/demo"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Démo live
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl gap-12 px-6 py-12 lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <Sidebar />
        </aside>

        <main className="docs-content max-w-3xl">
          <style>{`
            .docs-content section { padding-bottom: 3rem; }
            .docs-content h2 { scroll-margin-top: 6rem; font-size: 1.5rem; font-weight: 700; color: rgb(15 23 42); border-bottom: 1px solid rgb(226 232 240); padding-bottom: 0.5rem; margin: 2rem 0 1rem; }
            .docs-content h3 { scroll-margin-top: 6rem; font-size: 1.125rem; font-weight: 600; color: rgb(15 23 42); margin: 1.5rem 0 0.5rem; }
            .docs-content p { color: rgb(71 85 105); line-height: 1.7; margin: 0.75rem 0; }
            .docs-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
            .docs-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.75rem 0; }
            .docs-content li { color: rgb(71 85 105); line-height: 1.7; margin: 0.25rem 0; }
            .docs-content li strong { color: rgb(15 23 42); }
            .docs-content code { background: rgb(241 245 249); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.8125rem; font-family: ui-monospace, Menlo, monospace; color: rgb(15 23 42); }
            .docs-content a { color: rgb(79 70 229); text-decoration: none; }
            .docs-content a:hover { text-decoration: underline; }
            .docs-content strong { color: rgb(15 23 42); }
            .docs-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
            .docs-content table th, .docs-content table td { border: 1px solid rgb(226 232 240); padding: 0.5rem 0.75rem; text-align: left; }
            .docs-content table th { background: rgb(248 250 252); font-weight: 600; color: rgb(15 23 42); }
            .docs-content table code { font-size: 0.75rem; }
          `}</style>

          {/* ── OVERVIEW ────────────────────────────────────────────────── */}
          <section id="overview">
            <h2>Vue d&apos;ensemble</h2>
            <p>
              <strong>LIRI</strong> est le moteur live & IA universel de Cimolace.
              Il réunit vidéo HD (LiveKit), Studio créateur, Smartboard interactif,
              Masterclass Factory, multilingue temps réel, recall &amp; transcription,
              TTS/STT premium, le tout exposé via 3 canaux d&apos;intégration :
            </p>
            <ul>
              <li>
                <strong>SDK JavaScript</strong> — 6 lignes HTML collées dans votre site.
              </li>
              <li>
                <strong>Embed widget (iframe)</strong> — pour les CMS qui bloquent les
                scripts tiers (Webflow strict, Squarespace).
              </li>
              <li>
                <strong>API REST publique</strong> — pour reconstruire votre propre UI
                au-dessus de LIRI.
              </li>
            </ul>
            <p>
              Tous les modes s&apos;authentifient via une <strong>clé API tenant</strong>{" "}
              (préfixe <code>lk_</code>) générée dans votre dashboard. La facturation IA
              passe par <strong>LIRI Credits</strong> (quota mensuel inclus dans votre
              plan + packs de recharge).
            </p>
            <h3>URLs officielles</h3>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>URL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>API REST</td>
                  <td>
                    <code>https://api.cimolace.space</code>
                  </td>
                </tr>
                <tr>
                  <td>Embed widget</td>
                  <td>
                    <code>https://embed.cimolace.space</code>
                  </td>
                </tr>
                <tr>
                  <td>SDK JavaScript</td>
                  <td>
                    <code>https://cimolace.space/liri-sdk.js</code>
                  </td>
                </tr>
                <tr>
                  <td>Dashboard tenant</td>
                  <td>
                    <code>https://cimolace.space/tenant/admin</code>
                  </td>
                </tr>
                <tr>
                  <td>Swagger / OpenAPI</td>
                  <td>
                    <code>https://api.cimolace.space/docs</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── QUICKSTART ──────────────────────────────────────────────── */}
          <section id="quickstart">
            <h2>Quickstart (5 minutes)</h2>
            <p>
              Du zéro à un live LIRI dans votre site en 5 étapes.
            </p>
            <h3>1. Créez votre tenant</h3>
            <p>
              Rendez-vous sur{" "}
              <a href="https://cimolace.space/onboarding">cimolace.space/onboarding</a>,
              créez votre espace (gratuit, 500 crédits IA offerts) et notez votre slug
              tenant (ex : <code>mon-ecole</code>).
            </p>
            <h3>2. Générez une clé API publique</h3>
            <p>
              Dans le dashboard tenant → <strong>Réglages → Clés API</strong>, créez une
              clé publique <code>lk_pub_...</code> (utilisable côté front, scope
              limité). Pour les opérations sensibles côté serveur, utilisez une clé{" "}
              <code>lk_sec_...</code>.
            </p>
            <h3>3. Collez le snippet dans votre site</h3>
            <CodeBlock
              lang="html"
              code={`<script src="https://cimolace.space/liri-sdk.js"></script>
<div id="liri-live" data-tenant="mon-ecole" data-mode="live"></div>
<script>
  LIRI.init({
    tenant: "mon-ecole",
    apiKey: "lk_pub_xxxxxxxxxxxx"
  });
  LIRI.start("liri-live");
</script>`}
            />
            <h3>4. Ouvrez votre page</h3>
            <p>
              LIRI affiche le bouton &laquo; Rejoindre la session &raquo;. Au clic, il
              ouvre une room LiveKit HD avec chat, partage d&apos;écran, et l&apos;assistant
              IA actif.
            </p>
            <h3>5. (Optionnel) Configurez un webhook</h3>
            <p>
              Dans <strong>Réglages → Webhooks</strong>, ajoutez l&apos;URL de votre
              endpoint et choisissez les events (
              <code>session.started</code>, <code>session.ended</code>,
              <code>transcript.ready</code>...). Voir{" "}
              <a href="#webhooks-config">section Webhooks</a>.
            </p>
          </section>

          {/* ── ARCHITECTURE ────────────────────────────────────────────── */}
          <section id="architecture">
            <h2>Architecture</h2>
            <p>
              LIRI tourne sur 3 couches techniques découplées :
            </p>
            <ul>
              <li>
                <strong>API NestJS</strong> (<code>api.cimolace.space</code>) — héberge
                la logique métier, les endpoints publics, le webhook Stripe, et fait le
                pont avec Supabase + LiveKit.
              </li>
              <li>
                <strong>Edge Functions Supabase</strong> — pour les opérations IA
                latentes (TTS, STT, multilang, génération slides, Smartboard).
              </li>
              <li>
                <strong>LiveKit Cloud</strong> — serveurs WebRTC SFU pour la vidéo HD
                multi-participants.
              </li>
            </ul>
            <p>
              Le SDK et l&apos;embed côté client communiquent <em>uniquement</em> avec
              l&apos;API REST. Aucune donnée tenant ne transite en clair.
            </p>
          </section>

          {/* ── MODES ───────────────────────────────────────────────────── */}
          <section id="modes">
            <h2>Modes LIRI</h2>
            <p>
              LIRI expose 6 modes principaux. Vous les sélectionnez via{" "}
              <code>data-mode</code> sur le SDK ou via l&apos;URL d&apos;embed.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Description</th>
                  <th>data-mode</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Live</td>
                  <td>Visio HD multi-participants, chat, partage écran</td>
                  <td>
                    <code>live</code>
                  </td>
                </tr>
                <tr>
                  <td>Studio</td>
                  <td>Présentation slides + IA assistant live</td>
                  <td>
                    <code>studio</code>
                  </td>
                </tr>
                <tr>
                  <td>Smartboard</td>
                  <td>Tableau blanc collaboratif + OCR + IA</td>
                  <td>
                    <code>smartboard</code>
                  </td>
                </tr>
                <tr>
                  <td>Masterclass</td>
                  <td>Cours scénarisé généré par IA, format série</td>
                  <td>
                    <code>masterclass</code>
                  </td>
                </tr>
                <tr>
                  <td>Coach</td>
                  <td>1-to-1 coaching avec assistant IA dédié</td>
                  <td>
                    <code>coach</code>
                  </td>
                </tr>
                <tr>
                  <td>Webinar</td>
                  <td>Live broadcast 1-to-many, chat modéré, billetterie</td>
                  <td>
                    <code>webinar</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── AUTH ────────────────────────────────────────────────────── */}
          <section id="auth">
            <h2>Authentification</h2>
            <p>
              LIRI utilise 2 types de clés API et 1 type de JWT participant.
            </p>
            <h3>Clés API tenant</h3>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Préfixe</th>
                  <th>Usage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Publique</td>
                  <td>
                    <code>lk_pub_</code>
                  </td>
                  <td>
                    Front (SDK, embed). Scope limité : démarrer sessions, lire pricing.
                  </td>
                </tr>
                <tr>
                  <td>Secrète</td>
                  <td>
                    <code>lk_sec_</code>
                  </td>
                  <td>
                    Serveur uniquement. Tout l&apos;API REST, masterclass, exports.
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              <strong>Header HTTP :</strong> <code>X-API-Key: lk_sec_...</code>
            </p>
            <h3>JWT participant</h3>
            <p>
              Pour identifier un utilisateur final (nom affiché, rôle host/viewer,
              avatar), votre serveur génère un JWT signé avec votre clé secrète, puis
              passe ce JWT au SDK :
            </p>
            <CodeBlock
              lang="javascript"
              code={`LIRI.init({
  tenant: "mon-ecole",
  apiKey: "lk_pub_...",
  userToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
});`}
            />
          </section>

          {/* ── SDK ─────────────────────────────────────────────────────── */}
          <section id="sdk">
            <h2>SDK JavaScript</h2>
            <p>
              Le SDK <code>liri-sdk.js</code> (~24 ko gzip) gère pour vous : chargement
              du widget, auth, WebRTC, fallbacks, theming. Compatible tout navigateur
              evergreen.
            </p>
            <h3>Installation</h3>
            <CodeBlock
              lang="html"
              code={`<script src="https://cimolace.space/liri-sdk.js" defer></script>`}
            />
            <h3>API</h3>
            <CodeTabs
              tabs={[
                {
                  label: "Init + Start",
                  lang: "javascript",
                  code: `LIRI.init({
  tenant: "mon-ecole",
  apiKey: "lk_pub_xxxxxxxxxxxx",
  theme: "light",        // ou "dark" | "auto"
  locale: "fr",          // fr, en, es, de, it, pt, nl, ar, ja, ko, zh, ru
});

LIRI.start("liri-live", {
  mode: "live",          // live | studio | smartboard | masterclass | coach | webinar
  room: "salle-101",     // identifiant unique de session
  role: "host",          // host | viewer
});`,
                },
                {
                  label: "Events",
                  lang: "javascript",
                  code: `LIRI.on("session.started", (e) => console.log("Started", e.sessionId));
LIRI.on("participant.joined", (e) => console.log("+1", e.name));
LIRI.on("transcript.partial", (e) => console.log(e.text));
LIRI.on("transcript.final", (e) => saveTranscript(e));
LIRI.on("session.ended", (e) => redirectTo("/replay/" + e.sessionId));
LIRI.on("credits.low", (e) => alert("Crédits LIRI faibles : " + e.remaining));`,
                },
                {
                  label: "Programmatique",
                  lang: "javascript",
                  code: `// Contrôle manuel sans bouton "Join"
await LIRI.join({ room: "salle-101", role: "host" });

// Contrôles
LIRI.muteAudio(true);
LIRI.muteVideo(false);
LIRI.shareScreen();
LIRI.startRecording();

// Smartboard / Studio
LIRI.openSmartboard();
LIRI.loadSlides("https://mondrive.com/slides.pdf");

// Sortie
await LIRI.leave();
LIRI.destroy();`,
                },
              ]}
            />
          </section>

          {/* ── EMBED ───────────────────────────────────────────────────── */}
          <section id="embed">
            <h2>Embed widget (iframe)</h2>
            <p>
              Quand votre CMS interdit les scripts tiers (Squarespace, Webflow strict,
              certains LMS), utilisez l&apos;embed iframe. Tout fonctionne pareil mais
              hébergé sous <code>embed.cimolace.space</code>.
            </p>
            <h3>URL format</h3>
            <CodeBlock
              lang="text"
              code={`https://embed.cimolace.space/{mode}?tenant={slug}&apiKey={pub}&room={id}&role={host|viewer}`}
            />
            <h3>Exemple</h3>
            <CodeBlock
              lang="html"
              code={`<iframe
  src="https://embed.cimolace.space/live?tenant=mon-ecole&apiKey=lk_pub_xxx&room=salle-101&role=host"
  width="100%"
  height="640"
  allow="camera; microphone; display-capture; autoplay"
  style="border:0; border-radius:12px"
></iframe>`}
            />
            <h3>Paramètres URL</h3>
            <table>
              <thead>
                <tr>
                  <th>Paramètre</th>
                  <th>Requis</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>tenant</code>
                  </td>
                  <td>oui</td>
                  <td>Slug de votre tenant</td>
                </tr>
                <tr>
                  <td>
                    <code>apiKey</code>
                  </td>
                  <td>oui</td>
                  <td>
                    Clé publique <code>lk_pub_...</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>room</code>
                  </td>
                  <td>oui</td>
                  <td>Identifiant unique de session</td>
                </tr>
                <tr>
                  <td>
                    <code>role</code>
                  </td>
                  <td>oui</td>
                  <td>
                    <code>host</code> ou <code>viewer</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>theme</code>
                  </td>
                  <td>non</td>
                  <td>
                    <code>light</code> | <code>dark</code> | <code>auto</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>locale</code>
                  </td>
                  <td>non</td>
                  <td>
                    <code>fr</code>, <code>en</code>, <code>es</code>...
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>userToken</code>
                  </td>
                  <td>non</td>
                  <td>JWT participant signé (voir Auth)</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── WORDPRESS ───────────────────────────────────────────────── */}
          <section id="wordpress">
            <h2>WordPress</h2>
            <p>
              2 méthodes : un shortcode via le plugin LIRI officiel, ou collage manuel
              du SDK.
            </p>
            <h3>Méthode A — Plugin (recommandé)</h3>
            <ol>
              <li>
                Téléchargez <code>liri-wp.zip</code> depuis votre dashboard tenant.
              </li>
              <li>WP Admin → Extensions → Ajouter → Téléverser le ZIP → Activer.</li>
              <li>
                Réglages → LIRI : collez votre tenant slug + clé{" "}
                <code>lk_pub_...</code>.
              </li>
              <li>Dans n&apos;importe quelle page/article :</li>
            </ol>
            <CodeBlock
              lang="text"
              code={`[liri mode="live" room="cours-maths-101"]`}
            />
            <h3>Méthode B — SDK manuel</h3>
            <p>
              Activez le bloc HTML personnalisé Gutenberg et collez le quickstart
              ci-dessus.
            </p>
          </section>

          {/* ── WIX ─────────────────────────────────────────────────────── */}
          <section id="wix">
            <h2>Wix</h2>
            <p>
              Wix supporte l&apos;iframe via le widget <strong>HTML Embed</strong>{" "}
              (anciennement &laquo; iFrame &raquo;).
            </p>
            <ol>
              <li>
                Wix Editor → <strong>+ Ajouter</strong> → <strong>Embed</strong> →{" "}
                <strong>HTML iframe</strong>.
              </li>
              <li>Mode &laquo; URL externe &raquo;, collez l&apos;URL embed :</li>
            </ol>
            <CodeBlock
              lang="text"
              code={`https://embed.cimolace.space/live?tenant=mon-ecole&apiKey=lk_pub_xxx&room=salon-vip`}
            />
            <p>
              Wix bloque par défaut les permissions caméra/micro. Dans les paramètres
              du widget, cochez <em>Allow camera</em> + <em>Allow microphone</em> +{" "}
              <em>Allow display-capture</em>.
            </p>
          </section>

          {/* ── REACT ───────────────────────────────────────────────────── */}
          <section id="react">
            <h2>React / Next.js</h2>
            <p>
              Le SDK fonctionne en React via un effet d&apos;init. Voici un composant
              prêt à coller :
            </p>
            <CodeTabs
              tabs={[
                {
                  label: "Hook React",
                  lang: "tsx",
                  code: `"use client";
import { useEffect, useRef } from "react";

declare global { interface Window { LIRI: any } }

export function LiriLive({ tenant, apiKey, room, role = "viewer" }: {
  tenant: string; apiKey: string; room: string; role?: "host"|"viewer";
}) {
  const containerId = \`liri-\${room}\`;
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    const script = document.createElement("script");
    script.src = "https://cimolace.space/liri-sdk.js";
    script.async = true;
    script.onload = () => {
      window.LIRI.init({ tenant, apiKey });
      window.LIRI.start(containerId, { mode: "live", room, role });
      initialized.current = true;
    };
    document.head.appendChild(script);
    return () => { window.LIRI?.destroy?.(); };
  }, [tenant, apiKey, room, role, containerId]);

  return <div id={containerId} style={{ minHeight: 640 }} />;
}`,
                },
                {
                  label: "Usage Next.js",
                  lang: "tsx",
                  code: `import { LiriLive } from "@/components/LiriLive";

export default function CoursPage() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1>Cours du jour</h1>
      <LiriLive
        tenant="mon-ecole"
        apiKey={process.env.NEXT_PUBLIC_LIRI_PUB_KEY!}
        room="maths-101"
        role="viewer"
      />
    </div>
  );
}`,
                },
              ]}
            />
          </section>

          {/* ── API AUTH ────────────────────────────────────────────────── */}
          <section id="api-auth">
            <h2>API REST — Authentification</h2>
            <p>
              Toutes les requêtes au-delà des endpoints publics nécessitent une clé
              secrète tenant en header.
            </p>
            <CodeBlock
              lang="text"
              code={`X-API-Key: lk_sec_xxxxxxxxxxxxxxxxxxxxx`}
            />
            <p>
              Les endpoints publics (lecture pricing, packs) ne nécessitent aucune auth.
              Les endpoints "tenant-scoped" (data utilisateur, sessions) demandent en
              plus :
            </p>
            <CodeBlock
              lang="text"
              code={`X-Tenant-Slug: mon-ecole`}
            />
          </section>

          {/* ── API SESSIONS ────────────────────────────────────────────── */}
          <section id="api-sessions">
            <h2>Sessions live</h2>
            <h3>POST /liri/sessions — Créer une session</h3>
            <CodeTabs
              tabs={[
                {
                  label: "cURL",
                  lang: "bash",
                  code: `curl -X POST https://api.cimolace.space/liri/sessions \\
  -H "X-API-Key: lk_sec_xxxxxxx" \\
  -H "X-Tenant-Slug: mon-ecole" \\
  -H "Content-Type: application/json" \\
  -d '{
    "mode": "live",
    "title": "Cours de maths — Algèbre",
    "scheduled_at": "2026-06-01T14:00:00Z",
    "max_participants": 30,
    "record": true
  }'`,
                },
                {
                  label: "JavaScript",
                  lang: "javascript",
                  code: `const res = await fetch("https://api.cimolace.space/liri/sessions", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.LIRI_SEC_KEY,
    "X-Tenant-Slug": "mon-ecole",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    mode: "live",
    title: "Cours de maths — Algèbre",
    scheduled_at: "2026-06-01T14:00:00Z",
    record: true
  })
});
const { id, room_url } = await res.json();`,
                },
                {
                  label: "Python",
                  lang: "python",
                  code: `import requests, os

resp = requests.post(
    "https://api.cimolace.space/liri/sessions",
    headers={
        "X-API-Key": os.environ["LIRI_SEC_KEY"],
        "X-Tenant-Slug": "mon-ecole",
        "Content-Type": "application/json",
    },
    json={
        "mode": "live",
        "title": "Cours de maths — Algèbre",
        "scheduled_at": "2026-06-01T14:00:00Z",
        "record": True,
    },
)
session = resp.json()
print(session["id"], session["room_url"])`,
                },
                {
                  label: "PHP",
                  lang: "php",
                  code: `<?php
$ch = curl_init("https://api.cimolace.space/liri/sessions");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "X-API-Key: " . getenv("LIRI_SEC_KEY"),
    "X-Tenant-Slug: mon-ecole",
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "mode" => "live",
    "title" => "Cours de maths — Algèbre",
    "scheduled_at" => "2026-06-01T14:00:00Z",
    "record" => true,
  ]),
]);
$session = json_decode(curl_exec($ch), true);
echo $session["id"];`,
                },
              ]}
            />
            <h3>Réponse</h3>
            <CodeBlock
              lang="json"
              code={`{
  "id": "sess_abc123",
  "mode": "live",
  "title": "Cours de maths — Algèbre",
  "room_url": "https://embed.cimolace.space/live?tenant=mon-ecole&room=sess_abc123",
  "status": "scheduled",
  "scheduled_at": "2026-06-01T14:00:00Z",
  "max_participants": 30,
  "record": true,
  "created_at": "2026-05-29T11:30:00Z"
}`}
            />
            <h3>Autres endpoints sessions</h3>
            <table>
              <thead>
                <tr>
                  <th>Méthode</th>
                  <th>Endpoint</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>GET</td>
                  <td>
                    <code>/liri/sessions</code>
                  </td>
                  <td>Liste paginée</td>
                </tr>
                <tr>
                  <td>GET</td>
                  <td>
                    <code>/liri/sessions/:id</code>
                  </td>
                  <td>Détail + participants</td>
                </tr>
                <tr>
                  <td>PATCH</td>
                  <td>
                    <code>/liri/sessions/:id</code>
                  </td>
                  <td>Modifier titre, horaire, max</td>
                </tr>
                <tr>
                  <td>POST</td>
                  <td>
                    <code>/liri/sessions/:id/end</code>
                  </td>
                  <td>Terminer + générer replay</td>
                </tr>
                <tr>
                  <td>DELETE</td>
                  <td>
                    <code>/liri/sessions/:id</code>
                  </td>
                  <td>Annuler (avant démarrage)</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── API TOKENS ──────────────────────────────────────────────── */}
          <section id="api-tokens">
            <h2>Tokens participants</h2>
            <p>
              Générez un token participant signé pour identifier l&apos;utilisateur
              dans la session :
            </p>
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://api.cimolace.space/liri/sessions/sess_abc123/tokens \\
  -H "X-API-Key: lk_sec_xxx" \\
  -H "X-Tenant-Slug: mon-ecole" \\
  -d '{
    "user_id": "user_42",
    "name": "Alice Martin",
    "role": "viewer",
    "ttl_seconds": 3600
  }'`}
            />
            <CodeBlock
              lang="json"
              code={`{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-06-01T15:00:00Z",
  "session_id": "sess_abc123"
}`}
            />
          </section>

          {/* ── API MULTILANG ───────────────────────────────────────────── */}
          <section id="api-multilang">
            <h2>Multilingue temps réel</h2>
            <p>
              Traduisez à la volée n&apos;importe quel texte ou flux audio dans 30+
              langues.
            </p>
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://api.cimolace.space/liri/multilang/translate \\
  -H "X-API-Key: lk_sec_xxx" \\
  -H "X-Tenant-Slug: mon-ecole" \\
  -d '{
    "text": "Bonjour le monde",
    "source": "fr",
    "target": "en"
  }'
# → { "translated": "Hello world", "credits_used": 1 }`}
            />
          </section>

          {/* ── API TTS ─────────────────────────────────────────────────── */}
          <section id="api-tts">
            <h2>TTS / STT</h2>
            <h3>POST /liri/tts — Synthèse vocale</h3>
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://api.cimolace.space/liri/tts \\
  -H "X-API-Key: lk_sec_xxx" \\
  -H "X-Tenant-Slug: mon-ecole" \\
  -d '{
    "text": "Bienvenue dans ce cours de mathématiques.",
    "language": "fr",
    "voice": "studio-fr-A",
    "tier": "export"
  }' \\
  -o welcome.mp3`}
            />
            <p>
              <code>tier</code> = <code>live</code> (basse latence, ElevenLabs Flash) ou{" "}
              <code>export</code> (qualité max, Multilingual v2 + fallback Google
              Studio).
            </p>
            <h3>POST /liri/stt — Transcription</h3>
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://api.cimolace.space/liri/stt \\
  -H "X-API-Key: lk_sec_xxx" \\
  -H "X-Tenant-Slug: mon-ecole" \\
  -F "audio=@meeting.mp3" \\
  -F "language=fr" \\
  -F "model=whisper-large-v3"`}
            />
          </section>

          {/* ── API MASTERCLASS ─────────────────────────────────────────── */}
          <section id="api-masterclass">
            <h2>Masterclass Factory</h2>
            <p>
              Génère un cours complet (titre, plan, slides, quiz, transcripts) à partir
              d&apos;un sujet libre.
            </p>
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://api.cimolace.space/masterclass-factory/generate \\
  -H "X-API-Key: lk_sec_xxx" \\
  -H "X-Tenant-Slug: mon-ecole" \\
  -d '{
    "topic": "Introduction au théorème de Pythagore",
    "audience": "lycéens 1ère",
    "duration_minutes": 45,
    "language": "fr",
    "modules": ["slides", "quiz", "transcript", "tts_narration"]
  }'`}
            />
            <CodeBlock
              lang="json"
              code={`{
  "masterclass_id": "mc_xyz789",
  "title": "Le théorème de Pythagore — Le pilier de la géométrie",
  "modules": {
    "slides": { "url": "...", "count": 18 },
    "quiz": { "questions": 12, "id": "quiz_..." },
    "transcript": { "url": "...", "words": 4250 },
    "tts_narration": { "url": "...", "duration_s": 2680 }
  },
  "credits_used": 145,
  "credits_remaining": 855
}`}
            />
          </section>

          {/* ── WEBHOOKS CONFIG ─────────────────────────────────────────── */}
          <section id="webhooks-config">
            <h2>Webhooks — Configuration</h2>
            <p>
              Configurez vos endpoints webhook dans le dashboard tenant ou via l&apos;API :
            </p>
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://api.cimolace.space/liri/webhooks \\
  -H "X-API-Key: lk_sec_xxx" \\
  -H "X-Tenant-Slug: mon-ecole" \\
  -d '{
    "url": "https://monsite.com/webhooks/liri",
    "events": ["session.started", "session.ended", "transcript.ready"],
    "active": true
  }'
# → { "id": "wh_...", "secret": "whsec_..." }`}
            />
            <p>
              Notez bien le <code>secret</code> retourné — il sert à vérifier la
              signature.
            </p>
          </section>

          {/* ── WEBHOOKS EVENTS ─────────────────────────────────────────── */}
          <section id="webhooks-events">
            <h2>Events disponibles</h2>
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Quand</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>session.started</code>
                  </td>
                  <td>Première personne rejoint une session</td>
                </tr>
                <tr>
                  <td>
                    <code>session.ended</code>
                  </td>
                  <td>Dernière personne quitte ou host clique &laquo; Terminer &raquo;</td>
                </tr>
                <tr>
                  <td>
                    <code>participant.joined</code>
                  </td>
                  <td>Un participant rejoint</td>
                </tr>
                <tr>
                  <td>
                    <code>participant.left</code>
                  </td>
                  <td>Un participant quitte</td>
                </tr>
                <tr>
                  <td>
                    <code>recording.ready</code>
                  </td>
                  <td>Enregistrement vidéo finalisé + URL signée</td>
                </tr>
                <tr>
                  <td>
                    <code>transcript.ready</code>
                  </td>
                  <td>Transcript final disponible</td>
                </tr>
                <tr>
                  <td>
                    <code>masterclass.generated</code>
                  </td>
                  <td>Génération masterclass terminée</td>
                </tr>
                <tr>
                  <td>
                    <code>credits.low</code>
                  </td>
                  <td>Solde LIRI Credits &lt; seuil tenant</td>
                </tr>
                <tr>
                  <td>
                    <code>credits.depleted</code>
                  </td>
                  <td>Solde épuisé, sessions IA suspendues</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── WEBHOOKS SIGNATURE ──────────────────────────────────────── */}
          <section id="webhooks-signature">
            <h2>Vérification de signature</h2>
            <p>
              Chaque webhook arrive avec un header{" "}
              <code>X-LIRI-Signature: t=&lt;timestamp&gt;,v1=&lt;hex&gt;</code>. La
              signature est un HMAC-SHA256 de <code>{`${"`"}${"${"}t${"}"}.${"${"}body${"}"}${"`"}`}</code> avec votre
              secret webhook. Tolérance anti-replay : 5 minutes.
            </p>
            <CodeTabs
              tabs={[
                {
                  label: "Node.js",
                  lang: "javascript",
                  code: `import { createHmac, timingSafeEqual } from "crypto";

export function verifyLiriSignature(rawBody, header, secret) {
  const parts = Object.fromEntries(
    header.split(",").map(s => s.split("="))
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  // anti-replay 5 min
  if (Math.abs(Date.now()/1000 - parseInt(t,10)) > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");

  return timingSafeEqual(Buffer.from(v1,"hex"), Buffer.from(expected,"hex"));
}`,
                },
                {
                  label: "Python",
                  lang: "python",
                  code: `import hmac, hashlib, time

def verify_liri_signature(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(seg.split("=") for seg in header.split(","))
    t, v1 = parts.get("t"), parts.get("v1")
    if not t or not v1: return False
    if abs(time.time() - int(t)) > 300: return False
    expected = hmac.new(
        secret.encode(),
        f"{t}.{raw_body.decode()}".encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(v1, expected)`,
                },
                {
                  label: "PHP",
                  lang: "php",
                  code: `<?php
function verify_liri_signature(string $raw, string $header, string $secret): bool {
  $parts = [];
  foreach (explode(",", $header) as $kv) {
    [$k, $v] = explode("=", $kv, 2);
    $parts[$k] = $v;
  }
  $t = $parts["t"] ?? null;
  $v1 = $parts["v1"] ?? null;
  if (!$t || !$v1) return false;
  if (abs(time() - (int)$t) > 300) return false;
  $expected = hash_hmac("sha256", "$t.$raw", $secret);
  return hash_equals($expected, $v1);
}`,
                },
              ]}
            />
            <h3>Payload exemple</h3>
            <CodeBlock
              lang="json"
              code={`{
  "id": "evt_2NfGh...",
  "type": "session.ended",
  "created": 1780058600,
  "tenant": "mon-ecole",
  "data": {
    "session_id": "sess_abc123",
    "mode": "live",
    "duration_seconds": 2845,
    "participants_count": 14,
    "credits_used": 32,
    "recording_url": "https://...",
    "transcript_url": "https://..."
  }
}`}
            />
          </section>

          {/* ── CREDITS OVERVIEW ────────────────────────────────────────── */}
          <section id="credits-overview">
            <h2>LIRI Credits — Vue d&apos;ensemble</h2>
            <p>
              Toutes les opérations IA (TTS, STT, traduction, génération masterclass,
              Smartboard assist) consomment des <strong>LIRI Credits</strong>. Chaque
              plan inclut un quota mensuel rechargé automatiquement le 1er de chaque
              mois (cron Supabase).
            </p>
            <p>
              <strong>Unité :</strong> 1 LIRI Credit ≈ 0,001 €. Au-delà du quota, vous
              achetez des <em>packs de recharge</em> via Stripe Checkout.
            </p>
            <h3>GET /ai-billing/balance</h3>
            <CodeBlock
              lang="bash"
              code={`curl https://api.cimolace.space/ai-billing/balance \\
  -H "X-API-Key: lk_sec_xxx" \\
  -H "X-Tenant-Slug: mon-ecole"
# → { "balance_credits": 1247.5, "plan_tier": "pro", "monthly_quota": 10000, ... }`}
            />
          </section>

          {/* ── CREDITS TARIFS ──────────────────────────────────────────── */}
          <section id="credits-tarifs">
            <h2>Tarifs par modèle</h2>
            <p>Coûts approximatifs en crédits LIRI par unité d&apos;usage.</p>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Unité</th>
                  <th>Crédits</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>TTS ElevenLabs Flash (live)</td>
                  <td>1 000 caractères</td>
                  <td>50</td>
                </tr>
                <tr>
                  <td>TTS Google Studio (export)</td>
                  <td>1 000 caractères</td>
                  <td>16</td>
                </tr>
                <tr>
                  <td>STT Whisper large-v3</td>
                  <td>1 minute audio</td>
                  <td>0,5</td>
                </tr>
                <tr>
                  <td>Traduction multilang</td>
                  <td>1 000 caractères</td>
                  <td>2</td>
                </tr>
                <tr>
                  <td>LLM Groq Llama 3.3 70B</td>
                  <td>1 000 tokens</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>LLM Claude Sonnet</td>
                  <td>1 000 tokens</td>
                  <td>15</td>
                </tr>
                <tr>
                  <td>Génération Masterclass complète</td>
                  <td>1 cours 45 min</td>
                  <td>120–180</td>
                </tr>
                <tr>
                  <td>Smartboard OCR + IA</td>
                  <td>1 image</td>
                  <td>3</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── CREDITS PACKS ───────────────────────────────────────────── */}
          <section id="credits-packs">
            <h2>Packs de recharge</h2>
            <p>
              Recharges one-shot via Stripe Checkout. Activez l&apos;achat depuis votre
              dashboard ou via API :
            </p>
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://api.cimolace.space/ai-billing/topup/checkout \\
  -H "X-API-Key: lk_sec_xxx" \\
  -H "X-Tenant-Slug: mon-ecole" \\
  -d '{ "pack_key": "pack_5k" }'
# → { "checkout_url": "https://checkout.stripe.com/...", "session_id": "cs_..." }`}
            />
            <p>
              Redirigez l&apos;utilisateur vers <code>checkout_url</code>. À la
              confirmation du paiement, Stripe envoie l&apos;event{" "}
              <code>checkout.session.completed</code> à notre webhook interne, qui
              crédite automatiquement votre solde.
            </p>
            <table>
              <thead>
                <tr>
                  <th>pack_key</th>
                  <th>Crédits</th>
                  <th>Prix</th>
                  <th>Bonus</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>pack_1k</code>
                  </td>
                  <td>1 000</td>
                  <td>15 €</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>
                    <code>pack_5k</code>
                  </td>
                  <td>5 500</td>
                  <td>70 €</td>
                  <td>+10 %</td>
                </tr>
                <tr>
                  <td>
                    <code>pack_20k</code>
                  </td>
                  <td>24 000</td>
                  <td>250 €</td>
                  <td>+20 %</td>
                </tr>
                <tr>
                  <td>
                    <code>pack_100k</code>
                  </td>
                  <td>130 000</td>
                  <td>1 000 €</td>
                  <td>+30 %</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── SECURITE ────────────────────────────────────────────────── */}
          <section id="securite">
            <h2>Sécurité</h2>
            <ul>
              <li>
                <strong>HTTPS strict</strong> partout (HSTS, TLS 1.3). Aucun fallback
                HTTP.
              </li>
              <li>
                <strong>Clés API rotatables</strong> à tout moment depuis le dashboard
                tenant (révocation immédiate).
              </li>
              <li>
                <strong>Scoping</strong> : les clés <code>lk_pub_</code> ne peuvent pas
                lire de données utilisateur ni créer de masterclass — seulement
                démarrer des sessions.
              </li>
              <li>
                <strong>Signatures webhook HMAC-SHA256</strong> + anti-replay 5 min (idem
                Stripe).
              </li>
              <li>
                <strong>JWT participants</strong> à durée courte (1h par défaut),
                signés par votre serveur.
              </li>
              <li>
                <strong>RLS PostgreSQL</strong> sur Supabase : isolation tenant
                garantie au niveau base.
              </li>
              <li>
                <strong>Audit log</strong> : toutes les actions sensibles sont
                journalisées (table <code>access_audit_log</code>).
              </li>
            </ul>
          </section>

          {/* ── ERRORS ──────────────────────────────────────────────────── */}
          <section id="errors">
            <h2>Codes d&apos;erreur</h2>
            <table>
              <thead>
                <tr>
                  <th>Code HTTP</th>
                  <th>Code</th>
                  <th>Sens</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>400</td>
                  <td>
                    <code>BAD_REQUEST</code>
                  </td>
                  <td>Payload invalide ou paramètres manquants</td>
                </tr>
                <tr>
                  <td>401</td>
                  <td>
                    <code>UNAUTHORIZED</code>
                  </td>
                  <td>Clé API absente, expirée ou révoquée</td>
                </tr>
                <tr>
                  <td>402</td>
                  <td>
                    <code>CREDITS_DEPLETED</code>
                  </td>
                  <td>Solde LIRI Credits épuisé — rechargez un pack</td>
                </tr>
                <tr>
                  <td>403</td>
                  <td>
                    <code>FORBIDDEN</code>
                  </td>
                  <td>Clé valide mais scope insuffisant (pub vs sec)</td>
                </tr>
                <tr>
                  <td>404</td>
                  <td>
                    <code>NOT_FOUND</code>
                  </td>
                  <td>Ressource inexistante (session, masterclass…)</td>
                </tr>
                <tr>
                  <td>409</td>
                  <td>
                    <code>CONFLICT</code>
                  </td>
                  <td>Session déjà terminée, slug déjà utilisé…</td>
                </tr>
                <tr>
                  <td>429</td>
                  <td>
                    <code>RATE_LIMITED</code>
                  </td>
                  <td>
                    Trop de requêtes (limite 60/min sur les endpoints IA, retry après{" "}
                    <code>Retry-After</code>)
                  </td>
                </tr>
                <tr>
                  <td>500</td>
                  <td>
                    <code>INTERNAL_ERROR</code>
                  </td>
                  <td>Erreur serveur — réessayer avec backoff</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── CHANGELOG ───────────────────────────────────────────────── */}
          <section id="changelog">
            <h2>Changelog</h2>
            <h3>2026-05-29 — v2.0 (production)</h3>
            <ul>
              <li>
                API NestJS déployée sur <code>api.cimolace.space</code> (Railway,
                TLS 1.3).
              </li>
              <li>4 packs LIRI Credits sur Stripe (test + live mode).</li>
              <li>
                TTS : Google Cloud Studio voices en provider primaire (3× moins cher
                que ElevenLabs).
              </li>
              <li>Masterclass Factory : Groq Llama 3.3 70B + fallback DeepSeek.</li>
              <li>
                Webhooks : signature HMAC-SHA256 + anti-replay 5 min (compatible
                Stripe-style).
              </li>
              <li>26 Edge Functions LIRI déployées (TTS, STT, multilang, smartboard).</li>
            </ul>
            <p>
              Besoin d&apos;aide ?{" "}
              <a href="mailto:dev@cimolace.space">dev@cimolace.space</a> · Twitter{" "}
              <a href="https://twitter.com/cimolace">@cimolace</a>
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
