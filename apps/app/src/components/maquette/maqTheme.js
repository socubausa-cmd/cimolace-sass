import { Atom, Target, Crown, GraduationCap, BookOpen, Landmark, Quote } from 'lucide-react';

// Thème partagé du site maquette PRORASCIENCE × Ngowazulu (éditorial sombre / or, Fraunces + Inter).
export const MAQ_THEME = `
  .mq2 {
    --bg:#0d0b09; --fg:#f4efe6; --muted:#b3a890; --muted2:#8c8472; --gold:#d8b468;
    --panel:#16120c; --border:rgba(255,255,255,0.10); --grid:rgba(255,255,255,0.06);
  }
  .mq2, .mq2 * { font-family:'Inter', system-ui, -apple-system, sans-serif; }
  .mq2 .mq-display { font-family:'Fraunces', 'Source Serif 4', Georgia, serif !important; font-optical-sizing:auto; letter-spacing:-0.02em; }
  .mq2 input::placeholder { color:var(--muted2); opacity:1; }
  /* Immersif : on supprime les lignes qui séparent les sections (bordures des cartes conservées). */
  .mq2 section, .mq2 footer { border-top-color:transparent !important; border-bottom-color:transparent !important; }
  .mq2 header { border-bottom-color:rgba(255,255,255,0.05) !important; }
  .mq2 { background: radial-gradient(48% 38% at 12% 8%, rgba(216,180,104,0.06), transparent 60%), radial-gradient(44% 38% at 88% 84%, rgba(191,154,79,0.05), transparent 60%), var(--bg) !important; }
`;

// Liens de navigation partagés (header + footer). Ancres = sections de /t/isna ; routes = pages dédiées.
export const MAQ_LINKS = [
  { label: 'Doctrine', href: '/t/isna#doctrine' },
  { label: 'Mission', href: '/t/isna/mission' },
  { label: 'École', href: '/t/isna/ecole' },
  { label: 'Programme', href: '/t/isna/programme' },
  { label: 'Temple', href: '/t/isna/temple' },
  { label: 'Fondateur', href: '/t/isna/fondateur' },
  { label: 'Offres', href: '/t/isna#offres' },
];

// Navigation groupée (header avec menus déroulants). 3 univers + 1 lien.
export const MAQ_NAV = [
  {
    label: 'La doctrine',
    items: [
      { label: 'La doctrine', href: '/t/isna#doctrine', desc: 'Science totale · 3 piliers · méthode', icon: Atom },
      { label: 'Notre mission', href: '/t/isna/mission', desc: 'Restaurer la dignité', icon: Target },
      { label: 'Le Fondateur', href: '/t/isna/fondateur', desc: 'Le 5ᵉ Manikongo', icon: Crown },
    ],
  },
  {
    label: "L'École",
    items: [
      { label: "L'École · ISNA", href: '/t/isna/ecole', desc: 'Comprendre avant d’agir', icon: GraduationCap },
      { label: 'Le plan du cours', href: '/t/isna/programme', desc: 'Le cursus en 4 phases', icon: BookOpen },
    ],
  },
  {
    label: 'Le Temple',
    items: [
      { label: 'Le Temple · Ngowazulu', href: '/t/isna/temple', desc: 'L’hôpital de l’âme', icon: Landmark },
      { label: 'Témoignages', href: '/t/isna#temoignages', desc: 'Des vies transformées', icon: Quote },
    ],
  },
  { label: 'Offres', href: '/t/isna#offres' },
];
