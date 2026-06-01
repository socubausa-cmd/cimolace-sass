import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, CodeTabs } from "./CodeTabs";
import { Sidebar } from "./Sidebar";

export const metadata: Metadata = {
  title: "Documentation MedOS — Intégration développeur | Cimolace",
  description:
    "Documentation complète pour intégrer MedOS dans votre site. 3 modes, exemples Next.js, Express, Laravel, WordPress. Authentification, API REST, sécurité, RGPD.",
};

export default function MedOSDocPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero ribbon */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-indigo-600">
            <Link href="/medos" className="hover:underline">MedOS</Link>
            <span>/</span>
            <span>Documentation développeur</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Intégrer MedOS dans votre application
          </h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Le moteur médical de Cimolace s&apos;intègre dans n&apos;importe quel
            site existant via widget JS, iframe, ou API REST. Aucun framework
            propriétaire. Cette doc couvre tout : quickstart, authentification,
            modes d&apos;intégration, référence API, sécurité.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a href="#quickstart" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
              Quickstart 5 min →
            </a>
            <a href="https://api.cimolace.space/docs" target="_blank" className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
              Swagger API
            </a>
            <a href="/medos/v1/demo.html" className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
              Voir la démo live
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
            .docs-content table code { font-size: 0.75rem; }
          `}</style>

          <section id="overview">
            <h2>Vue d&apos;ensemble</h2>
            <p>
              <strong>MedOS</strong> est le moteur santé de Cimolace : dossier
              patient (EHR), notes SOAP, prescriptions, formulaires, journal
              santé, téléconsultation. Vous l&apos;activez sur votre tenant
              Cimolace, et vous l&apos;exposez à vos utilisateurs via 3 canaux :
            </p>
            <ul>
              <li><strong>Widget JS</strong> — 6 lignes HTML collées dans votre site.</li>
              <li><strong>iframe</strong> — pour les CMS qui bloquent les scripts tiers (Webflow strict).</li>
              <li><strong>API REST</strong> — pour reconstruire votre propre UI au-dessus de MedOS.</li>
            </ul>
            <p>
              Vous gardez votre domaine, votre branding, votre frontend. Vos
              clients ne quittent jamais votre site. Cimolace tourne en
              coulisse, invisible.
            </p>
            <div className="not-prose my-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <p className="m-0 text-sm font-medium text-indigo-900">
                💡 Commencez par le <a href="#quickstart" className="underline">Quickstart</a> pour avoir un widget qui marche en 5 minutes. Allez ensuite voir <a href="#niveau-2" className="underline">Niveau 2 SSO</a> pour le brancher à votre système d&apos;auth existant.
              </p>
            </div>
          </section>

          <section id="quickstart">
            <h2>Quickstart (5 minutes)</h2>
            <p>Trois étapes pour afficher le portail patient sur votre site en mode anonyme.</p>

            <h3>1. Whitelister votre domaine</h3>
            <p>Demandez au staff Cimolace d&apos;ajouter <code>votredomaine.com</code> dans <code>tenant_domains</code> (usage <code>embed_origin</code>). Sans ça, votre Origin sera refusée par CORS.</p>

            <h3>2. Activer les moteurs MedOS</h3>
            <p>Votre tenant doit avoir au moins <code>med_ehr</code> et <code>med_notes</code> activés dans <code>tenant_services</code>.</p>

            <h3>3. Coller le snippet</h3>
            <CodeTabs tabs={[
              { label: "HTML", lang: "html", code: `<!-- N'importe quelle page de votre site -->
<div id="medos-portal"></div>

<script
  src="https://cimolace.space/medos/v1/embed.js"
  data-tenant="votre-tenant-slug"
  data-mode="patient-portal"
  data-primary-color="#10b981"
  async
></script>` },
              { label: "React", lang: "tsx", code: `import { useEffect } from "react";

export function MedosWidget() {
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://cimolace.space/medos/v1/embed.js";
    s.setAttribute("data-tenant", "votre-slug");
    s.setAttribute("data-mode", "patient-portal");
    s.async = true;
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return <div id="medos-portal" />;
}` },
              { label: "Vue", lang: "vue", code: `<template>
  <div id="medos-portal"></div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
let script;
onMounted(() => {
  script = document.createElement("script");
  script.src = "https://cimolace.space/medos/v1/embed.js";
  script.setAttribute("data-tenant", "votre-slug");
  script.setAttribute("data-mode", "patient-portal");
  script.async = true;
  document.body.appendChild(script);
});
onUnmounted(() => script?.remove());
</script>` },
            ]} />
            <p className="text-sm text-slate-600">Le widget se monte dans le <code>&lt;div&gt;</code>, charge un JWT court, affiche le portail patient. Les visiteurs s&apos;authentifient via magic link Supabase intégré.</p>
          </section>

          <section id="architecture">
            <h2>Architecture</h2>
            <p>Cimolace est un SaaS multi-tenant. MedOS est un moteur de ce SaaS. Vous activez MedOS pour vos utilisateurs.</p>
            <CodeBlock lang="txt" code={`┌──────────────────────────────────────────────────────────────┐
│  Navigateur du visiteur final                                │
│                                                              │
│  Votre site (ex: zahirwellness.com)                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  votre header / nav / branding                         │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  <div id="medos-portal"></div>  ← widget Cimolace ici  │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  votre footer                                          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
              ↓
              ↓ widget appelle (CORS validé Origin)
              ↓
┌──────────────────────────────────────────────────────────────┐
│  api.cimolace.space  (invisible)                             │
│   • Vérifie votredomaine.com whitelisté                      │
│   • Délivre un JWT court (15 min)                            │
│   • Renvoie les données patient                              │
└──────────────────────────────────────────────────────────────┘`} />
          </section>

          <section id="modes">
            <h2>3 modes officiels</h2>
            <div className="not-prose my-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mode A</div>
                <h3 className="mt-1 text-base font-bold text-slate-900">Hébergé</h3>
                <p className="mt-2 text-sm text-slate-600">Vous n&apos;avez pas de site. Cimolace vous héberge sur <code className="rounded bg-slate-100 px-1 text-xs">*.medos.cimolace.space</code></p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mode B</div>
                <h3 className="mt-1 text-base font-bold text-slate-900">Domaine personnalisé</h3>
                <p className="mt-2 text-sm text-slate-600">Vous avez un domaine acheté mais pas de site. Cimolace sert sous ce domaine. SSL auto.</p>
              </div>
              <div className="rounded-xl border-2 border-indigo-500 bg-indigo-50 p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Mode C · Recommandé</div>
                <h3 className="mt-1 text-base font-bold text-slate-900">Embedded</h3>
                <p className="mt-2 text-sm text-slate-600">Vous avez déjà un site. Vous y collez le widget MedOS. Le cas le plus courant.</p>
              </div>
            </div>
          </section>

          <section id="identites">
            <h2>Identités &amp; rôles</h2>
            <div className="not-prose overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Identité</th>
                    <th className="py-2 pr-4 font-medium">Auth</th>
                    <th className="py-2 font-medium">Cas d&apos;usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-3 pr-4 font-medium">Visiteur anonyme</td><td className="py-3 pr-4"><code>POST /embed/token</code></td><td className="py-3 text-slate-600">Widget se monte, visiteur se connecte via magic link</td></tr>
                  <tr><td className="py-3 pr-4 font-medium">Patient identifié (Niveau 2)</td><td className="py-3 pr-4"><code>POST /embed/server-token</code></td><td className="py-3 text-slate-600">Votre backend appelle Cimolace, obtient un JWT lié au patient</td></tr>
                  <tr><td className="py-3 pr-4 font-medium">Backend tenant</td><td className="py-3 pr-4"><code>Bearer mdk_*</code></td><td className="py-3 text-slate-600">Server-to-server vers <code>/med/*</code></td></tr>
                  <tr><td className="py-3 pr-4 font-medium">Praticien</td><td className="py-3 pr-4">JWT Supabase</td><td className="py-3 text-slate-600">App med-app (pas le widget)</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="niveau-1">
            <h2>Niveau 1 — Widget anonyme</h2>
            <p>Le plus simple. Vous collez le snippet HTML, le widget gère l&apos;auth visiteur lui-même (magic link).</p>
            <h3>Fonctionnement</h3>
            <ol>
              <li>Le widget lit <code>data-tenant</code> et <code>data-mode</code></li>
              <li>Il appelle <code>POST /v1/medos/embed/token</code> avec son Origin</li>
              <li>Cimolace vérifie l&apos;Origin contre <code>tenant_domains</code>, signe un JWT 15 min</li>
              <li>Le widget appelle <code>/v1/medos/embed/me/*</code> avec ce JWT</li>
              <li>Si le visiteur n&apos;est pas connecté, magic link Supabase</li>
            </ol>
            <CodeTabs tabs={[
              { label: "HTML basique", lang: "html", code: `<div id="medos-portal"></div>
<script
  src="https://cimolace.space/medos/v1/embed.js"
  data-tenant="votre-slug"
  data-mode="patient-portal"
  async
></script>` },
              { label: "Avec branding", lang: "html", code: `<div id="medos-portal"></div>
<script
  src="https://cimolace.space/medos/v1/embed.js"
  data-tenant="votre-slug"
  data-mode="patient-portal"
  data-primary-color="#10b981"
  data-locale="fr"
  async
></script>` },
              { label: "Plusieurs widgets", lang: "html", code: `<!-- Page avec 2 widgets -->
<div id="rdv"></div>
<script src="https://cimolace.space/medos/v1/embed.js"
  data-tenant="votre-slug" data-mode="appointment-booker"
  data-target="#rdv" async></script>

<div id="health"></div>
<script src="https://cimolace.space/medos/v1/embed.js"
  data-tenant="votre-slug" data-mode="health-tracker"
  data-target="#health" async></script>` },
            ]} />
          </section>

          <section id="niveau-2">
            <h2>Niveau 2 — SSO server-to-server</h2>
            <p>Votre user est déjà connecté sur votre site. Vous voulez que le widget affiche directement son dossier, <strong>sans login dans le widget</strong>.</p>
            <p>Votre backend appelle Cimolace avec sa clé API tenant, obtient un JWT &ldquo;identifié&rdquo; (<code>sub = patient_user_id</code>), l&apos;injecte dans la page via <code>data-embed-token</code>.</p>

            <h3>Étape 1 — Backend : récupérer un token</h3>
            <CodeTabs tabs={[
              { label: "Next.js", lang: "ts", code: `// pages/api/medos-token.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";

const CIMOLACE_API = "https://api.cimolace.space";
const TENANT_KEY = process.env.CIMOLACE_TENANT_API_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req });
  if (!session?.user?.email) return res.status(401).end();

  const r = await fetch(\`\${CIMOLACE_API}/v1/medos/embed/server-token\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${TENANT_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      patient_email: session.user.email,
      patient_first_name: session.user.firstName,
      patient_last_name: session.user.lastName,
      mode: "patient-portal",
    }),
  });
  const { data } = await r.json();
  res.json({ token: data.token });
}` },
              { label: "Express", lang: "js", code: `// server.js
const express = require("express");
const app = express();

app.get("/api/medos-token", async (req, res) => {
  if (!req.session.user) return res.status(401).end();

  const r = await fetch("https://api.cimolace.space/v1/medos/embed/server-token", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.CIMOLACE_TENANT_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      patient_email: req.session.user.email,
      patient_first_name: req.session.user.firstName,
      patient_last_name: req.session.user.lastName,
      mode: "patient-portal",
    }),
  });
  const { data } = await r.json();
  res.json({ token: data.token });
});` },
              { label: "Laravel", lang: "php", code: `<?php
// routes/api.php
Route::middleware('auth')->get('/medos-token', function (Request $request) {
    $user = $request->user();
    $resp = Http::withToken(env('CIMOLACE_TENANT_API_KEY'))
        ->post('https://api.cimolace.space/v1/medos/embed/server-token', [
            'patient_email' => $user->email,
            'patient_first_name' => $user->first_name,
            'patient_last_name' => $user->last_name,
            'mode' => 'patient-portal',
        ]);
    return response()->json(['token' => $resp['data']['token']]);
});` },
              { label: "WordPress", lang: "php", code: `<?php
// functions.php (theme)
add_action('rest_api_init', function () {
  register_rest_route('mon-tenant/v1', '/medos-token', [
    'methods' => 'GET',
    'permission_callback' => fn() => is_user_logged_in(),
    'callback' => function () {
      $user = wp_get_current_user();
      $resp = wp_remote_post('https://api.cimolace.space/v1/medos/embed/server-token', [
        'headers' => [
          'Authorization' => 'Bearer ' . getenv('CIMOLACE_TENANT_API_KEY'),
          'Content-Type' => 'application/json',
        ],
        'body' => json_encode([
          'patient_email' => $user->user_email,
          'patient_first_name' => $user->first_name,
          'patient_last_name' => $user->last_name,
          'mode' => 'patient-portal',
        ]),
      ]);
      $data = json_decode(wp_remote_retrieve_body($resp), true);
      return ['token' => $data['data']['token']];
    },
  ]);
});` },
              { label: "Django", lang: "python", code: `# views.py
import os, requests
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

@login_required
def medos_token(request):
    r = requests.post(
        "https://api.cimolace.space/v1/medos/embed/server-token",
        headers={
            "Authorization": f"Bearer {os.environ['CIMOLACE_TENANT_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "patient_email": request.user.email,
            "patient_first_name": request.user.first_name,
            "patient_last_name": request.user.last_name,
            "mode": "patient-portal",
        },
    )
    return JsonResponse({"token": r.json()["data"]["token"]})` },
            ]} />

            <h3>Étape 2 — Frontend : injecter le token</h3>
            <CodeBlock lang="html" code={`<!-- /mon-espace-sante -->
<div id="medos-portal"></div>

<script>
  fetch("/api/medos-token")
    .then(r => r.json())
    .then(({ token }) => {
      const s = document.createElement("script");
      s.src = "https://cimolace.space/medos/v1/embed.js";
      s.setAttribute("data-tenant", "votre-slug");
      s.setAttribute("data-mode", "patient-portal");
      s.setAttribute("data-embed-token", token);
      s.async = true;
      document.body.appendChild(s);
    });
</script>`} />

            <div className="not-prose my-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="m-0 text-sm font-medium text-amber-900">
                ⚠️ <strong>Sécurité :</strong> la clé <code>CIMOLACE_TENANT_API_KEY</code> reste UNIQUEMENT côté serveur. Jamais dans un public env var (<code>NEXT_PUBLIC_*</code>), jamais dans un fichier versionné, jamais dans le bundle JS livré au navigateur.
              </p>
            </div>
          </section>

          <section id="widget-attributs">
            <h2>Attributs du widget JS</h2>
            <div className="not-prose overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Attribut</th>
                    <th className="py-2 pr-4 font-medium">Requis</th>
                    <th className="py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2 pr-4"><code>data-tenant</code></td><td className="py-2 pr-4 text-rose-600">requis</td><td className="py-2 text-slate-600">Slug de votre tenant Cimolace</td></tr>
                  <tr><td className="py-2 pr-4"><code>data-mode</code></td><td className="py-2 pr-4">défaut: patient-portal</td><td className="py-2 text-slate-600"><code>patient-portal</code>, <code>consent-form</code>, <code>intake-form</code>, <code>health-tracker</code>, <code>appointment-booker</code></td></tr>
                  <tr><td className="py-2 pr-4"><code>data-embed-token</code></td><td className="py-2 pr-4">optionnel</td><td className="py-2 text-slate-600">Pour Niveau 2 SSO. Si fourni, le widget l&apos;utilise directement.</td></tr>
                  <tr><td className="py-2 pr-4"><code>data-api-base</code></td><td className="py-2 pr-4">défaut: prod</td><td className="py-2 text-slate-600">URL API Cimolace (pour dev/staging)</td></tr>
                  <tr><td className="py-2 pr-4"><code>data-target</code></td><td className="py-2 pr-4">défaut: #medos-portal</td><td className="py-2 text-slate-600">Sélecteur CSS du conteneur DOM</td></tr>
                  <tr><td className="py-2 pr-4"><code>data-primary-color</code></td><td className="py-2 pr-4">optionnel</td><td className="py-2 text-slate-600">Hex color, ex: <code>#10b981</code></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="iframe">
            <h2>Mode iframe (Mode C.2)</h2>
            <p>Si votre CMS bloque les scripts tiers (Webflow strict, certains setups Squarespace), utilisez l&apos;iframe — aucun JS à charger, juste une balise :</p>
            <CodeBlock lang="html" code={`<iframe
  id="medos"
  src="https://cimolace.space/embed/patient-portal?tenant=votre-slug&primary=10b981"
  width="100%"
  height="600"
  frameborder="0"
  style="border:0"
></iframe>`} />

            <h3>Paramètres d&apos;URL</h3>
            <ul>
              <li><code>/embed/&lt;mode&gt;</code> — <code>patient-portal</code>, <code>appointment-booker</code>, <code>health-tracker</code>, <code>consent-form</code>, <code>intake-form</code></li>
              <li><code>?tenant=</code> — slug de votre tenant <span className="text-rose-600">(requis)</span></li>
              <li><code>?primary=</code> — couleur hex <strong>sans</strong> <code>#</code> (ex&nbsp;: <code>10b981</code>)</li>
            </ul>
            <div className="not-prose my-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="m-0 text-sm text-amber-900">⚠️ <strong>Aucun token dans l&apos;URL</strong> (évite les fuites dans les logs). L&apos;iframe s&apos;authentifie elle-même via <code>POST /embed/token</code>, validé par l&apos;<strong>Origin HTTP</strong> — votre domaine doit donc être whitelisté dans <code>tenant_domains</code>.</p>
            </div>

            <h3>Communication parent ↔ iframe (<code>postMessage</code>)</h3>
            <div className="not-prose overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Sens</th>
                    <th className="py-2 pr-4 font-medium">Message</th>
                    <th className="py-2 font-medium">Effet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  <tr><td className="py-2 pr-4">iframe → parent</td><td className="py-2 pr-4 font-mono">{`{ type: 'medos:ready' }`}</td><td className="py-2 text-slate-600">l&apos;iframe est chargée et prête</td></tr>
                  <tr><td className="py-2 pr-4">iframe → parent</td><td className="py-2 pr-4 font-mono">{`{ type: 'medos:height', height }`}</td><td className="py-2 text-slate-600">hauteur du contenu (auto-resize)</td></tr>
                  <tr><td className="py-2 pr-4">iframe → parent</td><td className="py-2 pr-4 font-mono">{`{ type: 'medos:event', name, payload }`}</td><td className="py-2 text-slate-600">événement utilisateur (ex&nbsp;: <code>note-read</code>)</td></tr>
                  <tr><td className="py-2 pr-4">parent → iframe</td><td className="py-2 pr-4 font-mono">{`{ type: 'medos:theme', primary }`}</td><td className="py-2 text-slate-600">changer la couleur à chaud</td></tr>
                </tbody>
              </table>
            </div>

            <h3>Auto-resize (recommandé)</h3>
            <p>L&apos;iframe émet sa hauteur en continu (via <code>ResizeObserver</code>). Ajustez-la côté parent pour éviter le double scroll :</p>
            <CodeBlock lang="html" code={`<script>
  window.addEventListener("message", (e) => {
    if (e.origin !== "https://cimolace.space") return;   // sécurité : vérifier l'origine
    const msg = e.data || {};
    if (msg.type === "medos:height") {
      document.getElementById("medos").style.height = msg.height + "px";
    }
  });
</script>`} />
          </section>

          <section id="auth-api">
            <h2>Authentification API</h2>
            <p>Tous les endpoints <code>/v1/medos/embed/*</code> et <code>/med/*</code> demandent un JWT en <code>Authorization: Bearer</code>.</p>
            <div className="not-prose overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Préfixe</th>
                    <th className="py-2 pr-4 font-medium">Durée</th>
                    <th className="py-2 font-medium">Obtenu via</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2 pr-4">Clé API tenant</td><td className="py-2 pr-4"><code>mdk_*</code></td><td className="py-2 pr-4">jusqu&apos;à revoke</td><td className="py-2 text-slate-600">Admin Cimolace</td></tr>
                  <tr><td className="py-2 pr-4">Embed-token anonyme</td><td className="py-2 pr-4"><code>eyJ...</code></td><td className="py-2 pr-4">15 min</td><td className="py-2 text-slate-600"><code>POST /embed/token</code></td></tr>
                  <tr><td className="py-2 pr-4">Embed-token identifié</td><td className="py-2 pr-4"><code>eyJ...</code></td><td className="py-2 pr-4">15 min</td><td className="py-2 text-slate-600"><code>POST /embed/server-token</code></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="endpoint-token">
            <h2><code>POST /v1/medos/embed/token</code></h2>
            <p>Émet un JWT court anonyme. Appelé par le widget JS, validé via l&apos;Origin HTTP contre <code>tenant_domains</code>.</p>
            <h3>Request</h3>
            <CodeBlock lang="bash" code={`curl -X POST https://api.cimolace.space/v1/medos/embed/token \\
  -H "Origin: https://votredomaine.com" \\
  -H "Content-Type: application/json" \\
  -d '{"tenant_slug":"votre-slug","mode":"patient-portal"}'`} />
            <h3>Response 200</h3>
            <CodeBlock lang="json" code={`{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 900,
    "api_base": "https://api.cimolace.space",
    "mode": "patient-portal",
    "scope": ["med:me:read", "med:notes:read"]
  }
}`} />
            <h3>Erreurs</h3>
            <ul>
              <li><code>403</code> Origin non whitelisté</li>
              <li><code>404</code> Tenant inconnu ou inactif</li>
              <li><code>400</code> Mode invalide</li>
            </ul>
          </section>

          <section id="endpoint-server-token">
            <h2><code>POST /v1/medos/embed/server-token</code></h2>
            <p>Émet un JWT court &ldquo;identifié&rdquo; lié à un patient précis. Crée le user Supabase + patient record automatiquement si absents.</p>
            <h3>Authentification</h3>
            <p>Clé API tenant en <code>Authorization: Bearer mdk_*</code>.</p>
            <h3>Request</h3>
            <CodeBlock lang="bash" code={`curl -X POST https://api.cimolace.space/v1/medos/embed/server-token \\
  -H "Authorization: Bearer mdk_votre-slug_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "patient_email": "client@example.com",
    "patient_first_name": "Marie",
    "patient_last_name": "Dupont",
    "mode": "patient-portal",
    "external_user_id": "user_42"
  }'`} />
            <h3>Response 201</h3>
            <CodeBlock lang="json" code={`{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 900,
    "api_base": "https://api.cimolace.space",
    "mode": "patient-portal",
    "scope": ["med:me:read", "med:notes:read"],
    "patient_user_id": "27d9260d-635c-4995-9524-48008fb7d5da",
    "patient_record_id": "029e5194-1813-4611-8220-1951c5e70531",
    "created": true
  }
}`} />
            <p className="text-sm text-slate-600"><code>created: true</code> au premier appel pour ce patient, <code>false</code> aux suivants (idempotent par email).</p>
          </section>

          <section id="endpoints-data">
            <h2>Endpoints data — votre app, votre UI</h2>
            <p>
              Vous avez <strong>déjà votre application</strong> ? C&apos;est le mode le plus
              puissant : votre backend obtient un <code>embed-token</code> via
              <code> /embed/server-token</code>, puis votre front appelle ces endpoints
              avec <code>Authorization: Bearer &lt;token&gt;</code> et <strong>reconstruit
              sa propre interface</strong> par-dessus MedOS. Toutes les réponses sont
              enveloppées dans <code>{`{ "data": ... }`}</code>. Toutes les routes sont
              scopées au <strong>seul patient du token</strong>.
            </p>
            <div className="not-prose overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200">
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Endpoint</th>
                    <th className="py-2 pr-4 font-medium">Méthode</th>
                    <th className="py-2 font-medium">Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/whoami</td><td className="py-2 pr-4">GET</td><td className="py-2 text-slate-600">—</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/appointments</td><td className="py-2 pr-4">GET</td><td className="py-2 text-slate-600">med:appointments:read</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/appointments</td><td className="py-2 pr-4">POST</td><td className="py-2 text-slate-600">med:appointments:write</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/prescriptions</td><td className="py-2 pr-4">GET</td><td className="py-2 text-slate-600">med:prescriptions:read</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/threads</td><td className="py-2 pr-4">GET</td><td className="py-2 text-slate-600">med:messages:read</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/threads/:id/messages</td><td className="py-2 pr-4">GET</td><td className="py-2 text-slate-600">med:messages:read</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/threads/:id/messages</td><td className="py-2 pr-4">POST</td><td className="py-2 text-slate-600">med:messages:write</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/teleconsult/appointment/:id/join</td><td className="py-2 pr-4">POST</td><td className="py-2 text-slate-600">med:teleconsult:join</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/notes</td><td className="py-2 pr-4">GET</td><td className="py-2 text-slate-600">med:notes:read</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/notes/:id/read</td><td className="py-2 pr-4">POST</td><td className="py-2 text-slate-600">med:notes:read</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/forms</td><td className="py-2 pr-4">GET</td><td className="py-2 text-slate-600">med:forms:read</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/forms/:id</td><td className="py-2 pr-4">GET</td><td className="py-2 text-slate-600">med:forms:read</td></tr>
                  <tr><td className="py-2 pr-4">/v1/medos/embed/me/health</td><td className="py-2 pr-4">POST</td><td className="py-2 text-slate-600">med:health:write</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-600">
              Le mode <code>patient-portal</code> couvre tous ces scopes. Les données médicales
              restent chez Cimolace (multi-tenant + RLS) ; votre app n&apos;affiche que celles du
              patient courant.
            </p>
          </section>

          <section id="api-keys">
            <h2>Clés API tenant</h2>
            <p>Les clés API sont créées par le staff Cimolace, ou via <a href="https://app.cimolace.space" target="_blank">app.cimolace.space</a> (panneau admin tenant).</p>
            <ul>
              <li>Format : <code>mdk_&lt;slug&gt;_&lt;48 chars hex&gt;</code></li>
              <li><strong>Stockée hashée SHA-256</strong> — irrécupérable une fois affichée. Si vous la perdez, créez-en une nouvelle.</li>
              <li>Révocation immédiate via <code>DELETE /admin/tenants/:id/api-keys/:keyId</code></li>
              <li>Stat d&apos;usage : champ <code>last_used_at</code> à chaque requête</li>
            </ul>
          </section>

          <section id="securite">
            <h2>Sécurité</h2>
            <ul>
              <li><strong>JWT court 15 min</strong> — pas de refresh, votre backend réémet à chaque page load.</li>
              <li><strong>CORS strict</strong> — seuls les domaines whitelist dans <code>tenant_domains</code> peuvent appeler <code>/embed/token</code>.</li>
              <li><strong>Clé API hashée</strong> — SHA-256, jamais stockée en clair.</li>
              <li><strong>Scope par mode</strong> — un token <code>consent-form</code> ne peut PAS lire les notes.</li>
              <li><strong>RBAC patient</strong> — un embed-token ne peut accéder qu&apos;aux données de SON patient.</li>
              <li><strong>Audit log automatique</strong> — chaque accès est tracé dans <code>med_audit_log</code>.</li>
            </ul>
          </section>

          <section id="rgpd">
            <h2>RGPD &amp; audit</h2>
            <p>MedOS est nativement RGPD :</p>
            <ul>
              <li><code>med_audit_log</code> — chaque lecture/écriture de note est loggée (qui, quand, depuis quelle IP)</li>
              <li><code>med_consent_records</code> — chaque consentement granulaire avec preuve (IP, user-agent, signature optionnelle, version du texte)</li>
              <li><code>med_gdpr_exports</code> — droit d&apos;accès / portabilité (export JSON ou PDF)</li>
              <li><code>med_gdpr_anonymizations</code> — droit à l&apos;oubli (pseudonymisation déterministe SHA-256)</li>
            </ul>
          </section>

          <section id="troubleshooting">
            <h2>Troubleshooting</h2>
            <h3>Le widget ne s&apos;affiche pas</h3>
            <ul>
              <li>Vérifier que <code>&lt;div id=&quot;medos-portal&quot;&gt;</code> existe AVANT le script</li>
              <li>Console : chercher les erreurs CORS / 403</li>
              <li>Tester en curl : <code>curl -X POST .../embed/token -H &quot;Origin: votre-domaine&quot;</code></li>
            </ul>
            <h3>Origin non autorisé (403)</h3>
            <p>Votre domaine n&apos;est pas dans <code>tenant_domains</code>. Contactez le staff Cimolace.</p>
            <h3>Tenant inactif</h3>
            <p>Le tenant doit avoir <code>status = &apos;active&apos;</code> ET au moins un service MedOS activé.</p>
            <h3>Token expired</h3>
            <p>Les JWT durent 15 min. Le widget les réémet automatiquement. En Niveau 2, votre backend doit réémettre à chaque page load.</p>
            <h3>Aucune note partagée</h3>
            <p>Le patient n&apos;a pas encore de note signée + partagée par un praticien.</p>
          </section>

          <section id="changelog">
            <h2>Changelog</h2>
            <ul>
              <li><strong>2026-05-30 v1.2</strong> — API patient <strong>complète</strong> : rendez-vous, ordonnances, messagerie et téléconsultation exposés via <code>/embed/me/*</code> (scopes <code>appointments</code>, <code>prescriptions</code>, <code>messages</code>, <code>teleconsult</code>). Mode &ldquo;votre app, votre UI&rdquo;.</li>
              <li><strong>2026-05-28 v1.1</strong> — Niveau 2 SSO via <code>/embed/server-token</code>. Support <code>data-embed-token</code>. Endpoints data <code>/embed/me/*</code>.</li>
              <li><strong>2026-05-28 v1.0</strong> — Widget JS embed.js. Modes patient-portal, consent-form, health-tracker. Iframe <code>/embed/[mode]</code>. ApiKeyGuard.</li>
            </ul>
          </section>

          <div className="not-prose mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <h3 className="text-xl font-bold text-slate-900">Prêt à intégrer ?</h3>
            <p className="mt-2 text-slate-600">Demandez votre clé API tenant et activez MedOS sur votre site en quelques minutes.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href="https://app.cimolace.space" target="_blank" className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700">
                Accéder à l&apos;admin
              </a>
              <a href="/contact" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
                Contacter l&apos;équipe
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
