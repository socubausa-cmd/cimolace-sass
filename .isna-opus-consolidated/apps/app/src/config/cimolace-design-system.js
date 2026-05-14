/**
 * CIMOLACE — Design System Config
 * Inspiration : Stripe + Linear + Apple. Sobre, premium, sûr.
 * Source : cimolace.html (session Claude local)
 */

// ─── Couleurs de base ────────────────────────────────────────────────────────
export const colors = {
  // Neutres
  bg:       '#ffffff',
  bgSoft:   '#fafafa',
  bgAlt:    '#f5f5f7',
  bgDeep:   '#0a0a0f',
  bgDark:   '#14141a',

  ink:      '#0a0a0f',
  inkSoft:  '#424245',
  muted:    '#6e6e73',
  line:     '#e5e5ea',
  lineSoft: '#f0f0f3',

  // Accents principaux CIMOLACE
  accent:      '#5b3df5',   // violet CIMOLACE
  accent2:     '#8b6dff',
  accentDeep:  '#3a1fb8',

  // Charte sombre (fond page actuelle)
  pageDark:    '#0a0a0f',
};

// ─── Palette OS — chaque vertical a sa couleur ───────────────────────────────
export const osColors = {
  temple:     '#c9a227',   // or sacré
  school:     '#1a4f8f',   // bleu académique
  schoolLive: '#ff6b4a',   // orange énergie
  commerce:   '#2cc275',   // vert croissance
  creator:    '#a855f7',   // violet créativité
  business:   '#1f2937',   // graphite pro
  media:      '#d4395f',   // rouge broadcast
};

// ─── Typographie ────────────────────────────────────────────────────────────
export const typography = {
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif',
  fontMono:   '"SF Mono", Menlo, Monaco, monospace',

  sizes: {
    heroTitle:   'clamp(48px, 7.5vw, 92px)',
    sectionTitle:'clamp(32px, 4.5vw, 56px)',
    sectionLead: 'clamp(17px, 1.4vw, 20px)',
    body:        '15px',
    small:       '13px',
    xs:          '11px',
  },

  weights: {
    regular: 400,
    medium:  500,
    semibold:600,
    bold:    700,
  },

  letterSpacing: {
    tight:   '-0.04em',
    normal:  '-0.02em',
    wide:    '0.04em',
    wider:   '0.08em',
  },
};

// ─── Espacement & Rayons ─────────────────────────────────────────────────────
export const spacing = {
  sectionPadding:  '110px 24px',
  containerMax:    '1100px',
  containerNarrow: '780px',
};

export const radius = {
  sm:  '8px',
  md:  '14px',   // --radius
  lg:  '22px',   // --radius-lg
};

// ─── Ombres ──────────────────────────────────────────────────────────────────
export const shadows = {
  sm: '0 1px 2px rgba(10, 10, 15, 0.04)',
  md: '0 4px 16px rgba(10, 10, 15, 0.06)',
  lg: '0 18px 48px rgba(10, 10, 15, 0.12)',
};

// ─── Tokens Tailwind-ready (à utiliser dans les className) ───────────────────
export const tw = {
  // Fonds
  bgPage:       'bg-[#0a0a0f]',          // fond dark principal
  bgLight:      'bg-white',
  bgSoft:       'bg-[#fafafa]',
  bgAlt:        'bg-[#f5f5f7]',
  bgTintViolet: 'bg-[#f5f4ff]',          // blanc teinté violet (sections light)

  // Texte sur fond dark
  textPrimary:  'text-white',
  textSoft:     'text-white/65',
  textMuted:    'text-white/40',

  // Texte sur fond light
  textInk:      'text-[#0a0a0f]',
  textInkSoft:  'text-[#424245]',
  textMutedLight:'text-[#6e6e73]',

  // Accents
  textAccent:   'text-[#5b3df5]',
  textAccent2:  'text-[#8b6dff]',
  bgAccent:     'bg-[#5b3df5]',
  borderAccent: 'border-[#5b3df5]',

  // Bordures
  borderLight:  'border-[#e5e5ea]',
  borderDark:   'border-white/[0.08]',
};

// ─── Sections alternées (light / dark) ──────────────────────────────────────
/**
 * Pattern recommandé pour CimolaceLanding :
 *
 * 1. Hero          → dark  (#0a0a0f) + halo violet
 * 2. Modules       → dark  (#0a0a0f)
 * 3. CatalogueOS   → light (#f5f4ff) — rupture visuelle forte
 * 4. Pricing       → soft  (#fafafa) ou dark featured
 * 5. Testimonials  → dark  (#14141a)
 * 6. Gallery       → dark  (#0a0a0f)
 * 7. Footer        → deep  (#0a0a0f)
 */
export const sectionThemes = {
  dark: {
    bg:         '#0a0a0f',
    text:       '#ffffff',
    textSoft:   'rgba(255,255,255,0.65)',
    textMuted:  'rgba(255,255,255,0.40)',
    border:     'rgba(255,255,255,0.08)',
    eyebrowBg:  'rgba(255,255,255,0.06)',
    eyebrowText:'#8b6dff',
    cardBg:     'rgba(255,255,255,0.04)',
  },
  light: {
    bg:         '#f5f4ff',
    text:       '#0a0a0f',
    textSoft:   '#424245',
    textMuted:  '#6e6e73',
    border:     '#e5e5ea',
    eyebrowBg:  '#f5f5f7',
    eyebrowText:'#5b3df5',
    cardBg:     '#ffffff',
  },
  soft: {
    bg:         '#fafafa',
    text:       '#0a0a0f',
    textSoft:   '#424245',
    textMuted:  '#6e6e73',
    border:     '#e5e5ea',
    eyebrowBg:  '#f5f5f7',
    eyebrowText:'#5b3df5',
    cardBg:     '#ffffff',
  },
};

// ─── Animations framer-motion réutilisables ──────────────────────────────────
export const motionVariants = {
  fadeUp: {
    hidden:  { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  },
  fadeIn: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
  },
  stagger: (delay = 0.07) => ({
    hidden:  {},
    visible: { transition: { staggerChildren: delay } },
  }),
  slideLeft: {
    hidden:  { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
  },
};

// ─── OS Catalogue data ───────────────────────────────────────────────────────
export const OS_CATALOGUE = [
  {
    id: 'temple',
    name: 'Temple en ligne',
    tagline: 'La maison numérique de votre communauté spirituelle.',
    emoji: '✦',
    color: osColors.temple,
    features: ['Cultes en direct multi-caméras', 'Calendrier liturgique partagé', 'Dons en ligne récurrents'],
    href: '/cimolace/products/temple-os',
  },
  {
    id: 'school',
    name: 'School OS',
    tagline: "L'école numérique complète, prête à l'emploi.",
    emoji: '▲',
    color: osColors.school,
    features: ['Parcours scolaires structurés', 'Suivi élève par chapitre', 'Replay multilingue automatique'],
    href: '/cimolace/products/school-os',
  },
  {
    id: 'school-live',
    name: 'School Live OS',
    tagline: 'Le cours live, niveau broadcast.',
    emoji: '◉',
    color: osColors.schoolLive,
    features: ['Cours direct + captation HD', 'Tableau interactif synchronisé', 'Captions multilingues live'],
    href: '/cimolace/products/school-live-os',
  },
  {
    id: 'commerce',
    name: 'Commerce OS',
    tagline: 'Votre boutique digitale, sans Shopify.',
    emoji: '$',
    color: osColors.commerce,
    features: ['Catalogue produits/services/abonnements', 'Paiements + relances auto', 'Pubs IA multi-plateformes'],
    href: '/cimolace/products/commerce-os',
  },
  {
    id: 'creator',
    name: 'Creator OS',
    tagline: 'Le studio complet du créateur de contenu.',
    emoji: '★',
    color: osColors.creator,
    features: ['Tournage + montage intégrés', 'Scripts IA + prompteur live', 'Traduction et publication multi-canal'],
    href: '/cimolace/products/creator-os',
  },
  {
    id: 'business',
    name: 'Business OS',
    tagline: "L'infrastructure des indépendants ambitieux.",
    emoji: '■',
    color: osColors.business,
    features: ['Réservation + paiements + relances', 'Programmes coaching avec jalons', 'Documents IA assistés'],
    href: '/cimolace/products/business-os',
  },
  {
    id: 'media',
    name: 'Media OS',
    tagline: 'La salle de rédaction du média moderne.',
    emoji: '◎',
    color: osColors.media,
    features: ['Émissions live + replays HD', 'Débats scorés avec juge IA', 'Productions multilingues exportables'],
    href: '/cimolace/products/media-os',
  },
];

export default {
  colors,
  osColors,
  typography,
  spacing,
  radius,
  shadows,
  tw,
  sectionThemes,
  motionVariants,
  OS_CATALOGUE,
};
