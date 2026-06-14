import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ChevronDown,
  Crown,
  FileText,
  Tag,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

import manuelContent from '@/content/manuel-initiatique-bris-de-sort.md?raw';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const PUBLIC = isnaTenantConfig.branding.publicSiteOrigin;
const PAGE_URL = `${PUBLIC}/manuel-initiatique-bris-de-sort`;
const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;

const VisualCard = ({ title, subtitle, children }) => (
  <div className="bg-[#192734] border border-white/5 rounded-2xl p-6">
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-sm font-bold text-white">{title}</div>
        {subtitle ? <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div> : null}
      </div>
    </div>
    <div className="mt-4">
      {children}
    </div>
  </div>
);

const CroixIncarnationDiagram = () => (
  <div className="bg-[#0B0E11] border border-white/10 rounded-2xl overflow-hidden">
    <div className="p-5">
      <svg viewBox="0 0 720 420" className="w-full h-auto">
        <defs>
          <radialGradient id="goldGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#FFD369" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.65" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="720" height="420" fill="#0B0E11" />
        <circle cx="360" cy="210" r="170" fill="url(#goldGlow)" />

        <circle cx="360" cy="210" r="150" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="2" />
        <circle cx="360" cy="210" r="70" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="2" />

        <line x1="360" y1="60" x2="360" y2="360" stroke="url(#goldLine)" strokeWidth="4" />
        <line x1="210" y1="210" x2="510" y2="210" stroke="url(#goldLine)" strokeWidth="4" />

        <circle cx="360" cy="210" r="12" fill="#D4AF37" />
        <circle cx="360" cy="210" r="26" fill="none" stroke="#D4AF37" strokeOpacity="0.45" strokeWidth="2" />

        <text x="360" y="35" textAnchor="middle" fontSize="14" fill="#FFFFFF" opacity="0.7" fontFamily="ui-sans-serif, system-ui">NORD</text>
        <text x="690" y="215" textAnchor="end" fontSize="14" fill="#FFFFFF" opacity="0.7" fontFamily="ui-sans-serif, system-ui">EST (face)</text>
        <text x="360" y="405" textAnchor="middle" fontSize="14" fill="#FFFFFF" opacity="0.7" fontFamily="ui-sans-serif, system-ui">SUD</text>
        <text x="30" y="215" textAnchor="start" fontSize="14" fill="#FFFFFF" opacity="0.7" fontFamily="ui-sans-serif, system-ui">OUEST</text>

        <rect x="392" y="186" width="170" height="48" rx="12" fill="#192734" stroke="#D4AF37" strokeOpacity="0.25" />
        <text x="407" y="205" fontSize="12" fill="#D4AF37" fontFamily="ui-sans-serif, system-ui" fontWeight="700">Centre :</text>
        <text x="407" y="223" fontSize="12" fill="#FFFFFF" opacity="0.8" fontFamily="ui-sans-serif, system-ui">Feu / calebasse</text>

        <rect x="110" y="270" width="210" height="62" rx="12" fill="#192734" stroke="#FFFFFF" strokeOpacity="0.08" />
        <text x="125" y="292" fontSize="12" fill="#FFFFFF" opacity="0.85" fontFamily="ui-sans-serif, system-ui" fontWeight="700">Zone de travail</text>
        <text x="125" y="312" fontSize="12" fill="#FFFFFF" opacity="0.65" fontFamily="ui-sans-serif, system-ui">Sel au sol + posture</text>

        <circle cx="510" cy="210" r="7" fill="#FFFFFF" opacity="0.25" />
        <text x="522" y="214" fontSize="11" fill="#FFFFFF" opacity="0.6" fontFamily="ui-sans-serif, system-ui">Axe Est</text>
      </svg>
    </div>
  </div>
);

const ThreeLevelsDiagram = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="bg-[#0B0E11] border border-white/10 rounded-2xl p-5">
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--school-accent)]">Mpandu</div>
      <div className="text-lg font-serif font-bold text-white mt-1">Tête</div>
      <div className="text-sm text-gray-400 mt-2">Intelligence · Finances · Commerce · Vision</div>
      <div className="mt-4 text-xs text-gray-500">Signes :</div>
      <div className="text-sm text-gray-300 mt-1">Confusion · échecs répétés · blocages</div>
    </div>
    <div className="bg-[#0B0E11] border border-white/10 rounded-2xl p-5">
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--school-accent)]">Nzinga</div>
      <div className="text-lg font-serif font-bold text-white mt-1">Cœur</div>
      <div className="text-sm text-gray-400 mt-2">Relations · Image sociale · Valeur · Amour</div>
      <div className="mt-4 text-xs text-gray-500">Signes :</div>
      <div className="text-sm text-gray-300 mt-1">Rejet · ruptures · isolement</div>
    </div>
    <div className="bg-[#0B0E11] border border-white/10 rounded-2xl p-5">
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--school-accent)]">Nsanku</div>
      <div className="text-lg font-serif font-bold text-white mt-1">Ombrine</div>
      <div className="text-sm text-gray-400 mt-2">Corps · Santé · Force vitale · Sexualité</div>
      <div className="mt-4 text-xs text-gray-500">Signes :</div>
      <div className="text-sm text-gray-300 mt-1">Épuisement · maladies chroniques</div>
    </div>
  </div>
);

const RitualTimelineDiagram = () => (
  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
    {[
      { t: 'Préparation', d: 'Matériaux + orientation Est' },
      { t: 'Diagnostic', d: 'Mpandu / Nzinga / Nsanku' },
      { t: 'Transfert', d: 'Œuf fécondé · parole · intention' },
      { t: 'Feu', d: 'Charbon + urines + Mpevelo' },
      { t: 'Bain final', d: 'Eaux vivantes + Nvouri Mpara' },
    ].map((s, i) => (
      <div key={s.t} className="bg-[#0B0E11] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 font-bold">Étape {i + 1}</div>
          <div className="text-[10px] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-2 py-0.5 rounded-full">3h00</div>
        </div>
        <div className="text-sm font-bold text-white mt-2">{s.t}</div>
        <div className="text-xs text-gray-400 mt-1 leading-relaxed">{s.d}</div>
      </div>
    ))}
  </div>
);

const MaterialsChecklistDiagram = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div className="bg-[#0B0E11] border border-white/10 rounded-2xl p-5">
      <div className="text-sm font-bold text-white">7 éléments</div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          "Œuf fécondé",
          "Gros sel",
          "Charbon incandescent",
          "Poudre de Mpevelo",
          "Urines du matin",
          "Savon Nvouri Mpara",
          "Eau vivante",
        ].map((x) => (
          <div key={x} className="text-xs text-gray-300 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
            {x}
          </div>
        ))}
      </div>
    </div>
    <div className="bg-[#0B0E11] border border-white/10 rounded-2xl p-5">
      <div className="text-sm font-bold text-white">Règles critiques</div>
      <div className="mt-3 space-y-2">
        <div className="text-xs text-gray-300 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-xl px-3 py-2">
          Eau vivante : pluie / source / chute / tronc d'arbre / vin de palme / eau de coco
        </div>
        <div className="text-xs text-gray-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          Interdit : eau du robinet (eau “morte”)
        </div>
        <div className="text-xs text-gray-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          Interdit : œuf du commerce non fécondé / réfrigéré
        </div>
        <div className="text-xs text-gray-300 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
          Orientation : face à l'Est · heure : 3h00 · ordre des phases non négociable
        </div>
      </div>
    </div>
  </div>
);

const navItems = [
  { id: 'intro', s: 'Intro' },
  { id: 'ch1', s: 'Ch.1' },
  { id: 'ch2', s: 'Ch.2' },
  { id: 'ch3', s: 'Ch.3' },
  { id: 'ch4', s: 'Ch.4' },
  { id: 'ch5', s: 'Ch.5' },
  { id: 'ch6', s: 'Ch.6' },
  { id: 'ch7', s: 'Ch.7' },
  { id: 'ch8', s: 'Ch.8' },
];

const ManuelInitiatiqueBrisDeSortPage = () => {
  const [ac, setAc] = useState('intro');
  const go = (id) => {
    setAc(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const parsed = useMemo(() => {
    const src = String(manuelContent || '').replace(/\r\n/g, '\n');
    const re = /^CHAPITRE\s+(\d+)\s+—\s+(.+)$/gm;
    const matches = Array.from(src.matchAll(re));
    if (matches.length === 0) {
      return {
        intro: src.trim(),
        chapters: [],
      };
    }

    const intro = src.slice(0, matches[0].index ?? 0).trim();
    const chapters = matches.map((m, idx) => {
      const start = m.index ?? 0;
      const end = idx + 1 < matches.length ? (matches[idx + 1].index ?? src.length) : src.length;
      const number = m[1];
      const title = (m[2] || '').trim();
      const text = src.slice(start, end).trim();
      return { id: `ch${number}`, number, title, text };
    });

    return { intro, chapters };
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1419] text-white">
      <Helmet>
        <title>{`Manuel Initiatique — Rituel de Bris de Sort | ${SITE_NAME}`}</title>
        <meta name="description" content="Manuel Initiatique — Rituel de Bris de Sort (Transmission du 5ᵉ Manikongo — Ngowazulu). 8 chapitres : doctrine (Mpandu, Nzinga, Nsanku, Croix d'Incarnation) et protocoles pratiques." />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:type" content="book" />
        <meta property="og:title" content={`Manuel Initiatique — Rituel de Bris de Sort | ${SITE_NAME}`} />
        <meta property="og:description" content="Transmission du 5ᵉ Manikongo — Ngowazulu. Manuel complet : théorie + pratique, 8 chapitres." />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Manuel Initiatique — Rituel de Bris de Sort | ${SITE_NAME}`} />
        <meta name="twitter:description" content="Transmission du 5ᵉ Manikongo — Ngowazulu. Doctrine des trois niveaux (Mpandu, Nzinga, Nsanku) + protocole pratique." />
        <meta name="keywords" content="Prorascience, manuel initiatique, rituel de bris de sort, Mpandu, Nzinga, Nsanku, Croix d'Incarnation, ELAPSI TIYAH, Mpevelo, eaux vivantes, 5ᵉ Manikongo, Ngowazulu, manikongo5" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Book',
          name: 'Manuel Initiatique — Rituel de Bris de Sort',
          author: { '@type': 'Person', name: '5ᵉ Manikongo', alternateName: 'Ngowazulu' },
          publisher: { '@type': 'Organization', name: SITE_NAME },
          inLanguage: 'fr',
          url: PAGE_URL,
          description: "Manuel Initiatique — Rituel de Bris de Sort. Doctrine des trois niveaux (Mpandu, Nzinga, Nsanku) et protocoles pratiques."
        })}</script>
      </Helmet>

      {/* HERO */}
      <section className="relative py-28 md:py-40 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/60 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[300px]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
            <BookOpen className="w-4 h-4" /> Prorascience · Manuel
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">
            Rituel de<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] via-yellow-400 to-[var(--school-accent)]">Bris de Sort</span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto">
            Transmission du <span className="text-[var(--school-accent)] font-semibold">5ᵉ Manikongo</span> — Ngowazulu. 8 chapitres : doctrine + pratique (Mpandu, Nzinga, Nsanku, Croix d'Incarnation).
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/bibliotheque">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/5 h-11 px-6">
                <BookOpen className="w-4 h-4 mr-2" /> Retour Bibliothèque
              </Button>
            </Link>
            <a href="#ch1" onClick={(e) => { e.preventDefault(); go('ch1'); }}>
              <Button className="bg-[var(--school-accent)] text-black hover:bg-[#bfa345] font-bold h-11 px-6">
                Lire maintenant <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><Crown className="w-4 h-4 text-[var(--school-accent)]" /> 5ᵉ Manikongo</span>
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-[var(--school-accent)]" /> 8 chapitres</span>
            <span className="flex items-center gap-1.5"><Tag className="w-4 h-4 text-[var(--school-accent)]" /> Rituel</span>
          </div>

          <ChevronDown className="w-6 h-6 text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] mx-auto animate-bounce" />
        </div>
      </section>

      {/* NAV */}
      <div className="sticky top-20 z-30 bg-[#0F1419]/95 backdrop-blur-xl border-b border-white/5 py-3 mb-8">
        <div className="max-w-4xl mx-auto px-4 flex gap-2 overflow-x-auto">
          {navItems.map((it) => (
            <button
              key={it.id}
              onClick={() => go(it.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                ac === it.id
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]'
                  : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              {it.s}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-20 space-y-10">
        <section id="intro" className="space-y-6 scroll-mt-28">
          <div className="bg-[#192734] border border-white/5 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[var(--school-accent)]" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Avertissement</div>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                  Ce texte est présenté comme un livre/manuel du système Prorascience. Lisez et utilisez avec discernement.
                </p>
              </div>
            </div>
          </div>

          <VisualCard
            title="Croquis — Croix d'Incarnation"
            subtitle="Schéma d'orientation : axes + centre rituel (feu/calebasse)"
          >
            <CroixIncarnationDiagram />
            <div className="mt-3 text-xs text-gray-500 leading-relaxed">
              Repère l'Est (face) avant de commencer. Le centre représente le point d\'action (feu/calebasse) ; la zone de travail indique l\'espace de posture/sel.
            </div>
          </VisualCard>

          <VisualCard
            title="Croquis — Les 3 niveaux (Mpandu / Nzinga / Nsanku)"
            subtitle="Lecture rapide : où le sort s'ancre et ce que le rituel adresse"
          >
            <ThreeLevelsDiagram />
          </VisualCard>

          <VisualCard
            title="Croquis — Timeline du rituel (3h00)"
            subtitle="Vue globale des phases — préparation à bain final"
          >
            <RitualTimelineDiagram />
          </VisualCard>

          <VisualCard
            title="Croquis — Checklist des matériaux"
            subtitle="7 éléments + interdits majeurs"
          >
            <MaterialsChecklistDiagram />
          </VisualCard>

          {parsed.intro && (
            <div className="bg-[#192734] border border-white/5 rounded-2xl p-6">
              <div className="text-gray-300 whitespace-pre-line leading-relaxed">
                {parsed.intro}
              </div>
            </div>
          )}
        </section>

        {parsed.chapters.map((ch) => (
          <section key={ch.id} id={ch.id} className="space-y-5 scroll-mt-28">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[var(--school-accent)]" />
              </div>
              <div>
                <span className="text-xs text-[var(--school-accent)] font-bold uppercase tracking-wider">Chapitre {ch.number}</span>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">{ch.title}</h2>
              </div>
            </div>

            <div className="bg-[#192734] border border-white/5 rounded-2xl p-6">
              <div className="text-gray-300 whitespace-pre-line leading-relaxed">
                {ch.text}
              </div>
            </div>
          </section>
        ))}

        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">© PRORASCIENCE — NGOWAZULU · ISNA — Manikongo MK5 — Première édition</p>
        </div>
      </div>
    </div>
  );
};

export default ManuelInitiatiqueBrisDeSortPage;
