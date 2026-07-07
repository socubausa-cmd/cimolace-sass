/**
 * CimolaceCreationAgent — assistant conversationnel immersif de création d'organisation.
 * Route (preview) : /creer-organisation/agent
 *
 * LOT 2 (cette version) : coque immersive L1 + MACHINE À ÉTATS du flux de création,
 * branchée sur les vrais endpoints (check-slug + POST /signup/tenant + login).
 *   Flux : discovery → produit → marque (nom + slug vérifié) → compte → prêt.
 *   - Présence 5 états (connexion/attente/réflexion/écriture/prêt) câblée aux événements.
 *   - Saisie « parler à la présence » (toucher / type-anywhere) pour le texte libre et le
 *     NOM de l'organisation ; l'étape COMPTE a un vrai formulaire (e-mail + mot de passe) —
 *     le mot de passe est saisi par l'utilisateur, jamais par l'agent.
 *   - Le « cerveau » IA (routeur d'intention + réponses génératives + tunnel de vente)
 *     arrive au LOT 3 (edge agent-brain) ; ici les réponses restent préécrites.
 *
 * Réutilise la logique de OnboardingOrgPage.jsx (endpoints identiques, prouvés en prod).
 * Cf. mémoire projet `cimolace-creation-agent-immersif` pour la direction complète (L1→L5).
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Stethoscope, ShoppingBag, ArrowUp, ArrowRight, ArrowLeft, Check, Loader2, Mail, Lock, Volume2, VolumeX, Sparkles, SkipForward, X, Compass, BookOpen, Users, Tag, UserPlus, Calendar, Download, Scale, Send } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { authStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { logEvent, logUnanswered } from '@/lib/agent/vnpStats';
import { BG, BG_THINK, INK, TERRA, GOLD, SERIF, DISPLAY, STYLE } from '@/lib/agent/immersiveTheme';
import Presence from '@/components/agent/Presence';
import { CIMOLACE_LESSONS } from '@/lib/agent/cimolaceLessons';
import { OS_KNOWLEDGE, prorascienceKnowledgeText, buildTenantTour, buildNodeScene } from '@/lib/agent/prorascienceKnowledge';
import { buildVnpGraph, vnpSerialize, vnpRelated, vnpIntent } from '@/lib/agent/vnp';
import { createProtocol } from '@/lib/agent/vnpProtocol';

// Cimolace EST le moteur de rendu (l'OS) : il consomme le CONTENU de cours du Précepteur
// (données JSON : leçons narrées + atelier) et le rend NATIVEMENT dans sa coque — voix serif
// + atelier natif, aucun composant/tableau étranger → jamais de fond blanc « autre app ».

// Juge d'atelier local (miroir de judgeAtelier.js) : classe la réponse + choisit un « ack » varié.
function judgeAtelierLocal(scene, answer) {
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const a = norm(answer);
  const hit = (arr) => (Array.isArray(arr) ? arr : []).some((k) => k && a.includes(norm(k)));
  let cat = 'partial';
  if (hit(scene.expected_answers)) cat = 'ok';
  else if (hit(scene.expected_errors)) cat = 'wrong';
  const variants = (scene.ack_variants && scene.ack_variants[cat]) || [];
  const ack = variants[Math.floor(Math.random() * variants.length)] ||
    (cat === 'ok' ? 'Exactement.' : cat === 'wrong' ? 'Pas tout à fait.' : 'Presque.');
  return { cat, ack };
}

// Intention d'apprendre → Cimolace bascule en mode formation (rend le cours nativement).
const isLessonIntent = (m) =>
  /enseigne|apprends?[ -]?moi|donne[ -]?moi un cours|fais[ -]?moi un cours|un vrai cours|cours (sur|de|complet|num[ée]rique)|je veux (comprendre|apprendre)|montre[ -]?moi un cours|le pr[ée]cepteur|suivre un cours/i.test(m || '');

// Valide/coerce un cours généré (edge generate-lesson) — ne throw jamais ; null si inutilisable.
function normalizeLesson(raw) {
  try {
    const src = raw && raw.course ? raw.course : raw;
    if (!src || !Array.isArray(src.concepts)) return null;
    const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
    const arr = (a, n, len) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => cut(x, len)).filter(Boolean);
    const concepts = src.concepts.slice(0, 2).map((c) => {
      const scenes = (Array.isArray(c && c.scenes) ? c.scenes : []).map((s) => {
        if (!s || typeof s !== 'object') return null;
        if (s.type === 'lecon') {
          const narration = cut(s.narration || s.board_text, 700);
          return narration ? { type: 'lecon', title: cut(s.title, 80) || undefined, board_text: cut(s.board_text || s.narration, 220), narration } : null;
        }
        if (s.type === 'atelier') {
          if (!s.question) return null;
          const ack = s.ack_variants || {};
          return {
            type: 'atelier', address: '{{student_name}}', question: cut(s.question, 320), hint: cut(s.hint, 200) || undefined,
            expected_answers: arr(s.expected_answers, 10, 40), expected_errors: arr(s.expected_errors, 10, 40),
            ack_variants: { ok: arr(ack.ok, 4, 40), partial: arr(ack.partial, 4, 40), wrong: arr(ack.wrong, 4, 40) },
            reveal_narration: cut(s.reveal_narration, 800),
          };
        }
        if (s.type === 'transition') { const n = cut(s.narration, 220); return n ? { type: 'transition', narration: n } : null; }
        return null; // jamais croquis/image (le rendu natif ne les joue pas)
      }).filter(Boolean);
      return scenes.length ? { title: cut(c && c.title, 80), scenes } : null;
    }).filter(Boolean);
    if (!concepts.length || !concepts.some((c) => c.scenes.some((s) => s.type === 'lecon'))) return null;
    return { title: cut(src.title, 80) || 'Cours', concepts };
  } catch { return null; }
}

// Extrait le sujet d'un message d'apprentissage (« enseigne-moi X », « un cours sur X »).
function extractLessonTopic(m) {
  const s = String(m || '').trim();
  let t = '';
  let mm = s.match(/cours (?:complet |num[ée]rique )?(?:sur|de|d'|d’|à propos de)\s+(.+)/i);
  if (mm) t = mm[1];
  if (!t) { mm = s.match(/(?:enseigne|apprends?|explique|montre|parle)[ -]?(?:moi|nous)?\s+(?:sur\s+|comment\s+|à\s+)?(.+)/i); if (mm) t = mm[1]; }
  if (!t) { mm = s.match(/(?:sur|à propos de)\s+(.+)/i); if (mm) t = mm[1]; }
  t = t.replace(/^(le |la |les |l'|l’)/i, '').replace(/[?.!\s]+$/, '').trim();
  return t.length >= 3 ? t.slice(0, 90) : '';
}

// BG/BG_THINK/INK/TERRA/GOLD/SERIF importés depuis @/lib/agent/immersiveTheme (coque partagée)

const GREETING = "Bonjour. Dites-moi ce que vous voulez lancer — je m'occupe du reste.";

// Icône de puce (realm tenant) selon l'intention de la question — cohérent avec le redesign éditorial.
function chipIconFor(q) {
  const s = String(q || '').toLowerCase();
  if (/fondateur|recteur|manikongo|[ée]quipe/.test(s)) return Users;
  if (/forfait|prix|tarif|palier|cycle|mentorat|co[ûu]t|parcours/.test(s)) return Tag;
  if (/contact|support|aide|nous [ée]crire/.test(s)) return Mail;
  if (/mission|vision|valeur|histoire|r[ée]alisation/.test(s)) return Sparkles;
  return BookOpen;
}

// ── VNP — styles de puces (accueil / navigation guidée / action) + méta des actions métier. ──
const VNP_CHIP_BASE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 14, lineHeight: 1.25, borderRadius: 15, padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' };
const VNP_NAV_CHIP = { ...VNP_CHIP_BASE, color: 'rgba(244,239,230,.9)', background: 'rgba(244,239,230,.035)', border: '1px solid rgba(230,204,146,.2)' };
const VNP_ACTION_CHIP = { ...VNP_CHIP_BASE, color: INK, background: 'rgba(217,119,87,.15)', border: '1px solid rgba(217,119,87,.5)' };
const VNP_VISIT_CHIP = { ...VNP_CHIP_BASE, fontWeight: 600, color: '#231208', background: TERRA, border: '1px solid transparent' };
const VNP_CHIP_LABEL = { display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 };
const VNP_FIELD = { width: '100%', boxSizing: 'border-box', background: 'rgba(244,239,230,.05)', border: '1px solid rgba(230,204,146,.22)', borderRadius: 12, padding: '11px 14px', color: INK, fontFamily: 'inherit', fontSize: 14, outline: 'none' };

// Créneaux de RDV proposés (Action Engine « réserver ») : prochains jours ouvrés × 2 horaires.
function fmtSlot(d) {
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} · ${hh}h${mm === '00' ? '' : mm}`;
}
function genSlots(count = 6) {
  const out = [];
  const times = [[10, 0], [15, 0]];
  const d = new Date(); d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (out.length < count && guard < 30) {
    guard += 1;
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // saute le week-end
    for (const [h, m] of times) {
      if (out.length >= count) break;
      const slot = new Date(d); slot.setHours(h, m, 0, 0);
      out.push({ iso: slot.toISOString(), label: fmtSlot(slot) });
    }
  }
  return out;
}
// Protocole de Visite (spec §3) — reducer vnpProtocol branché mais OFF par défaut : le flux VNP actuel
// reste la référence. Passer à true APRÈS validation preview pour piloter node/détail par la machine à états.
const VNP_PROTOCOL_V2 = false;

// Réponses DESIGNÉES : un clic de sujet compose une SCÈNE (buildNodeScene + normalizeScene) au lieu
// d'un texte plat. Kill-switch instantané (fallback exact = narration speak()). ON par défaut.
const VNP_SCENES_V2 = true;

const VNP_ACTION_META = {
  contacter: { label: 'Nous contacter', Icon: Mail },
  rejoindre: { label: 'Rejoindre', Icon: UserPlus },
  reserver: { label: 'Réserver', Icon: Calendar },
  acheter: { label: 'Choisir un forfait', Icon: Tag },
  comparer: { label: 'Comparer', Icon: Scale },
  comprendre: { label: 'Comprendre', Icon: BookOpen },
  decouvrir: { label: 'Découvrir', Icon: Sparkles },
  telecharger: { label: 'Télécharger', Icon: Download },
  participer: { label: 'Participer', Icon: Users },
  __detail__: { label: 'Approfondir', Icon: BookOpen },
};

// L'OS peut RENDRE un tenant existant (realm) — MÊME moteur/couleurs, seuls le logo (au coin),
// le nom de la plateforme et le message de bienvenue changent. Résolution du slug tenant :
// prop → ?os=<slug> (preview) → host dédié (prorascience.org → isna). Sinon null = realm Cimolace.
function getOsRealmSlug(propSlug) {
  if (propSlug) return String(propSlug).trim().toLowerCase();
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search).get('os');
    if (q && q.trim()) return q.trim().toLowerCase();
  } catch { /* ignore */ }
  const host = window.location.hostname.toLowerCase();
  if (host === 'prorascience.org' || host === 'www.prorascience.org') return 'isna';
  return null;
}

// Fallback anti-flash + robustesse CORS : l'API branding bloque les origines vercel.app en preview
// (le fetch réel confirme/affine en prod). Garantit nom + logo immédiats pour les tenants connus.
const OS_REALM_FALLBACK = {
  // Logo prorascience = l'ŒIL (Œil d'Horus + oreille), version blanche transparente pour le badge sombre.
  isna: { name: 'Prorascience', logo: '/prorascience-eye.png' },
};

const SUGG = [
  { kind: 'school', label: 'École / cours en ligne', Icon: GraduationCap },
  { kind: 'medos', label: 'Clinique / santé', Icon: Stethoscope },
  { kind: 'shop', label: 'Boutique en ligne', Icon: ShoppingBag },
];

// Mon « kind » d'UI → « kind » attendu par POST /signup/tenant
const KIND_MAP = { school: 'school', medos: 'medos', shop: 'mbolo' };

const PRODUCT = {
  school: { tag: 'LIRI École', reply: "Parfait — LIRI École : lives, cours, smartboard IA, replay. On construit votre espace ?" },
  medos: { tag: 'MedOS', reply: "Pour une clinique, MedOS : dossiers, notes SOAP, téléconsultation, RGPD. On le met en place ?" },
  shop: { tag: 'Virtuel Mbolo', reply: "Pour vendre en ligne, Virtuel Mbolo : catalogue, panier, mobile money. On lance votre boutique ?" },
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function guessKind(v) {
  const s = (v || '').toLowerCase();
  if (/clin|sant|patient|m[ée]dec|soin/.test(s)) return 'medos';
  if (/boutiq|vend|produit|commerce|magasin|mbolo/.test(s)) return 'shop';
  return 'school';
}

// STYLE importé depuis @/lib/agent/immersiveTheme (coque partagée)

// ── Croquis « Précepteur » — se dessinent seuls (stroke-dashoffset), un par sujet ──
const T_LABELS = { live: 'Live', cours: 'Cours', ia: 'IA', replay: 'Replay', compare: 'Comparé', prix: 'Prix' };
const TOPIC_ORDER = ['live', 'cours', 'ia', 'replay', 'compare', 'prix'];
// Questions canoniques par sujet (rail L5 → interroge le cerveau).
const TOPIC_Q = {
  live: 'Comment marchent les cours en direct ?',
  cours: 'Et les cours et leçons à la demande ?',
  ia: 'Le smartboard IA, ça fait quoi ?',
  replay: 'Les cours restent en replay après ?',
  compare: 'Pourquoi Cimolace plutôt que Zoom ?',
  prix: 'Et le prix, ça donne quoi ?',
};
// ── L7 — « Fais-moi le tour » : l'IA prend le contrôle et enchaîne les scènes toute seule ──
// Chaque beat = { reply (voix Sherpas), keyword (surligné), topic? (croquis), scene? (composition), final? }.
const isTourIntent = (m) =>
  /fais[ -]?(moi )?(le )?tour|pr[ée]sente[ -]?(moi )?tout|montre[ -]?(moi )?tout|tour (complet|du produit|guid[ée])|fais le tour|visite guid[ée]|pr[ée]sentation (compl[èe]te|guid[ée])/i.test(m || '');

const TOUR = {
  school: [
    { reply: "C'est parti, je te fais le tour. Ton école aura deux faces : ce que voient tes élèves, et ta salle des machines.",
      keyword: 'deux faces',
      scene: { type: 'split', headline: 'Ton école, deux mondes',
        left: { title: "Le monde d'en haut", subtitle: 'Côté élève', points: ['Vitrine à ta marque', 'Inscription en 1 clic', 'Lives HD + replay'] },
        right: { title: "Le monde d'en bas", subtitle: 'Côté toi', points: ['Tableau de bord', 'Membres & paiements', 'Smartboard IA'] },
        tone: { left: 'gold', right: 'terra' } } },
    { reply: 'Le cœur, c\'est le direct : tes cours en live HD, avec un tableau intelligent qui dessine pour toi.',
      keyword: 'en direct', topic: 'live' },
    { reply: 'Et rien ne se perd : chaque live devient un replay que tes élèves revoient quand ils veulent.',
      keyword: 'un replay', topic: 'replay' },
    { reply: 'Côté budget c\'est clair : dès 150 €/mois, et zéro commission sur tes ventes.',
      keyword: 'zéro commission',
      scene: { type: 'aside', side: 'right', title: 'Les paliers',
        items: [{ label: 'START', value: '150 €/mois', note: 'lives + replay' }, { label: 'BUSINESS', value: '200 €/mois', note: 'multi-classes, IA' }, { label: 'Installation', value: '500 € une fois', note: 'prêt en minutes' }],
        highlight: 'START' } },
    { reply: 'Voilà le tour ! Ton espace à ta marque est prêt en quelques minutes — on le lance ?',
      keyword: 'prêt en quelques minutes', final: true },
  ],
  medos: [
    { reply: 'Je te fais le tour. MedOS, c\'est deux faces : l\'espace de ton patient, et ton cockpit de praticien.',
      keyword: 'deux faces',
      scene: { type: 'split', headline: 'MedOS, deux faces',
        left: { title: 'Côté patient', subtitle: 'Rassurant', points: ['Prise de RDV en ligne', 'Téléconsultation', 'Portail à ta marque'] },
        right: { title: 'Côté praticien', subtitle: 'Puissant', points: ['Dossiers patients', 'Notes SOAP dictées', 'Ordonnances & suivi'] },
        tone: { left: 'gold', right: 'terra' } } },
    { reply: 'En consultation, tu dictes : l\'IA rédige la note SOAP pendant que tu parles à ton patient.',
      keyword: 'note SOAP',
      scene: { type: 'tutorial', title: 'Une consultation, 3 gestes',
        steps: [{ title: 'Ouvre le dossier', detail: "Tout l'historique du patient d'un coup d'œil." }, { title: 'Dicte, l\'IA rédige', detail: 'La note SOAP s\'écrit toute seule.' }, { title: 'Lance la téléconsult', detail: 'Vidéo sécurisée, à distance, RGPD.' }],
        cta: 'Mettre en place MedOS' } },
    { reply: 'Côté budget : dès 150 €/mois, zéro commission, et c\'est aux couleurs de ta clinique.',
      keyword: 'zéro commission',
      scene: { type: 'aside', side: 'right', title: 'Les paliers',
        items: [{ label: 'START', value: '150 €/mois', note: 'dossiers + téléconsult' }, { label: 'BUSINESS', value: '200 €/mois', note: 'multi-praticiens' }, { label: 'Installation', value: '500 € une fois', note: 'prêt en minutes' }],
        highlight: 'START' } },
    { reply: 'Voilà le tour ! Ta clinique en ligne, à ta marque, est prête en minutes — on la lance ?',
      keyword: 'prête en minutes', final: true },
  ],
  shop: [
    { reply: 'Je te fais le tour. Ta boutique a deux faces : la vitrine que voit ton client, et ton arrière-boutique.',
      keyword: 'deux faces',
      scene: { type: 'split', headline: 'Ta boutique, deux faces',
        left: { title: 'La vitrine', subtitle: 'Côté client', points: ['Catalogue à ta marque', 'Panier & paiement', 'Mobile money'] },
        right: { title: "L'arrière-boutique", subtitle: 'Côté toi', points: ['Produits & stock', 'Commandes', 'Encaissements'] },
        tone: { left: 'gold', right: 'terra' } } },
    { reply: 'Vendre, c\'est 3 gestes : tu ajoutes un produit, tu partages ton lien, tu encaisses en mobile money.',
      keyword: 'mobile money',
      scene: { type: 'tutorial', title: 'Vendre en 3 gestes',
        steps: [{ title: 'Ajoute un produit', detail: 'Photo, prix, stock — en une minute.' }, { title: 'Partage ton lien', detail: 'Ta boutique à ta marque, prête à envoyer.' }, { title: 'Encaisse', detail: 'Carte ou mobile money (XAF/XOF).' }],
        cta: 'Lancer ma boutique' } },
    { reply: 'Côté budget : dès 150 €/mois, zéro commission sur tes ventes.',
      keyword: 'zéro commission',
      scene: { type: 'aside', side: 'right', title: 'Les paliers',
        items: [{ label: 'START', value: '150 €/mois', note: 'catalogue + paiement' }, { label: 'BUSINESS', value: '200 €/mois', note: 'multi-boutiques' }, { label: 'Installation', value: '500 € une fois', note: 'prêt en minutes' }],
        highlight: 'START' } },
    { reply: 'Voilà le tour ! Ta boutique à ta marque est prête en minutes — on la lance ?',
      keyword: 'prête en minutes', final: true },
  ],
};

// Surligne le mot-clé dans la reply avec la boîte « Punch » PARTAGÉE (grotesque MAJUSCULE
// dorée, classe `.sv-key` de immersiveTheme) : l'Assistant et Le Précepteur ont le MÊME punch.
function highlightReply(text, kw) {
  if (!kw) return text;
  const i = text.toLowerCase().indexOf(kw.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="sv-key">{text.slice(i, i + kw.length)}</span>
      {text.slice(i + kw.length)}
    </>
  );
}
function croquisFor(t) {
  const dr = (d) => ({ className: 'cca-dr', style: { animationDelay: `${d}s` } });
  const S = { stroke: '#d97757', strokeWidth: 2, fill: 'none', pathLength: 1 };
  const G = { stroke: '#e6cc92', strokeWidth: 2, fill: 'none', pathLength: 1 };
  const M = { stroke: 'rgba(244,239,230,.4)', strokeWidth: 2, fill: 'none', pathLength: 1 };
  const wrap = (children) => (
    <svg width="204" height="112" viewBox="0 0 220 120" fill="none" aria-hidden="true">{children}</svg>
  );
  if (t === 'live') return wrap(<>
    <rect x="8" y="8" width="204" height="104" rx="8" {...S} {...dr(0.05)} />
    <rect x="18" y="18" width="118" height="66" rx="5" {...G} {...dr(0.35)} />
    <circle cx="77" cy="45" r="12" {...G} {...dr(0.55)} />
    <rect x="146" y="18" width="56" height="30" rx="4" {...S} {...dr(0.7)} />
    <rect x="146" y="54" width="56" height="30" rx="4" {...S} {...dr(0.8)} />
    <circle cx="200" cy="98" r="4" fill="#e24b4a" />
  </>);
  if (t === 'cours') return wrap(<>
    <rect x="82" y="8" width="56" height="24" rx="5" {...G} {...dr(0.05)} />
    <line x1="110" y1="32" x2="110" y2="50" {...S} {...dr(0.3)} />
    <line x1="40" y1="50" x2="180" y2="50" {...S} {...dr(0.42)} />
    <line x1="40" y1="50" x2="40" y2="66" {...S} {...dr(0.54)} />
    <line x1="110" y1="50" x2="110" y2="66" {...S} {...dr(0.6)} />
    <line x1="180" y1="50" x2="180" y2="66" {...S} {...dr(0.66)} />
    <rect x="16" y="68" width="48" height="40" rx="5" {...S} {...dr(0.78)} />
    <rect x="86" y="68" width="48" height="40" rx="5" {...S} {...dr(0.9)} />
    <rect x="156" y="68" width="48" height="40" rx="5" {...S} {...dr(1.02)} />
  </>);
  if (t === 'ia') return wrap(<>
    <rect x="8" y="8" width="204" height="104" rx="8" {...S} {...dr(0.05)} />
    <path d="M26 84 C54 40 86 104 120 64 C142 42 170 54 188 80" {...G} strokeWidth={2.4} {...dr(0.4)} />
    <path d="M178 24 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" {...G} {...dr(1.05)} fill="rgba(230,204,146,.15)" />
  </>);
  if (t === 'replay') return wrap(<>
    <line x1="22" y1="60" x2="198" y2="60" {...M} strokeWidth={3} {...dr(0.05)} />
    <line x1="22" y1="60" x2="88" y2="60" {...S} strokeWidth={3} {...dr(0.4)} />
    <circle cx="88" cy="60" r="7" fill="#e6cc92" />
    <line x1="56" y1="52" x2="56" y2="68" {...M} {...dr(0.7)} />
    <line x1="140" y1="52" x2="140" y2="68" {...M} {...dr(0.8)} />
    <path d="M100 86 l0 24 l20 -12 z" {...S} {...dr(1)} fill="rgba(217,119,87,.2)" />
  </>);
  if (t === 'compare') return wrap(<>
    <rect x="22" y="12" width="80" height="96" rx="8" {...S} {...dr(0.05)} />
    <rect x="118" y="36" width="80" height="52" rx="8" {...M} {...dr(0.35)} />
    <path d="M34 38 l6 6 l12 -12" {...G} strokeWidth={2.4} {...dr(0.6)} />
    <path d="M34 62 l6 6 l12 -12" {...G} strokeWidth={2.4} {...dr(0.72)} />
    <path d="M34 86 l6 6 l12 -12" {...G} strokeWidth={2.4} {...dr(0.84)} />
    <path d="M132 62 l6 6 l12 -12" {...M} strokeWidth={2.4} {...dr(0.96)} />
  </>);
  return wrap(<>
    <rect x="28" y="14" width="164" height="22" rx="6" {...M} {...dr(0.1)} />
    <rect x="28" y="46" width="164" height="28" rx="7" stroke="#d97757" strokeWidth={2.4} fill="rgba(217,119,87,.14)" pathLength={1} {...dr(0.35)} />
    <rect x="28" y="86" width="164" height="22" rx="6" {...M} {...dr(0.6)} />
    <circle cx="178" cy="60" r="11" {...G} {...dr(0.85)} />
  </>);
}

// ═══════════════════════════════════════════════════════════════════════════
// L6 — L'IA réalisatrice de sa surface : un champ `scene` (optionnel) décrit une
// composition de tout l'écran ; le front la met en scène + l'anime, puis revient
// au mode de base. `reply` reste TOUJOURS la voix autonome (invariant anti-écran-vide).
// ═══════════════════════════════════════════════════════════════════════════
const SCENE_TYPES = ['aside', 'split', 'reader', 'tutorial', 'cards'];
const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// normalizeScene = AUTORITÉ FINALE (pure, ne throw jamais). Doute → null → center-question.
function normalizeScene(raw) {
  try {
    if (!raw || typeof raw !== 'object' || !SCENE_TYPES.includes(raw.type)) return null;
    const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
    const arr = (a, n, len) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => cut(x, len)).filter(Boolean);
    if (raw.type === 'aside') {
      const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 4)
        .map((it) => (it && it.label && it.value)
          ? { label: cut(it.label, 24), value: cut(it.value, 40), note: cut(it.note, 80) || undefined } : null)
        .filter(Boolean);
      if (!items.length) return null;
      return { type: 'aside', side: 'right', // toujours à droite : le rail des sujets occupe la gauche
        title: cut(raw.title, 80) || undefined, items,
        highlight: typeof raw.highlight === 'string' ? cut(raw.highlight, 24) : undefined };
    }
    if (raw.type === 'split') {
      const pane = (o) => (o && o.title && Array.isArray(o.points) && o.points.length >= 2)
        ? { title: cut(o.title, 60), subtitle: cut(o.subtitle, 80) || undefined, points: arr(o.points, 4, 90) } : null;
      const left = pane(raw.left), right = pane(raw.right);
      if (!left || !right || left.points.length < 2 || right.points.length < 2) return null;
      const tn = (v) => (v === 'terra' || v === 'gold') ? v : undefined;
      return { type: 'split', headline: cut(raw.headline, 80) || undefined, left, right,
        tone: { left: tn(raw.tone && raw.tone.left), right: tn(raw.tone && raw.tone.right) } };
    }
    if (raw.type === 'reader') {
      const body = (Array.isArray(raw.body) ? raw.body : []).slice(0, 6)
        .map((s) => (s && s.h && s.p) ? { h: cut(s.h, 60), p: cut(s.p, 700) } : null).filter(Boolean);
      if (!body.length || !(raw.profile && raw.profile.name)) return null;
      const facts = (Array.isArray(raw.profile.facts) ? raw.profile.facts : []).slice(0, 4)
        .map((f) => (f && f.k && f.v) ? { k: cut(f.k, 24), v: cut(f.v, 60) } : null).filter(Boolean);
      return { type: 'reader', title: cut(raw.title, 80) || 'Lecture',
        profile: { name: cut(raw.profile.name, 60), role: cut(raw.profile.role, 80) || undefined,
          avatarSeed: cut(raw.profile.avatarSeed, 40) || undefined, facts },
        body, suggestions: arr(raw.suggestions, 4, 60) };
    }
    if (raw.type === 'tutorial') {
      const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 5)
        .map((s) => (s && s.title) ? { title: cut(s.title, 60), detail: cut(s.detail, 160) || undefined,
          sketch: TOPIC_ORDER.includes(s.sketch) ? s.sketch : undefined } : null).filter(Boolean);
      if (!steps.length) return null;
      return { type: 'tutorial', title: cut(raw.title, 80) || 'Pas à pas', steps, cta: cut(raw.cta, 80) || undefined };
    }
    if (raw.type === 'cards') {
      const cards = (Array.isArray(raw.cards) ? raw.cards : []).slice(0, 6)
        .map((c) => (c && c.title) ? {
          title: cut(c.title, 40),
          value: cut(c.value, 40) || undefined,
          note: cut(c.note, 120) || undefined,
          badge: cut(c.badge, 24) || undefined,
          accent: (c.accent === 'terra' || c.accent === 'gold') ? c.accent : undefined,
          ref: (c.ref && typeof c.ref === 'object') ? {
            kind: c.ref.kind === 'plan' ? 'plan' : 'info',
            title: cut(c.ref.title, 60) || cut(c.title, 40),
            value: cut(c.ref.value, 40) || undefined,
            note: cut(c.ref.note, 340) || undefined,
            actions: (Array.isArray(c.ref.actions) ? c.ref.actions : []).filter((a) => typeof a === 'string').slice(0, 4),
            related: (Array.isArray(c.ref.related) ? c.ref.related : []).slice(0, 3)
              .map((r) => (r && r.nodeId && r.label) ? { nodeId: cut(r.nodeId, 40), label: cut(r.label, 40) } : null).filter(Boolean),
          } : undefined,
        } : null).filter(Boolean);
      if (!cards.length) return null;
      return { type: 'cards', title: cut(raw.title, 80) || undefined, cards };
    }
    return null;
  } catch { return null; }
}

// Avatar SVG déterministe (hash → teinte terra/or), zéro réseau — pour le reader.
function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function avatarFromSeed(seed) {
  const s = String(seed || '?').trim() || '?';
  const h = hashSeed(s);
  const accent = (h & 1) ? TERRA : GOLD;
  const initials = s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('') || '?';
  const gid = `av-${h}`;
  return (
    <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="38%" cy="30%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.92" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.14" />
        </radialGradient>
      </defs>
      <circle cx="37" cy="37" r="35" fill={`url(#${gid})`} />
      <circle cx="37" cy="37" r="35.5" fill="none" stroke={accent} strokeOpacity="0.4" />
      <text x="37" y="39" dominantBaseline="middle" textAnchor="middle" fontFamily={SERIF} fontSize="25" fontWeight="600" fill="#1a1613">{initials}</text>
    </svg>
  );
}

// ── Renderer de scène + 4 sous-scènes. Contenu rendu dès scene!=null (jamais gaté
//    sur `visible`) ; la classe cca-scene-on n'ajoute QUE le mouvement (anti onglet-masqué). ──
function SceneStage({ scene, visible, readerIdx, setReaderIdx, onSuggest, onCta, hooks, onHook, onFocus }) {
  if (!scene) return null;
  return (
    <div className={`cca-scene cca-stage-${scene.type} ${visible ? 'cca-scene-on' : ''}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      {scene.type === 'aside' && <AsidePanel scene={scene} />}
      {scene.type === 'split' && <SplitWorlds scene={scene} hooks={hooks} onHook={onHook} />}
      {scene.type === 'reader' && <ReaderView scene={scene} idx={readerIdx} setIdx={setReaderIdx} onSuggest={onSuggest} hooks={hooks} />}
      {scene.type === 'tutorial' && <TutorialFlow scene={scene} onCta={onCta} hooks={hooks} onHook={onHook} />}
      {scene.type === 'cards' && <CardsScene scene={scene} onFocus={onFocus} />}
    </div>
  );
}

function AsidePanel({ scene }) {
  const isLeft = scene.side === 'left';
  return (
    <aside className={`cca-aside ${isLeft ? 'cca-aside-left' : ''}`} style={{ pointerEvents: 'auto' }}>
      {scene.title && <div className="cca-aside-title">{scene.title}</div>}
      {scene.items.map((it, i) => (
        <div key={i} className="cca-aside-row" style={{ transitionDelay: `${i * 70 + 120}ms` }}>
          <div className="cca-aside-head">
            <span className="cca-aside-label" style={it.label === scene.highlight ? { color: TERRA } : undefined}>{it.label}</span>
            <span className="cca-aside-value">{it.value}</span>
          </div>
          {it.note && <span className="cca-aside-note">{it.note}</span>}
        </div>
      ))}
    </aside>
  );
}

// cards — grille de cartes PLEIN ÉCRAN (forfaits/chiffres/valeurs), révélées en cascade.
// CSS + slot injectés ici (valeurs littérales du thème → aucune dépendance d'import).
const CARDS_CSS = `
.cca-scene-on.cca-slot-cards{transform:translateY(-38vh) scale(.5);opacity:0}
.cca-cards{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:13px;padding:78px 5vw 7vh;overflow-y:auto;scrollbar-width:none}
@media (max-height:820px){.cca-cards{justify-content:flex-start}}
.cca-cards::-webkit-scrollbar{width:0}
.cca-cards-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:22px;color:#f4efe6;text-align:center;margin-bottom:2px;opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-cards-title{opacity:1;transform:none}
.cca-cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:13px;max-width:880px;width:100%;margin:0 auto}
.cca-card{position:relative;background:rgba(244,239,230,.04);border:1px solid rgba(244,239,230,.1);border-radius:16px;padding:17px 17px 15px;display:flex;flex-direction:column;gap:5px;opacity:0;transform:translateY(16px) scale(.98);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1),border-color .2s ease,background .2s ease}
.cca-scene-on .cca-card{opacity:1;transform:none}
.cca-card:hover{border-color:rgba(230,204,146,.4);background:rgba(244,239,230,.06)}
.cca-card-gold{border-color:rgba(230,204,146,.5);background:rgba(230,204,146,.05)}
.cca-card-terra{border-color:rgba(217,119,87,.4)}
.cca-card-badge{position:absolute;top:-9px;right:14px;background:#e6cc92;color:#2a140c;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;padding:2px 9px;border-radius:999px}
.cca-card-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:16px;color:#f4efe6;font-weight:600}
.cca-card-value{font-family:'Cormorant Garamond','Cormorant',Georgia,serif;font-size:31px;line-height:1;color:#e6cc92;margin:1px 0}
.cca-card-terra .cca-card-value{color:#d97757}
.cca-card-note{font-size:12.5px;line-height:1.45;color:rgba(244,239,230,.6)}
.cca-card-click:hover{border-color:rgba(230,204,146,.55);background:rgba(244,239,230,.07);transform:translateY(-2px)}
.cca-card-more{margin-top:7px;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#e6cc92;opacity:.7;transition:opacity .2s ease}
.cca-card-click:hover .cca-card-more{opacity:1}
@media (max-width:640px){.cca-cards{padding:7vh 5vw 4vh}.cca-cards-grid{grid-template-columns:1fr}.cca-card-value{font-size:27px}}
`;
function CardsScene({ scene, onFocus }) {
  return (
    <div className="cca-cards" style={{ pointerEvents: 'auto' }}>
      <style>{CARDS_CSS}</style>
      {scene.title && <div className="cca-cards-title">{scene.title}</div>}
      <div className="cca-cards-grid">
        {scene.cards.map((c, i) => {
          const clickable = !!(c.ref && onFocus);
          return (
            <div
              key={i}
              className={`cca-card${c.accent === 'gold' ? ' cca-card-gold' : c.accent === 'terra' ? ' cca-card-terra' : ''}${clickable ? ' cca-card-click' : ''}`}
              style={{ transitionDelay: `${i * 65 + 140}ms`, cursor: clickable ? 'pointer' : 'default' }}
              onClick={clickable ? (e) => { e.stopPropagation(); onFocus(c.ref); } : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(c.ref); } } : undefined}
            >
              {c.badge && <span className="cca-card-badge">{c.badge}</span>}
              <div className="cca-card-title">{c.title}</div>
              {c.value && <div className="cca-card-value">{c.value}</div>}
              {c.note && <div className="cca-card-note">{c.note}</div>}
              {clickable && <span className="cca-card-more">Voir le détail →</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// FocusDrawer — MODE FOCUS : cliquer un élément (carte) ouvre un tiroir d'approfondissement INLINE
// (détail + actions métier + sujets liés), sans quitter la conversation. Backdrop → ferme.
const FOCUS_CSS = `
@keyframes ccaFocusIn{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
.cca-focus-back{position:fixed;inset:0;background:rgba(12,12,11,.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:40;display:flex;align-items:flex-end;justify-content:center}
.cca-focus{width:min(560px,94vw);max-height:82vh;overflow-y:auto;scrollbar-width:none;background:#211f1d;border:1px solid rgba(230,204,146,.2);border-bottom:none;border-radius:22px 22px 0 0;padding:22px 22px 26px;box-shadow:0 -20px 60px -20px rgba(0,0,0,.7);animation:ccaFocusIn .34s cubic-bezier(.16,1,.3,1) both}
.cca-focus::-webkit-scrollbar{width:0}
.cca-focus-grip{width:38px;height:4px;border-radius:2px;background:rgba(244,239,230,.2);margin:0 auto 16px}
.cca-focus-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:20px;color:#f4efe6;font-weight:600}
.cca-focus-value{font-family:'Cormorant Garamond','Cormorant',Georgia,serif;font-size:38px;line-height:1.05;color:#e6cc92;margin:3px 0 10px}
.cca-focus-note{font-size:14px;line-height:1.6;color:rgba(244,239,230,.78);margin-bottom:18px}
.cca-focus-actions{display:flex;flex-direction:column;gap:9px;margin-bottom:16px}
.cca-focus-act{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px;border-radius:13px;border:1px solid rgba(217,119,87,.4);background:rgba(217,119,87,.12);color:#f4efe6;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background .16s ease,border-color .16s ease}
.cca-focus-act:hover{background:rgba(217,119,87,.2);border-color:rgba(217,119,87,.6)}
.cca-focus-act.sec{border-color:rgba(244,239,230,.14);background:rgba(244,239,230,.04)}
.cca-focus-act.sec:hover{background:rgba(244,239,230,.08);border-color:rgba(244,239,230,.28)}
.cca-focus-suites{display:flex;flex-wrap:wrap;gap:8px}
.cca-focus-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;border:1px solid rgba(230,204,146,.24);background:rgba(230,204,146,.05);color:rgba(244,239,230,.85);font-family:inherit;font-size:12.5px;cursor:pointer;transition:background .16s ease,border-color .16s ease}
.cca-focus-chip:hover{background:rgba(230,204,146,.13);border-color:rgba(230,204,146,.45)}
.cca-focus-close{margin-top:16px;width:100%;padding:11px;border-radius:12px;border:none;background:transparent;color:rgba(244,239,230,.5);font-family:inherit;font-size:13px;cursor:pointer}
.cca-focus-close:hover{color:rgba(244,239,230,.85)}
`;
function FocusDrawer({ item, brand, onClose, onAction, onNode }) {
  if (!item) return null;
  return (
    <div className="cca-focus-back" onClick={onClose}>
      <style>{FOCUS_CSS}</style>
      <div className="cca-focus" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cca-focus-grip" />
        <div className="cca-focus-title">{item.title}</div>
        {item.value && <div className="cca-focus-value">{item.value}</div>}
        {item.note && <div className="cca-focus-note">{item.note}</div>}
        {item.actions && item.actions.length > 0 && (
          <div className="cca-focus-actions">
            {item.actions.map((a, i) => {
              const m = VNP_ACTION_META[a];
              if (!m) return null;
              return (
                <button key={a} className={`cca-focus-act${i > 0 ? ' sec' : ''}`} onClick={() => onAction(a, m.label)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><m.Icon size={17} /> {m.label}</span>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>
        )}
        {item.related && item.related.length > 0 && (
          <div className="cca-focus-suites">
            {item.related.map((r) => (
              <button key={r.nodeId} className="cca-focus-chip" onClick={() => onNode(r.nodeId)}>{r.label} →</button>
            ))}
          </div>
        )}
        <button className="cca-focus-close" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

function SplitWorlds({ scene, hooks, onHook }) {
  const col = (side, data, tone) => (
    <div className={`cca-split-col cca-col-${side}`}>
      <h3 className="cca-split-h" style={{ color: tone === 'terra' ? TERRA : GOLD }}>{data.title}</h3>
      {data.subtitle && <p className="cca-split-sub">{data.subtitle}</p>}
      {data.points.map((p, i) => (
        <div key={i} className="cca-split-b" style={{ transitionDelay: `${i * 80 + 260}ms` }}>
          <span className="cca-split-tick" style={{ background: tone === 'terra' ? TERRA : GOLD }} />{p}
        </div>
      ))}
    </div>
  );
  return (
    <div className="cca-split" style={{ pointerEvents: 'auto' }}>
      <div className="cca-split-veil" />
      {scene.headline && <div className="cca-split-headline">{scene.headline}</div>}
      {col('l', scene.left, (scene.tone && scene.tone.left) || 'gold')}
      <div className="cca-split-line" />
      {col('r', scene.right, (scene.tone && scene.tone.right) || 'terra')}
      {hooks && hooks.length > 0 && (
        <div className="cca-split-hooks">
          {hooks.map((h, i) => (
            <span key={i} className="cca-chip" onClick={() => onHook(h)}
              style={{ fontSize: 12.5, color: GOLD, background: 'rgba(244,239,230,.06)', borderRadius: 999, padding: '7px 14px' }}>{h}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ReaderView({ scene, idx, setIdx, onSuggest, hooks }) {
  const scrollRef = useRef(null);
  const chips = (scene.suggestions && scene.suggestions.length) ? scene.suggestions : (hooks || []);
  const onScroll = () => {
    const el = scrollRef.current; if (!el) return;
    const cRect = el.getBoundingClientRect();
    const secs = el.querySelectorAll('section');
    let best = 0, bestD = Infinity;
    secs.forEach((sec, i) => { const d = Math.abs(sec.getBoundingClientRect().top - cRect.top - 10); if (d < bestD) { bestD = d; best = i; } });
    setIdx(best);
  };
  const go = (i) => {
    setIdx(i);
    const sec = scrollRef.current && scrollRef.current.querySelector(`#cca-sec-${i}`);
    if (sec) sec.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
  };
  const profile = scene.profile;
  return (
    <div className="cca-reader" style={{ pointerEvents: 'auto' }}>
      <div className="cca-reader-profile">
        {avatarFromSeed(profile.avatarSeed || profile.name)}
        <div className="cca-reader-name">{profile.name}</div>
        {profile.role && <div className="cca-reader-role">{profile.role}</div>}
        {(profile.facts || []).map((f, i) => (
          <div key={i} className="cca-reader-fact"><span>{f.k}</span><b>{f.v}</b></div>
        ))}
      </div>
      <div className="cca-reader-body" ref={scrollRef} onScroll={onScroll}>
        <h2 className="cca-reader-title">{scene.title}</h2>
        {scene.body.map((s, i) => (
          <section key={i} id={`cca-sec-${i}`}>
            <h4 className="cca-reader-h">{s.h}</h4>
            {s.p.split('\n\n').map((para, j) => (<p key={j} className="cca-reader-p">{para}</p>))}
          </section>
        ))}
      </div>
      <nav className="cca-reader-nav">
        {scene.body.map((s, i) => (
          <button key={i} className={i === idx ? 'on' : ''} onClick={() => go(i)}>
            <span className="dot" />{s.h}
          </button>
        ))}
      </nav>
      {chips.length > 0 && (
        <div className="cca-reader-suggests">
          {chips.map((s, i) => (
            <span key={i} className="cca-chip" onClick={() => onSuggest(s)}
              style={{ fontSize: 12, color: GOLD, background: 'rgba(244,239,230,.05)', borderRadius: 999, padding: '6px 13px' }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function TutorialFlow({ scene, onCta, hooks, onHook }) {
  return (
    <div className="cca-tuto" style={{ pointerEvents: 'auto' }}>
      <div className="cca-tuto-title">{scene.title}</div>
      <div className="cca-tuto-steps">
        {scene.steps.map((st, i) => (
          <div key={i} className="cca-tuto-step" style={{ transitionDelay: `${i * 110 + 160}ms` }}>
            <span className="cca-tuto-n">{i + 1}</span>
            <div className="cca-tuto-txt">
              <div className="cca-tuto-h">{st.title}</div>
              {st.detail && <div className="cca-tuto-d">{st.detail}</div>}
            </div>
            {TOPIC_ORDER.includes(st.sketch) && <div className="cca-tuto-sketch">{croquisFor(st.sketch)}</div>}
          </div>
        ))}
      </div>
      <div className="cca-tuto-foot">
        {scene.cta && (
          <button className="cca-chip cca-tuto-cta" onClick={onCta}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#2a140c', background: TERRA, border: 'none', borderRadius: 12, padding: '11px 22px', fontWeight: 500, fontSize: 13.5, cursor: 'pointer' }}>
            {scene.cta}<ArrowRight size={16} />
          </button>
        )}
        {hooks && hooks.length > 0 && hooks.map((h, i) => (
          <span key={i} className="cca-chip" onClick={() => onHook(h)}
            style={{ fontSize: 12.5, color: GOLD, background: 'rgba(244,239,230,.06)', borderRadius: 999, padding: '7px 14px' }}>{h}</span>
        ))}
      </div>
    </div>
  );
}

export default function CimolaceCreationAgent({ tenantSlug: tenantSlugProp = null } = {}) {
  const navigate = useNavigate();
  const { login } = useAuth();

  // L8-P1 — realm : si un tenant est ciblé, l'OS REND ce tenant (même moteur, autre identité) au lieu
  // du tunnel de création Cimolace. isTenantRealm gate tout le flux « créer une org Cimolace ».
  const osTenant = getOsRealmSlug(tenantSlugProp);
  const isTenantRealm = !!osTenant;
  const [osBrand, setOsBrand] = useState(() => (osTenant ? (OS_REALM_FALLBACK[osTenant] || { name: osTenant, logo: '' }) : null)); // { name, logo }
  useEffect(() => {
    if (!osTenant) return undefined;
    let alive = true;
    fetch(`${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(osTenant)}/branding`)
      .then((r) => r.json()).then((b) => {
        const t = (b && b.data) ? b.data : b;
        // Le logo du realm (OS_REALM_FALLBACK, ex. l'œil prorascience) PRIME sur celui de la DB
        // (qui renvoie le wordmark ISNA) ; la DB ne sert qu'à affiner le NOM affiché.
        const realmLogo = (OS_REALM_FALLBACK[osTenant] && OS_REALM_FALLBACK[osTenant].logo) || '';
        if (alive && t && t.slug) setOsBrand({ name: t.name || osTenant, logo: realmLogo || t.logo_url || t.logo || '' });
      }).catch(() => {});
    return () => { alive = false; };
  }, [osTenant]);

  const [presence, setPresence] = useState('connexion'); // connexion|attente|reflexion|ecriture|pret
  const [message, setMessage] = useState('');
  const [engaged, setEngaged] = useState(false); // realm tenant : le visiteur a-t-il interagi ? (masque le hero d'accueil)
  const [step, setStep] = useState('discovery'); // discovery|product|brand_ask|brand_confirm|account|pret

  const [chosen, setChosen] = useState('school');
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugState, setSlugState] = useState({ checking: false, available: null });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [brainHooks, setBrainHooks] = useState([]);
  // VNP — graphe de connaissance du tenant + suggestions de suite (navigation guidée) + actions dispo.
  const vnpGraph = useMemo(
    () => (osTenant && OS_KNOWLEDGE[osTenant]) ? buildVnpGraph(OS_KNOWLEDGE[osTenant], (osBrand && osBrand.name) || osTenant) : null,
    [osTenant, osBrand],
  );
  const [vnpSuggest, setVnpSuggest] = useState([]); // [{nodeId,label}] sujets liés
  const [vnpActs, setVnpActs] = useState([]);       // [intentId] actions disponibles
  const [contactForm, setContactForm] = useState(null); // Action Engine : {name,email,message,subject,sending,sent,error} | null
  const [focusItem, setFocusItem] = useState(null); // MODE FOCUS : ref de l'élément approfondi (tiroir) | null
  const protocolRef = useRef(null); // Protocole de Visite (machine à états) — instancié si VNP_PROTOCOL_V2
  useEffect(() => {
    protocolRef.current = VNP_PROTOCOL_V2 && vnpGraph ? createProtocol({ graph: vnpGraph, order: vnpGraph.tourOrder }) : null;
  }, [vnpGraph]);
  const [bookingForm, setBookingForm] = useState(null); // Action Engine RDV : {service,slotIso,name,email,sending,sent,error} | null
  const bookingSlots = useMemo(() => genSlots(6), []); // créneaux proposés (stables sur la session)
  const [covered, setCovered] = useState([]);
  const [topic, setTopic] = useState(null);
  const [keyword, setKeyword] = useState('');
  const coveredRef = useRef([]);

  // L6 — scène « réalisée » par l'IA (composition plein écran)
  const [scene, setScene] = useState(null);
  const [sceneVisible, setSceneVisible] = useState(false);
  const [readerIdx, setReaderIdx] = useState(0);
  const sceneRef = useRef(null);
  const sceneTimer = useRef(null);
  const rafRef = useRef(null);
  const brainGenRef = useRef(0); // invalide un brain() en vol (Retour / appels concurrents)
  const historyRef = useRef([]); // mémoire conversationnelle envoyée à l'edge

  // L7 — « Fais-moi le tour » : l'IA enchaîne les scènes toute seule
  const [tourActive, setTourActive] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);
  const tourRef = useRef(null);   // { kind, beats, gen }
  const tourTimer = useRef(null);
  const tourGenRef = useRef(0);

  // L8 — mode formation NATIF : Cimolace rend le cours lui-même (voix serif + atelier natif).
  const [pendingLesson, setPendingLesson] = useState(false); // on attend le prénom
  const [lessonActive, setLessonActive] = useState(false);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [atelier, setAtelier] = useState(null);      // scène atelier en cours (attend une réponse)
  const [atelierAck, setAtelierAck] = useState('');  // retour du prof après réponse
  const [atelierValue, setAtelierValue] = useState('');
  const lessonRef = useRef(null);   // { scenes, idx, name, tag }
  const lessonTimer = useRef(null);
  const lessonGenRef = useRef(0);
  const atelierInputRef = useRef(null);
  const pendingTopicRef = useRef(''); // sujet à générer (génération à la volée)

  const [inputOpen, setInputOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const typeTimer = useRef(null);
  const thinkTimer = useRef(null);
  const rootRef = useRef(null);
  const genRef = useRef(0);
  const audioCtxRef = useRef(null);
  const audioUnlocked = useRef(false);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  const inLesson = lessonActive;
  // Realm tenant : la saisie est ACTIVE et branchée sur le cerveau du tenant (prorascience-brain).
  // Realm Cimolace : saisie sur le funnel de création. (lessonActive coupe toujours la saisie.)
  const inputAllowed = !lessonActive && (isTenantRealm || step === 'discovery' || step === 'brand_ask' || step === 'brain' || step === 'product');

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { coveredRef.current = covered; }, [covered]);
  useEffect(() => { sceneRef.current = scene; }, [scene]);

  // ── Sons synthétisés (Web Audio, zéro asset) — subtils, coupables via mute ──
  const audio = useCallback(() => {
    if (mutedRef.current) return null;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return null; }
    const ctx = audioCtxRef.current;
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }, []);
  const tone = useCallback((freq, dur, gain, type, when) => {
    const ctx = audio(); if (!ctx) return;
    const t = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.03);
  }, [audio]);
  const sHello = useCallback(() => { tone(432, 0.16, 0.035, 'sine', 0); tone(648, 0.2, 0.03, 'sine', 0.09); }, [tone]);
  const sThink = useCallback(() => { tone(196, 0.85, 0.024, 'sine', 0); tone(294, 0.85, 0.015, 'sine', 0); }, [tone]);
  const sTick = useCallback(() => { tone(1180, 0.028, 0.011, 'triangle', 0); }, [tone]);
  const sPop = useCallback(() => { tone(540, 0.07, 0.03, 'sine', 0); }, [tone]);
  const sChime = useCallback(() => { tone(523, 0.14, 0.035, 'sine', 0); tone(659, 0.14, 0.03, 'sine', 0.1); tone(784, 0.22, 0.03, 'sine', 0.2); }, [tone]);

  // Autoplay : le son ne peut démarrer qu'après un 1er geste utilisateur.
  useEffect(() => {
    const unlock = () => {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;
      audio();
      if (!mutedRef.current) sHello();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [audio, sHello]);

  // Typewriter robuste par « génération » : chaque speak() incrémente un jeton ; toute
  // frappe périmée (nouvelle frappe, ou double-mount StrictMode) s'arrête d'elle-même via
  // le garde genRef. setTimeout récursif = zéro interval orphelin.
  const speak = useCallback((text, done) => {
    const gen = ++genRef.current;
    clearTimeout(typeTimer.current);
    // Onglet masqué (les timers y sont throttlés → frappe saccadée) ou reduced-motion :
    // on écrit le texte instantanément plutôt que d'animer.
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMessage(text);
      setPresence('attente');
      if (done) done();
      return;
    }
    setPresence('ecriture');
    setMessage('');
    let i = 0;
    const tick = () => {
      if (genRef.current !== gen) return; // périmée → stop
      i += 1;
      setMessage(text.slice(0, i));
      if (i % 2 === 0 && text.charAt(i - 1) !== ' ') sTick();
      if (i >= text.length) {
        setPresence('attente');
        if (done) done();
        return;
      }
      typeTimer.current = setTimeout(tick, 22);
    };
    typeTimer.current = setTimeout(tick, 22);
  }, [sTick]);

  const think = useCallback((fn, delay = 1000) => {
    setPresence('reflexion');
    sThink();
    clearTimeout(thinkTimer.current);
    thinkTimer.current = setTimeout(fn, delay);
  }, [sThink]);

  // L6 — séquenceur d'entrée/sortie de scène. Le contenu est monté dès setScene ;
  // `sceneVisible` (classe cca-scene-on) ne pilote QUE le mouvement → jamais d'écran vide.
  const exitScene = useCallback((done) => {
    brainGenRef.current += 1; // toute sortie de scène invalide un brain() en vol
    clearTimeout(sceneTimer.current);
    cancelAnimationFrame(rafRef.current);
    if (!sceneRef.current) { setSceneVisible(false); if (done) done(); return; }
    setSceneVisible(false); // retire cca-scene-on → sortie animée, présence revient au centre
    const dur = (document.hidden || prefersReduced()) ? 0 : 320;
    sceneTimer.current = setTimeout(() => { setScene(null); setReaderIdx(0); if (done) done(); }, dur);
  }, []);

  const enterScene = useCallback((next, speakReply) => {
    clearTimeout(sceneTimer.current);
    cancelAnimationFrame(rafRef.current);
    if (!next) { exitScene(speakReply); return; }
    const instant = document.hidden || prefersReduced();
    setReaderIdx(0);
    setScene(next);
    if (instant) { setSceneVisible(true); if (speakReply) speakReply(); return; }
    setSceneVisible(false);
    // Double rAF stocké/annulable → révèle seulement si une scène est toujours montée.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => { if (sceneRef.current) setSceneVisible(true); });
    });
    if (next.type === 'split') sThink(); // grand geste → appui sonore
    const voiceDelay = next.type === 'aside' ? 500 : 360; // laisse la scène se poser avant la voix
    sceneTimer.current = setTimeout(() => { if (speakReply) speakReply(); }, voiceDelay);
  }, [exitScene, sThink]);

  // Éveil (realm Cimolace : greeting de vente ; realm tenant : bienvenue gérée à part, attend le branding)
  const welcomedRef = useRef(false);
  useEffect(() => {
    const t = !isTenantRealm ? setTimeout(() => speak(GREETING), 900) : null;
    return () => { if (t) clearTimeout(t); clearInterval(typeTimer.current); clearTimeout(thinkTimer.current); clearTimeout(sceneTimer.current); clearTimeout(lessonTimer.current); cancelAnimationFrame(rafRef.current); };
  }, [speak, isTenantRealm]);

  // Bienvenue TENANT — accueil ÉDITORIAL : le hero (eyebrow + grand nom serif + filet + corps) est
  // rendu statiquement (cf. bloc hero). On amène la présence à « attente » pour révéler
  // hero + suggestions (pas de machine à écrire — l'accueil se pose, il ne se tape pas).
  // ⚠️ NE dépend QUE de isTenantRealm : dépendre d'osBrand relancerait l'effet quand le fetch
  // branding aboutit (sur le vrai domaine), son cleanup annulerait le timer → présence jamais « attente »
  // → suggestions invisibles. (En preview le fetch est bloqué par CORS, donc le bug ne se voyait pas.)
  useEffect(() => {
    if (!isTenantRealm || welcomedRef.current) return undefined;
    welcomedRef.current = true;
    const t = setTimeout(() => setPresence('attente'), 650);
    return () => clearTimeout(t);
  }, [isTenantRealm]);

  // Filet anti-écran-vide : si l'onglet redevient visible et qu'une scène est montée
  // mais restée invisible (rAF gelé en arrière-plan), on la révèle.
  useEffect(() => {
    const onVis = () => { if (!document.hidden && sceneRef.current && !sceneVisible) setSceneVisible(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [sceneVisible]);

  // ── L7 — « Fais-moi le tour » : l'IA prend le contrôle et enchaîne les scènes ──
  const stopTour = useCallback(() => {
    tourGenRef.current += 1;         // invalide toute avance programmée
    clearTimeout(tourTimer.current);
    tourRef.current = null;
    setTourActive(false);
  }, []);

  const runBeat = useCallback((gen, i) => {
    if (tourGenRef.current !== gen) return; // tour arrêté / remplacé
    const t = tourRef.current;
    if (!t) return;
    if (i >= t.beats.length) { // dépassé la fin → décision
      setPresence('attente');
      if (t.tenant) { setStep('brain'); stopTour(); return; } // realm tenant : retour au guide (pas de tunnel Cimolace)
      setCovered((prev) => Array.from(new Set([...prev, 'prix'])));
      setStep('product');
      stopTour();
      return;
    }
    t.idx = i; // l'index vit dans le ref (jamais périmé pour skipBeat)
    const beat = t.beats[i];
    setTourIdx(i);
    setBrainHooks([]); setError('');
    setMessage(''); // évite le flash du message précédent avant que le beat parle
    setKeyword(beat.keyword || '');
    const tp = TOPIC_ORDER.includes(beat.topic) ? beat.topic : null;
    setTopic(tp);
    if (tp) setCovered((prev) => (prev.includes(tp) ? prev : [...prev, tp]));
    setStep('brain'); // scènes/croquis se montent en brain/product
    enterScene(normalizeScene(beat.scene), () => speak(beat.reply, () => {
      if (tourGenRef.current !== gen) return;
      if (beat.final) {
        // fin : retour à la base. Realm tenant → présence-guide ; Cimolace → décision (CTA « Lancer … »)
        if (t.tenant) { setPresence('attente'); setStep('brain'); tourRef.current = null; setTourActive(false); return; }
        setCovered((prev) => Array.from(new Set([...prev, 'prix'])));
        setStep('product');
        tourRef.current = null;
        setTourActive(false);
        return;
      }
      const dwell = Math.min(4600, 1500 + beat.reply.length * 24); // temps de lecture
      tourTimer.current = setTimeout(() => runBeat(gen, i + 1), dwell);
    }));
  }, [enterScene, speak, stopTour]);

  const startTour = useCallback((kind) => {
    stopTour();
    const k = TOUR[kind] ? kind : 'school';
    const gen = ++tourGenRef.current;
    tourRef.current = { kind: k, beats: TOUR[k], gen, idx: 0 };
    setChosen(k); setError('');
    setTourActive(true); setTourIdx(0);
    runBeat(gen, 0);
  }, [stopTour, runBeat]);

  // P4-pixel — visite guidée du TENANT (beats construits depuis son knowledge pack). Même
  // moteur de scènes que le tour Cimolace, mais drapeau `tenant` = pas de tunnel de vente Cimolace.
  const startTenantTour = useCallback(() => {
    if (!osTenant) return;
    setEngaged(true);
    stopTour();
    const beats = buildTenantTour(OS_KNOWLEDGE[osTenant] || undefined, (osBrand && osBrand.name) || osTenant);
    if (!beats || !beats.length) return;
    const gen = ++tourGenRef.current;
    tourRef.current = { kind: 'tenant', beats, gen, idx: 0, tenant: true };
    setError('');
    setTourActive(true); setTourIdx(0);
    runBeat(gen, 0);
  }, [osTenant, osBrand, stopTour, runBeat]);

  const skipBeat = useCallback(() => {
    const t = tourRef.current;
    if (!t) return;
    clearTimeout(tourTimer.current);
    genRef.current += 1;             // coupe la frappe en cours
    runBeat(t.gen, t.idx + 1);       // index depuis le ref (jamais périmé)
  }, [runBeat]);

  const endTour = useCallback(() => {
    stopTour();
    genRef.current += 1;
    setStep(isTenantRealm ? 'brain' : 'product'); // realm tenant → retour au guide, jamais le tunnel Cimolace
    setTopic(null);
    exitScene();
  }, [stopTour, exitScene, isTenantRealm]);

  const openInput = useCallback((prefill = '') => {
    setInputOpen(true);
    setValue(prefill);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);
  const closeInput = useCallback(() => { setInputOpen(false); setValue(''); }, []);

  // ── L8 — mode formation NATIF : Cimolace EST le moteur de rendu du cours ──
  const stopLesson = useCallback(() => {
    lessonGenRef.current += 1;
    clearTimeout(lessonTimer.current);
    lessonRef.current = null;
    setLessonActive(false);
    setAtelier(null); setAtelierAck(''); setAtelierValue('');
  }, []);

  // Joue la scène i : leçon/transition = Cimolace NARRE (voix serif) puis enchaîne ; atelier = interactif.
  const runLessonScene = useCallback((gen, i) => {
    if (lessonGenRef.current !== gen) return;
    const L = lessonRef.current;
    if (!L) return;
    if (i >= L.scenes.length) { // fin du cours → on éclaire la décision
      stopLesson();
      setCovered((prev) => Array.from(new Set([...prev, 'prix'])));
      setStep('product');
      speak(`Voilà, ${L.name} — tu as tout compris. On lance ton ${L.tag} ?`);
      return;
    }
    L.idx = i; setLessonIdx(i);
    setAtelier(null); setAtelierAck(''); setAtelierValue('');
    const sc = L.scenes[i];
    if (sc.type === 'atelier') {
      setKeyword(''); setMessage(''); setPresence('attente');
      setAtelier(sc); // affiche l'atelier natif, attend la réponse (pas d'auto-avance)
      setTimeout(() => { if (atelierInputRef.current) atelierInputRef.current.focus(); }, 60);
      return;
    }
    const text = String(sc.narration || sc.board_text || sc.text || '').trim();
    if (!text) { runLessonScene(gen, i + 1); return; }
    setKeyword('');
    speak(text, () => {
      if (lessonGenRef.current !== gen) return;
      const dwell = Math.min(2600, 700 + text.length * 8);
      lessonTimer.current = setTimeout(() => runLessonScene(gen, i + 1), dwell);
    });
  }, [speak, stopLesson]);

  // Réponse à l'atelier : juge local + « ack » + révélation narrée, puis on continue.
  const answerAtelier = useCallback((raw) => {
    const L = lessonRef.current; const sc = atelier;
    if (!L || !sc) return;
    const gen = L.gen;
    const { ack } = judgeAtelierLocal(sc, raw);
    sPop();
    setAtelierAck(ack);
    setAtelier(null); setAtelierValue('');
    const reveal = String(sc.reveal_narration || '').trim() || ack;
    speak(reveal, () => {
      if (lessonGenRef.current !== gen) return;
      const dwell = Math.min(3000, 900 + reveal.length * 8);
      lessonTimer.current = setTimeout(() => { setAtelierAck(''); runLessonScene(gen, L.idx + 1); }, dwell);
    });
  }, [atelier, speak, sPop, runLessonScene]);

  const skipLessonScene = useCallback(() => {
    const L = lessonRef.current; if (!L) return;
    clearTimeout(lessonTimer.current);
    genRef.current += 1;
    if (atelier) { answerAtelier(''); return; } // « voir la réponse »
    runLessonScene(L.gen, L.idx + 1);
  }, [atelier, answerAtelier, runLessonScene]);

  const beginLesson = useCallback((course, name, tag, gen) => {
    const scenes = (course.concepts || []).flatMap((c) => c.scenes || []);
    lessonRef.current = { scenes, idx: 0, name, tag, gen };
    setAtelier(null); setAtelierAck(''); setAtelierValue('');
    setLessonActive(true); setLessonIdx(0);
    runLessonScene(gen, 0);
  }, [runLessonScene]);

  const startLesson = useCallback(async (name, topic) => {
    stopTour(); exitScene();
    setPendingLesson(false);
    setBrainHooks([]); setKeyword(''); setTopic(null); setError('');
    setStep('brain');
    const nm = String(name || '').trim() || 'toi';
    const key = ['school', 'medos', 'shop'].includes(chosen) ? chosen : 'school';
    const t = String(topic || '').trim();
    const gen = ++lessonGenRef.current;
    if (!t) { // pas de sujet → cours on-brand canné du moteur choisi
      beginLesson(CIMOLACE_LESSONS[key] || CIMOLACE_LESSONS.school, nm, PRODUCT[key].tag, gen);
      return;
    }
    // GÉNÉRATION À LA VOLÉE : le Précepteur (cerveau) écrit le cours, Cimolace (OS) le rend natif.
    setLessonActive(true); setLessonIdx(0); setAtelier(null); setAtelierAck('');
    setPresence('reflexion'); sThink();
    setMessage(`Je te prépare un cours sur « ${t} »…`);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-lesson', { body: { topic: t, engine: key, studentName: nm } });
      if (lessonGenRef.current !== gen) return;
      if (fnErr) throw fnErr;
      const course = normalizeLesson(data);
      if (!course) throw new Error('empty');
      beginLesson(course, nm, PRODUCT[key].tag, gen);
    } catch (_) {
      if (lessonGenRef.current !== gen) return; // repli non bloquant : le cours canné du moteur
      beginLesson(CIMOLACE_LESSONS[key] || CIMOLACE_LESSONS.school, nm, PRODUCT[key].tag, gen);
    }
  }, [stopTour, exitScene, chosen, beginLesson, sThink]);

  const askLessonName = useCallback((topic) => {
    stopTour(); stopLesson(); exitScene();
    pendingTopicRef.current = String(topic || '').trim();
    setPendingLesson(true);
    setStep('brain');
    const t = pendingTopicRef.current;
    speak(t
      ? `Avec plaisir — je te prépare un cours sur « ${t} ». Comment tu t'appelles ? Je t'appellerai par ton prénom.`
      : "Avec plaisir — je vais t'enseigner ça moi-même. Comment tu t'appelles ? Je t'appellerai par ton prénom.",
      () => openInput());
  }, [stopTour, stopLesson, exitScene, speak, openInput]);

  // « type-anywhere » — seulement là où le texte libre a du sens
  useEffect(() => {
    const onKey = (e) => {
      if (inputOpen || !inputAllowed) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key && e.key.length === 1) openInput(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputOpen, inputAllowed, openInput]);

  const checkSlug = useCallback(async (s) => {
    if (s.length < 2) { setSlugState({ checking: false, available: null }); return; }
    setSlugState({ checking: true, available: null });
    try {
      const res = await fetch(`${getApiBaseUrl()}/signup/tenant/check-slug`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: s }),
      });
      const body = await res.json().catch(() => ({}));
      const payload = body?.data ?? body;
      setSlugState({ checking: false, available: Boolean(payload?.available) });
    } catch {
      setSlugState({ checking: false, available: null });
    }
  }, []);

  // ── Transitions de flux ────────────────────────────────────────────────
  const pickKind = useCallback((k) => {
    sPop();
    stopTour(); stopLesson();
    exitScene();
    setChosen(k);
    setError('');
    think(() => { setStep('product'); speak(PRODUCT[k].reply); });
  }, [think, speak, sPop, exitScene, stopTour, stopLesson]);

  const chooseProduct = useCallback(() => {
    sPop();
    stopTour(); stopLesson();
    exitScene();
    setStep('brand_ask');
    speak("Comment s'appelle votre organisation ? Dites-le moi.", () => openInput());
  }, [speak, openInput, sPop, exitScene, stopTour, stopLesson]);

  const submitName = useCallback((name) => {
    stopTour(); stopLesson();
    exitScene();
    const s = slugify(name);
    setOrgName(name);
    setSlug(s);
    checkSlug(s);
    think(() => { setStep('brand_confirm'); speak(`Parfait. Votre espace : cimolace.space/t/${s || '…'}. On continue ?`); });
  }, [think, speak, checkSlug, exitScene, stopTour, stopLesson]);

  const continueToAccount = useCallback(() => {
    sPop();
    stopTour(); stopLesson();
    exitScene();
    setStep('account');
    speak("Dernière étape : votre e-mail et un mot de passe (8 caractères min). Vous saisissez, je crée l'espace.");
  }, [speak, sPop, exitScene, stopTour, stopLesson]);

  // Le « cerveau » : appelle l'edge agent-brain (LLM) → reply générative + produit + hooks.
  // Repli hors-ligne : détection par mots-clés.
  const brain = useCallback(async (message) => {
    if (isLessonIntent(message)) { askLessonName(extractLessonTopic(message)); return; } // formation → cours natif (généré si sujet)
    if (isTourIntent(message)) { startTour(TOUR[chosen] ? chosen : guessKind(message)); return; }
    stopTour(); stopLesson();
    setError('');
    setBrainHooks([]);
    setKeyword('');
    exitScene(); // efface la scène + invalide tout brain en vol (brainGenRef)
    const gen = brainGenRef.current;
    setPresence('reflexion');
    sThink();
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('agent-brain', {
        body: { message, chosen, covered: coveredRef.current, history: historyRef.current.slice(-6) },
      });
      if (brainGenRef.current !== gen) return; // périmé (Retour / nouvel appel) → on abandonne
      if (fnErr) throw fnErr;
      setKeyword(String(data?.keyword || ''));
      const reply = String(data?.reply || '').trim() || "Je vous écoute — dites-m'en un peu plus ?";
      const product = data?.product && PRODUCT[data.product] ? data.product : null;
      const t = TOPIC_ORDER.includes(data?.topic) ? data.topic : null;
      setTopic(t);
      if (t) setCovered((prev) => (prev.includes(t) ? prev : [...prev, t]));
      setBrainHooks(Array.isArray(data?.hooks) ? data.hooks : []);
      historyRef.current = [...historyRef.current, { role: 'user', content: message }, { role: 'assistant', content: reply }].slice(-12);
      const nextScene = normalizeScene(data?.scene); // autorité finale, ne throw jamais
      if (product) setChosen(product);
      setStep(product ? 'product' : 'brain');
      enterScene(nextScene, () => speak(reply)); // scene null → speak immédiat (mode L5)
    } catch (_) {
      if (brainGenRef.current !== gen) return;
      exitScene();
      setTopic(null);
      const k = guessKind(message);
      setChosen(k);
      setStep('product');
      speak(PRODUCT[k].reply);
    }
  }, [chosen, speak, sThink, enterScene, exitScene, startTour, stopTour, stopLesson, askLessonName]);

  // P3/P4 — Cerveau du TENANT (realm) : répond dans SON périmètre depuis sa mémoire centralisée,
  // refuse Cimolace (cloison). Générique, piloté par le knowledge pack du tenant.
  const tenantBrain = useCallback(async (message) => {
    setError(''); setBrainHooks([]); setKeyword('');
    setEngaged(true); // quitte l'accueil éditorial → la voix (réponse) prend le relais
    const gen = ++brainGenRef.current;
    setPresence('reflexion'); sThink();
    try {
      const knowledge = OS_KNOWLEDGE[osTenant] ? prorascienceKnowledgeText(OS_KNOWLEDGE[osTenant]) : '';
      const { data, error: fnErr } = await supabase.functions.invoke('prorascience-brain', {
        body: { message, platformName: (osBrand && osBrand.name) || osTenant, knowledge, history: historyRef.current.slice(-6) },
      });
      if (brainGenRef.current !== gen) return;
      if (fnErr) throw fnErr;
      const reply = String(data?.reply || '').trim() || "Je vous écoute — dites-m'en un peu plus ?";
      historyRef.current = [...historyRef.current, { role: 'user', content: message }, { role: 'assistant', content: reply }].slice(-12);
      speak(reply);
    } catch (_) {
      if (brainGenRef.current !== gen) return;
      speak(`Restons sur ${(osBrand && osBrand.name) || 'ce site'} — je vous écoute.`);
    }
  }, [osTenant, osBrand, speak, sThink]);

  // Exécuteur des EFFETS du reducer Protocole (gaté). Effets PRIMITIFS seulement (aucun renvoi vers
  // vnpChat/vnpAction → pas de souci d'ordre React) ; l'ordre des effets est préservé.
  const runEffects = useCallback((effects) => {
    (effects || []).forEach((e) => {
      if (e.type === 'SPEAK') speak(e.text);
      else if (e.type === 'SET_SUGGESTIONS') setVnpSuggest(e.items || []);
      else if (e.type === 'SET_ACTIONS') setVnpActs((e.items || []).map((it) => (typeof it === 'string' ? it : it.id)));
      else if (e.type === 'OPEN_CONTACT') setContactForm({ name: '', email: '', message: '', subject: `Contact via l'assistant ${(osBrand && osBrand.name) || osTenant}`, sending: false, sent: false, error: '' });
      else if (e.type === 'LOG') logEvent(e.event, e.payload || {}, osTenant);
      // TOUR_STEP / GO_CHECKOUT / ASK_BRAIN : gérés par les handlers existants (v1 du branchement).
    });
  }, [speak, osBrand, osTenant]);

  // ── VNP (VibeNavigation Protocol) — moteur d'intentions + navigation guidée + Action Engine ──
  // Ouvre un NŒUD du graphe de façon DÉTERMINISTE (clic sur une intention/un sujet) : réponse directe
  // depuis le contenu du nœud + sujets liés (suites) + actions disponibles. Zéro appel LLM.
  const vnpOpenNode = useCallback((nodeId) => {
    const g = vnpGraph; if (!g) return;
    const n = g.byId(nodeId); if (!n) return;
    setEngaged(true); setError('');
    brainGenRef.current += 1;
    if (VNP_PROTOCOL_V2 && protocolRef.current) { runEffects(protocolRef.current.dispatch({ type: 'OPEN_NODE', payload: { nodeId } }).effects); return; }
    setVnpSuggest(vnpRelated(g, nodeId, 3));
    setVnpActs(n.actions || []);
    logEvent('node_opened', { nodeId, intention: n.intention || '' }, osTenant);
    // Réponse DESIGNÉE : compose une SCÈNE (buildNodeScene → normalizeScene) ; la voix suit.
    // Fallback EXACT vers la narration plate si aucune scène (contact/support) ou flag OFF.
    const sc = VNP_SCENES_V2 ? normalizeScene(buildNodeScene(nodeId, OS_KNOWLEDGE[osTenant])) : null;
    if (sc) { enterScene(sc, () => speak(n.summary || n.title)); return; }
    speak(`${n.summary} ${n.content}`.replace(/\s+/g, ' ').trim().slice(0, 340) || n.title);
  }, [vnpGraph, speak, osTenant, runEffects, enterScene]);

  // MODE FOCUS — cliquer un élément (carte) ouvre le tiroir d'approfondissement inline.
  const openFocus = useCallback((ref) => {
    if (!ref) return;
    setFocusItem(ref);
    try { logEvent('focus_open', { kind: ref.kind || '', title: ref.title || '' }, osTenant); } catch { /* non bloquant */ }
  }, [osTenant]);

  // Réponse à une QUESTION LIBRE via l'edge VNP (résout intention + nœud + suggestions + actions).
  const vnpChat = useCallback(async (message) => {
    const g = vnpGraph;
    setError(''); setEngaged(true);
    const gen = ++brainGenRef.current;
    setPresence('reflexion'); sThink();
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('vnp', {
        body: { op: 'chat', message, platformName: (osBrand && osBrand.name) || osTenant, graph: g ? vnpSerialize(g) : '', history: historyRef.current.slice(-6) },
      });
      if (brainGenRef.current !== gen) return;
      if (fnErr) throw fnErr;
      const reply = String(data?.reply || '').trim() || "Je vous écoute — dites-m'en un peu plus ?";
      historyRef.current = [...historyRef.current, { role: 'user', content: message }, { role: 'assistant', content: reply }].slice(-12);
      const sug = (Array.isArray(data?.suggestions) ? data.suggestions : [])
        .map((id) => g && g.byId(id)).filter(Boolean).map((nn) => ({ nodeId: nn.id, label: nn.title })).slice(0, 3);
      setVnpSuggest(sug.length ? sug : (g && data?.nodeId ? vnpRelated(g, data.nodeId, 3) : []));
      setVnpActs(Array.isArray(data?.actions) ? data.actions.slice(0, 4) : []);
      logEvent('vnp_chat', { intent: data?.intent || '', nodeId: data?.nodeId || '', onTopic: data?.onTopic !== false, sug: sug.length }, osTenant);
      if (data?.onTopic === false) logUnanswered(message, osTenant);
      speak(reply);
    } catch (_) {
      if (brainGenRef.current !== gen) return;
      setVnpSuggest([]); setVnpActs([]);
      speak(`Restons sur ${(osBrand && osBrand.name) || 'ce site'} — je vous écoute.`);
    }
  }, [vnpGraph, osBrand, osTenant, speak, sThink]);

  // ACTION ENGINE — EXÉCUTE une action métier pour de vrai (pas un accusé de réception) :
  //  • contacter/participer → mini-formulaire inline, livré dans la table contact_requests (mailbox) ;
  //  • acheter/rejoindre/réserver → on annonce puis on emmène vers la VRAIE page /forfaits (Stripe/PawaPay).
  const vnpAction = useCallback(async (actionId, label) => {
    setError(''); setEngaged(true); setVnpActs([]);
    if (actionId === '__detail__') { if (protocolRef.current) runEffects(protocolRef.current.dispatch({ type: 'WANT_DETAIL' }).effects); return; }
    if (actionId === 'contacter' || actionId === 'participer') {
      setContactForm({ name: '', email: '', message: '', subject: `Contact via l'assistant ${(osBrand && osBrand.name) || osTenant}`, sending: false, sent: false, error: '' });
      return;
    }
    if (actionId === 'reserver') { // RDV : sélecteur de créneaux inline (dans la conversation)
      setBookingForm({ service: 'Consultation privée', slotIso: '', name: '', email: '', sending: false, sent: false, error: '' });
      return;
    }
    const gen = ++brainGenRef.current;
    setPresence('reflexion'); sThink();
    try {
      const { data } = await supabase.functions.invoke('vnp', {
        body: { op: 'action', action: actionId, platformName: (osBrand && osBrand.name) || osTenant, payload: { label } },
      });
      if (brainGenRef.current !== gen) return;
      const msg = String(data?.message || "C'est noté.");
      const kind = data?.next?.kind;
      logEvent('action_triggered', { action: actionId, next_kind: kind || '' }, osTenant);
      if (kind === 'checkout' || kind === 'booking') {
        speak(msg, () => setTimeout(() => { window.location.assign('/forfaits'); }, 700)); // → vraie page de checkout
        return;
      }
      speak(msg);
    } catch (_) {
      if (brainGenRef.current !== gen) return;
      speak('Un instant — réessayons dans un moment.');
    }
  }, [osBrand, osTenant, speak, sThink]);

  // Livraison RÉELLE du contact : insertion dans contact_requests (même table que le ContactModal du site → mailbox).
  const submitContact = useCallback(async () => {
    const f = contactForm; if (!f || f.sending) return;
    const email = (f.email || '').trim();
    const message = (f.message || '').trim();
    if (!/.+@.+\..+/.test(email)) { setContactForm((c) => ({ ...c, error: "Une adresse e-mail valide, s'il vous plaît." })); return; }
    if (!message) { setContactForm((c) => ({ ...c, error: 'Écrivez-nous un petit message.' })); return; }
    setContactForm((c) => ({ ...c, sending: true, error: '' }));
    try {
      // Livraison via l'edge VNP (service role → contourne la RLS de contact_requests).
      const { data, error: fnErr } = await supabase.functions.invoke('vnp', {
        body: { op: 'action', action: 'contacter', platformName: (osBrand && osBrand.name) || osTenant, payload: { slug: osTenant, name: (f.name || '').trim(), email, subject: f.subject, message } },
      });
      if (fnErr || !data?.ok) throw (fnErr || new Error('delivery failed'));
      setContactForm((c) => ({ ...c, sending: false, sent: true }));
      logEvent('contact_submitted', {}, osTenant);
      speak(`Merci${f.name ? `, ${f.name.trim()}` : ''} — votre message est bien parti. L'équipe de ${(osBrand && osBrand.name) || osTenant} vous répond vite.`);
      setTimeout(() => setContactForm(null), 2800);
    } catch (_) {
      setContactForm((c) => ({ ...c, sending: false, error: 'Envoi impossible pour le moment — réessayez.' }));
    }
  }, [contactForm, osBrand, osTenant, speak]);

  // Prise de RDV RÉELLE : le créneau choisi + email → enregistré (vnp_booking_requests) via l'edge (service role).
  const submitBooking = useCallback(async () => {
    const f = bookingForm; if (!f || f.sending) return;
    const email = (f.email || '').trim();
    if (!f.slotIso) { setBookingForm((c) => ({ ...c, error: 'Choisissez un créneau.' })); return; }
    if (!/.+@.+\..+/.test(email)) { setBookingForm((c) => ({ ...c, error: "Une adresse e-mail valide, s'il vous plaît." })); return; }
    setBookingForm((c) => ({ ...c, sending: true, error: '' }));
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('vnp', {
        body: { op: 'action', action: 'reserver', platformName: (osBrand && osBrand.name) || osTenant, payload: { slug: osTenant, service: f.service, name: (f.name || '').trim(), email, preferred_at: f.slotIso } },
      });
      if (fnErr || !data?.ok) throw (fnErr || new Error('booking failed'));
      setBookingForm((c) => ({ ...c, sending: false, sent: true }));
      logEvent('booking_submitted', { service: f.service }, osTenant);
      speak(String(data?.message || `C'est réservé — ${(osBrand && osBrand.name) || osTenant} vous confirme par e-mail.`));
      setTimeout(() => setBookingForm(null), 3000);
    } catch (_) {
      setBookingForm((c) => ({ ...c, sending: false, error: 'Réservation impossible pour le moment — réessayez.' }));
    }
  }, [bookingForm, osBrand, osTenant, speak]);

  const submitInput = useCallback(() => {
    const v = value.trim();
    closeInput();
    if (!v) return;
    sPop();
    if (isTenantRealm) { vnpChat(v); return; } // realm tenant → moteur VNP (intention + nœud + suites)
    if (pendingLesson) { startLesson(v, pendingTopicRef.current); return; } // le prénom → on lance/génère le cours
    if (step === 'brand_ask') { submitName(v); return; }
    brain(v);
  }, [value, step, pendingLesson, isTenantRealm, vnpChat, closeInput, submitName, brain, startLesson, sPop]);

  const createAccount = useCallback(async () => {
    setError('');
    stopTour(); stopLesson();
    exitScene();
    if (!email.trim() || !password) { setError('E-mail et mot de passe requis.'); return; }
    if (password.length < 8) { setError('Mot de passe : 8 caractères minimum.'); return; }
    if (slug.length < 2) { setError("Le nom d'organisation ne produit pas d'identifiant valide."); return; }
    sPop();
    setBusy(true);
    setPresence('reflexion');
    sThink();
    try {
      const res = await fetch(`${getApiBaseUrl()}/signup/tenant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, platformName: orgName.trim(), slug, kind: KIND_MAP[chosen] || 'liri' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || body?.message || 'Création impossible. Réessayez.');
      const payload = body?.data ?? body;
      const createdSlug = payload?.tenant?.slug || slug;
      logEvent('tenant_created', { slug: createdSlug, kind: chosen }, createdSlug);
      const nextUrl = payload?.next_url || `/t/${createdSlug}/admin`;
      authStore.setTenantSlug(createdSlug);
      setStep('pret');
      setPresence('pret');
      sChime();
      setMessage(`Votre espace ${PRODUCT[chosen].tag} est prêt.`);
      const { error: loginErr } = await login(email.trim(), password);
      setTimeout(() => navigate(loginErr ? '/login' : nextUrl, { replace: true }), 1500);
    } catch (err) {
      setError(err?.message || 'Une erreur est survenue.');
      setPresence('attente');
    } finally {
      setBusy(false);
    }
  }, [email, password, slug, orgName, chosen, login, navigate, sPop, sThink, sChime, exitScene, stopTour, stopLesson]);

  const goBack = useCallback(() => {
    sPop();
    setError('');
    setBusy(false);
    closeInput();
    stopTour(); stopLesson();
    setPendingLesson(false);
    exitScene();
    if (step === 'product' || step === 'brain') { setStep('discovery'); speak(GREETING); }
    else if (step === 'brand_ask') { setStep('product'); speak(PRODUCT[chosen].reply); }
    else if (step === 'brand_confirm') { setStep('brand_ask'); speak("Quel nom pour votre organisation ?", () => openInput()); }
    else if (step === 'account') { setStep('brand_confirm'); speak(`On reprend — cimolace.space/t/${slug}. On continue ?`); }
  }, [step, chosen, slug, sPop, closeInput, speak, openInput, exitScene, stopTour, stopLesson]);

  const onRootClick = (e) => {
    if (inputOpen || !inputAllowed) return;
    if (rootRef.current && e.target === rootRef.current) openInput();
  };

  const bg = presence === 'reflexion' ? BG_THINK : BG;
  const showActions = presence === 'attente' && !inputOpen;
  // Accueil ÉDITORIAL du realm tenant : hero (eyebrow + grand nom + filet + corps) tant que le
  // visiteur n'a pas interagi (pas de scène/tour/leçon/saisie en cours).
  const showTenantHero = isTenantRealm && !engaged && !scene && !tourActive && !lessonActive && !inputOpen;
  const tenantName = (osBrand && osBrand.name) || osTenant;
  // Écran SCINDÉ : dès qu'une action (formulaire/RDV) est ouverte, on passe en 2 zones —
  // le guide parle à GAUCHE, la zone d'action (qui s'étire) à DROITE.
  const showSplitAction = isTenantRealm && !!(contactForm || bookingForm);
  // Scène plein écran (split/reader/tutorial) : la voix centrale + actions en flux s'effacent,
  // la scène porte le message ; `aside` garde la voix au centre.
  const fullscreenScene = !!scene && scene.type !== 'aside';
  const tourTotal = tourActive ? ((tourRef.current && tourRef.current.beats.length) || (TOUR[chosen] || []).length) : 0; // points de progression (tenant ou Cimolace)

  return (
    <div
      ref={rootRef}
      onClick={onRootClick}
      style={{
        minHeight: '100vh', background: bg, transition: 'background .8s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', padding: '0 24px',
        fontFamily: "'Inter', system-ui, sans-serif", cursor: inputOpen || !inputAllowed ? 'default' : 'text',
      }}
    >
      <style>{STYLE}</style>

      {/* Particules ambiantes — le vide « respire » même au repos */}
      <span className="cca-amb" style={{ width: 5, height: 5, top: '34%', left: '32%', opacity: 0.16, animation: 'ccaDriftA 11s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 4, height: 4, top: '58%', left: '65%', opacity: 0.13, background: '#e6cc92', animation: 'ccaDriftB 14s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 3, height: 3, top: '44%', left: '70%', opacity: 0.12, animation: 'ccaDriftC 9s ease-in-out infinite' }} />

      {/* L6 — Scène « réalisée » par l'IA : composition de toute la surface (fond, sous la voix).
         Realm tenant (prorascience) : rendre dès qu'une scène existe (le step Cimolace n'y vit pas). */}
      {scene && (isTenantRealm || step === 'brain' || step === 'product') && (
        <SceneStage scene={scene} visible={sceneVisible} readerIdx={readerIdx} setReaderIdx={setReaderIdx}
          onSuggest={isTenantRealm ? vnpChat : brain} onCta={isTenantRealm ? vnpChat : chooseProduct}
          hooks={isTenantRealm ? [] : brainHooks} onHook={isTenantRealm ? vnpChat : brain} onFocus={openFocus} />
      )}

      {/* MODE FOCUS — tiroir d'approfondissement inline (carte cliquée) */}
      {isTenantRealm && (
        <FocusDrawer
          item={focusItem} brand={tenantName}
          onClose={() => setFocusItem(null)}
          onAction={(a, label) => { setFocusItem(null); vnpAction(a, label); }}
          onNode={(id) => { setFocusItem(null); vnpOpenNode(id); }}
        />
      )}

      {/* Identité du realm (où on est) : badge marque (logo + nom) + état connecté */}
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'none', zIndex: 6 }}>
        {isTenantRealm ? (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 15px', border: '1px solid rgba(230,204,146,.26)', borderRadius: 999, background: 'rgba(230,204,146,.045)' }}>
              {osBrand && osBrand.logo
                ? <img src={osBrand.logo} alt={tenantName} style={{ height: 21, width: 'auto', maxWidth: 40, objectFit: 'contain' }} />
                : <span style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: GOLD, borderRadius: 1, display: 'inline-block' }} />}
              <span style={{ fontFamily: DISPLAY, fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>{tenantName}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{ position: 'relative', display: 'inline-flex', width: 9, height: 9 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid #3fbf6a', animation: 'ccaPing 1.9s ease-out infinite' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid #3fbf6a' }} />
              </span>
              <span style={{ fontSize: 12, color: 'rgba(244,239,230,.55)', letterSpacing: '.02em' }}>Connecté</span>
            </span>
          </>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.85 }}>
            <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6, alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#3fbf6a', animation: 'ccaPing 1.9s ease-out infinite' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fbf6a' }} />
            </span>
            <span style={{ fontSize: 11.5, color: 'rgba(244,239,230,.6)', letterSpacing: '.03em' }}>assistant cimolace · connecté</span>
          </span>
        )}
      </div>

      {/* L5 — rail de sujets « tableau intelligent » : liste à gauche, clic → le cerveau compose au centre.
          Sert aussi de barre de couverture (le tunnel) : sujets abordés = allumés. */}
      {(step === 'brain' || step === 'product') && !inLesson && !isTenantRealm && (
        <div className={`cca-in ${fullscreenScene ? 'cca-rail-dim' : ''}`} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 13, zIndex: 3, maxWidth: 130 }}>
          <span style={{ fontSize: 9, color: 'rgba(244,239,230,.3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 3 }}>Le tour du produit</span>
          {TOPIC_ORDER.map((tp) => {
            const on = covered.includes(tp);
            const cur = topic === tp;
            return (
              <button key={tp} onClick={(e) => { e.stopPropagation(); brain(TOPIC_Q[tp]); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', cursor: 'pointer', color: cur ? '#f4efe6' : on ? '#e6cc92' : 'rgba(244,239,230,.4)', fontSize: 12.5, fontFamily: 'inherit', padding: 0, textAlign: 'left' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: cur ? '#d97757' : on ? '#e6cc92' : 'rgba(244,239,230,.22)' }} />
                {T_LABELS[tp]}
              </button>
            );
          })}
        </div>
      )}

      {/* Son on/off */}
      <button
        onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
        aria-label={muted ? 'Activer le son' : 'Couper le son'}
        style={{ position: 'absolute', top: 16, right: 18, background: 'transparent', border: 'none', color: 'rgba(244,239,230,.4)', cursor: 'pointer', zIndex: 5, padding: 4, display: 'inline-flex' }}
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>

      {/* Retour — jamais bloqué */}
      {step !== 'discovery' && step !== 'pret' && (
        <button
          onClick={(e) => { e.stopPropagation(); goBack(); }}
          aria-label="Revenir en arrière"
          style={{ position: 'absolute', top: 16, left: 18, background: 'transparent', border: 'none', color: 'rgba(244,239,230,.5)', cursor: 'pointer', zIndex: 5, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontFamily: 'inherit' }}
        >
          <ArrowLeft size={16} /> Retour
        </button>
      )}

      {/* Présence (le wrapper se décale selon la scène active) */}
      <div
        className={`cca-presence-holder${scene ? ` cca-slot-${scene.type}` : ''}${scene && sceneVisible ? ' cca-scene-on' : ''}${scene && scene.type === 'aside' && scene.side === 'left' ? ' cca-aside-left' : ''}`}
        style={{ position: 'relative', zIndex: 4 }}
      >
        <Presence state={presence} />
      </div>

      {/* Croquis « Précepteur » — se dessine quand le cerveau explique un sujet */}
      {topic && (step === 'brain' || step === 'product') && (
        <div key={topic} className="cca-in cca-voicecol" style={{ marginTop: 8, marginBottom: 2, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 4, opacity: fullscreenScene ? 0 : 1, pointerEvents: fullscreenScene ? 'none' : undefined }}>
          {croquisFor(topic)}
        </div>
      )}

      {/* Realm tenant — ACCUEIL ÉDITORIAL : eyebrow + grand nom serif (Cormorant) + filet losange + corps */}
      {showTenantHero && (
        <div className="cca-in" style={{ textAlign: 'center', marginTop: 14, maxWidth: 680, position: 'relative', zIndex: 4, padding: '0 20px' }}>
          <div className="cca-display" style={{ fontSize: 13, letterSpacing: '.34em', textTransform: 'uppercase', color: TERRA, fontWeight: 600, marginBottom: 4 }}>
            Bienvenue sur
          </div>
          <h1 className="cca-display" style={{ fontWeight: 600, fontSize: 'clamp(46px, 8.5vw, 90px)', lineHeight: 1.02, letterSpacing: '-0.005em', color: INK, margin: 0, textWrap: 'balance' }}>
            {tenantName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '18px auto 16px', width: 220 }}>
            <span style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, rgba(217,119,87,.5))' }} />
            <span style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: TERRA, borderRadius: 1, opacity: 0.9, flexShrink: 0 }} />
            <span style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, rgba(217,119,87,.5), transparent)' }} />
          </div>
          <p className="cca-display" style={{ fontSize: 'clamp(19px, 2.3vw, 25px)', lineHeight: 1.42, color: 'rgba(244,239,230,.9)', margin: '0 auto', maxWidth: 500, textWrap: 'balance' }}>
            Je suis votre guide — je connais tout {tenantName}. Que souhaitez-vous découvrir ?
          </p>
        </div>
      )}

      {/* Voix (masquée pendant l'accueil éditorial OU l'écran scindé — le texte passe alors à gauche) */}
      {!showTenantHero && !showSplitAction && (
        <div className={`cca-voicecol${fullscreenScene ? ' cca-dim' : ''}`} style={{ minHeight: 34, marginTop: 14, textAlign: 'center', position: 'relative', zIndex: 4 }}>
          {message ? (
            <p className="cca-in" style={{ fontFamily: isTenantRealm ? DISPLAY : SERIF, fontSize: isTenantRealm ? 23 : 19, lineHeight: 1.45, color: INK, maxWidth: isTenantRealm ? 560 : 470, margin: '0 auto' }}>
              {keyword && (step === 'brain' || step === 'product') ? highlightReply(message, keyword) : message}
              {(presence === 'ecriture' || presence === 'attente') && <span className="cca-caret" />}
            </p>
          ) : (
            showActions && step === 'discovery' && !isTenantRealm && <span style={{ fontSize: 12, color: 'rgba(244,239,230,.4)' }}>touchez l'écran pour parler</span>
          )}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <p className="cca-in" style={{ marginTop: 10, fontSize: 12.5, color: '#f0997b' }}>{error}</p>
      )}

      {/* VNP — Realm tenant : accueil = INTENTIONS (avant interaction) ; puis NAVIGATION GUIDÉE
          (sujets liés) + ACTION ENGINE (actions métier). Le visiteur ne clique pas des liens : des intentions. */}
      {showActions && isTenantRealm && !tourActive && !fullscreenScene && !contactForm && !bookingForm && (
        <div className="cca-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(238px, 1fr))', gap: 10, justifyItems: 'stretch', marginTop: 24, width: '100%', maxWidth: 560, position: 'relative', zIndex: 4, padding: '0 20px', boxSizing: 'border-box' }}>
          {/* Toujours proposé : la visite guidée (l'OS REND le site en scènes) */}
          <button className="cca-chip cca-chip-visit" onClick={(e) => { e.stopPropagation(); startTenantTour(); }} style={VNP_VISIT_CHIP}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Compass size={17} style={{ flexShrink: 0 }} /> Fais-moi visiter</span>
            <ArrowRight size={16} style={{ flexShrink: 0 }} />
          </button>

          {/* ACCUEIL (avant interaction) : les intentions VNP (cartographie du site) */}
          {!engaged && (vnpGraph ? vnpGraph.accueil.filter((a) => a.intent !== 'visiter') : []).slice(0, 6).map((a) => {
            const Icon = chipIconFor(a.label);
            return (
              <button key={a.label} className="cca-chip" style={VNP_NAV_CHIP}
                onClick={(e) => { e.stopPropagation(); if (a.nodeId) vnpOpenNode(a.nodeId); else vnpChat(a.label); }}>
                <span style={VNP_CHIP_LABEL}><Icon size={16} style={{ color: GOLD, flexShrink: 0 }} /><span>{a.label}</span></span>
                <ArrowRight size={15} style={{ color: 'rgba(230,204,146,.6)', flexShrink: 0 }} />
              </button>
            );
          })}

          {/* NAVIGATION GUIDÉE (après interaction) : sujets liés → suites */}
          {engaged && vnpSuggest.map((s) => {
            const Icon = chipIconFor(s.label);
            return (
              <button key={`s-${s.nodeId}`} className="cca-chip" style={VNP_NAV_CHIP}
                onClick={(e) => { e.stopPropagation(); vnpOpenNode(s.nodeId); }}>
                <span style={VNP_CHIP_LABEL}><Icon size={16} style={{ color: GOLD, flexShrink: 0 }} /><span>{s.label}</span></span>
                <ArrowRight size={15} style={{ color: 'rgba(230,204,146,.6)', flexShrink: 0 }} />
              </button>
            );
          })}

          {/* ACTION ENGINE (après interaction) : actions métier disponibles (hors navigation pure) */}
          {engaged && vnpActs.filter((act) => !['comprendre', 'decouvrir'].includes(act)).map((act) => {
            const m = VNP_ACTION_META[act];
            if (!m) return null;
            return (
              <button key={`a-${act}`} className="cca-chip" style={VNP_ACTION_CHIP}
                onClick={(e) => { e.stopPropagation(); vnpAction(act, m.label); }}>
                <span style={VNP_CHIP_LABEL}><m.Icon size={16} style={{ color: TERRA, flexShrink: 0 }} /><span>{m.label}</span></span>
                <ArrowRight size={15} style={{ color: TERRA, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}

      {/* ACTION ENGINE — ÉCRAN SCINDÉ : le guide parle à GAUCHE, la ZONE D'ACTION (s'étire) à DROITE */}
      {showSplitAction && (
        <div className="cca-in cca-actionsplit" onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', gap: 30, alignItems: 'center', width: '100%', maxWidth: 1000, margin: '8px auto 0', padding: '0 28px', boxSizing: 'border-box', position: 'relative', zIndex: 6 }}>

          {/* GAUCHE — la voix du guide */}
          <div className="cca-actionsplit-text" style={{ flex: '1 1 44%', minWidth: 0 }}>
            {message && (
              <p className="cca-display" style={{ fontSize: 'clamp(18px, 1.9vw, 23px)', lineHeight: 1.5, color: 'rgba(244,239,230,.92)', margin: 0, textAlign: 'left', maxWidth: '42ch' }}>
                {message}{(presence === 'ecriture') && <span className="cca-caret" />}
              </p>
            )}
          </div>

          {/* DROITE — zone d'action bordée, hauteur dynamique selon le contenu */}
          <div className="cca-actionzone" style={{ flex: '1 1 56%', minWidth: 0, background: 'rgba(244,239,230,.03)', border: '1px solid rgba(230,204,146,.16)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>

            {contactForm && (contactForm.sent ? (
              <div style={{ textAlign: 'center', color: GOLD, fontFamily: DISPLAY, fontSize: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
                <Check size={18} /> Message envoyé
              </div>
            ) : (
              <>
                <div className="cca-display" style={{ fontSize: 18, color: INK, marginBottom: 2 }}>Parlez-nous</div>
                <input className="cca-field" placeholder="Votre nom" value={contactForm.name}
                  onChange={(e) => setContactForm((c) => ({ ...c, name: e.target.value }))} style={VNP_FIELD} />
                <input className="cca-field" type="email" placeholder="Votre e-mail" value={contactForm.email}
                  onChange={(e) => setContactForm((c) => ({ ...c, email: e.target.value }))} style={VNP_FIELD} />
                <textarea placeholder={`Votre message pour ${tenantName}…`} value={contactForm.message} rows={3}
                  onChange={(e) => setContactForm((c) => ({ ...c, message: e.target.value }))} style={{ ...VNP_FIELD, resize: 'vertical', lineHeight: 1.4 }} />
                {contactForm.error && <span style={{ color: '#f0997b', fontSize: 12.5 }}>{contactForm.error}</span>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); submitContact(); }} disabled={contactForm.sending}
                    style={{ ...VNP_CHIP_BASE, flex: 1, justifyContent: 'center', fontWeight: 600, color: '#231208', background: TERRA, border: 'none', opacity: contactForm.sending ? 0.7 : 1 }}>
                    {contactForm.sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {contactForm.sending ? 'Envoi…' : 'Envoyer'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setContactForm(null); }}
                    style={{ ...VNP_NAV_CHIP, justifyContent: 'center', width: 108 }}>Annuler</button>
                </div>
              </>
            ))}

            {bookingForm && (bookingForm.sent ? (
              <div style={{ textAlign: 'center', color: GOLD, fontFamily: DISPLAY, fontSize: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
                <Check size={18} /> Créneau demandé
              </div>
            ) : (
              <>
                <div className="cca-display" style={{ fontSize: 18, color: INK, marginBottom: 2 }}>Réserver une {bookingForm.service}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 }}>
                  {bookingSlots.map((s) => {
                    const on = bookingForm.slotIso === s.iso;
                    return (
                      <button key={s.iso} onClick={(e) => { e.stopPropagation(); setBookingForm((c) => ({ ...c, slotIso: s.iso, error: '' })); }}
                        style={{ ...VNP_CHIP_BASE, justifyContent: 'center', fontSize: 13, textTransform: 'capitalize',
                          color: on ? '#231208' : 'rgba(244,239,230,.9)', background: on ? TERRA : 'rgba(244,239,230,.035)',
                          border: on ? '1px solid transparent' : '1px solid rgba(230,204,146,.2)' }}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <input className="cca-field" placeholder="Votre nom" value={bookingForm.name}
                  onChange={(e) => setBookingForm((c) => ({ ...c, name: e.target.value }))} style={VNP_FIELD} />
                <input className="cca-field" type="email" placeholder="Votre e-mail" value={bookingForm.email}
                  onChange={(e) => setBookingForm((c) => ({ ...c, email: e.target.value }))} style={VNP_FIELD} />
                {bookingForm.error && <span style={{ color: '#f0997b', fontSize: 12.5 }}>{bookingForm.error}</span>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); submitBooking(); }} disabled={bookingForm.sending}
                    style={{ ...VNP_CHIP_BASE, flex: 1, justifyContent: 'center', fontWeight: 600, color: '#231208', background: TERRA, border: 'none', opacity: bookingForm.sending ? 0.7 : 1 }}>
                    {bookingForm.sending ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}
                    {bookingForm.sending ? 'Réservation…' : 'Confirmer le RDV'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setBookingForm(null); }}
                    style={{ ...VNP_NAV_CHIP, justifyContent: 'center', width: 108 }}>Annuler</button>
                </div>
              </>
            ))}
          </div>
        </div>
      )}

      {/* Actions par étape */}
      {showActions && step === 'discovery' && !tourActive && !isTenantRealm && (
        <div className="cca-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center', marginTop: 18, maxWidth: 480 }}>
          {SUGG.map(({ kind, label, Icon }) => (
            <span key={kind} className="cca-chip" onClick={(e) => { e.stopPropagation(); pickKind(kind); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: GOLD, background: 'rgba(244,239,230,.05)', borderRadius: 999, padding: '8px 15px' }}>
              <Icon size={14} />{label}
            </span>
          ))}
          <span className="cca-chip" onClick={(e) => { e.stopPropagation(); startTour(chosen); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: TERRA, background: 'rgba(217,119,87,.11)', borderRadius: 999, padding: '8px 15px' }}>
            <Sparkles size={14} />Fais-moi le tour
          </span>
          <span className="cca-chip" onClick={(e) => { e.stopPropagation(); askLessonName(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: GOLD, background: 'rgba(230,204,146,.09)', borderRadius: 999, padding: '8px 15px' }}>
            <GraduationCap size={14} />Apprendre avec le Précepteur
          </span>
        </div>
      )}

      {showActions && step === 'product' && !isTenantRealm && !fullscreenScene && !tourActive && !lessonActive && (
        <div className="cca-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 16, position: 'relative', zIndex: 4 }}>
          {brainHooks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 470 }}>
              {brainHooks.map((h, n) => (
                <span key={`ph${n}`} className="cca-chip" onClick={(e) => { e.stopPropagation(); brain(h); }}
                  style={{ fontSize: 12, color: GOLD, background: 'rgba(244,239,230,.05)', borderRadius: 999, padding: '6px 13px' }}>{h}</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); chooseProduct(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500, color: '#2a140c', background: TERRA, border: 'none', borderRadius: 11, padding: '10px 18px', cursor: 'pointer' }}>
              {(covered.length >= 3 || covered.includes('prix')) ? `Lancer ${PRODUCT[chosen].tag} — dès 150 €/mois` : `Choisir ${PRODUCT[chosen].tag}`}<ArrowRight size={15} />
            </button>
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); const o = ['school', 'medos', 'shop'].filter((x) => x !== chosen); pickKind(o[0]); }}
              style={{ fontSize: 13, color: 'rgba(244,239,230,.6)', background: 'rgba(244,239,230,.05)', border: 'none', borderRadius: 11, padding: '10px 15px', cursor: 'pointer' }}>
              Autre
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {!(covered.length >= 3 || covered.includes('prix')) && (
              <span className="cca-chip" onClick={(e) => { e.stopPropagation(); startTour(chosen); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: TERRA, background: 'rgba(217,119,87,.10)', borderRadius: 999, padding: '7px 14px' }}>
                <Sparkles size={13} />Fais-moi le tour
              </span>
            )}
            <span className="cca-chip" onClick={(e) => { e.stopPropagation(); askLessonName(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: GOLD, background: 'rgba(230,204,146,.09)', borderRadius: 999, padding: '7px 14px' }}>
              <GraduationCap size={13} />Un cours sur {PRODUCT[chosen].tag}
            </span>
          </div>
        </div>
      )}

      {showActions && step === 'brain' && !isTenantRealm && !fullscreenScene && !tourActive && !lessonActive && (
        <div className="cca-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 16, position: 'relative', zIndex: 4 }}>
          {(covered.length >= 3 || covered.includes('prix')) && (
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); chooseProduct(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500, color: '#2a140c', background: TERRA, border: 'none', borderRadius: 12, padding: '11px 22px', cursor: 'pointer' }}>
              Lancer {PRODUCT[chosen].tag} — dès 150 €/mois<ArrowRight size={16} />
            </button>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center', maxWidth: 480 }}>
            {brainHooks.map((h, n) => (
              <span key={`bh${n}`} className="cca-chip" onClick={(e) => { e.stopPropagation(); brain(h); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: GOLD, background: 'rgba(244,239,230,.05)', borderRadius: 999, padding: '7px 14px' }}>
                <ArrowRight size={13} />{h}
              </span>
            ))}
            {SUGG.map(({ kind, label, Icon }) => (
              <span key={kind} className="cca-chip" onClick={(e) => { e.stopPropagation(); pickKind(kind); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'rgba(244,239,230,.6)', background: 'rgba(244,239,230,.04)', borderRadius: 999, padding: '7px 14px' }}>
                <Icon size={13} />{label}
              </span>
            ))}
            <span className="cca-chip" onClick={(e) => { e.stopPropagation(); startTour(chosen); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: TERRA, background: 'rgba(217,119,87,.10)', borderRadius: 999, padding: '7px 14px' }}>
              <Sparkles size={13} />Fais-moi le tour
            </span>
          </div>
        </div>
      )}

      {showActions && step === 'brand_confirm' && (
        <div className="cca-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, color: slugState.available === false ? '#f0997b' : '#7fe0a0' }}>
            {slugState.checking ? (<><Loader2 size={13} className="animate-spin" /> vérification…</>)
              : slugState.available === false ? (<>identifiant déjà pris — changez le nom</>)
                : slugState.available ? (<><Check size={13} /> identifiant disponible</>)
                  : (<>cimolace.space/t/{slug}</>)}
          </span>
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="cca-chip" disabled={slugState.available === false} onClick={(e) => { e.stopPropagation(); continueToAccount(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500, color: '#2a140c', background: slugState.available === false ? 'rgba(217,119,87,.4)' : TERRA, border: 'none', borderRadius: 11, padding: '10px 18px', cursor: slugState.available === false ? 'not-allowed' : 'pointer' }}>
              Continuer<ArrowRight size={15} />
            </button>
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); setStep('brand_ask'); speak('Quel nom, alors ?', () => openInput()); }}
              style={{ fontSize: 13, color: 'rgba(244,239,230,.6)', background: 'rgba(244,239,230,.05)', border: 'none', borderRadius: 11, padding: '10px 15px', cursor: 'pointer' }}>
              Changer le nom
            </button>
          </div>
        </div>
      )}

      {showActions && step === 'account' && (
        <form className="cca-in" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); createAccount(); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 9, width: 320, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(244,239,230,.05)', borderRadius: 11, padding: '10px 13px' }}>
            <Mail size={15} color="rgba(244,239,230,.4)" />
            <input className="cca-field" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 13.5, fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(244,239,230,.05)', borderRadius: 11, padding: '10px 13px' }}>
            <Lock size={15} color="rgba(244,239,230,.4)" />
            <input className="cca-field" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (8 car. min)"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 13.5, fontFamily: 'inherit' }} />
          </div>
          <button type="submit" disabled={busy}
            style={{ marginTop: 4, background: TERRA, color: '#2a140c', border: 'none', borderRadius: 11, padding: '11px', fontSize: 13.5, fontWeight: 500, cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            {busy ? (<><Loader2 size={15} className="animate-spin" /> Création…</>) : (<>Créer mon espace<ArrowRight size={15} /></>)}
          </button>
        </form>
      )}

      {/* L7 — Tour guidé : sous-titre narrateur (scènes plein écran) + contrôles */}
      {tourActive && (
        <>
          {fullscreenScene && message && (
            <div className="cca-in" style={{ position: 'absolute', left: '50%', bottom: 98, transform: 'translateX(-50%)', width: 'min(620px, 86vw)', textAlign: 'center', zIndex: 6, pointerEvents: 'none' }}>
              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.5, color: INK, margin: 0 }}>
                {keyword ? highlightReply(message, keyword) : message}
                {(presence === 'ecriture' || presence === 'attente') && <span className="cca-caret" />}
              </p>
            </div>
          )}
          <div style={{ position: 'absolute', left: '50%', bottom: 34, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14, zIndex: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {Array.from({ length: tourTotal }).map((_, i) => (
                <span key={i} style={{ width: i === tourIdx ? 18 : 6, height: 6, borderRadius: 999, background: i === tourIdx ? TERRA : i < tourIdx ? GOLD : 'rgba(244,239,230,.25)', transition: 'all .3s cubic-bezier(.16,1,.3,1)' }} />
              ))}
            </div>
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); skipBeat(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(244,239,230,.06)', border: 'none', color: 'rgba(244,239,230,.7)', borderRadius: 999, padding: '7px 13px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>
              <SkipForward size={13} />Passer
            </button>
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); endTour(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: 'rgba(244,239,230,.45)', borderRadius: 999, padding: '7px 10px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>
              <X size={13} />Arrêter
            </button>
          </div>
        </>
      )}

      {/* L8 — Mode formation NATIF : atelier interactif + contrôles du cours */}
      {lessonActive && (
        <>
          {atelier && (
            <div className="cca-in" onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 5, marginTop: 16, width: 'min(560px, 88vw)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: TERRA, marginBottom: 8 }}>Atelier · à toi de réfléchir</div>
              <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.5, color: INK, margin: '0 0 4px' }}>
                {lessonRef.current && lessonRef.current.name ? <span style={{ color: GOLD }}>{lessonRef.current.name}, </span> : null}{atelier.question}
              </p>
              {atelier.hint && <p style={{ fontSize: 12.5, fontStyle: 'italic', color: 'rgba(244,239,230,.45)', margin: '0 0 12px' }}>Indice : {atelier.hint}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(244,239,230,.07)', borderRadius: 14, padding: '8px 8px 8px 15px', marginTop: atelier.hint ? 0 : 12 }}>
                <input ref={atelierInputRef} className="cca-field" value={atelierValue} onChange={(e) => setAtelierValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); answerAtelier(atelierValue); } }}
                  placeholder="Écris ta réponse…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 14, fontFamily: 'inherit' }} />
                <button onClick={() => answerAtelier(atelierValue)} aria-label="Répondre"
                  style={{ width: 32, height: 32, borderRadius: 9, background: TERRA, color: '#2a140c', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                  <ArrowUp size={17} />
                </button>
              </div>
            </div>
          )}
          {atelierAck && !atelier && (
            <p className="cca-in" style={{ marginTop: 10, fontSize: 15, fontWeight: 500, color: GOLD, fontFamily: SERIF }}>{atelierAck}</p>
          )}
          <div style={{ position: 'absolute', left: '50%', bottom: 34, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14, zIndex: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {Array.from({ length: (lessonRef.current && lessonRef.current.scenes ? lessonRef.current.scenes.length : 0) }).map((_, i) => (
                <span key={i} style={{ width: i === lessonIdx ? 16 : 5, height: 5, borderRadius: 999, background: i === lessonIdx ? TERRA : i < lessonIdx ? GOLD : 'rgba(244,239,230,.22)', transition: 'all .3s cubic-bezier(.16,1,.3,1)' }} />
              ))}
            </div>
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); skipLessonScene(); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(244,239,230,.06)', border: 'none', color: 'rgba(244,239,230,.7)', borderRadius: 999, padding: '7px 13px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>
              <SkipForward size={13} />{atelier ? 'Voir la réponse' : 'Passer'}
            </button>
            <button className="cca-chip" onClick={(e) => { e.stopPropagation(); stopLesson(); setStep('product'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: 'rgba(244,239,230,.45)', borderRadius: 999, padding: '7px 10px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}>
              <X size={13} />Arrêter
            </button>
          </div>
        </>
      )}

      {/* Saisie « parler à la présence » */}
      {inputOpen && (
        <div className="cca-in" onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', zIndex: 6, left: '50%', bottom: 40, transform: 'translateX(-50%)', width: 'min(440px, 86vw)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(244,239,230,.07)', borderRadius: 14, padding: '8px 8px 8px 15px' }}>
          <input ref={inputRef} className="cca-field" value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitInput(); } else if (e.key === 'Escape') { closeInput(); } }}
            placeholder={step === 'brand_ask' ? 'Nom de votre organisation…' : 'Parlez à la présence…'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 14, fontFamily: 'inherit' }} />
          <button onClick={submitInput} aria-label="Envoyer"
            style={{ width: 32, height: 32, borderRadius: 9, background: TERRA, color: '#2a140c', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
            <ArrowUp size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
