import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BookOpen, ChevronDown, Atom, Zap, Sparkles, Shield,
  Scale, Quote, FileText, GraduationCap, Eye, Globe,
  Flame, Star, ArrowRight, Waves, Circle, Triangle,
  Square, GitBranch, Minus, Plus, Activity, Layers,
  BarChart3, Network
} from 'lucide-react';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const PAGE_URL = `${PUBLIC}/ontodynamique`;
const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;

/* ─── UI Blocks ─── */
const SectionBox = ({ color, title, children }) => (
  <div className={`bg-${color}-500/[0.06] border border-${color}-500/20 rounded-xl p-5 my-4`}>
    <h4 className={`text-sm font-bold text-${color}-400 uppercase tracking-wider mb-3`}>{title}</h4>
    <div className="text-gray-300 leading-relaxed space-y-2">{children}</div>
  </div>
);

const LawBox = ({ title, children }) => (
  <div className="bg-[var(--school-accent)]/[0.08] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-xl p-5 my-4">
    <div className="flex items-center gap-2 mb-2">
      <Scale className="w-4 h-4 text-[var(--school-accent)]" />
      <span className="text-xs font-bold text-[var(--school-accent)] uppercase tracking-wider">{title}</span>
    </div>
    <p className="text-gray-200 leading-relaxed font-medium">{children}</p>
  </div>
);

const BQ = ({ children }) => (
  <div className="border-l-4 border-[var(--school-accent)] pl-5 py-3 my-5">
    <p className="text-lg font-serif italic text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] leading-relaxed">{children}</p>
  </div>
);

const DT = ({ headers, rows }) => (
  <div className="overflow-x-auto my-4">
    <table className="w-full text-sm border-collapse">
      <thead><tr>{headers.map((h, i) => <th key={i} className="text-left text-[var(--school-accent)] text-xs uppercase tracking-wider py-3 px-3 border-b border-white/10 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">{row.map((cell, j) => <td key={j} className="py-3 px-3 text-gray-300">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const ConstanteCard = ({ name, charge, nature, fonction, force, role, color, icon: Icon }) => (
  <div className={`bg-${color}-500/[0.06] border border-${color}-500/20 rounded-xl p-5 hover:border-${color}-500/40 transition-all`}>
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-lg bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center`}>
        <Icon className={`w-5 h-5 text-${color}-400`} />
      </div>
      <div>
        <h4 className="text-base font-bold text-white">{name}</h4>
        <span className={`text-xs font-mono text-${color}-400`}>charge {charge}</span>
      </div>
    </div>
    <div className="space-y-1.5 text-sm">
      <p className="text-gray-400"><span className="text-gray-200 font-semibold">Nature :</span> {nature}</p>
      <p className="text-gray-400"><span className="text-gray-200 font-semibold">Fonction :</span> {fonction}</p>
      <p className="text-gray-400"><span className="text-gray-200 font-semibold">Force :</span> {force}</p>
      <p className="text-gray-400"><span className="text-gray-200 font-semibold">Rôle :</span> {role}</p>
    </div>
  </div>
);

const RegimeCard = ({ number, name, geometrie, condition, vibration, masse, exemple, schema, color }) => (
  <div className={`bg-[#192734] border border-${color}-500/20 rounded-xl p-6 hover:border-${color}-500/40 transition-all`}>
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 rounded-lg bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center`}>
        <span className={`text-sm font-bold text-${color}-400`}>{number}</span>
      </div>
      <div>
        <h4 className="text-lg font-bold text-white">{name}</h4>
        <span className={`text-xs text-${color}-400`}>{geometrie}</span>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
      <div><span className="text-gray-500 text-xs block">Condition</span><span className="text-gray-300">{condition}</span></div>
      <div><span className="text-gray-500 text-xs block">Vibration</span><span className="text-gray-300">{vibration}</span></div>
      <div><span className="text-gray-500 text-xs block">Masse</span><span className="text-gray-300">{masse}</span></div>
      <div><span className="text-gray-500 text-xs block">Exemple</span><span className={`text-${color}-300 font-semibold`}>{exemple}</span></div>
    </div>
    <div className="bg-black/30 rounded-lg p-3 text-center font-mono text-sm text-gray-400">{schema}</div>
  </div>
);

const ChHead = ({ id, color, icon: Icon, number, title }) => (
  <div className="flex items-center gap-3" id={id}>
    <div className={`w-11 h-11 rounded-xl bg-${color}-500/10 border border-${color}-500/30 flex items-center justify-center`}>
      <Icon className={`w-5 h-5 text-${color}-400`} />
    </div>
    <div>
      <span className={`text-xs text-${color}-400 font-bold uppercase tracking-wider`}>Chapitre {number}</span>
      <h2 className="text-xl md:text-2xl font-serif font-bold text-white">{title}</h2>
    </div>
  </div>
);

const navItems = [
  { id: 'ch24', s: 'Ch.24' }, { id: 'ch25', s: 'Ch.25' }, { id: 'ch26', s: 'Ch.26' },
  { id: 'ch27', s: 'Ch.27' }, { id: 'ch28', s: 'Ch.28' }, { id: 'ch29', s: 'Ch.29' },
];

const OntodynamiquePage = () => {
  const [ac, setAc] = useState('ch24');
  const go = (id) => { setAc(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      <Helmet>
        <title>{`Ontodynamique — Partie V | ${SITE_NAME}`}</title>
        <meta name="description" content="Ontodynamique — Partie V de l'Histoire Complète du Cosmos. Mécanique Différentielle, Géométrie des Cordes Énergétiques, 4 régimes de cordes et sélection progressive par le 5ᵉ Manikongo." />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:type" content="book" />
        <meta property="og:title" content={`Ontodynamique — Partie V | ${SITE_NAME}`} />
        <meta property="og:description" content="Mécanique Différentielle et Géométrie des Cordes Énergétiques — Histoire Complète du Cosmos." />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Ontodynamique — Partie V | ${SITE_NAME}`} />
        <meta name="twitter:description" content="Cordes énergétiques, mécanique différentielle et formation des particules quantiques." />
        <meta name="keywords" content="Prorascience, ontodynamique, cordes énergétiques, mécanique différentielle, particules, Manikongo, espace-temps-énergie, sélection progressive" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Book', name: 'Ontodynamique — Partie V',
          author: { '@type': 'Person', name: '5ᵉ Manikongo', alternateName: 'Ngowazulu' },
          publisher: { '@type': 'Organization', name: SITE_NAME },
          inLanguage: 'fr', url: PAGE_URL,
          description: 'Mécanique Différentielle et Géométrie des Cordes Énergétiques — Histoire Complète du Cosmos.'
        })}</script>
      </Helmet>

      {/* HERO */}
      <section className="relative py-28 md:py-40 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/60 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[300px]" />
        <div className="absolute top-20 right-20 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[200px]" />
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-widest border border-emerald-500/20">
              <Atom className="w-3.5 h-3.5" /> Partie V
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
              <BookOpen className="w-3.5 h-3.5" /> Histoire du Cosmos
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400">Ontodynamique</span>
          </h1>
          <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto">Mécanique Différentielle et Géométrie des Cordes Énergétiques</p>
          <p className="text-gray-500 text-base">Par le <span className="text-[var(--school-accent)] font-semibold">5ᵉ Manikongo</span> — NGOWAZULU / ISNA</p>
          <div className="bg-[#192734]/80 border border-white/5 rounded-xl p-5 max-w-lg mx-auto">
            <p className="text-base font-serif italic text-gray-300">« L'Énergie n\'est pas une substance. C\'est la résistance du Firmament entre Espace et Temps. »</p>
          </div>
          <p className="text-xs text-gray-600 uppercase tracking-widest">© PRORASCIENCE — Tous droits réservés</p>
          <ChevronDown className="w-6 h-6 text-emerald-400/50 mx-auto animate-bounce" />
        </div>
      </section>

      {/* NAV */}
      <div className="sticky top-20 z-30 bg-[#0F1419]/95 backdrop-blur-xl border-b border-white/5 py-3 mb-8">
        <div className="max-w-4xl mx-auto px-4 flex gap-2 overflow-x-auto">
          {navItems.map(n => (
            <button key={n.id} onClick={() => go(n.id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ac === n.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white'}`}>{n.s}</button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-20 space-y-16">

        {/* ═══ CHAPITRE 24 ═══ */}
        <section id="ch24" className="space-y-5 scroll-mt-28">
          <ChHead id="ch24-head" color="blue" icon={Layers} number="24" title="Espace-Temps-Énergie : Constantes vs Grandeurs" />
          <LawBox title="Distinction fondamentale">
            Espace, Temps, Énergie ne sont PAS des grandeurs ontodynamiques — ce sont des constantes cosmologiques. Les grandeurs D, I, H, τ dérivent de ces constantes mais opèrent à un niveau différent.
          </LawBox>

          <h3 className="text-xl font-serif font-bold text-white mt-6">24.1 — Les Trois Constantes Cosmologiques Primordiales</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConstanteCard
              name="ESPACE" charge="négative (−)" color="blue"
              icon={Minus}
              nature="Rétractabilité, unification, retour vers P₀"
              fonction="Compter, Peser, Diviser"
              force="Gravitation (attraction)"
              role="Conserve la mémoire, structure l'ordre"
            />
            <ConstanteCard
              name="TEMPS" charge="positive (+)" color="orange"
              icon={Plus}
              nature="Dilatation, expansion, devenir sans retour"
              fonction="Étendre, Avancer, Différencier"
              force="Expansion cosmique"
              role="Produit la nouveauté, génère la différenciation"
            />
            <ConstanteCard
              name="ÉNERGIE" charge="neutre (⊘)" color="emerald"
              icon={Zap}
              nature="Résistance à l'effondrement, firmament entre E et T"
              fonction="E = Résistance(Espace, Temps)"
              force="Tension du ressort cosmique"
              role="Maintient la séparation E-T, permet l'existence"
            />
          </div>

          <h3 className="text-xl font-serif font-bold text-white mt-6">24.2 — Les Grandeurs Ontodynamiques (dérivées)</h3>
          <p className="text-gray-300 leading-relaxed">Les grandeurs D, I, H, τ, Ω, r sont des mesures quantitatives qui émergent de l'interaction entre les trois constantes. Elles ne remplacent pas E-T-Énergie mais les quantifient dans des contextes spécifiques.</p>
          <div className="bg-[#192734] border border-white/5 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-2 font-bold">Analogie pédagogique :</p>
            <p className="text-gray-300">E-T-Énergie = les <span className="text-[var(--school-accent)] font-semibold">trois couleurs primaires</span> (rouge, bleu, jaune). D, I, H = les <span className="text-white font-semibold">nuances dérivées</span> (orange, violet, vert). Les primaires sont CONSTANTES, les nuances sont DÉRIVÉES mais nécessaires pour décrire la richesse du réel.</p>
          </div>

          <h3 className="text-xl font-serif font-bold text-white mt-6">24.3 — Relation Formelle</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-[#192734] rounded-lg p-3 border border-white/5">
              <span className="text-sm font-mono text-blue-400 font-bold w-8">D</span>
              <span className="text-gray-300 text-sm">Différence — dérive de la fonction <span className="text-blue-300 font-semibold">DIVISER</span> (Espace)</span>
            </div>
            <div className="flex items-center gap-3 bg-[#192734] rounded-lg p-3 border border-white/5">
              <span className="text-sm font-mono text-violet-400 font-bold w-8">I</span>
              <span className="text-gray-300 text-sm">Indifférence — dérive de la fonction <span className="text-violet-300 font-semibold">COMPTER</span> (Espace)</span>
            </div>
            <div className="flex items-center gap-3 bg-[#192734] rounded-lg p-3 border border-white/5">
              <span className="text-sm font-mono text-emerald-400 font-bold w-8">H</span>
              <span className="text-gray-300 text-sm">Hypostasie — dérive de l'<span className="text-emerald-300 font-semibold">activité spatio-temporelle totale</span></span>
            </div>
            <div className="flex items-center gap-3 bg-[#192734] rounded-lg p-3 border border-white/5">
              <span className="text-sm font-mono text-orange-400 font-bold w-8">τ</span>
              <span className="text-gray-300 text-sm">Temps ontologique — dérive du <span className="text-orange-300 font-semibold">logarithme du facteur d'échelle</span> (Temps)</span>
            </div>
          </div>

          <DT
            headers={["Type", "Nom", "Nature", "Rôle", "Niveau"]}
            rows={[
              ["CONSTANTE", "Espace", "Rétractabilité (−)", "Unifie, structure", "Primordial"],
              ["CONSTANTE", "Temps", "Dilatation (+)", "Différencie, avance", "Primordial"],
              ["CONSTANTE", "Énergie", "Résistance (neutre)", "Sépare E-T", "Primordial"],
              ["GRANDEUR", "D", "Différence ontologique", "Mesure individualisation", "Dérivé"],
              ["GRANDEUR", "I", "Indifférence", "Mesure communauté", "Dérivé"],
              ["GRANDEUR", "H", "Hypostasie", "Mesure complexité", "Dérivé"],
              ["GRANDEUR", "τ", "Temps ontologique", "Mesure âge ontologique", "Dérivé"],
            ]}
          />
        </section>

        {/* ═══ CHAPITRE 25 ═══ */}
        <section id="ch25" className="space-y-5 scroll-mt-28">
          <ChHead id="ch25-head" color="cyan" icon={Activity} number="25" title="Géométrie des Cordes Énergétiques et Ondes Différentielles" />
          <p className="text-gray-300 leading-relaxed">Les cordes vibratoires sont les premières manifestations de l'Énergie après la brisure de symétrie. Elles ne sont pas des objets mais des <span className="text-white font-semibold">tensions dynamiques entre Espace et Temps</span>. Leur géométrie dépend du régime de pression.</p>

          <h3 className="text-xl font-serif font-bold text-white mt-6">25.1 — Origine des Cordes : Tension E-T</h3>
          <p className="text-gray-300 leading-relaxed">Lorsque Espace et Temps se séparent à partir de P₀, une tension apparaît. Cette tension = Énergie = Firmament. Les cordes sont les <span className="text-[var(--school-accent)] font-semibold">lignes de force</span> de cette tension.</p>
          <div className="bg-[#192734] border border-white/5 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-2 font-bold">Analogie : Corde de guitare</p>
            <p className="text-gray-300">Une corde tendue entre deux points A (Espace) et B (Temps). Elle vibre selon le degré de tension. Plus la tension est forte, plus les modes de vibration sont riches.</p>
          </div>

          <h3 className="text-xl font-serif font-bold text-white mt-6">25.2 — Les Quatre Régimes Géométriques</h3>
          <div className="space-y-4">
            <RegimeCard
              number="1" name="CORDES OUVERTES" geometrie="Ligne droite tendue" color="yellow"
              condition="E et T tirent avec force égale"
              vibration="1D linéaire"
              masse="Nulle"
              exemple="Photon"
              schema="A ─────────── B  (ligne droite tendue)"
            />
            <RegimeCard
              number="2" name="CORDES COURBÉES" geometrie="Arc, forme U" color="violet"
              condition="Pression latérale modérée"
              vibration="1.5D arc"
              masse="Quasi-nulle"
              exemple="Neutrino"
              schema="A  /‾‾‾‾‾\  B  (arc courbe)"
            />
            <RegimeCard
              number="3" name="CORDES FERMÉES" geometrie="Boucle (○, □, △)" color="emerald"
              condition="Pression maximale"
              vibration="2D modes complexes"
              masse="Élevée"
              exemple="Électron, Quark"
              schema="○ Cercle    □ Carré    △ Triangle"
            />
            <RegimeCard
              number="4" name="CORDES EN RÉSEAU" geometrie="Agrégats 3D" color="rose"
              condition="Plusieurs cordes se lient"
              vibration="3D synchronisée"
              masse="Très élevée"
              exemple="Proton, Neutron"
              schema="⬡─⬡─⬡  réseaux interconnectés"
            />
          </div>

          {/* Modes de vibration des boucles */}
          <h3 className="text-xl font-serif font-bold text-white mt-6">Modes de vibration des Cordes Fermées</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#192734] border border-emerald-500/20 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">○</div>
              <p className="text-emerald-400 font-bold text-sm">Vibration circulaire</p>
              <p className="text-gray-400 text-xs mt-1">Boucle oscillant radialement = <span className="text-white font-semibold">Électron</span></p>
            </div>
            <div className="bg-[#192734] border border-blue-500/20 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">□</div>
              <p className="text-blue-400 font-bold text-sm">Vibration carrée</p>
              <p className="text-gray-400 text-xs mt-1">Boucle à 4 coins = <span className="text-white font-semibold">Quark</span> (charge ⅔ ou ⅓)</p>
            </div>
            <div className="bg-[#192734] border border-violet-500/20 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">△</div>
              <p className="text-violet-400 font-bold text-sm">Vibration triangulaire</p>
              <p className="text-gray-400 text-xs mt-1">Boucle à 3 coins = <span className="text-white font-semibold">Particule composite</span></p>
            </div>
            <div className="bg-[#192734] border border-orange-500/20 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">⬮</div>
              <p className="text-orange-400 font-bold text-sm">Vibration elliptique</p>
              <p className="text-gray-400 text-xs mt-1">Boucle déformée = <span className="text-white font-semibold">Bosons massifs</span> (W, Z)</p>
            </div>
          </div>

          <LawBox title="Note cruciale">
            La masse d'une particule N\'EST PAS une propriété intrinsèque mais une conséquence géométrique de la fermeture de la corde. Plus la boucle est fermée et dense, plus la masse est élevée.
          </LawBox>

          <h3 className="text-xl font-serif font-bold text-white mt-6">25.3 — Tableau Ontologique des Cordes</h3>
          <DT
            headers={["Régime", "Géométrie", "Pression", "Vibration", "Masse", "Exemple"]}
            rows={[
              ["1. Ouvertes", "Ligne droite", "Équilibrée E=T", "1D linéaire", "Nulle", "Photon"],
              ["2. Courbées", "Arc (U)", "Latérale modérée", "1.5D arc", "Quasi-nulle", "Neutrino"],
              ["3. Fermées", "Boucle (○,□,△)", "Maximale", "2D modes", "Élevée", "Électron, Quark"],
              ["4. Réseaux", "Agrégats 3D", "Collective", "3D synchro", "Très élevée", "Proton, Neutron"],
            ]}
          />
        </section>

        {/* ═══ CHAPITRE 26 ═══ */}
        <section id="ch26" className="space-y-5 scroll-mt-28">
          <ChHead id="ch26-head" color="orange" icon={Zap} number="26" title="Mécanique Différentielle : D et I comme Moteur Cosmique" />
          <p className="text-gray-300 leading-relaxed">Le moteur fondamental du cosmos n'est pas une force extérieure mais la <span className="text-white font-semibold">tension interne</span> entre deux tendances opposées : la Différence (D) et l\'Indifférence (I).</p>

          <h3 className="text-xl font-serif font-bold text-white mt-6">26.1 — D et I : les deux pôles du mouvement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-orange-500/[0.06] border border-orange-500/20 rounded-xl p-5">
              <h4 className="text-orange-400 font-bold text-sm uppercase tracking-wider mb-3">D — Différence</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Tendance à l'<span className="text-white font-semibold">individualisation</span></li>
                <li>• Génère la distinction, la séparation</li>
                <li>• Produit la complexité et la variété</li>
                <li>• Hérite de la fonction Temps (+)</li>
              </ul>
            </div>
            <div className="bg-violet-500/[0.06] border border-violet-500/20 rounded-xl p-5">
              <h4 className="text-violet-400 font-bold text-sm uppercase tracking-wider mb-3">I — Indifférence</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Tendance à la <span className="text-white font-semibold">communauté</span></li>
                <li>• Génère l'unification, le regroupement</li>
                <li>• Produit la stabilité et l'ordre</li>
                <li>• Hérite de la fonction Espace (−)</li>
              </ul>
            </div>
          </div>

          <h3 className="text-xl font-serif font-bold text-white mt-6">26.2 — Le Moteur Différentiel</h3>
          <p className="text-gray-300 leading-relaxed">Tout mouvement cosmique résulte du déséquilibre entre D et I. L'énergie de ce mouvement est le différentiel Δ = |D − I|.</p>
          <div className="bg-[#192734] border border-white/10 rounded-xl p-5 text-center my-4">
            <p className="text-xl font-mono text-[var(--school-accent)] font-bold">Δ = |D − I|</p>
            <p className="text-sm text-gray-500 mt-2">L'énergie du mouvement ontologique</p>
          </div>
          <DT
            headers={["Cas", "D vs I", "Résultat"]}
            rows={[
              ["D > I", "Différence domine", "Expansion, diversification, complexification"],
              ["I > D", "Indifférence domine", "Contraction, unification, simplification"],
              ["D = I", "Équilibre", "Stabilité temporaire (état métastable)"],
              ["D ≫ I", "Différence extrême", "Fragmentation, chaos, dissolution"],
              ["I ≫ D", "Indifférence extrême", "Effondrement, singularité, retour vers P₀"],
            ]}
          />
          <LawBox title="Loi du Moteur Différentiel">
            Tout système ontologique est animé par la tension entre D (différenciation) et I (indifférenciation). La direction du mouvement dépend de quel pôle domine. L'énergie du mouvement est proportionnelle au différentiel Δ = |D − I|.
          </LawBox>
        </section>

        {/* ═══ CHAPITRE 27 ═══ */}
        <section id="ch27" className="space-y-5 scroll-mt-28">
          <ChHead id="ch27-head" color="emerald" icon={Network} number="27" title="Formation des Particules Quantiques par Agrégation de Cordes" />
          <p className="text-gray-300 leading-relaxed">Les particules que la physique considère comme « fondamentales » ne sont pas des points sans structure. Ce sont des <span className="text-white font-semibold">agrégats de cordes énergétiques</span> dont la géométrie d'assemblage détermine les propriétés observées.</p>

          <h3 className="text-xl font-serif font-bold text-white mt-6">27.1 — Le mécanisme d'agrégation</h3>
          <p className="text-gray-300 leading-relaxed">Quand des cordes fermées (Régime 3) entrent en résonance — c'est-à-dire quand leurs modes de vibration sont compatibles — elles se lient par <span className="text-[var(--school-accent)] font-semibold">attraction différentielle</span>. Cette liaison forme un réseau stable (Régime 4).</p>
          <div className="bg-[#192734] border border-emerald-500/20 rounded-xl p-5">
            <p className="text-sm text-gray-400 font-bold mb-2">Processus d'agrégation :</p>
            <div className="space-y-2 text-sm text-gray-300">
              <p>1. <span className="text-emerald-400 font-semibold">Résonance</span> — Deux cordes vibrent à des fréquences compatibles</p>
              <p>2. <span className="text-emerald-400 font-semibold">Attraction</span> — Le différentiel Δ crée une force d'attraction entre elles</p>
              <p>3. <span className="text-emerald-400 font-semibold">Liaison</span> — Les cordes se lient en un réseau cohérent</p>
              <p>4. <span className="text-emerald-400 font-semibold">Stabilisation</span> — Le réseau atteint un mode de vibration collective stable</p>
            </div>
          </div>

          <h3 className="text-xl font-serif font-bold text-white mt-6">27.2 — De la corde à la particule</h3>
          <DT
            headers={["Cordes", "Agrégation", "Résultat", "Propriétés"]}
            rows={[
              ["1 corde fermée ○", "Isolée", "Électron", "Charge −1, spin ½, léger"],
              ["1 corde carrée □", "Isolée", "Quark", "Charge ⅔ ou −⅓, spin ½"],
              ["3 quarks (□□□)", "Réseau triangulaire", "Proton / Neutron", "Charge +1 ou 0, masse élevée"],
              ["Protons + Neutrons", "Réseau sphérique", "Noyau atomique", "Charge +Z, masse A"],
              ["Noyau + Électrons", "Réseau orbital", "Atome", "Charge 0, propriétés chimiques"],
            ]}
          />
          <BQ>Chaque niveau de complexité est un nouvel agrégat de cordes — pas une nouvelle substance. La matière est de la géométrie vibratoire empilée.</BQ>
        </section>

        {/* ═══ CHAPITRE 28 ═══ */}
        <section id="ch28" className="space-y-5 scroll-mt-28">
          <ChHead id="ch28-head" color="rose" icon={Eye} number="28" title="Preuve de la Non-Fondamentalité des Particules" />
          <p className="text-gray-300 leading-relaxed">Si les particules sont des agrégats de cordes, alors elles ne sont pas fondamentales. Elles ont une <span className="text-white font-semibold">structure interne</span>. Voici les arguments.</p>

          <h3 className="text-xl font-serif font-bold text-white mt-6">28.1 — L'argument historique</h3>
          <p className="text-gray-300 leading-relaxed">Chaque fois que la physique a déclaré avoir trouvé le « plus petit », elle a trouvé plus petit ensuite :</p>
          <div className="space-y-2">
            {[
              { era: "XIXᵉ siècle", claim: "L'atome est indivisible", reality: "L'atome contient des électrons, protons, neutrons" },
              { era: "Années 1930", claim: "Le proton est fondamental", reality: "Le proton contient 3 quarks" },
              { era: "Années 1970", claim: "Le quark est fondamental", reality: "Les quarks ont des propriétés internes (couleur)" },
              { era: "Aujourd'hui", claim: "Le quark est le plus petit", reality: "Prorascience : le quark est une corde fermée □" },
            ].map((item, i) => (
              <div key={i} className="bg-[#192734] border border-white/5 rounded-xl p-4 flex items-start gap-3">
                <span className="text-xs font-bold text-rose-400 shrink-0 w-24">{item.era}</span>
                <div>
                  <p className="text-gray-500 text-sm line-through">{item.claim}</p>
                  <p className="text-gray-300 text-sm mt-1">→ {item.reality}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-serif font-bold text-white mt-6">28.2 — L'argument logique</h3>
          <p className="text-gray-300 leading-relaxed">Si une particule a des <span className="text-white font-semibold">propriétés</span> (masse, charge, spin) — alors elle a une <span className="text-white font-semibold">structure</span>. Car toute propriété est une relation. Et toute relation implique au moins deux éléments distincts. Un point sans structure ne peut pas avoir de propriétés.</p>
          <LawBox title="Théorème de Non-Fondamentalité">
            Toute entité possédant des propriétés mesurables distinctes possède nécessairement une structure interne. Il n'existe pas de « point fondamental sans structure » capable de porter des propriétés. Les particules quantiques sont des géométries vibratoires — pas des points.
          </LawBox>

          <h3 className="text-xl font-serif font-bold text-white mt-6">28.3 — Le zoom ontologique</h3>
          <p className="text-gray-300 leading-relaxed">Si on pouvait « zoomer » dans un quark, on verrait :</p>
          <div className="bg-[#192734] border border-rose-500/20 rounded-xl p-5 space-y-2">
            <p className="text-gray-300 text-sm"><span className="text-rose-400 font-bold">Niveau 1</span> — Le quark (point apparent)</p>
            <p className="text-gray-300 text-sm"><span className="text-rose-400 font-bold">Niveau 2</span> — Une corde fermée en vibration carrée □</p>
            <p className="text-gray-300 text-sm"><span className="text-rose-400 font-bold">Niveau 3</span> — La tension E-T qui forme cette corde</p>
            <p className="text-gray-300 text-sm"><span className="text-rose-400 font-bold">Niveau 4</span> — Le champ de permission Φ qui autorise cette tension</p>
            <p className="text-gray-300 text-sm"><span className="text-rose-400 font-bold">Niveau 5</span> — Le Potentia Prima P₀ — le fond irréductible</p>
          </div>
          <BQ>On ne touche jamais le fond en zoomant dans la matière. On traverse des niveaux de géométrie vibratoire jusqu'au champ de permission lui-même.</BQ>
        </section>

        {/* ═══ CHAPITRE 29 ═══ */}
        <section id="ch29" className="space-y-5 scroll-mt-28">
          <ChHead id="ch29-head" color="amber" icon={BarChart3} number="29" title="Variance Différentielle et Sélection Progressive" />
          <p className="text-gray-300 leading-relaxed">Le cosmos ne produit pas toutes les géométries possibles avec la même probabilité. Il y a une <span className="text-white font-semibold">sélection progressive</span> — un mécanisme ontologique qui favorise certaines configurations et en élimine d'autres.</p>

          <h3 className="text-xl font-serif font-bold text-white mt-6">29.1 — La Variance Différentielle</h3>
          <p className="text-gray-300 leading-relaxed">La variance différentielle mesure la <span className="text-[var(--school-accent)] font-semibold">dispersion des différentiels Δ</span> dans un système. Une variance élevée = beaucoup de configurations en compétition. Une variance faible = le système a convergé vers des configurations stables.</p>
          <div className="bg-[#192734] border border-white/10 rounded-xl p-5 text-center my-4">
            <p className="text-xl font-mono text-[var(--school-accent)] font-bold">Var(Δ) = ⟨Δ²⟩ − ⟨Δ⟩²</p>
            <p className="text-sm text-gray-500 mt-2">Variance des différentiels ontologiques</p>
          </div>

          <h3 className="text-xl font-serif font-bold text-white mt-6">29.2 — Le mécanisme de sélection</h3>
          <DT
            headers={["Phase", "Variance", "Processus", "Résultat"]}
            rows={[
              ["Chaos initial", "Très élevée", "Toutes les géométries en compétition", "Instabilité maximale"],
              ["Sélection primaire", "Élevée → modérée", "Les géométries instables s'effondrent", "Cordes ouvertes et fermées"],
              ["Agrégation", "Modérée → faible", "Les cordes résonantes s'agrègent", "Particules stables"],
              ["Équilibre", "Faible", "Les configurations stables dominent", "Matière ordinaire"],
            ]}
          />

          <h3 className="text-xl font-serif font-bold text-white mt-6">29.3 — Sélection progressive vs sélection naturelle</h3>
          <p className="text-gray-300 leading-relaxed">La sélection progressive est au cosmos ce que la sélection naturelle est au vivant — mais à un niveau plus fondamental.</p>
          <DT
            headers={["", "Sélection naturelle (Darwin)", "Sélection progressive (Prorascience)"]}
            rows={[
              ["Niveau", "Biologique", "Ontologique"],
              ["Unité", "Organisme", "Géométrie vibratoire"],
              ["Critère", "Adaptation à l'environnement", "Stabilité du différentiel Δ"],
              ["Mécanisme", "Reproduction différentielle", "Résonance et agrégation"],
              ["Résultat", "Espèces adaptées", "Particules stables, matière"],
            ]}
          />
          <LawBox title="Loi de Sélection Progressive">
            Dans tout système ontologique, les géométries vibratoires dont le différentiel Δ est stable et résonant avec leur environnement survivent et s'agrègent. Celles dont le Δ est instable se dissolvent. La complexité croissante du cosmos est le résultat de cette sélection — pas d\'un plan, pas d\'un hasard, mais d\'une nécessité structurelle.
          </LawBox>
          <BQ>Le cosmos ne choisit pas quoi construire. Il élimine ce qui ne tient pas. Ce qui reste — c'est nous.</BQ>
        </section>

        {/* CTA */}
        <section className="text-center space-y-6 mt-8">
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent mx-auto" />
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dialogue-physique"><Button variant="outline" className="border-blue-500/30 hover:bg-blue-500/10 text-blue-400 h-12 px-8 text-base"><BookOpen className="w-5 h-5 mr-2" /> Livre II — Physique</Button></Link>
            <Link to="/fond-de-tout"><Button variant="outline" className="border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] h-12 px-8 text-base"><BookOpen className="w-5 h-5 mr-2" /> Livre I — Le Fond</Button></Link>
            <Link to="/formations/catalogue"><Button className="bg-emerald-500 text-white hover:bg-emerald-600 gap-2 h-12 px-8 text-base font-bold"><GraduationCap className="w-5 h-5" /> Formations</Button></Link>
          </div>
        </section>

        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">© PRORASCIENCE — NGOWAZULU · ISNA — 5ᵉ Manikongo — L'Histoire Complète du Cosmos — Partie V</p>
        </div>
      </div>
    </div>
  );
};

export default OntodynamiquePage;
