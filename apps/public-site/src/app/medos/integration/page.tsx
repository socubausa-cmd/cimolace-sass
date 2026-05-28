import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Intégrer MedOS — 3 modes officiels | Cimolace",
  description:
    "Connectez MedOS à votre site existant, hébergez-le sous votre domaine, ou créez votre espace MedOS Cimolace. 3 modes d'intégration officiels avec exemples de code.",
  openGraph: {
    title: "Intégrer MedOS — Documentation",
    description:
      "Widget JS, iframe, API REST. MedOS s'intègre à tout site. Conforme RGPD.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function MedOSIntegrationPage() {
  return (
    <main className="bg-white text-slate-900">
      {/* ───────────────────────────── Hero ─────────────────────────── */}
      <section className="bg-gradient-to-b from-slate-900 to-black text-white py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
            Documentation d&apos;intégration
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Intégrer MedOS dans votre infrastructure
          </h1>
          <p className="text-xl text-white/70 max-w-3xl">
            Vous gardez votre site. Cimolace fournit le moteur médical.
            <br />
            <strong className="text-white">Trois modes officiels</strong>,
            chacun pensé pour un type de client différent.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#mode-a"
              className="rounded-full bg-white/10 hover:bg-white/20 px-5 py-2.5 text-sm font-medium border border-white/20"
            >
              Mode A · Hébergé
            </a>
            <a
              href="#mode-b"
              className="rounded-full bg-white/10 hover:bg-white/20 px-5 py-2.5 text-sm font-medium border border-white/20"
            >
              Mode B · Domaine perso
            </a>
            <a
              href="#mode-c"
              className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 text-sm font-medium"
            >
              Mode C · Embarqué dans votre site
            </a>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Matrice de choix ──────────────────── */}
      <section className="py-20 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Quel mode choisir ?
          </h2>
          <p className="text-slate-600 mb-10">
            Répondez à une question simple : votre cabinet a-t-il déjà un
            site web ?
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <ChoiceCard
              tag="Mode A"
              title="Pas de site existant"
              subtitle="MedOS Hébergé"
              description="On vous fournit tout : sous-domaine, portail, back-office. Time-to-market < 1 heure."
              href="#mode-a"
              color="bg-indigo-50 border-indigo-200"
              accent="text-indigo-700"
            />
            <ChoiceCard
              tag="Mode B"
              title="Domaine acheté, sans site"
              subtitle="Domaine personnalisé"
              description="Vous gardez votre URL. Cimolace héberge l'expérience sous votre marque, SSL automatique."
              href="#mode-b"
              color="bg-purple-50 border-purple-200"
              accent="text-purple-700"
            />
            <ChoiceCard
              tag="Mode C"
              title="Site existant actif"
              subtitle="Embarqué dans votre site"
              description="Vous ajoutez 4 lignes de HTML. Le portail patient s'affiche dans votre site. Cas Zahir Wellness."
              href="#mode-c"
              color="bg-emerald-50 border-emerald-200"
              accent="text-emerald-700"
              recommended
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────────── Mode A ────────────────────────── */}
      <section id="mode-a" className="py-20 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader
            tag="Mode A"
            title="MedOS Hébergé"
            subtitle="Pour un cabinet qui n'a pas (encore) de site web"
          />

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h3 className="text-xl font-bold mb-3">Comment ça marche</h3>
              <ol className="space-y-3 text-slate-700">
                <Step n={1}>
                  Vous créez votre espace sur{" "}
                  <Link
                    href="/"
                    className="text-indigo-600 hover:underline"
                  >
                    cimolace.space
                  </Link>
                </Step>
                <Step n={2}>Vous activez le moteur MedOS</Step>
                <Step n={3}>
                  Votre cabinet est disponible sous{" "}
                  <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">
                    votre-nom.medos.cimolace.space
                  </code>
                </Step>
                <Step n={4}>
                  Vous personnalisez logo, couleurs, contenu depuis votre
                  dashboard Cimolace
                </Step>
              </ol>
            </div>

            <FeatureBox
              title="Ce que vous obtenez immédiatement"
              items={[
                "Landing page brandée à votre cabinet",
                "Portail patient (notes, formulaires, journal santé)",
                "Back-office praticien (dossiers, notes SOAP, IA charting)",
                "Conformité RGPD native (audit log, consentement)",
                "Support et hébergement Cimolace",
              ]}
            />
          </div>

          <div className="mt-10 rounded-2xl bg-slate-900 text-white p-8">
            <p className="text-sm text-white/60 mb-2">Exemple d&apos;URL</p>
            <p className="font-mono text-lg">
              https://<span className="text-emerald-400">clinique-marie</span>
              .medos.cimolace.space
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────────────── Mode B ────────────────────────── */}
      <section
        id="mode-b"
        className="py-20 border-b border-slate-200 bg-slate-50"
      >
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader
            tag="Mode B"
            title="Domaine personnalisé"
            subtitle="Vous avez un domaine, on l'utilise comme façade"
          />

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h3 className="text-xl font-bold mb-3">Comment ça marche</h3>
              <ol className="space-y-3 text-slate-700">
                <Step n={1}>
                  Vous avez déjà acheté{" "}
                  <code className="bg-slate-200 px-1.5 py-0.5 rounded text-sm">
                    clinique-x.fr
                  </code>{" "}
                  (ou .com, .ga, .ci, etc.)
                </Step>
                <Step n={2}>
                  Vous ajoutez 2 enregistrements DNS (CNAME + TXT) selon nos
                  instructions
                </Step>
                <Step n={3}>
                  Cimolace provisionne le certificat SSL automatiquement
                  (Cloudflare for SaaS)
                </Step>
                <Step n={4}>
                  Votre expérience MedOS est servie sous votre domaine. Aucune
                  mention de cimolace.space.
                </Step>
              </ol>
            </div>

            <FeatureBox
              title="Avantages"
              items={[
                "Branding 100% à votre marque (URL, certificat, design)",
                "SEO de votre cabinet préservé",
                "Aucune compétence technique requise",
                "Cimolace garde le contrôle technique (sécurité, sauvegardes, mises à jour)",
              ]}
            />
          </div>

          <div className="mt-10 grid md:grid-cols-2 gap-4">
            <CodeBlock
              title="Étape DNS — CNAME"
              language="dns"
              code={`clinique-x.fr → CNAME → custom.cimolace.space.`}
            />
            <CodeBlock
              title="Étape DNS — Vérification"
              language="dns"
              code={`_cimolace.clinique-x.fr → TXT → "cimolace-verify=abc123..."`}
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────────── Mode C ────────────────────────── */}
      <section id="mode-c" className="py-20 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader
            tag="Mode C"
            title="Embarqué dans votre site existant"
            subtitle="Vous gardez votre site. MedOS s'invite dedans."
          />

          <p className="text-slate-700 mb-10 max-w-3xl">
            Ce mode est conçu pour les clients comme{" "}
            <strong>Zahir Wellness</strong> qui ont déjà un site web en
            production et veulent simplement <em>brancher</em> un moteur
            médical sans casser quoi que ce soit.
          </p>

          <p className="text-slate-600 mb-10 max-w-3xl">
            Trois options techniques selon votre niveau d&apos;intégration.
          </p>

          {/* Sous-mode C.1 — Widget JS */}
          <div className="mb-16">
            <SubModeHeader
              code="C.1"
              title="Widget JavaScript"
              recommended
              description="Recommandé en premier. 4 lignes de HTML, ça fonctionne immédiatement."
            />

            <p className="text-slate-700 mb-4">
              Le widget MedOS est un fichier JavaScript hébergé par Cimolace.
              Il crée un Shadow DOM pour ne pas entrer en conflit avec votre
              CSS et s&apos;authentifie automatiquement via votre Origin HTTP
              (whitelisté côté Cimolace).
            </p>

            <CodeBlock
              title="À coller dans votre HTML"
              language="html"
              code={`<!-- Sur n'importe quelle page de votre site -->
<div id="medos-portal"></div>

<script
  src="https://cimolace.space/medos/v1/embed.js"
  data-tenant="zahirwellness"
  data-mode="patient-portal"
  data-primary-color="#10b981"
  async
></script>`}
            />

            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <InfoBox
                title="Modes disponibles"
                items={[
                  "patient-portal — Dossier patient + notes partagées",
                  "consent-form — Formulaire de consentement",
                  "intake-form — Anamnèse premier RDV",
                  "health-tracker — Journal santé (humeur, sommeil)",
                  "appointment-booker — Prise de RDV (à venir)",
                ]}
              />
              <InfoBox
                title="Personnalisation"
                items={[
                  "data-tenant — Identifiant tenant Cimolace (obligatoire)",
                  "data-mode — Choix du widget (obligatoire)",
                  "data-primary-color — Couleur d'accent (#hex)",
                  "data-target — Sélecteur CSS personnalisé (#mon-div)",
                  "data-api-base — Surcharge de l'URL API (multi-env)",
                ]}
              />
            </div>
          </div>

          {/* Sous-mode C.2 — Iframe */}
          <div className="mb-16">
            <SubModeHeader
              code="C.2"
              title="Iframe signée"
              description="Idéal pour Webflow, Squarespace, Wix, ou tout site avec CSP stricte."
            />

            <p className="text-slate-700 mb-4">
              Si votre framework bloque le JavaScript tiers (CSP), utilisez
              une iframe pleine page. Cimolace gère l&apos;auth via l&apos;Origin
              de l&apos;iframe.
            </p>

            <CodeBlock
              title="Iframe à intégrer"
              language="html"
              code={`<iframe
  src="https://cimolace.space/embed/patient-portal?tenant=zahirwellness&primary=10b981"
  width="100%"
  height="600"
  frameborder="0"
  loading="lazy"
></iframe>`}
            />

            <div className="mt-6">
              <InfoBox
                title="Événements postMessage (parent ↔ iframe)"
                items={[
                  'iframe → parent : { type: "medos:ready" }',
                  'iframe → parent : { type: "medos:height", height: 720 } (auto-resize)',
                  'iframe → parent : { type: "medos:event", name: "note-read", payload }',
                  'parent → iframe : { type: "medos:theme", primary: "#hex" }',
                ]}
              />
            </div>
          </div>

          {/* Sous-mode C.3 — API + SDK */}
          <div>
            <SubModeHeader
              code="C.3"
              title="API REST + clé tenant"
              description="Pour les équipes dev qui veulent construire leur propre UI sur le moteur MedOS."
            />

            <p className="text-slate-700 mb-4">
              Votre backend appelle directement{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">
                api.cimolace.space/med/*
              </code>{" "}
              avec une clé API tenant. Rate limiting par tenant, webhooks
              sortants pour synchroniser avec votre CRM.
            </p>

            <CodeBlock
              title="Exemple curl — Lister les patients"
              language="bash"
              code={`curl https://api.cimolace.space/med/patients \\
  -H "Authorization: Bearer mdk_zahirwellness_a1b2c3d4..." \\
  -H "X-Tenant-Slug: zahirwellness"`}
            />

            <CodeBlock
              title="Exemple Node.js — Créer un dossier patient"
              language="javascript"
              code={`const response = await fetch(
  "https://api.cimolace.space/med/patients",
  {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.CIMOLACE_API_KEY}\`,
      "X-Tenant-Slug": "zahirwellness",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      patient_user_id: "uuid-supabase-de-votre-user",
      first_name: "Alice",
      last_name: "Dupont",
      consent_given: true,
    }),
  },
);
const { data: patient } = await response.json();`}
            />

            <div className="mt-6">
              <InfoBox
                title="Endpoints principaux MedOS"
                items={[
                  "POST /med/patients — Créer dossier patient",
                  "GET /med/patients/:id — Lire dossier",
                  "POST /med/patients/:id/notes — Créer note SOAP",
                  "POST /med/notes/:id/sign — Signer (verrouiller) note",
                  "POST /med/notes/:id/share — Partager note au patient",
                  "POST /med/forms/:id/responses — Soumettre formulaire",
                  "POST /med/health — Ajouter entrée journal santé",
                  "POST /med/charting/start — Lancer transcription IA",
                ]}
              />
            </div>

            <p className="text-sm text-slate-500 mt-4">
              Documentation OpenAPI complète :{" "}
              <a
                href="https://api.cimolace.space/docs"
                className="text-indigo-600 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                api.cimolace.space/docs
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────── Pas-à-pas Zahir Wellness ────────────────── */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
            Cas pratique
          </p>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Comment Zahir Wellness branche MedOS
          </h2>
          <p className="text-white/70 mb-12 max-w-2xl">
            Zahir a déjà son site en production. Voici les 5 étapes pour
            ajouter le portail patient MedOS sans casser l&apos;existant.
          </p>

          <div className="space-y-4">
            <ZahirStep
              n={1}
              title="Cimolace crée un tenant zahirwellness"
              body="Un staff Cimolace provisionne le tenant et active le moteur MedOS via le back-office admin. Pas d'action côté Zahir."
            />
            <ZahirStep
              n={2}
              title="Cimolace whitelist le domaine zahirwellness.com"
              body="Dans le back-office admin Cimolace : section 'Intégration MedOS' → 'Domaines autorisés' → ajout de zahirwellness.com."
            />
            <ZahirStep
              n={3}
              title="Cimolace génère une clé API tenant"
              body="Section 'Clés API' → 'Générer une clé'. La valeur brute (mdk_zahirwellness_…) est affichée une seule fois et transmise au dev Zahir de manière sécurisée."
            />
            <ZahirStep
              n={4}
              title="Zahir colle le snippet dans une page test"
              body="Sur une page cachée (/espace-membre par exemple), Zahir ajoute les 4 lignes HTML du widget. Le widget s'authentifie automatiquement via l'Origin HTTP."
            />
            <ZahirStep
              n={5}
              title="Validation shadow puis bascule progressive"
              body="Une semaine de test sans trafic réel (validation auth, audit, RGPD), puis activation via feature flag : 10 % des patients → 50 % → 100 %. Rollback = retirer le <script>."
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────── Sécurité ────────────────────────── */}
      <section className="py-20 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-bold mb-10">
            Sécurité et conformité
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <SecurityCard
              title="Isolation multi-tenant"
              body="Chaque tenant a son tenant_id propagé sur toutes les tables MedOS. Row Level Security (RLS) PostgreSQL impose l'isolation au niveau base de données — pas seulement applicatif."
            />
            <SecurityCard
              title="Audit log RGPD automatique"
              body="Chaque accès patient/note est tracé dans med_audit_log : qui, quand, IP, user agent, ressource. Append-only, jamais modifié, jamais supprimé."
            />
            <SecurityCard
              title="Authentification multi-couches"
              body="3 méthodes : JWT Supabase (utilisateurs Cimolace), clé API tenant (server-to-server), embed-token JWT court (widget navigateur). Chaque méthode a son guard et son scope."
            />
            <SecurityCard
              title="CORS dynamique strict"
              body="Le navigateur d'un site externe ne peut appeler MedOS que si son domaine est whitelisté dans tenant_domains. Aucune fuite possible vers un site non autorisé."
            />
            <SecurityCard
              title="Aucun secret côté client"
              body="Le widget JS et l'iframe n'embarquent aucune clé secrète. L'auth se fait via l'Origin HTTP que le navigateur ne peut pas falsifier."
            />
            <SecurityCard
              title="Notes signées non modifiables"
              body="Une fois signée par le praticien, une note SOAP devient immuable. Toute tentative de modification est rejetée par l'API et auditée."
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────── CTA ─────────────────────────────── */}
      <section className="py-24 bg-emerald-50 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
            Prêt à intégrer MedOS ?
          </h2>
          <p className="text-slate-700 text-lg mb-8">
            Créez votre tenant Cimolace, activez MedOS, récupérez votre clé
            API. Vous êtes branché en 30 minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 px-6 py-3 font-medium"
            >
              Créer mon tenant
            </Link>
            <a
              href="https://api.cimolace.space/docs"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 px-6 py-3 font-medium"
            >
              Documentation API complète
            </a>
            <Link
              href="/contact"
              className="rounded-full bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 px-6 py-3 font-medium"
            >
              Contacter l&apos;équipe
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

// ──────────────────────────────── Sub-components ──────────────────────────

function ChoiceCard({
  tag,
  title,
  subtitle,
  description,
  href,
  color,
  accent,
  recommended,
}: {
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  color: string;
  accent: string;
  recommended?: boolean;
}) {
  return (
    <a
      href={href}
      className={`block rounded-2xl border-2 p-6 transition-all hover:scale-[1.02] ${color} relative`}
    >
      {recommended && (
        <span className="absolute -top-3 right-4 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full">
          RECOMMANDÉ
        </span>
      )}
      <p className={`text-xs uppercase tracking-widest font-bold mb-2 ${accent}`}>
        {tag}
      </p>
      <h3 className="text-xl font-bold text-slate-900 mb-1">{title}</h3>
      <p className={`text-sm font-semibold mb-3 ${accent}`}>{subtitle}</p>
      <p className="text-sm text-slate-600">{description}</p>
    </a>
  );
}

function SectionHeader({
  tag,
  title,
  subtitle,
}: {
  tag: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-10">
      <p className="text-xs uppercase tracking-widest text-emerald-600 font-bold mb-3">
        {tag}
      </p>
      <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-3">
        {title}
      </h2>
      <p className="text-lg text-slate-600">{subtitle}</p>
    </div>
  );
}

function SubModeHeader({
  code,
  title,
  description,
  recommended,
}: {
  code: string;
  title: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="rounded-full bg-slate-900 text-white text-xs font-mono px-3 py-1">
          {code}
        </span>
        <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
        {recommended && (
          <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-1 rounded">
            Recommandé
          </span>
        )}
      </div>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function FeatureBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6">
      <h3 className="text-lg font-bold mb-4">{title}</h3>
      <ul className="space-y-2 text-slate-700 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-emerald-500 flex-shrink-0">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <h4 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wide">
        {title}
      </h4>
      <ul className="space-y-1.5 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="font-mono text-xs">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CodeBlock({
  title,
  language,
  code,
}: {
  title: string;
  language: string;
  code: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <span className="text-xs font-mono text-slate-500">{language}</span>
      </div>
      <pre className="bg-slate-900 text-slate-100 p-5 overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ZahirStep({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4 items-start bg-white/5 border border-white/10 rounded-xl p-5">
      <span className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-500 text-black font-bold flex items-center justify-center">
        {n}
      </span>
      <div>
        <h3 className="font-bold text-white mb-1">{title}</h3>
        <p className="text-white/70 text-sm">{body}</p>
      </div>
    </div>
  );
}

function SecurityCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-6 bg-white">
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{body}</p>
    </div>
  );
}
