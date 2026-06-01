import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, CodeTabs } from "./CodeTabs";
import { Sidebar } from "./Sidebar";

export const metadata: Metadata = {
  title: "Documentation Mbolo — API Storefront e-commerce | Cimolace",
  description:
    "Connectez votre site existant à Mbolo : catalogue, panier, commandes via une API REST authentifiée par clé. Exemples cURL, Next.js, PHP. Checkout invité, sécurité, prix recalculés côté serveur.",
};

const BASE = "https://api.cimolace.space/v1/mbolo/storefront";

export default function MboloDocPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero ribbon */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-indigo-600">
            <Link href="/" className="hover:underline">Cimolace</Link>
            <span>/</span>
            <span>Mbolo — Documentation développeur</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Brancher Mbolo sur votre site
          </h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            <strong>Mbolo</strong> est le moteur e-commerce de Cimolace. Votre
            site existant garde son design ; Mbolo gère le catalogue, le panier
            et les commandes via une API REST authentifiée par clé. Aucun compte
            client requis pour acheter — checkout invité natif. Vous codez
            uniquement l&apos;affichage ; les prix, le stock et les commandes
            vivent dans Mbolo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a href="#quickstart" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
              Quickstart 5 min →
            </a>
            <a href="/medos/integration" className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
              Voir aussi : API MedOS
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
            .docs-content th { text-align: left; border-bottom: 2px solid rgb(226 232 240); padding: 0.5rem; color: rgb(15 23 42); }
            .docs-content td { border-bottom: 1px solid rgb(241 245 249); padding: 0.5rem; vertical-align: top; }
            .docs-content table code { font-size: 0.75rem; }
          `}</style>

          <section id="overview">
            <h2>Vue d&apos;ensemble</h2>
            <p>
              Vous avez déjà un site (Next.js, WordPress, Shopify-like maison,
              Webflow…). Mbolo lui ajoute une vraie boutique sans que vous ayez à
              gérer une base de données produits, un panier ou un back-office.
              Le principe :
            </p>
            <ul>
              <li><strong>Vous appelez l&apos;API Mbolo</strong> avec une clé tenant (<code>mbk_…</code>) pour lister le catalogue.</li>
              <li><strong>Vous affichez</strong> les produits avec votre propre design.</li>
              <li><strong>Vous postez la commande</strong> — Mbolo recalcule les prix, enregistre la commande, vous renvoie un numéro.</li>
              <li><strong>Le commerçant gère tout</strong> depuis le back-office Mbolo (catalogue, stock, commandes).</li>
            </ul>
            <p>
              Vos acheteurs n&apos;ont pas besoin de compte Cimolace : le
              checkout est <strong>invité</strong> (un email suffit). Vous gardez
              votre domaine et votre marque ; Mbolo reste invisible côté client.
            </p>
            <div className="not-prose my-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
              <p className="m-0 text-sm font-medium text-indigo-900">
                💡 C&apos;est le même modèle d&apos;intégration que <a href="/medos/integration" className="underline">MedOS « Mode C »</a> (santé) : une clé API tenant, des endpoints REST scoping automatiquement votre boutique. Un site peut combiner plusieurs moteurs Cimolace.
              </p>
            </div>
          </section>

          <section id="quickstart">
            <h2>Quickstart (5 minutes)</h2>

            <h3>1. Obtenir une clé API</h3>
            <p>
              Le commerçant génère une clé storefront depuis son espace Cimolace
              (ou le staff la crée). Elle ressemble à
              {" "}<code>mbk_votreboutique_xxxxxxxx…</code> et s&apos;envoie en
              header <code>Authorization: Bearer</code>. La clé identifie le
              tenant : tous les appels sont automatiquement isolés à votre
              boutique.
            </p>

            <h3>2. Lister le catalogue</h3>
            <CodeTabs tabs={[
              { label: "cURL", lang: "bash", code: `curl ${BASE}/products \\
  -H "Authorization: Bearer mbk_votreboutique_xxxxxxxx"` },
              { label: "Next.js", lang: "tsx", code: `// app/boutique/page.tsx (Server Component)
async function getProducts() {
  const res = await fetch(
    "${BASE}/products",
    {
      headers: { Authorization: \`Bearer \${process.env.MBOLO_KEY}\` },
      next: { revalidate: 60 },
    },
  );
  const { data } = await res.json();
  return data; // tableau de produits
}

export default async function Boutique() {
  const products = await getProducts();
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name} — {(p.price_cents / 100).toLocaleString()} {p.currency}</li>
      ))}
    </ul>
  );
}` },
              { label: "PHP", lang: "php", code: `<?php
$ch = curl_init("${BASE}/products");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("MBOLO_KEY")],
]);
$body = json_decode(curl_exec($ch), true);
$products = $body["data"];
foreach ($products as $p) {
  echo $p["name"] . " — " . ($p["price_cents"] / 100) . " " . $p["currency"] . "\\n";
}` },
            ]} />

            <h3>3. Encaisser une commande</h3>
            <p>Postez le panier ; Mbolo recalcule tout et renvoie la commande.</p>
            <CodeBlock lang="bash" code={`curl -X POST ${BASE}/orders \\
  -H "Authorization: Bearer mbk_votreboutique_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer": { "email": "client@example.com", "name": "Awa N." },
    "items": [
      { "slug": "equilibre-femme", "variantId": "<id-variante>", "quantity": 1 },
      { "slug": "vitalite-homme", "quantity": 2 }
    ]
  }'`} />
          </section>

          <section id="architecture">
            <h2>Architecture</h2>
            <p>
              Une seule base de données, isolée par tenant. La clé API résout
              votre <code>tenant_id</code> ; chaque requête est filtrée
              automatiquement — vous ne voyez jamais le catalogue d&apos;une
              autre boutique. Trois ressources :
            </p>
            <ul>
              <li><strong>Catégories</strong> — regroupent les produits (optionnel).</li>
              <li><strong>Produits</strong> — prix, stock, images, variantes, bénéfices, SEO.</li>
              <li><strong>Commandes</strong> — créées au checkout, consultables au back-office.</li>
            </ul>
            <p>Base de l&apos;API : <code>{BASE}</code></p>
          </section>

          <section id="auth">
            <h2>Authentification</h2>
            <p>
              Toutes les requêtes storefront exigent une clé API tenant dans le
              header <code>Authorization</code>. Préfixe <code>mbk_</code> pour
              les clés Mbolo.
            </p>
            <CodeBlock lang="http" code={`Authorization: Bearer mbk_votreboutique_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`} />
            <table>
              <thead><tr><th>Règle</th><th>Détail</th></tr></thead>
              <tbody>
                <tr><td>Stockage</td><td>La clé n&apos;est jamais stockée en clair (hash SHA-256 côté serveur).</td></tr>
                <tr><td>Isolation</td><td>La clé résout le tenant → vos données uniquement.</td></tr>
                <tr><td>Révocation</td><td>Une clé révoquée est refusée immédiatement (401).</td></tr>
                <tr><td>Secret</td><td>Gardez la clé côté serveur. Ne l&apos;exposez jamais dans le JS public du navigateur.</td></tr>
              </tbody>
            </table>
            <div className="not-prose my-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="m-0 text-sm font-medium text-amber-900">
                ⚠️ La clé donne accès à votre catalogue ET à la création de commandes. Appelez l&apos;API depuis <strong>votre backend</strong> (Server Component, route API, PHP…), pas depuis le navigateur.
              </p>
            </div>
          </section>

          <section id="prix">
            <h2>Prix &amp; devises</h2>
            <p>
              Tous les montants sont en <strong>centimes entiers</strong>{" "}
              (<code>price_cents</code>), avec un champ <code>currency</code>
              {" "}(défaut <code>XAF</code>). Pour afficher : divisez par 100.
              Une variante porte un <code>price_delta_cents</code> qui
              s&apos;ajoute au prix de base.
            </p>
            <p>
              <strong>Les prix envoyés par le client sont ignorés.</strong> Au
              checkout, Mbolo relit chaque produit/variante en base et recalcule
              le total — impossible de falsifier un prix côté navigateur.
            </p>
          </section>

          <section id="endpoint-categories">
            <h2>GET /categories</h2>
            <p>Liste les catégories actives de votre boutique.</p>
            <CodeBlock lang="bash" code={`curl ${BASE}/categories -H "Authorization: Bearer mbk_..."`} />
            <CodeBlock lang="json" code={`{
  "data": [
    { "id": "a0…", "slug": "complements", "name": "Compléments", "sort_order": 1 }
  ]
}`} />
          </section>

          <section id="endpoint-products">
            <h2>GET /products</h2>
            <p>
              Liste les produits actifs (les vedettes en premier), images
              jointes. Filtre optionnel <code>?category=&lt;id&gt;</code>.
            </p>
            <CodeBlock lang="bash" code={`curl "${BASE}/products?category=a0…" -H "Authorization: Bearer mbk_..."`} />
            <CodeBlock lang="json" code={`{
  "data": [
    {
      "id": "b0…",
      "name": "Équilibre Femme",
      "slug": "equilibre-femme",
      "price_cents": 2990000,
      "compare_at_price_cents": 3490000,
      "currency": "XAF",
      "stock": 50,
      "is_featured": true,
      "tagline": "Harmonie au naturel",
      "benefits": ["100% naturel", "Soutient le cycle"],
      "images": [{ "url": "https://…", "is_primary": true }]
    }
  ]
}`} />
          </section>

          <section id="endpoint-product">
            <h2>GET /products/:slug</h2>
            <p>Détail d&apos;un produit par son slug, avec images et variantes.</p>
            <CodeBlock lang="bash" code={`curl ${BASE}/products/equilibre-femme -H "Authorization: Bearer mbk_..."`} />
            <CodeBlock lang="json" code={`{
  "data": {
    "id": "b0…",
    "name": "Équilibre Femme",
    "price_cents": 2990000,
    "currency": "XAF",
    "benefits": ["100% naturel"],
    "images": [{ "url": "https://…", "is_primary": true }],
    "variants": [
      { "id": "d0…", "label": "Cure 1 mois", "price_delta_cents": 0 },
      { "id": "d1…", "label": "Cure 3 mois", "price_delta_cents": 700000 }
    ]
  }
}`} />
          </section>

          <section id="endpoint-orders">
            <h2>POST /orders — checkout invité</h2>
            <p>
              Crée une commande. <code>customer.email</code> est obligatoire ;
              <code>items</code> référence chaque produit par <code>slug</code>
              {" "}ou <code>productId</code>, avec un <code>variantId</code>
              {" "}optionnel et une <code>quantity</code>.
            </p>
            <h3>Corps de requête</h3>
            <CodeBlock lang="json" code={`{
  "customer": {
    "email": "client@example.com",
    "name": "Awa N.",
    "phone": "+241060000000",
    "address": { "city": "Libreville", "country": "GA" }
  },
  "items": [
    { "slug": "equilibre-femme", "variantId": "d1…", "quantity": 1 },
    { "productId": "b1…", "quantity": 2 }
  ]
}`} />
            <h3>Réponse</h3>
            <CodeBlock lang="json" code={`{
  "data": {
    "order": {
      "order_number": "MB-1896-MPTXPO5N",
      "status": "pending",
      "channel": "storefront",
      "total_cents": 9270000,
      "currency": "XAF",
      "customer_email": "client@example.com"
    },
    "items": [ /* lignes recalculées côté serveur */ ],
    "total_cents": 9270000,
    "currency": "XAF"
  }
}`} />
            <table>
              <thead><tr><th>Champ</th><th>Règle</th></tr></thead>
              <tbody>
                <tr><td><code>customer.email</code></td><td>Requis.</td></tr>
                <tr><td><code>items[].slug</code> / <code>productId</code></td><td>L&apos;un des deux. Produit inactif ou hors tenant → 400.</td></tr>
                <tr><td><code>items[].variantId</code></td><td>Optionnel. Doit appartenir au produit, sinon 400.</td></tr>
                <tr><td><code>total_cents</code></td><td>Calculé serveur (prix base + deltas variantes × quantités).</td></tr>
              </tbody>
            </table>
          </section>

          <section id="securite">
            <h2>Sécurité</h2>
            <ul>
              <li><strong>Clé côté serveur uniquement</strong> — jamais dans le bundle navigateur.</li>
              <li><strong>Prix non falsifiables</strong> — recalcul systématique en base au checkout.</li>
              <li><strong>Isolation tenant</strong> — chaque requête est filtrée par le tenant de la clé.</li>
              <li><strong>Révocation immédiate</strong> — une clé compromise se coupe en un clic (401 instantané).</li>
              <li><strong>Paiement</strong> — la commande naît en <code>pending</code>. Branchez votre PSP (Stripe, PawaPay…) puis confirmez la commande au back-office / via webhook.</li>
            </ul>
          </section>

          <section id="back-office">
            <h2>Back-office</h2>
            <p>
              Le commerçant gère sa boutique sans toucher au code, depuis
              l&apos;espace Cimolace :
            </p>
            <ul>
              <li><strong>Catalogue</strong> — créer/éditer produits, catégories, images, variantes, stock, vedettes.</li>
              <li><strong>Commandes</strong> — suivre les commandes boutique et storefront, voir le détail des lignes et le client.</li>
            </ul>
            <p>
              Les produits créés au back-office sont immédiatement disponibles
              via l&apos;API storefront — votre site se met à jour tout seul.
            </p>
          </section>

          <section id="troubleshooting">
            <h2>Troubleshooting</h2>
            <table>
              <thead><tr><th>Symptôme</th><th>Cause probable</th></tr></thead>
              <tbody>
                <tr><td><code>401</code> sur tous les appels</td><td>Header <code>Authorization</code> absent, mal formé, ou clé révoquée/inconnue.</td></tr>
                <tr><td><code>401 « préfixe attendu »</code></td><td>La clé ne commence pas par <code>mbk_</code> (ou <code>cml_</code>).</td></tr>
                <tr><td><code>400 « Produit introuvable »</code></td><td>slug/productId erroné, produit inactif, ou appartenant à un autre tenant.</td></tr>
                <tr><td><code>400 « customer.email requis »</code></td><td>Le checkout exige au minimum un email.</td></tr>
                <tr><td>Catalogue vide</td><td>Aucun produit <code>is_active = true</code> dans votre tenant.</td></tr>
              </tbody>
            </table>
          </section>

          <section id="changelog">
            <h2>Changelog</h2>
            <ul>
              <li><strong>Wave 2</strong> — API storefront publique (clé API) + checkout invité.</li>
              <li><strong>Wave 1</strong> — Catalogue riche : catégories, images, variantes, prix barrés, vedettes, bénéfices, SEO.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
