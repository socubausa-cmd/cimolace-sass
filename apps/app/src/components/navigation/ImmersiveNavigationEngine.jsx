import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Sparkles, X, RotateCcw, Mic, PanelLeft, PanelRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── CATEGORY COLOR MAP ────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  booking:   { color: '#C9A84C', bg: 'rgba(201,168,76,0.12)',  border: 'rgba(201,168,76,0.38)' },
  offer:     { color: '#C9A84C', bg: 'rgba(201,168,76,0.10)',  border: 'rgba(201,168,76,0.28)' },
  cursus:    { color: '#1A8A7A', bg: 'rgba(26,138,122,0.12)',  border: 'rgba(26,138,122,0.38)' },
  module:    { color: '#C9A84C', bg: 'rgba(201,168,76,0.09)',  border: 'rgba(201,168,76,0.26)' },
  coaching:  { color: '#7B3FA8', bg: 'rgba(123,63,168,0.12)', border: 'rgba(123,63,168,0.38)' },
  service:   { color: '#C0392B', bg: 'rgba(192,57,43,0.12)',  border: 'rgba(192,57,43,0.38)'  },
  community: { color: '#2E7D9A', bg: 'rgba(46,125,154,0.12)', border: 'rgba(46,125,154,0.38)' },
  knowledge: { color: '#8B6914', bg: 'rgba(139,105,20,0.10)', border: 'rgba(139,105,20,0.28)' },
  page:      { color: '#9B59B6', bg: 'rgba(155,89,182,0.10)', border: 'rgba(155,89,182,0.28)' },
};

function categoryColor(cat = '') {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.page;
}

// ── TEMPERATURE STYLES ────────────────────────────────────────────────────────
const TEMP_STYLES = {
  cold: { label: '❄ Signal froid',  color: '#4A90D9', bg: 'rgba(74,144,217,0.12)', border: 'rgba(74,144,217,0.3)'  },
  warm: { label: '🔆 Signal tiède', color: '#E8A020', bg: 'rgba(232,160,32,0.12)', border: 'rgba(232,160,32,0.3)'  },
  hot:  { label: '🔥 Signal chaud', color: '#E05020', bg: 'rgba(224,80,32,0.12)',  border: 'rgba(224,80,32,0.3)'   },
};

function intentToTemperature(intent = '') {
  if (['booking', 'coaching', 'complex', 'urgent'].includes(intent)) return 'hot';
  if (['module', 'cursus', 'information', 'pricing', 'learning', 'ritual'].includes(intent)) return 'warm';
  return 'cold';
}

// ── SVG CATEGORY ICONS ────────────────────────────────────────────────────────
function CategoryIcon({ category }) {
  const c = categoryColor(category);
  if (category === 'booking') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="13" rx="2" stroke={c.color} strokeWidth="1.2" />
      <path d="M2 8h16" stroke={c.color} strokeWidth="1" />
      <path d="M6 2v4M14 2v4" stroke={c.color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  if (category === 'cursus' || category === 'module') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke={c.color} strokeWidth="1.2" />
      <path d="M7 7h6M7 10h6M7 13h4" stroke={c.color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
  if (category === 'coaching') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke={c.color} strokeWidth="1.2" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c.color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  if (category === 'service') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke={c.color} strokeWidth="1.2" />
      <circle cx="10" cy="10" r="3.5" stroke={c.color} strokeWidth="1" />
      <circle cx="10" cy="10" r="1.2" fill={c.color} />
    </svg>
  );
  if (category === 'offer') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L12.2 7.8H19L13.6 11.4L15.8 17.2L10 13.6L4.2 17.2L6.4 11.4L1 7.8H7.8L10 2Z" stroke={c.color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
  if (category === 'community') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 7a7 7 0 0 1 14 0c0 4.5-4 8-7 10C7 15 3 11.5 3 7Z" stroke={c.color} strokeWidth="1.2" />
      <circle cx="10" cy="7" r="2" stroke={c.color} strokeWidth="1" />
    </svg>
  );
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L12.2 7.8H19L13.6 11.4L15.8 17.2L10 13.6L4.2 17.2L6.4 11.4L1 7.8H7.8L10 2Z" stroke={c.color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// ── LOCAL SITE MAP (fallback + auto-click source) ─────────────────────────────
const LOCAL_SITE_MAP = [
  {
    id: 'cursus',
    label: 'Cursus Fondamental ISNA',
    path: '/formations/catalogue',
    category: 'cursus',
    summary: '10 modules pour comprendre les lois métaphysiques, la logique des rituels et la science africaine.',
    ctaLabel: "S'inscrire",
    keywords: ['cursus','comprendre','fondamental','base','loi','metaphysique','isna','science'],
    intents: ['cursus','information','learning'],
  },
  {
    id: 'modules',
    label: 'Modules Pratiques',
    path: '/formations/catalogue',
    category: 'module',
    summary: 'Libation, talisman, protection, guérison — chaque module est une technologie issue de la science occulte africaine.',
    ctaLabel: 'Choisir un module',
    keywords: ['module','libation','talisman','protection','guerison','pratique','rite'],
    intents: ['module','learning','ritual'],
  },
  {
    id: 'booking',
    label: 'Prendre rendez-vous',
    path: '/appointment/request',
    category: 'booking',
    summary: 'Calendrier intelligent avec secrétariat. Entretien personnalisé pour orienter votre parcours.',
    ctaLabel: 'Réserver',
    keywords: ['rendez-vous','rdv','entretien','conseiller','parler','secretariat','contact','appointment','reserver'],
    intents: ['booking','coaching','complex'],
  },
  {
    id: 'forfaits',
    label: 'Forfaits & Abonnements',
    path: '/forfaits',
    category: 'offer',
    summary: 'Plans, paiements et activation. Accédez à la formation complète avec un abonnement mensuel.',
    ctaLabel: 'Voir les forfaits',
    keywords: ['forfait','prix','tarif','abonnement','payer','paiement','combien','cout'],
    intents: ['pricing','payment'],
  },
  {
    id: 'coaching',
    label: 'Coaching Professionnel',
    path: '/accompagnement/coaching',
    category: 'coaching',
    summary: 'Parcours pour devenir praticien : accompagnement, diagnostic, maîtrise complète.',
    ctaLabel: 'Découvrir',
    keywords: ['coaching','praticien','professionnel','exercer','devenir','metier','accompagnement'],
    intents: ['coaching','professional'],
  },
  {
    id: 'ngowazulu',
    label: 'Services Spirituels — NGOWAZULU',
    path: '/services-spirituels',
    category: 'service',
    summary: 'Consultation, Mentorat, Ouverture de recouvrement. Intervention spirituelle personnalisée par le Maître.',
    ctaLabel: 'Découvrir',
    keywords: ['ngowazulu','spirituel','consultation','mentorat','recouvrement','reve','oppression','guerison','mystique'],
    intents: ['spiritual','service','urgent'],
  },
  {
    id: 'communion',
    label: 'La Communion — Culte Live',
    path: '/services-spirituels',
    category: 'service',
    summary: 'Maintenance spirituelle mensuelle. Culte live de fermeture (dernier vendredi) et ouverture (1er dimanche).',
    ctaLabel: 'Rejoindre',
    keywords: ['communion','culte','live','maintenance','mois','priere','offrande'],
    intents: ['spiritual','community'],
  },
  {
    id: 'about',
    label: 'À propos — Prorascence Academy',
    path: '/a-propos',
    category: 'page',
    summary: 'Vision, mission et histoire de la Prorascence Academy et du Manikongo fondateur.',
    ctaLabel: 'En savoir plus',
    keywords: ['propos','fondateur','histoire','mission','vision','prorascence','academy'],
    intents: ['information','discovery'],
  },
  {
    id: 'chat',
    label: 'Messagerie Immersive',
    path: '/messages',
    category: 'community',
    summary: 'Conversation enrichie, SmartBoard, partage de fichiers et bascule vers session live.',
    ctaLabel: 'Ouvrir',
    keywords: ['chat','message','messagerie','conversation','immersif','direct'],
    intents: ['community','chat'],
  },
];

/** IDs renvoyés par l'IA (open_modal) → page embarquée */
const OPEN_MODAL_SERVICE_MAP = {
  consultation: { path: '/appointment/request', title: 'Consultation & rendez-vous', category: 'booking' },
  mentorship: { path: '/services-spirituels', title: 'Mentorat NGOWAZULU', category: 'service' },
  recouvrement: { path: '/services-spirituels', title: 'Ouverture de recouvrement', category: 'service' },
  cursus: { path: '/formations/catalogue', title: 'Cursus fondamental ISNA', category: 'cursus' },
  modules: { path: '/formations/catalogue', title: 'Modules pratiques', category: 'module' },
  communion: { path: '/services-spirituels', title: 'Communion & culte live', category: 'service' },
};

// ── HELPER: normalize ─────────────────────────────────────────────────────────
function normalizeText(str) {
  return String(str || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s]/g, ' ').trim();
}

// ── LOCAL RANK (kept intact) ──────────────────────────────────────────────────
function localRank(query) {
  const q = normalizeText(query);
  if (!q) return LOCAL_SITE_MAP.slice(0, 3);
  return LOCAL_SITE_MAP
    .map(entry => {
      const kw = entry.keywords.map(k => normalizeText(k));
      const kHits = kw.filter(k => q.includes(k)).length;
      const labelHit = normalizeText(entry.label).split(' ').some(w => w.length > 3 && q.includes(w)) ? 1 : 0;
      const summaryHit = normalizeText(entry.summary).split(' ').some(w => w.length > 4 && q.includes(w)) ? 1 : 0;
      return { ...entry, _score: kHits * 4 + labelHit * 3 + summaryHit * 2 };
    })
    .filter(e => e._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 3);
}

// ── LOCAL INTENT (kept intact) ────────────────────────────────────────────────
function localIntent(query) {
  const q = normalizeText(query);
  if (/(rendez|rdv|entretien|conseiller|appointment|reserver)/.test(q)) return 'booking';
  if (/(coaching|praticien|professionnel|exercer|devenir|metier)/.test(q)) return 'coaching';
  if (/(module|libation|talisman|protection|guerison|rite)/.test(q)) return 'module';
  if (/(cursus|comprendre|base|fondamental|loi|metaphysique)/.test(q)) return 'cursus';
  if (/(prix|tarif|payer|paiement|abonnement|forfait|combien)/.test(q)) return 'pricing';
  if (/(ngowazulu|spirituel|reve|oppression|mystique|mentorat)/.test(q)) return 'spiritual';
  return 'information';
}

// ── LOCAL GUIDANCE (conversation-first, no “cliquez ici”) ─────────────────────
function localGuidance(intent, topMatch) {
  const name = topMatch?.label || '';
  const cite = name ? ` La proposition la plus alignée avec ce que vous décrivez : « ${name} ».` : '';
  const ask =
    " Qu'est-ce qui compte le plus pour vous en ce moment : avancer vite, sécuriser votre compréhension, ou parler budget avant de vous engager ?";
  const labels = {
    booking:
      `Un échange avec le secrétariat sert à cadrer votre situation sans pression : on clarifie votre besoin, les options qui collent, et ce qui peut attendre.${cite} Quand vous sentirez que c'est le bon moment, vous pourrez confirmer un rendez-vous — le choix vous appartient.${ask}`,
    coaching:
      `Le coaching s'adresse à celles et ceux qui veulent exercer avec méthode : posture professionnelle, cadre, et progression dans le temps.${cite} L'idée n'est pas de “naviguer” mais de construire un plan réaliste avec vous.${ask}`,
    module:
      `Les modules sont des blocs pratiques : une technique, un objectif, un résultat observable. C'est efficace quand vous savez déjà quel thème creuser.${cite}${ask}`,
    cursus:
      `Le cursus fondamental structure la compréhension avant la pratique avancée : ordre logique, bases solides, moins d'à-coups.${cite}${ask}`,
    pricing:
      `Les tarifs suivent la logique du format : module isolé, abonnement, ou parcours long — chacun correspond à un rythme et un niveau d'engagement différent.${cite} Sans chiffre précis ici, dites-moi ce que vous cherchez à optimiser : coût mensuel, flexibilité, ou accès complet ?`,
    spiritual:
      `NGOWAZULU propose un accompagnement spirituel encadré, à part des parcours académiques Prorascence : l'objectif est l'intervention et le suivi adapté à votre situation.${cite}${ask}`,
    information:
      `Je peux vous aider à trancher entre formation, entretien humain, ou accompagnement NGOWAZULU selon votre priorité.${cite}${ask}`,
  };
  return labels[intent] || labels.information;
}

function localCommercialHighlights(intent, topMatch) {
  const out = [];
  if (topMatch?.summary) out.push(topMatch.summary.slice(0, 140) + (topMatch.summary.length > 140 ? '…' : ''));
  const lines = {
    booking: "Un créneau humain clarifie souvent ce qu'aucune page ne remplace : la nuance de votre cas.",
    coaching: "Le coaching vise la crédibilité professionnelle : méthode, éthique, clientèle.",
    module: "Un module = une compétence ciblée ; le cursus = une progression globale.",
    cursus: "Le cursus évite les trous dans la compréhension avant la spécialisation.",
    pricing: "Comparer module seul vs abonnement = comparer rythme et profondeur, pas seulement le prix.",
    spiritual: "NGOWAZULU : cadre d'intervention spirituelle distinct des cursus Prorascence.",
    information: "La bonne décision commence par clarifier l'objectif, pas par précipiter le clic.",
  };
  if (lines[intent]) out.push(lines[intent]);
  if (topMatch?.label) out.push(`Piste centrale : ${topMatch.label}.`);
  return out.filter(Boolean).slice(0, 4);
}

const FRIENDLY_PATH = {
  '/': 'Accueil',
  '/forfaits': 'Espace forfaits et paiements',
  '/formations/catalogue': 'Catalogue formations',
  '/appointment/request': 'Prise de rendez-vous',
  '/accompagnement/coaching': 'Coaching professionnel',
  '/services-spirituels': 'Services NGOWAZULU',
  '/a-propos': 'À propos',
  '/messages': 'Messagerie',
};

function friendlyPathLabel(path) {
  if (!path) return 'Espace dédié';
  return FRIENDLY_PATH[path] || 'Espace dédié';
}

/** Pages « action » (paiement, RDV, etc.) → petite fenêtre ; le reste → aperçu contenu */
const ACTION_CATEGORIES = new Set(['booking', 'offer', 'coaching', 'service', 'community']);

function categoryIsAction(cat) {
  return ACTION_CATEGORIES.has(String(cat || '').toLowerCase());
}

function getEmbeddedPanelMode(_path, category) {
  return categoryIsAction(category) ? 'action' : 'content';
}

function buildIframeSrc(path) {
  if (!path || typeof window === 'undefined') return '';
  const p = path.startsWith('/') ? path : `/${path}`;
  const sep = p.includes('?') ? '&' : '?';
  return `${window.location.origin}${p}${sep}immersive_embed=1`;
}

// ── AUTO-CLICK DETECTION ──────────────────────────────────────────────────────
const AUTO_CLICK_TRIGGERS = /\b(prends|choisis|selectionne|sélectionne|je veux ca|je veux ça|celui-la|celui-là|prends le premier|prends ca|je prends|ok pour|oui pour ce|ce premier)\b/i;

function localAutoClick(text, matches) {
  if (!AUTO_CLICK_TRIGGERS.test(normalizeText(text))) return null;
  return matches[0]?.id || null;
}

// ── GUIDED QUESTION DETECTION ─────────────────────────────────────────────────
const VAGUE_TRIGGERS = /\b(aide|sais pas|je sais pas|besoin d'aide|je ne sais pas|perdu|je cherche|comment|quoi|que faire|par ou commencer|par où commencer)\b/i;

function localGuidedQuestion(text) {
  const q = normalizeText(text);
  if (q.length < 14 || VAGUE_TRIGGERS.test(q)) {
    return "Quel est votre objectif principal ?";
  }
  return null;
}

const GUIDED_CHIPS_BY_QUESTION = {
  "Quel est votre objectif principal ?": [
    { label: "Apprendre et comprendre", query: "Je veux comprendre les lois métaphysiques et africaines" },
    { label: "Consulter spirituellement", query: "J'ai besoin d'une consultation spirituelle avec NGOWAZULU" },
    { label: "Devenir praticien", query: "Je veux devenir praticien professionnel" },
  ],
};

// ── FOLLOW-UP CHIPS BY INTENT ─────────────────────────────────────────────────
const FOLLOW_UP_BY_INTENT = {
  learning:    [{ label: "Tarifs : comment c'est structuré ?", query: "Expliquez-moi comment les tarifs des formations sont structurés sans m'envoyer sur un lien." }, { label: "Par où commencer ?", query: "Je débute : par quoi dois-je commencer concrètement ?" }, { label: "Différence module / cursus", query: "Quelle est la différence entre un module et le cursus pour mon objectif ?" }],
  module:      [{ label: "Choisir un module", query: "Aidez-moi à choisir un module adapté à mon niveau, en m'expliquant pourquoi." }, { label: "Logique des prix", query: "Comment se comparent les prix module à la carte et l'abonnement ?" }, { label: "Résultat attendu", query: "Qu'est-ce qu'un module me permet de maîtriser concrètement ?" }],
  cursus:      [{ label: "Programme du cursus", query: "Décrivez-moi la progression du cursus fondamental et ce que j'y gagne." }, { label: "Investissement dans le temps", query: "Combien de temps faut-il prévoir pour tenir le cursus sérieusement ?" }, { label: "Après le cursus", query: "Que puis-je enchaîner après le cursus selon votre logique ?" }],
  booking:     [{ label: "À quoi sert le RDV ?", query: "À quoi sert exactement un rendez-vous secrétariat dans mon cas ?" }, { label: "Prêt à m'engager", query: "Je suis prêt à prendre un créneau : que dois-je préparer avant ?" }, { label: "Encore des doutes", query: "J'hésite encore : quelles questions dois-je me poser avant de réserver ?" }],
  pricing:     [{ label: "Comparer les formules", query: "Expliquez-moi les formules de paiement et ce qu'elles impliquent pour moi." }, { label: "Budget serré", query: "J'ai un budget limité : quelle option a le meilleur rapport valeur pour moi ?" }, { label: "Engagement", query: "Quelle formule correspond à un engagement léger vs profond ?" }],
  spiritual:   [{ label: "NGOWAZULU : pour qui ?", query: "Pour quels types de situations NGOWAZULU est-il pertinent par rapport aux formations ?" }, { label: "Déroulé", query: "Comment se déroule un accompagnement NGOWAZULU, étape par étape ?" }, { label: "Urgence", query: "Je ressens une urgence spirituelle : comment m'orienter sans précipitation inutile ?" }],
  coaching:    [{ label: "Le coaching en pratique", query: "Qu'est-ce que le coaching change concrètement pour quelqu'un qui veut exercer ?" }, { label: "Profil idéal", query: "Quel profil est le plus à sa place en coaching professionnel ?" }, { label: "Après le coaching", query: "Quelle trajectoire après le coaching dans votre écosystème ?" }],
  information: [{ label: "M'aider à choisir", query: "Posez-moi les questions qui manquent pour me recommander le bon parcours." }, { label: "Offres en un coup d'oeil", query: "Résumez-moi les grandes familles d'offres et leurs différences." }, { label: "Parler à un humain", query: "Je préfère en parler à quelqu'un : dans quel cas est-ce le plus pertinent ?" }],
};

function followUpByIntent(intent) {
  return FOLLOW_UP_BY_INTENT[intent] || FOLLOW_UP_BY_INTENT.information;
}

// ── SUGGESTION CHIPS ──────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Je veux apprendre la libation',
  "J'ai des rêves troublants",
  'Devenir praticien',
  'Prendre rendez-vous',
  'Voir les tarifs',
  'Comprendre les lois invisibles',
];

const HISTORY_KEY = 'imm_nav_v2_history';

/** Framer Motion — aligné sur les transitions premium du site */
const navEase = [0.22, 1, 0.36, 1];
const sectionVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const blockVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: navEase } },
};
const cardListVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const cardItemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.38, ease: navEase } },
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ImmersiveNavigationEngine({
  isOpen,
  onClose,
  isAuthenticated = false,
  canUseImmersiveChat = false,
  userRole = 'visitor',
  isPremiumActive = false,
  recentPathways = [],
  runtimeContext = null,
  sessionToken = '',
  onOpenQuickChat,
}) {
  const location   = useLocation();

  // ── State ──────────────────────────────────────────────────────────────────
  const [query,           setQuery]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [answer,          setAnswer]          = useState('');
  const [temperature,     setTemperature]     = useState(null);
  const [results,         setResults]         = useState([]);
  const [primaryPath,     setPrimaryPath]     = useState(null);

  // Conversation history (for AI context)
  const [convHistory,     setConvHistory]     = useState([]); // [{role, content}]
  // Feed display (last exchanges for UI)
  const [feedExchanges,   setFeedExchanges]   = useState([]); // [{user, assistant}]

  // Intelligent OS features
  const [autoClickId,     setAutoClickId]     = useState(null);
  const [guidedQuestion,  setGuidedQuestion]  = useState(null);
  const [followUpChips,   setFollowUpChips]   = useState([]);
  const [escalated,       setEscalated]       = useState(false);
  const [isListening,     setIsListening]     = useState(false);
  const [hasMic,          setHasMic]          = useState(false);
  const [commercialHighlights, setCommercialHighlights] = useState([]);
  /** Panneau latéral (iframe) sans quitter la conversation */
  const [embeddedPanel, setEmbeddedPanel] = useState(null); // { path, title, category, mode }

  const abortRef     = useRef(null);
  const sessionRef   = useRef('');
  const inputRef     = useRef(null);
  const cardRefs     = useRef({});
  const recognRef    = useRef(null);

  if (!sessionRef.current) {
    sessionRef.current = `imm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // ── Check mic availability ─────────────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setHasMic(Boolean(SR));
  }, []);

  // ── Persist history ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = window.sessionStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.convHistory) setConvHistory(parsed.convHistory.slice(-10));
        if (parsed.feedExchanges) setFeedExchanges(parsed.feedExchanges.slice(-5));
      }
    } catch { /* no-op */ }
  }, [isOpen]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify({
        convHistory: convHistory.slice(-10),
        feedExchanges: feedExchanges.slice(-5),
      }));
    } catch { /* no-op */ }
  }, [convHistory, feedExchanges]);

  // ── Voice recognition ──────────────────────────────────────────────────────
  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recognRef.current) { recognRef.current.stop(); }
    const r = new SR();
    r.lang = 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onstart  = () => setIsListening(true);
    r.onend    = () => setIsListening(false);
    r.onerror  = () => setIsListening(false);
    r.onresult = e => {
      const transcript = e.results[0][0].transcript;
      setQuery(transcript);
      setTimeout(() => runQuery(transcript), 200);
    };
    recognRef.current = r;
    r.start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Escalation save ────────────────────────────────────────────────────────
  async function saveEscalation(userText) {
    try {
      await supabase.from('escalation_events').insert({
        thread_id:    null,
        reason:       'navigation_engine_escalation',
        handled:      false,
        payload_json: { source: 'immersive_nav', message: userText, session: sessionRef.current },
      });
    } catch { /* no-op */ }
  }

  // ── Scroll to auto-selected card ───────────────────────────────────────────
  function scrollToCard(id) {
    setTimeout(() => {
      const el = cardRefs.current[id];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }

  // ── CORE QUERY ENGINE ──────────────────────────────────────────────────────
  async function runQuery(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || loading) return;
    if (abortRef.current) abortRef.current.abort();

    setSubmitted(true);
    setQuery('');
    setAutoClickId(null);
    setGuidedQuestion(null);
    setFollowUpChips([]);
    setEscalated(false);
    setCommercialHighlights([]);

    // ── Step 1: instant local results ──────────────────────────────────────
    const localMatches  = localRank(trimmed);
    const localIntValue = localIntent(trimmed);
    const localGuide    = localGuidance(localIntValue, localMatches[0]);

    setCommercialHighlights(localCommercialHighlights(localIntValue, localMatches[0]));
    setAnswer(localGuide);
    setTemperature(intentToTemperature(localIntValue));
    setResults(localMatches);
    setPrimaryPath(localMatches[0]?.path || null);

    // ── Intelligent OS local rules ──────────────────────────────────────────
    const autoId = localAutoClick(trimmed, localMatches);
    if (autoId) {
      setAutoClickId(autoId);
      scrollToCard(autoId);
    }

    const gq = localGuidedQuestion(trimmed);
    if (gq && !autoId) setGuidedQuestion(gq);

    const chips = followUpByIntent(localIntValue);
    setFollowUpChips(chips);

    // Detect urgent escalation locally
    const isUrgent = /(urgent|immediatement|maintenant|tout de suite|sos|aide urgente)/i.test(normalizeText(trimmed))
                     && ['booking', 'spiritual', 'coaching'].includes(localIntValue);
    if (isUrgent) {
      setEscalated(true);
      saveEscalation(trimmed);
    }

    // ── Update conversation history for AI context ──────────────────────────
    const newUserMsg = { role: 'user', content: trimmed };
    const newConvHistory = [...convHistory.slice(-9), newUserMsg];
    setConvHistory(newConvHistory);
    setFeedExchanges(prev => [...prev.slice(-4), { user: trimmed, assistant: localGuide }]);

    // ── Step 2: try to enhance with Netlify API (production only) ──────────
    const isLocalhost = window.location.hostname === 'localhost'
                     || window.location.hostname === '127.0.0.1'
                     || window.location.hostname.startsWith('192.168.');
    if (isLocalhost) return;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    try {
      const res = await fetch('/api/immersive/guide', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          context: {
            runtimeContext,
            recentPathways,
            currentPath: location.pathname,
            isAuthenticated,
            isPremiumActive,
            sessionId: sessionRef.current,
            history: newConvHistory.slice(-10),
            recentAssistantExcerpts: convHistory
              .filter(m => m.role === 'assistant')
              .slice(-3)
              .map(m => String(m.content || '').slice(0, 500)),
          },
        }),
      });

      const ct = res.headers.get('content-type') || '';
      const payload = (res.ok && ct.includes('application/json'))
        ? await res.json().catch(() => null)
        : null;

      if (payload?.guidance || payload?.answer) {
        const intentDet = String(payload.intent || localIntValue).toLowerCase();
        const temp = payload.temperature || intentToTemperature(intentDet);
        const routeMatches = Array.isArray(payload.routeMatches) ? payload.routeMatches : [];
        const aiGuide = payload.guidance || payload.answer;

        setAnswer(aiGuide);
        setTemperature(temp);
        setResults(routeMatches.length > 0 ? routeMatches.slice(0, 4) : localMatches);
        setPrimaryPath(typeof payload.primaryPath === 'string' ? payload.primaryPath : routeMatches[0]?.path || localMatches[0]?.path || null);

        // AI-driven intelligent OS fields
        if (payload.auto_click) {
          setAutoClickId(String(payload.auto_click));
          scrollToCard(String(payload.auto_click));
        }
        if (payload.guided_question && !payload.auto_click) {
          setGuidedQuestion(String(payload.guided_question));
        }
        if (payload.escalate && !escalated) {
          setEscalated(true);
          saveEscalation(trimmed);
        }
        if (Array.isArray(payload.follow_chips) && payload.follow_chips.length > 0) {
          setFollowUpChips(
            payload.follow_chips.map(text => ({
              label: String(text),
              query: String(text),
            })),
          );
        } else {
          setFollowUpChips(followUpByIntent(intentDet));
        }
        if (Array.isArray(payload.commercial_highlights) && payload.commercial_highlights.length > 0) {
          setCommercialHighlights(payload.commercial_highlights.slice(0, 4));
        }

        const modalId = String(payload.open_modal || '').toLowerCase();
        if (modalId && OPEN_MODAL_SERVICE_MAP[modalId]) {
          const cfg = OPEN_MODAL_SERVICE_MAP[modalId];
          openEmbeddedPanel({
            path: cfg.path,
            title: cfg.title,
            category: cfg.category,
          });
        }

        // Update history with AI response
        const aiMsg = { role: 'assistant', content: aiGuide };
        setConvHistory(prev => [...prev.slice(-9), aiMsg]);
        setFeedExchanges(prev => {
          const updated = [...prev];
          if (updated.length > 0) updated[updated.length - 1] = { ...updated[updated.length - 1], assistant: aiGuide };
          return updated;
        });
      }
    } catch {
      // API failed silently — local results remain
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && query.trim()) {
      e.preventDefault();
      runQuery(query);
    }
  }

  function closeEngine() { onClose?.(); }

  function resetConversation() {
    setSubmitted(false);
    setAnswer('');
    setResults([]);
    setTemperature(null);
    setPrimaryPath(null);
    setAutoClickId(null);
    setGuidedQuestion(null);
    setFollowUpChips([]);
    setEscalated(false);
    setCommercialHighlights([]);
    setConvHistory([]);
    setFeedExchanges([]);
    setEmbeddedPanel(null);
    try { window.sessionStorage.removeItem(HISTORY_KEY); } catch { /* no-op */ }
  }

  const iframeSrc = useMemo(
    () => (embeddedPanel?.path ? buildIframeSrc(embeddedPanel.path) : ''),
    [embeddedPanel],
  );

  function openEmbeddedPanel({ path, title, category, mode }) {
    if (!path) return;
    const cat = String(category || 'page');
    const m = mode || getEmbeddedPanelMode(path, cat);
    const label = title || friendlyPathLabel(path);
    const intro =
      m === 'action'
        ? `J'ouvre une fenêtre pour « ${label} » — vous restez dans la conversation ; complétez l'étape dans le panneau à droite.`
        : `Aperçu de « ${label} » — le contenu s'affiche dans le panneau ; vous pouvez continuer à discuter ici.`;
    setEmbeddedPanel({ path, title: label, category: cat, mode: m });
    setFeedExchanges(prev => [...prev.slice(-4), { user: `→ ${label}`, assistant: intro }]);
  }

  function closeEmbeddedPanel() {
    setEmbeddedPanel(null);
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  const guidedChips = guidedQuestion ? (GUIDED_CHIPS_BY_QUESTION[guidedQuestion] || []) : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — glass premium */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: navEase }}
            onClick={closeEngine}
            className="fixed inset-0 z-[140] bg-[#0F1419]/90 backdrop-blur-md"
          />

          {/* Engine panel */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.4, ease: navEase }}
            className="fixed inset-0 z-[150] flex flex-col overflow-hidden"
          >
            <style>{`
              @keyframes imm-nav-shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
              @keyframes imm-nav-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
              @keyframes imm-nav-pulse-green { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} 50%{box-shadow:0 0 0 8px rgba(34,197,94,0.12)} }
              @keyframes imm-nav-mic { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
              @keyframes imm-nav-orb { 0%,100%{opacity:.45;transform:scale(.88)} 50%{opacity:1;transform:scale(1)} }
            `}</style>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0F1419] text-white">
              {/* Ambiance — alignée sur ChooseAccountTypePage */}
              <div className="pointer-events-none fixed inset-0" aria-hidden>
                <div className="absolute top-1/4 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-indigo-500/5 blur-[100px]" />
              </div>

              <motion.div
                variants={sectionVariants}
                initial="hidden"
                animate="show"
                className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-3 font-sans sm:px-6"
              >

              {/* ── Top bar ── */}
              <div className="flex w-full shrink-0 items-center justify-between px-1 pt-2 sm:px-2">
                {submitted ? (
                  <button
                    type="button"
                    onClick={resetConversation}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200/60 transition-all duration-300 hover:border-amber-400/30 hover:bg-white/10 hover:text-amber-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Nouvelle session
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={closeEngine}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 transition-all duration-300 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-2 lg:flex-row lg:gap-4">
                {/* Colonne gauche — suggestions & poursuite (desktop) */}
                <aside className="order-2 hidden shrink-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/5 bg-[#151a21]/80 p-3 backdrop-blur-xl lg:order-none lg:flex lg:w-[min(260px,26vw)]">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                    <PanelLeft className="h-3.5 w-3.5 shrink-0" />
                    Suggestions
                  </div>
                  {!submitted && (
                    <div className="flex flex-col gap-2">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => { setQuery(s); runQuery(s); }}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-gray-400 transition-all duration-300 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:text-white"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {submitted && followUpChips.length > 0 && (
                    <>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        Pour poursuivre
                      </div>
                      <div className="flex flex-col gap-2">
                        {followUpChips.map((chip, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => runQuery(chip.query)}
                            className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] px-3 py-2 text-left text-xs text-gray-300 transition-all duration-300 hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </aside>

                {/* Centre — réponses & cartes (scroll) */}
                <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:order-none">
                <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-[#151a21]/80 px-3 py-4 pb-2 backdrop-blur-xl sm:px-5">

              {/* ── Brand header (ChooseAccountTypePage) ── */}
              <motion.div variants={blockVariants} className="mb-6 w-full pt-2 text-center sm:mb-8">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <Sparkles className="h-4 w-4 text-[var(--school-accent)]" />
                  <span className="text-sm text-gray-400">
                    {submitted ? 'Assistant ISNA' : 'Navigation intelligente'}
                  </span>
                </div>
                <h1 className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text font-serif text-2xl font-bold tracking-tight text-transparent sm:text-3xl md:text-4xl">
                  {submitted ? 'Votre échange' : "Par où souhaitez-vous avancer ?"}
                </h1>
                <p className="mx-auto mt-4 max-w-xl text-base text-gray-400 sm:text-lg">
                  {submitted
                    ? "Je reformule et je croise les contenus du site pour vous — les actions s'ouvrent à côté quand c'est le bon moment."
                    : "Posez une question : l'IA résume le site comme un conseiller, sans vous envoyer fouiller les pages."}
                </p>
              </motion.div>

              {/* ── Conversation feed (last exchanges) ── */}
              {feedExchanges.length > 0 && (
                <div className="mb-4 flex w-full flex-col gap-3">
                  {feedExchanges.slice(-4).map((ex, i) => (
                    <motion.div
                      key={i}
                      variants={blockVariants}
                      initial="hidden"
                      animate="show"
                      className="flex flex-col gap-2"
                    >
                      {ex.user ? (
                        <div className="flex justify-end">
                          <div className="max-w-[90%] rounded-2xl rounded-br-sm border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-200 shadow-lg backdrop-blur-md">
                            {ex.user}
                          </div>
                        </div>
                      ) : null}
                      {ex.assistant ? (
                        <div className="flex justify-start">
                          <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-200 shadow-lg backdrop-blur-md">
                            {ex.assistant}
                          </div>
                        </div>
                      ) : null}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Réponses assistant : dans le fil ci-dessus (évite doublon avec answer) */}

              {/* ── Escalation banner (après l'explication) ── */}
              <AnimatePresence>
                {escalated && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="premium-panel mb-4 flex w-full flex-wrap items-center gap-3 border border-emerald-500/35 bg-emerald-950/20 p-4 shadow-[0_12px_50px_rgba(0,0,0,0.28)]"
                    style={{ animation: 'imm-nav-pulse-green 2.8s ease-in-out infinite' }}
                  >
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-emerald-300">Transfert au Secrétariat ISNA</p>
                      <p className="mt-1 text-xs text-emerald-200/75">
                        Un conseiller pourra finaliser avec vous. Quand vous le souhaitez, vous pouvez confirmer un rendez-vous — le bouton ci-dessous matérialise ce choix.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-emerald-500/25"
                      onClick={() => {
                        openEmbeddedPanel({
                          path: '/appointment/request',
                          title: 'Prendre rendez-vous',
                          category: 'booking',
                          mode: 'action',
                        });
                      }}
                    >
                      Réserver
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Auto-click notification ── */}
              <AnimatePresence>
                {autoClickId && results.find(r => r.id === autoClickId) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="glass-panel mb-3 flex w-full flex-wrap items-center gap-2 rounded-xl border border-amber-400/25 px-4 py-3"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
                      Sélectionné pour vous
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {results.find(r => r.id === autoClickId)?.label}
                    </span>
                    <span className="ml-auto text-xs italic text-white/45">
                      Confirmez sur la carte si ce choix vous convient
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Guided question ── */}
              <AnimatePresence>
                {guidedQuestion && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="premium-panel mb-4 w-full border border-blue-500/25 bg-blue-950/20 p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-sky-500 text-xs font-bold text-white">
                        ?
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-300/90">
                        Question de qualification
                      </span>
                    </div>
                    <p className="mb-3 text-sm text-white/90">{guidedQuestion}</p>
                    <div className="flex flex-wrap gap-2">
                      {guidedChips.map((chip, ci) => (
                        <button
                          key={ci}
                          type="button"
                          className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs text-sky-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/50 hover:bg-sky-500/20"
                          onClick={() => { setGuidedQuestion(null); runQuery(chip.query); }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Loading skeleton ── */}
              {loading && !answer && (
                <div className="mb-5 w-full space-y-2">
                  {[0, 1].map(i => (
                    <div
                      key={i}
                      className="h-24 rounded-2xl border border-white/5 bg-gradient-to-r from-white/[0.03] via-amber-500/[0.06] to-white/[0.03] bg-[length:200%_auto]"
                      style={{ animation: 'imm-nav-shimmer 1.35s linear infinite' }}
                    />
                  ))}
                </div>
              )}

              {/* ── Cartes d'action ── */}
              {submitted && results.length > 0 && (
                <p className="mb-2 w-full text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200/35">
                  Actions possibles · quand vous choisissez d'agir ici
                </p>
              )}
              <motion.div
                variants={cardListVariants}
                initial="hidden"
                animate="show"
                className="flex w-full flex-col gap-3"
              >
                {results.map((route, i) => {
                  const cat = String(route.category || 'page');
                  const cc = categoryColor(cat);
                  const isAutoSelected = autoClickId === route.id;
                  return (
                    <motion.div
                      key={`${route.id || i}-${i}`}
                      ref={el => { if (el && route.id) cardRefs.current[route.id] = el; }}
                      variants={cardItemVariants}
                      className={cn(
                        'glass-card group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300',
                        isAutoSelected
                          ? 'ring-2 ring-amber-400/70 ring-offset-2 ring-offset-[#090D14] shadow-[0_0_32px_rgba(251,191,36,0.15)]'
                          : 'hover:-translate-y-1 hover:shadow-2xl',
                      )}
                      style={{
                        borderColor: cc.border,
                        background: isAutoSelected ? 'rgba(201,168,76,0.08)' : undefined,
                      }}
                    >
                      {/* Auto-select badge */}
                      {isAutoSelected && (
                        <div className="absolute right-3 top-3 rounded-full border border-amber-400/45 bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200">
                          Sélectionné
                        </div>
                      )}

                      <div
                        className="absolute left-0 right-0 top-0 h-px opacity-50"
                        style={{ background: `linear-gradient(90deg,transparent,${cc.color},transparent)` }}
                      />

                      <div className="mb-2.5 flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                          style={{ background: cc.bg, borderColor: cc.border }}
                        >
                          <CategoryIcon category={cat} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold tracking-tight text-white">
                            {route.label}
                          </h3>
                          <p className="mt-0.5 text-[11px] italic text-white/50">{friendlyPathLabel(route.path)}</p>
                        </div>
                        <span
                          className="shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide"
                          style={{ background: cc.bg, borderColor: cc.border, color: cc.color }}
                        >
                          {cat}
                        </span>
                      </div>

                      {route.summary && (
                        <p className="mb-3 text-[13px] leading-relaxed text-white/70">{route.summary}</p>
                      )}

                      {Array.isArray(route.relatedPaths) && route.relatedPaths.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {route.relatedPaths.slice(0, 3).map((rp, ri) => (
                            <button
                              key={ri}
                              type="button"
                              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/45 transition-all duration-300 hover:border-amber-400/25 hover:text-amber-100/90"
                              onClick={() => {
                                openEmbeddedPanel({
                                  path: rp,
                                  title: friendlyPathLabel(rp),
                                  category: 'page',
                                });
                              }}
                            >
                              {rp}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={cn(
                            'rounded-lg px-4 py-2 text-xs font-bold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg',
                            ['coaching', 'service', 'community'].includes(cat)
                              ? 'bg-gradient-to-r text-white shadow-black/20'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-amber-500/20',
                          )}
                          style={
                            ['coaching', 'service', 'community'].includes(cat)
                              ? { background: `linear-gradient(90deg, ${cc.color}, ${cc.color}dd)` }
                              : undefined
                          }
                          onClick={() => {
                            if (route.path) {
                              openEmbeddedPanel({
                                path: route.path,
                                title: route.label,
                                category: cat,
                              });
                            }
                          }}
                        >
                          {route.ctaLabel || 'Ouvrir'}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* ── Empty state ── */}
              {submitted && !loading && results.length === 0 && !answer && (
                <div className="py-12 text-center text-amber-200/35">
                  <div className="mb-3 text-3xl">✦</div>
                  <p className="text-sm italic">Connexion en cours avec l'assistant…</p>
                </div>
              )}

              {/* ── Bottom brand ── */}
              <div className="mt-12 flex items-center justify-center gap-3">
                <div className="h-px w-14 bg-gradient-to-r from-transparent to-amber-500/25" />
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200/30">
                  NGOWAZULU · PRORASCENCE · ISNA
                </span>
                <div className="h-px w-14 bg-gradient-to-l from-transparent to-amber-500/25" />
              </div>
                </div>
                </div>

                {/* Colonne droite — signal, points clés, instructions panneau */}
                <aside className="order-3 hidden shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/5 bg-[#151a21]/80 p-3 backdrop-blur-xl lg:flex lg:w-[min(280px,28vw)]">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                    <PanelRight className="h-3.5 w-3.5 shrink-0" />
                    Explications & contexte
                  </div>
                  {temperature && TEMP_STYLES[temperature] && (
                    <div
                      className="rounded-lg border px-3 py-2 text-[11px] font-semibold"
                      style={{
                        background: TEMP_STYLES[temperature].bg,
                        borderColor: TEMP_STYLES[temperature].border,
                        color: TEMP_STYLES[temperature].color,
                      }}
                    >
                      {TEMP_STYLES[temperature].label}
                    </div>
                  )}
                  {commercialHighlights.length > 0 && (
                    <div className="glass-card border-l-4 border-l-amber-500/40 p-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/60">
                        Points clés
                      </span>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-white/80">
                        {commercialHighlights.map((h, hi) => (
                          <li key={hi}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {embeddedPanel && (
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/25 p-3 text-xs leading-relaxed text-cyan-100/90">
                      <p className="mb-1 font-semibold text-cyan-200">Panneau actif</p>
                      <p>
                        {embeddedPanel.mode === 'action'
                          ? "Complétez l'action dans la fenêtre à droite. Le chat reste ici, ancré à gauche."
                          : "L'aperçu s'affiche à droite — continuez la conversation dans le champ en bas."}
                      </p>
                    </div>
                  )}
                </aside>
              </div>

              {/* Suggestions — mobile (scroll horizontal) */}
              {!submitted && (
                <div className="mb-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-1 lg:hidden">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setQuery(s); runQuery(s); }}
                      className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-gray-400 transition-all duration-300 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Composer : bas pleine largeur ; dock flottant à gauche si panneau ouvert ── */}
              <div
                className={cn(
                  'shrink-0 border-t border-white/10 bg-[#151a21]/90 px-3 py-3 backdrop-blur-xl transition-all duration-300',
                  embeddedPanel
                    ? 'fixed bottom-4 left-4 z-[200] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] shadow-2xl shadow-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] lg:left-6 lg:max-w-md'
                    : 'relative mt-auto rounded-2xl border border-white/5',
                )}
              >
                {embeddedPanel && (
                  <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Chat — restez dans la conversation
                  </p>
                )}
                <motion.div variants={blockVariants} className="relative w-full">
                  <textarea
                    ref={inputRef}
                    rows={embeddedPanel ? 2 : 2}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={submitted ? "Continuez la conversation…" : "Ex : je veux apprendre la libation, j'ai des rêves troublants…"}
                    className={cn(
                      'w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 pr-[5.75rem] text-sm text-gray-200',
                      'placeholder:text-white/35 backdrop-blur-xl transition-all duration-300',
                      'focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]',
                    )}
                  />
                  {hasMic && (
                    <button
                      type="button"
                      onClick={startVoice}
                      title="Parler"
                      className={cn(
                        'absolute bottom-3 right-14 flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300',
                        isListening
                          ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10',
                      )}
                      style={isListening ? { animation: 'imm-nav-mic 1s ease-in-out infinite' } : undefined}
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => runQuery(query)}
                    disabled={!query.trim() || loading}
                    className={cn(
                      'absolute bottom-3 right-2 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300',
                      query.trim() && !loading
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/20 hover:scale-105'
                        : 'cursor-not-allowed bg-white/5 text-white/25',
                    )}
                  >
                    {loading ? (
                      <span
                        className="h-4 w-4 rounded-full border-2 border-black/20 border-t-black"
                        style={{ animation: 'imm-nav-spin 0.75s linear infinite' }}
                      />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M2 14L14 8L2 2V6.5L9 8L2 9.5V14Z" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                </motion.div>
              </div>

              <AnimatePresence>
                {embeddedPanel && (
                  <motion.div
                    key={embeddedPanel.path}
                    initial={{ x: '100%', opacity: 0.9 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0.9 }}
                    transition={{ duration: 0.35, ease: navEase }}
                    className="fixed inset-y-0 right-0 z-[160] flex w-full max-w-[min(100vw,520px)] flex-col border-l border-white/10 bg-[#151a21]/95 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{embeddedPanel.title}</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/40">
                          {embeddedPanel.mode === 'action'
                            ? "Fenêtre d'action — vous ne quittez pas la conversation"
                            : 'Aperçu de la page'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeEmbeddedPanel}
                        className="shrink-0 rounded-xl border border-white/10 p-2 text-gray-400 transition-colors hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:text-white"
                        aria-label="Fermer le panneau"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="relative min-h-0 flex-1 bg-[#090D14]">
                      {iframeSrc ? (
                        <iframe
                          title={embeddedPanel.title}
                          src={iframeSrc}
                          className="h-full min-h-[50vh] w-full border-0"
                          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                        />
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
