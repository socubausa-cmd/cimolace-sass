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
import { GraduationCap, Stethoscope, ShoppingBag, ArrowUp, ArrowRight, ArrowLeft, Check, Loader2, Mail, Lock, Volume2, VolumeX, Sparkles, SkipForward, X, Compass, BookOpen, Users, Tag, UserPlus, Calendar, Download, Scale, Send, Eye, Target, Gem, Hexagon } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { authStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';
import { logEvent, logUnanswered } from '@/lib/agent/vnpStats';
import { BG, BG_THINK, INK, TERRA, GOLD, SERIF, DISPLAY, STYLE } from '@/lib/agent/immersiveTheme';
import Presence from '@/components/agent/Presence';
import { CIMOLACE_LESSONS } from '@/lib/agent/cimolaceLessons';
import { OS_KNOWLEDGE, prorascienceKnowledgeText, buildTenantTour, buildNodeScene } from '@/lib/agent/prorascienceKnowledge';
import { CIMOLACE_KNOWLEDGE } from '@/lib/agent/cimolaceKnowledge';

// Carte knowledge de TOUS les realms OS = tenants (OS_KNOWLEDGE = { isna }) + Cimolace lui-même.
// Cimolace devient un realm VNP à part entière (guide data-driven), en plus de son tunnel de création.
const OS_KNOWLEDGE_ALL = { ...OS_KNOWLEDGE, cimolace: CIMOLACE_KNOWLEDGE };
import SEO from '@/components/SEO';
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

// Icônes décoratives du reader (badges ronds sur sections/faits), cyclées par index.
const READER_ICONS = [BookOpen, Hexagon, Compass, Sparkles, Scale, Eye];
const readerIcon = (i) => READER_ICONS[((i % READER_ICONS.length) + READER_ICONS.length) % READER_ICONS.length];
// Icône par SUJET (puces « Poursuivre » de la barre suite) — repli sur une flèche.
const NODE_ICONS = {
  mission: Target, vision: Eye, valeurs: Gem, services: Compass, solutions: Scale, produits: Tag,
  realisations: Sparkles, histoire: BookOpen, fondateur: Users, equipe: Users, faq: Sparkles,
  contact: Mail, support: Mail, identity: Hexagon, documentation: BookOpen, ressources: Compass,
};
// Icône de CARTE (clé bornée → composant lucide). Les cartes forfaits reçoivent une icône par palier.
const CARD_ICON_MAP = { calendar: Calendar, compass: Compass, grad: GraduationCap, users: Users, gem: Gem, sparkles: Sparkles, book: BookOpen, tag: Tag, hexagon: Hexagon };
// Intention « MEMBRE QUI REVIENT » (déjà un compte) : une question tapée qui matche → on route
// vers l'espace (login tenant), sans passer par l'edge. Complète le bouton « Mon espace ».
const LOGIN_RE = /(me\s*connect|se\s*connect|connexion|connecter|mon\s*compte|mon\s*espace|espace\s*(membre|perso|client)|acc[eé]der\s*[àa]?\s*(mon|l['e ]|son)\s*(compte|espace)|identifi|\blog[\s-]?in\b|\bsign[\s-]?in\b|d[eé]j[àa]\s*(un\s*)?compte|me\s*logg)/i;

// Realms OS de marque AUTORISÉS. Rendre un realm = afficher le chrome « tenant » (badge marque,
// « Connecté », branding fetché) par-dessus le MÊME moteur. Accepter un slug arbitraire via `?os=`
// laissait usurper N'IMPORTE QUELLE marque sur le domaine Cimolace (phishing visuel) → allow-list
// stricte. Aujourd'hui, seul le tenant fondateur est un realm OS (cf. OS_KNOWLEDGE = { isna }).
const OS_REALMS = new Set(['isna', 'cimolace']);

// Host dédié → son realm de marque (parité avec HOST_PORTAL dans App.jsx : prorascience.org = isna).
// Cimolace lui-même est un realm VNP (guide) sur ses propres hosts — le tunnel de création reste
// accessible via l'action « Créer ma plateforme » (funnelMode), sans quitter l'OS.
function hostOsRealm(host) {
  const h = String(host || '').toLowerCase();
  if (h === 'prorascience.org' || h === 'www.prorascience.org') return 'isna';
  if (h === 'app.cimolace.space' || h === 'cimolace.space' || h === 'www.cimolace.space') return 'cimolace';
  return null;
}

// Hosts de preview/dev où l'on teste librement un realm autorisé (jamais un domaine public de prod).
function isPreviewOrDevOsHost(host) {
  const h = String(host || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h.endsWith('-cimolace.vercel.app')) return true; // preview Vercel = bac à sable OS
  return false;
}

// L'OS peut RENDRE un tenant existant (realm) — MÊME moteur/couleurs, seuls le logo (au coin), le nom
// de la plateforme et le message de bienvenue changent. Résolution du slug tenant (allow-list stricte) :
//   prop (App.jsx ne la passe QUE pour un host de realm connu) → ?os=<slug> (preview/dev, ou prod SI
//   == realm du host) → host dédié (prorascience.org → isna). Sinon null = realm Cimolace neutre.
function getOsRealmSlug(propSlug) {
  if (propSlug) {
    const s = String(propSlug).trim().toLowerCase();
    return OS_REALMS.has(s) ? s : null; // prop validée quand même (défense en profondeur)
  }
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  const realmOfHost = hostOsRealm(host); // 'isna' sur prorascience.org, sinon null
  try {
    const q = new URLSearchParams(window.location.search).get('os');
    if (q && q.trim()) {
      const s = q.trim().toLowerCase();
      if (!OS_REALMS.has(s)) return realmOfHost;       // slug non autorisé → ignoré (retombe sur le host)
      if (isPreviewOrDevOsHost(host)) return s;         // preview/dev : test libre des realms autorisés
      if (realmOfHost && s === realmOfHost) return s;   // prod : uniquement le realm du host lui-même
      return realmOfHost;                               // prod host sans ce realm (ex. cimolace.space) → ignoré
    }
  } catch { /* ignore */ }
  return realmOfHost;
}

// Fallback anti-flash + robustesse CORS : l'API branding bloque les origines vercel.app en preview
// (le fetch réel confirme/affine en prod). Garantit nom + logo immédiats pour les tenants connus.
const OS_REALM_FALLBACK = {
  // Logo prorascience = l'ŒIL (Œil d'Horus + oreille), version blanche transparente pour le badge sombre.
  isna: { name: 'Prorascience', logo: '/prorascience-eye.png' },
  cimolace: { name: 'Cimolace', logo: '/logo.svg' },
};

// Positionnement des 4 cycles (prix depuis billing_plans → jamais recopiés ici). Le « pour qui » guide
// le choix : 4 chemins DISTINCTS. Temple/cultes ouverts dès l'Autonome ; le Privilégié = la pratique.
const CYCLE_META = {
  autonome:   { name: 'Autonome',   for: 'Apprendre en autonomie — Temple & cultes inclus.' },
  academique: { name: 'Académique', for: 'Le cursus complet, encadré par l’équipe.' },
  prive:      { name: 'Privé',      for: 'Accompagnement rapproché, en petit comité.' },
  privilegie: { name: 'Privilégié', for: 'Pour ceux qui veulent pratiquer — mentorat souverain.' },
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

// L'edge VNP renvoie next.target = le LIBELLÉ de l'offre choisie (ex. « Cycle Académique »).
// On le mappe sur la clé de cycle de /forfaits (autonome|academique|prive|privilegie) pour
// pré-sélectionner le bon palier au checkout. Retourne '?plan=<clé>' ou '' (pas de présélection :
// la consultation est un one-off réservé en inline, jamais un cycle de /forfaits).
function forfaitsPlanQuery(target) {
  const s = String(target || '').toLowerCase();
  let key = '';
  if (/consultation/.test(s)) key = '';
  else if (/privil[ée]gi|mentorat|souverain/.test(s)) key = 'privilegie';
  else if (/acad[ée]miq/.test(s)) key = 'academique';
  else if (/priv[ée]/.test(s)) key = 'prive';
  else if (/autonom/.test(s)) key = 'autonome';
  return key ? `?plan=${encodeURIComponent(key)}` : '';
}

// Descriptions courtes des intentions d'accueil (liste « Explorez » épurée). Robuste aux
// variations de libellé (match par mots-clés sur intent+label) — data-driven, réutilisable.
function exploreDesc(a) {
  const s = `${(a && a.intent) || ''} ${(a && a.label) || ''}`.toLowerCase();
  if (/forfait|prix|tarif|offre/.test(s)) return 'Choisissez le forfait adapté à vos besoins.';
  if (/mission/.test(s)) return "Comprendre notre engagement et notre raison d'être.";
  if (/vision/.test(s)) return "Explorer notre vision pour aujourd'hui et pour demain.";
  if (/fondateur|manikongo|recteur/.test(s)) return "Découvrez l'histoire et l'engagement de notre fondateur.";
  if (/contact|question|parler/.test(s)) return 'Une question ? Parlons-en, nous sommes là pour vous.';
  if (/temple|ngowazulu|spirit|consultation/.test(s)) return 'Le pôle temple : consultations, cultes et accompagnement.';
  if (/qu'?est|c'?est quoi|comprendre|approche|découvrir|présent/.test(s)) return 'Découvrez notre approche, nos valeurs et notre univers.';
  return 'En savoir plus.';
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
const SCENE_TYPES = ['aside', 'split', 'reader', 'tutorial', 'cards', 'timeline', 'stats', 'comparateur', 'faq'];
const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// normalizeScene = AUTORITÉ FINALE (pure, ne throw jamais). Doute → null → center-question.
function normalizeScene(raw) {
  try {
    if (!raw || typeof raw !== 'object' || !SCENE_TYPES.includes(raw.type)) return null;
    const cut = (s, n) => String(s == null ? '' : s).slice(0, n);
    const arr = (a, n, len) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => cut(x, len)).filter(Boolean);
    // ref MODE FOCUS partagé (cards/timeline/comparateur) : borné, jamais throw.
    const normRef = (r, fallbackTitle) => (r && typeof r === 'object') ? {
      kind: r.kind === 'plan' ? 'plan' : 'info',
      title: cut(r.title, 60) || cut(fallbackTitle, 40),
      value: cut(r.value, 40) || undefined,
      note: cut(r.note, 340) || undefined,
      actions: (Array.isArray(r.actions) ? r.actions : []).filter((a) => typeof a === 'string').slice(0, 4),
      related: (Array.isArray(r.related) ? r.related : []).slice(0, 3)
        .map((x) => (x && x.nodeId && x.label) ? { nodeId: cut(x.nodeId, 40), label: cut(x.label, 40) } : null).filter(Boolean),
    } : undefined;
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
        .map((f) => (f && f.k && f.v) ? { k: cut(f.k, 24), v: cut(f.v, 110) } : null).filter(Boolean);
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
          icon: (typeof c.icon === 'string' && c.icon.length < 16) ? c.icon : undefined,
          ref: (c.ref && typeof c.ref === 'object') ? {
            kind: c.ref.kind === 'plan' ? 'plan' : 'info',
            title: cut(c.ref.title, 60) || cut(c.title, 40),
            value: cut(c.ref.value, 40) || undefined,
            note: cut(c.ref.note, 340) || undefined,
            // Lien d'achat (Payment Link Stripe) — préservé UNIQUEMENT si c'est une URL https valide.
            link: (typeof c.ref.link === 'string' && /^https:\/\/[^\s"'<>]+$/.test(c.ref.link)) ? c.ref.link : undefined,
            // Paliers (chacun son Payment Link) — label + prix + lien https validé.
            tiers: Array.isArray(c.ref.tiers) ? c.ref.tiers.slice(0, 6).map((t) => (t && t.label) ? {
              label: cut(t.label, 30), price: cut(t.price, 20) || undefined,
              link: (typeof t.link === 'string' && /^https:\/\/[^\s"'<>]+$/.test(t.link)) ? t.link : undefined,
            } : null).filter(Boolean) : undefined,
            actions: (Array.isArray(c.ref.actions) ? c.ref.actions : []).filter((a) => typeof a === 'string').slice(0, 4),
            related: (Array.isArray(c.ref.related) ? c.ref.related : []).slice(0, 3)
              .map((r) => (r && r.nodeId && r.label) ? { nodeId: cut(r.nodeId, 40), label: cut(r.label, 40) } : null).filter(Boolean),
          } : undefined,
        } : null).filter(Boolean);
      if (!cards.length) return null;
      return { type: 'cards', title: cut(raw.title, 80) || undefined, cards };
    }
    if (raw.type === 'timeline') {
      const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 6)
        .map((s) => (s && s.title) ? {
          marker: cut(s.marker, 6) || undefined,
          icon: (typeof s.icon === 'string' && s.icon.length < 16) ? s.icon : undefined,
          kicker: cut(s.kicker, 24) || undefined,
          title: cut(s.title, 48),
          detail: cut(s.detail, 200) || undefined,
          foot: cut(s.foot, 60) || undefined,
          accent: (s.accent === 'terra' || s.accent === 'gold') ? s.accent : undefined,
          ref: normRef(s.ref, s.title),
        } : null).filter(Boolean);
      if (!steps.length) return null;
      return { type: 'timeline', title: cut(raw.title, 80) || undefined, steps };
    }
    if (raw.type === 'stats') {
      const metrics = (Array.isArray(raw.metrics) ? raw.metrics : []).slice(0, 6)
        .map((m) => (m && m.label && m.value != null) ? {
          label: cut(m.label, 40), value: cut(m.value, 16),
          icon: (typeof m.icon === 'string' && m.icon.length < 16) ? m.icon : undefined,
          note: cut(m.note, 80) || undefined,
          ref: normRef(m.ref, m.label),
        } : null).filter(Boolean);
      if (!metrics.length) return null;
      return { type: 'stats', title: cut(raw.title, 80) || undefined, metrics };
    }
    if (raw.type === 'comparateur') {
      const plans = (Array.isArray(raw.plans) ? raw.plans : []).slice(0, 4)
        .map((p) => (p && p.name) ? {
          name: cut(p.name, 28), value: cut(p.value, 24) || undefined,
          icon: (typeof p.icon === 'string' && p.icon.length < 16) ? p.icon : undefined,
          popular: !!p.popular, ref: normRef(p.ref, p.name),
        } : null).filter(Boolean);
      const n = plans.length;
      if (n < 2) return null;
      const rows = (Array.isArray(raw.rows) ? raw.rows : []).slice(0, 8)
        .map((r) => (r && r.feature) ? {
          feature: cut(r.feature, 60),
          has: Array.from({ length: n }, (_, i) => !!(Array.isArray(r.has) && r.has[i])),
        } : null).filter(Boolean);
      if (!rows.length) return null;
      return { type: 'comparateur', title: cut(raw.title, 80) || undefined, intro: cut(raw.intro, 120) || undefined, plans, rows };
    }
    if (raw.type === 'faq') {
      const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 8)
        .map((it) => (it && it.q && it.a) ? { q: cut(it.q, 140), a: cut(it.a, 600) } : null).filter(Boolean);
      if (!items.length) return null;
      return { type: 'faq', title: cut(raw.title, 80) || undefined, items };
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
// SceneSuggest — la SUITE : barre basse d'orientation (le guide ne laisse JAMAIS un cul-de-sac).
// Actions métier (terra, via VNP_ACTION_META) + sujets liés (chips → nœud). Dégradé de fond → le
// contenu qui défile s'estompe dessous (pas de bord dur). Révélée avec la scène.
const SCENE_SUGGEST_CSS = `
.cca-ss{position:absolute;left:0;right:0;bottom:0;z-index:6;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:9px;padding:38px 5vw 20px;background:linear-gradient(to top,#262624 36%,rgba(38,38,36,.85) 64%,transparent);opacity:0;transform:translateY(10px);transition:opacity .5s ease .32s,transform .5s cubic-bezier(.16,1,.3,1) .32s;pointer-events:auto}
.cca-scene-on .cca-ss{opacity:1;transform:none}
.cca-ss-lead{width:100%;display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:8px;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,239,230,.4)}
.cca-ss-lead::before,.cca-ss-lead::after{content:'';height:1px;width:clamp(40px,14vw,130px)}
.cca-ss-lead::before{background:linear-gradient(90deg,transparent,rgba(230,204,146,.42))}
.cca-ss-lead::after{background:linear-gradient(90deg,rgba(230,204,146,.42),transparent)}
.cca-ss-act{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;border:1px solid rgba(217,119,87,.45);background:rgba(217,119,87,.14);color:#f4efe6;font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background .16s ease,border-color .16s ease}
.cca-ss-act:hover{background:rgba(217,119,87,.24);border-color:rgba(217,119,87,.65)}
.cca-ss-chip{display:inline-flex;align-items:center;gap:8px;padding:9px 15px 9px 13px;border-radius:999px;border:1px solid rgba(230,204,146,.26);background:rgba(230,204,146,.05);color:rgba(244,239,230,.85);font-family:inherit;font-size:12.5px;cursor:pointer;transition:background .16s ease,border-color .16s ease}
.cca-ss-chip:hover{background:rgba(230,204,146,.13);border-color:rgba(230,204,146,.48)}
.cca-ss-chip>svg:first-of-type{color:#e6cc92}
.cca-ss-arr{color:#e6cc92;opacity:.55;margin-left:1px}
.cca-scene:has(.cca-ss) .cca-cards,.cca-scene:has(.cca-ss) .cca-tl,.cca-scene:has(.cca-ss) .cca-st,.cca-scene:has(.cca-ss) .cca-cmp,.cca-scene:has(.cca-ss) .cca-tuto{padding-bottom:120px;transition:padding-bottom .28s cubic-bezier(.16,1,.3,1)}
/* Champ « écrire » ouvert : la scène AMÉNAGE l'espace (recule) pour ne pas être recouverte par la barre de saisie. */
.cca-input-open .cca-scene:has(.cca-ss) .cca-cards,.cca-input-open .cca-scene:has(.cca-ss) .cca-tl,.cca-input-open .cca-scene:has(.cca-ss) .cca-st,.cca-input-open .cca-scene:has(.cca-ss) .cca-cmp,.cca-input-open .cca-scene:has(.cca-ss) .cca-tuto{padding-bottom:184px}
@media (max-width:640px){.cca-ss{padding:32px 4vw 15px;gap:7px}}
`;
// Actions de CONVERSION (mises en avant dans la suite) ; les intentions « molles » (comprendre,
// découvrir, comparer, visiter) sont couvertes par les chips de sujets, pas par un CTA terra.
const SCENE_STRONG_ACTS = { rejoindre: 1, reserver: 1, acheter: 1, contacter: 1, telecharger: 1, participer: 1 };
function SceneSuggest({ acts, suggest, onAct, onNode }) {
  const actList = (acts || []).map((a) => ({ id: a, m: VNP_ACTION_META[a] })).filter((x) => x.m && SCENE_STRONG_ACTS[x.id]).slice(0, 2);
  // Dédup : un chip de sujet ne répète pas un CTA d'action déjà présent (ex. « Nous contacter »).
  const actLabels = new Set(actList.map((x) => x.m.label.toLowerCase()));
  const sugList = (suggest || []).filter((s) => s && s.nodeId && s.label && !actLabels.has(String(s.label).toLowerCase())).slice(0, 3);
  if (!actList.length && !sugList.length) return null;
  return (
    <div className="cca-ss">
      <style>{SCENE_SUGGEST_CSS}</style>
      <span className="cca-ss-lead">Poursuivre</span>
      {actList.map(({ id, m }) => (
        <button key={id} type="button" className="cca-ss-act" onClick={() => onAct(id, m.label)}>
          <m.Icon size={15} /> {m.label}
        </button>
      ))}
      {sugList.map((s) => {
        const Ic = NODE_ICONS[s.nodeId] || Sparkles;
        return (
          <button key={s.nodeId} type="button" className="cca-ss-chip" onClick={() => onNode(s.nodeId)}>
            <Ic size={14} /><span>{s.label}</span><ArrowRight className="cca-ss-arr" size={13} />
          </button>
        );
      })}
    </div>
  );
}

export function SceneStage({ scene, visible, readerIdx, setReaderIdx, onSuggest, onCta, hooks, onHook, onFocus, suggest, acts, onNode, onAct, glossary, onTerm }) {
  if (!scene) return null;
  return (
    <div className={`cca-scene cca-stage-${scene.type} ${visible ? 'cca-scene-on' : ''}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      {scene.type === 'aside' && <AsidePanel scene={scene} />}
      {scene.type === 'split' && <SplitWorlds scene={scene} hooks={hooks} onHook={onHook} />}
      {scene.type === 'reader' && <ReaderView scene={scene} idx={readerIdx} setIdx={setReaderIdx} onSuggest={onSuggest} hooks={hooks} glossary={glossary} onTerm={onTerm} />}
      {scene.type === 'tutorial' && <TutorialFlow scene={scene} onCta={onCta} hooks={hooks} onHook={onHook} />}
      {scene.type === 'cards' && <CardsScene scene={scene} onFocus={onFocus} glossary={glossary} onTerm={onTerm} />}
      {scene.type === 'timeline' && <TimelineFlow scene={scene} onFocus={onFocus} glossary={glossary} onTerm={onTerm} />}
      {scene.type === 'stats' && <StatsPanel scene={scene} visible={visible} onFocus={onFocus} />}
      {scene.type === 'comparateur' && <ComparateurScene scene={scene} onFocus={onFocus} glossary={glossary} onTerm={onTerm} />}
      {scene.type === 'faq' && <FaqScene scene={scene} glossary={glossary} onTerm={onTerm} />}
      {scene.type !== 'aside' && <SceneSuggest acts={(scene.type === 'tutorial' && scene.cta) ? [] : acts} suggest={suggest} onAct={onAct} onNode={onNode} />}
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
.cca-card-ic{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#e6cc92;border:1px solid rgba(230,204,146,.28);background:rgba(230,204,146,.05);margin-bottom:11px}
.cca-card-gold .cca-card-ic{border-color:rgba(230,204,146,.45);background:rgba(230,204,146,.09)}
.cca-card-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:16px;color:#f4efe6;font-weight:600}
.cca-card-value{font-family:'Cormorant Garamond','Cormorant',Georgia,serif;font-size:31px;line-height:1;color:#e6cc92;margin:1px 0}
.cca-card-terra .cca-card-value{color:#d97757}
.cca-card-note{font-size:12.5px;line-height:1.45;color:rgba(244,239,230,.6)}
.cca-card-click:hover{border-color:rgba(230,204,146,.55);background:rgba(244,239,230,.07);transform:translateY(-2px)}
.cca-card-more{margin-top:7px;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#e6cc92;opacity:.7;transition:opacity .2s ease}
.cca-card-click:hover .cca-card-more{opacity:1}
@media (max-width:640px){.cca-cards{padding:7vh 5vw 4vh}.cca-cards-grid{grid-template-columns:1fr}.cca-card-value{font-size:27px}}
`;
function CardsScene({ scene, onFocus, glossary, onTerm }) {
  return (
    <div className="cca-cards" style={{ pointerEvents: 'auto' }}>
      <style>{CARDS_CSS}</style>
      {scene.title && <div className="cca-cards-title">{scene.title}</div>}
      <div className="cca-cards-grid">
        {scene.cards.map((c, i) => {
          const clickable = !!(c.ref && onFocus);
          const CIc = c.icon ? CARD_ICON_MAP[c.icon] : null;
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
              {CIc && <span className="cca-card-ic"><CIc size={17} /></span>}
              <div className="cca-card-title">{c.title}</div>
              {c.value && <div className="cca-card-value">{c.value}</div>}
              {c.note && <div className="cca-card-note">{glossify(c.note, glossary, onTerm)}</div>}
              {clickable && <span className="cca-card-more">Voir le détail →</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// timeline — FRISE VERTICALE (séquence : méthode/parcours). Jalons révélés en cascade le long
// d'un fil ; repère chiffré Cormorant, corps cliquable → focus. CSS locale (hex littéraux).
const TIMELINE_CSS = `
.cca-tl{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:78px 5vw 7vh;overflow-y:auto;scrollbar-width:none}
@media (max-height:820px){.cca-tl{justify-content:flex-start}}
.cca-tl::-webkit-scrollbar{width:0}
.cca-tl-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:22px;color:#f4efe6;text-align:center;margin-bottom:24px;opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-tl-title{opacity:1;transform:none}
.cca-tl-track{width:100%;max-width:540px;margin:0 auto}
.cca-tl-node{position:relative;display:grid;grid-template-columns:48px 1fr;gap:16px;padding-bottom:26px;opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .55s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-tl-node{opacity:1;transform:none}
.cca-tl-node:last-child{padding-bottom:2px}
.cca-tl-rail{position:relative;display:flex;justify-content:center}
.cca-tl-num{position:relative;z-index:1;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond','Cormorant',Georgia,serif;font-size:24px;line-height:1;color:#e6cc92;background:rgba(230,204,146,.09);border:1px solid rgba(230,204,146,.34)}
.cca-tl-node.terra .cca-tl-num{color:#d97757;background:rgba(217,119,87,.09);border-color:rgba(217,119,87,.36)}
.cca-tl-line{position:absolute;top:44px;bottom:-4px;left:50%;width:1px;transform:translateX(-.5px);background:linear-gradient(rgba(230,204,146,.5),rgba(230,204,146,.08))}
.cca-tl-node:last-child .cca-tl-line{display:none}
.cca-tl-body{padding-top:4px}
.cca-tl-body.click{cursor:pointer;border-radius:12px;transition:background .18s ease}
.cca-tl-body.click:hover{background:rgba(244,239,230,.035)}
.cca-tl-kicker{display:inline-flex;align-items:center;gap:5px;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(230,204,146,.72)}
.cca-tl-h{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:19px;color:#f4efe6;font-weight:600;margin:1px 0 4px}
.cca-tl-detail{font-size:13.5px;line-height:1.55;color:rgba(244,239,230,.66)}
.cca-tl-foot{margin-top:6px;font-size:11.5px;color:rgba(244,239,230,.44)}
.cca-tl-more{display:inline-block;margin-top:8px;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#e6cc92;opacity:0;transition:opacity .2s ease}
.cca-tl-body.click:hover .cca-tl-more{opacity:.85}
@media (max-width:640px){.cca-tl{padding:7vh 6vw 4vh}.cca-tl-node{grid-template-columns:42px 1fr;gap:13px}.cca-tl-num{width:38px;height:38px;font-size:21px}}
`;
function TimelineFlow({ scene, onFocus, glossary, onTerm }) {
  return (
    <div className="cca-tl" style={{ pointerEvents: 'auto' }}>
      <style>{TIMELINE_CSS}</style>
      {scene.title && <div className="cca-tl-title">{scene.title}</div>}
      <div className="cca-tl-track">
        {scene.steps.map((s, i) => {
          const clickable = !!(s.ref && onFocus);
          const open = clickable ? () => onFocus(s.ref) : undefined;
          const TIc = s.icon ? CARD_ICON_MAP[s.icon] : null;
          return (
            <div key={i} className={`cca-tl-node${s.accent === 'terra' ? ' terra' : ''}`} style={{ transitionDelay: `${i * 90 + 150}ms` }}>
              <div className="cca-tl-rail">
                <span className="cca-tl-num">{s.marker || (i + 1)}</span>
                <span className="cca-tl-line" />
              </div>
              <div className={`cca-tl-body${clickable ? ' click' : ''}`}
                onClick={open} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : undefined}>
                {s.kicker && <div className="cca-tl-kicker">{TIc && <TIc size={12} />}{s.kicker}</div>}
                <div className="cca-tl-h">{s.title}</div>
                {s.detail && <div className="cca-tl-detail">{glossify(s.detail, glossary, onTerm)}</div>}
                {s.foot && <div className="cca-tl-foot">{s.foot}</div>}
                {clickable && <span className="cca-tl-more">Approfondir →</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// StatValue — compteur animé (parse '2500+' / '95%' → nombre + suffixe), rAF maison, respecte
// prefers-reduced-motion (garde-fou prefersReduced) ; non-numérique → valeur brute affichée.
function StatValue({ raw, active }) {
  const parsed = String(raw).match(/^(\D*)([\d\s.,]+)(.*)$/);
  const prefix = parsed ? parsed[1] : '';
  const target = parsed ? parseFloat(parsed[2].replace(/[\s,]/g, '')) : NaN;
  const suffix = parsed ? parsed[3] : '';
  const [disp, setDisp] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    // Anime UNE fois quand la scène devient visible. CORRECTNESS FIRST : le nombre affiché
    // doit TOUJOURS finir sur la vraie valeur — jamais un partiel faux (ex. « 339+ » au lieu
    // de « 2500+ ») si rAF est gelé (onglet masqué / throttling) ou reduced-motion.
    if (!Number.isFinite(target) || !active || startedRef.current) return undefined;
    startedRef.current = true;
    if (prefersReduced() || (typeof document !== 'undefined' && document.hidden)) { setDisp(target); return undefined; }
    let raf; let start; let done = false;
    const dur = 900;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const finish = () => { if (!done) { done = true; setDisp(target); } };
    const tick = (now) => {
      if (start == null) start = now;
      const t = Math.min(1, (now - start) / dur);
      setDisp(target * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick); else finish();
    };
    // Filet anti-gel : setTimeout (bien moins throttlé que rAF onglet masqué) garantit la
    // valeur finale ; + snap immédiat si l'onglet passe en arrière-plan pendant l'anim.
    const safety = setTimeout(finish, dur + 500);
    const onHide = () => { if (document.hidden) finish(); };
    document.addEventListener('visibilitychange', onHide);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); document.removeEventListener('visibilitychange', onHide); };
  }, [active, target]);
  if (!Number.isFinite(target)) return <span>{raw}</span>;
  const shown = new Intl.NumberFormat('fr-FR').format(Math.round(disp));
  return <span>{prefix}{shown}{suffix}</span>;
}

// stats — DASHBOARD de chiffres (réalisations) : gros nombres Cormorant en count-up ;
// une jauge sous les métriques en % pour les différencier (pas de grille identique plate).
const STATS_CSS = `
.cca-st{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:78px 5vw 7vh;overflow-y:auto;scrollbar-width:none}
@media (max-height:820px){.cca-st{justify-content:flex-start}}
.cca-st::-webkit-scrollbar{width:0}
.cca-st-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:22px;color:#f4efe6;text-align:center;margin-bottom:20px;opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-st-title{opacity:1;transform:none}
.cca-st-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:14px;max-width:740px;width:100%;margin:0 auto}
.cca-st-tile{background:rgba(244,239,230,.04);border:1px solid rgba(244,239,230,.1);border-radius:16px;padding:20px 18px;display:flex;flex-direction:column;gap:5px;opacity:0;transform:translateY(16px) scale(.98);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1),border-color .2s ease}
.cca-scene-on .cca-st-tile{opacity:1;transform:none}
.cca-st-tile.pct{grid-column:1/-1;background:rgba(230,204,146,.05);border-color:rgba(230,204,146,.22)}
.cca-st-tile.click{cursor:pointer}
.cca-st-tile.click:hover{border-color:rgba(230,204,146,.4)}
.cca-st-ic{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#e6cc92;border:1px solid rgba(230,204,146,.26);background:rgba(230,204,146,.05);margin-bottom:10px}
.cca-st-tile.pct .cca-st-ic{border-color:rgba(230,204,146,.42);background:rgba(230,204,146,.09)}
.cca-st-val{font-family:'Cormorant Garamond','Cormorant',Georgia,serif;font-size:44px;line-height:1;color:#e6cc92;font-weight:600}
.cca-st-label{font-size:12.5px;line-height:1.4;color:rgba(244,239,230,.64)}
.cca-st-note{font-size:11px;color:rgba(244,239,230,.42)}
.cca-st-bar{margin-top:9px;height:3px;border-radius:2px;background:rgba(244,239,230,.1);overflow:hidden}
.cca-st-bar>span{display:block;height:100%;background:#e6cc92;border-radius:2px;width:0;transition:width 1s cubic-bezier(.16,1,.3,1) .25s}
@media (max-width:640px){.cca-st{padding:7vh 6vw 4vh}.cca-st-grid{grid-template-columns:1fr 1fr}.cca-st-val{font-size:38px}}
`;
function StatsPanel({ scene, visible, onFocus }) {
  return (
    <div className="cca-st" style={{ pointerEvents: 'auto' }}>
      <style>{STATS_CSS}</style>
      {scene.title && <div className="cca-st-title">{scene.title}</div>}
      <div className="cca-st-grid">
        {scene.metrics.map((m, i) => {
          const clickable = !!(m.ref && onFocus);
          const open = clickable ? () => onFocus(m.ref) : undefined;
          const pct = /%\s*$/.test(String(m.value));
          const pctNum = pct ? Math.max(0, Math.min(100, parseFloat(String(m.value)) || 0)) : 0;
          const MIc = m.icon ? CARD_ICON_MAP[m.icon] : null;
          return (
            <div key={i} className={`cca-st-tile${pct ? ' pct' : ''}${clickable ? ' click' : ''}`}
              style={{ transitionDelay: `${i * 70 + 150}ms` }}
              onClick={open} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : undefined}>
              {MIc && <span className="cca-st-ic"><MIc size={15} /></span>}
              <div className="cca-st-val"><StatValue raw={m.value} active={visible} /></div>
              <div className="cca-st-label">{m.label}</div>
              {m.note && <div className="cca-st-note">{m.note}</div>}
              {pct && <div className="cca-st-bar"><span style={{ width: visible ? `${pctNum}%` : '0%' }} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// comparateur — TABLEAU comparatif des cycles (tableau sémantique) : colonnes = forfaits,
// lignes = features (✓/–), colonne « le plus choisi » mise en avant, en-tête → focus (choisir).
const COMPARATEUR_CSS = `
.cca-cmp{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:74px 4vw 7vh;overflow-y:auto;scrollbar-width:none}
@media (max-height:860px){.cca-cmp{justify-content:flex-start}}
.cca-cmp::-webkit-scrollbar{width:0}
.cca-cmp-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:22px;color:#f4efe6;text-align:center;opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-cmp-title{opacity:1;transform:none}
.cca-cmp-intro{font-size:13px;color:rgba(244,239,230,.56);text-align:center;margin:5px 0 18px;opacity:0;transition:opacity .5s ease .1s}
.cca-scene-on .cca-cmp-intro{opacity:1}
.cca-cmp-scroll{max-width:720px;width:100%;overflow-x:auto;scrollbar-width:none}
.cca-cmp-scroll::-webkit-scrollbar{height:0}
.cca-cmp-table{border-collapse:collapse;width:100%;min-width:500px}
.cca-cmp-corner{width:32%}
.cca-cmp-ph{vertical-align:bottom;padding:8px 10px 12px;text-align:center;position:relative;opacity:0;transform:translateY(-8px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-cmp-ph{opacity:1;transform:none}
.cca-cmp-ph.pop{background:rgba(230,204,146,.06);border-radius:14px 14px 0 0;box-shadow:inset 0 0 0 1px rgba(230,204,146,.22)}
.cca-cmp-badge{display:inline-block;margin-bottom:6px;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:#2a140c;background:#e6cc92;padding:2px 8px;border-radius:999px}
.cca-cmp-pic{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#e6cc92;border:1px solid rgba(230,204,146,.26);background:rgba(230,204,146,.05);margin:0 auto 8px}
.cca-cmp-pname{display:block;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:14px;color:#f4efe6;font-weight:600}
.cca-cmp-price{display:block;font-family:'Cormorant Garamond','Cormorant',Georgia,serif;font-size:24px;color:#e6cc92;line-height:1.1;margin-top:1px}
.cca-cmp-choose{margin-top:7px;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:#e6cc92;background:transparent;border:1px solid rgba(230,204,146,.32);border-radius:999px;padding:4px 11px;cursor:pointer;transition:background .16s ease,border-color .16s ease}
.cca-cmp-choose:hover{background:rgba(230,204,146,.12);border-color:rgba(230,204,146,.55)}
.cca-cmp-row{opacity:0;transition:opacity .45s ease}
.cca-scene-on .cca-cmp-row{opacity:1}
.cca-cmp-feat{text-align:left;font-size:12.5px;font-weight:400;color:rgba(244,239,230,.74);padding:11px 12px 11px 4px;border-top:1px solid rgba(244,239,230,.08)}
.cca-cmp-cell{text-align:center;padding:11px 10px;border-top:1px solid rgba(244,239,230,.08);font-size:15px}
.cca-cmp-cell.pop{background:rgba(230,204,146,.045)}
.cca-cmp-row:last-child .cca-cmp-cell.pop{border-radius:0 0 14px 14px}
.cca-cmp-yes{color:#e6cc92;font-weight:700}
.cca-cmp-no{color:rgba(244,239,230,.3)}
@media (max-width:640px){.cca-cmp{padding:7vh 4vw 4vh}.cca-cmp-price{font-size:20px}}
`;
function ComparateurScene({ scene, onFocus, glossary, onTerm }) {
  const plans = scene.plans;
  return (
    <div className="cca-cmp" style={{ pointerEvents: 'auto' }}>
      <style>{COMPARATEUR_CSS}</style>
      {scene.title && <div className="cca-cmp-title">{scene.title}</div>}
      {scene.intro && <div className="cca-cmp-intro">{scene.intro}</div>}
      <div className="cca-cmp-scroll">
        <table className="cca-cmp-table">
          <thead>
            <tr>
              <th className="cca-cmp-corner" aria-hidden="true" />
              {plans.map((p, i) => {
                const clickable = !!(p.ref && onFocus);
                const PIc = p.icon ? CARD_ICON_MAP[p.icon] : null;
                return (
                  <th key={i} scope="col" className={`cca-cmp-ph${p.popular ? ' pop' : ''}`} style={{ transitionDelay: `${i * 70 + 160}ms` }}>
                    {p.popular && <span className="cca-cmp-badge">Le plus choisi</span>}
                    {PIc && <span className="cca-cmp-pic"><PIc size={15} /></span>}
                    <span className="cca-cmp-pname">{p.name}</span>
                    {p.value && <span className="cca-cmp-price">{p.value}</span>}
                    {clickable && <button type="button" className="cca-cmp-choose" onClick={() => onFocus(p.ref)}>Choisir →</button>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {scene.rows.map((r, ri) => (
              <tr key={ri} className="cca-cmp-row" style={{ transitionDelay: `${ri * 55 + 260}ms` }}>
                <th scope="row" className="cca-cmp-feat">{glossify(r.feature, glossary, onTerm)}</th>
                {r.has.map((v, ci) => (
                  <td key={ci} className={`cca-cmp-cell${plans[ci] && plans[ci].popular ? ' pop' : ''}`}>
                    {v ? <span className="cca-cmp-yes" aria-label="inclus">✓</span> : <span className="cca-cmp-no" aria-label="non inclus">–</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// faq — ACCORDÉON de questions fréquentes : chaque question se déplie (grid-rows 0fr→1fr = auto
// height fluide), une seule ouverte à la fois, la 1re ouverte par défaut. CSS locale (hex littéraux).
const FAQ_CSS = `
.cca-faq{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:78px 5vw 7vh;overflow-y:auto;scrollbar-width:none}
@media (max-height:820px){.cca-faq{justify-content:flex-start}}
.cca-faq::-webkit-scrollbar{width:0}
.cca-faq-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:22px;color:#f4efe6;text-align:center;margin-bottom:20px;opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-faq-title{opacity:1;transform:none}
.cca-faq-list{width:100%;max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.cca-faq-item{background:rgba(244,239,230,.04);border:1px solid rgba(244,239,230,.1);border-radius:14px;overflow:hidden;opacity:0;transform:translateY(14px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1),border-color .2s ease}
.cca-scene-on .cca-faq-item{opacity:1;transform:none}
.cca-faq-item.open{border-color:rgba(230,204,146,.34);background:rgba(244,239,230,.05)}
.cca-faq-q{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;background:transparent;border:none;cursor:pointer;text-align:left;font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:15.5px;color:#f4efe6;font-weight:600;transition:color .16s ease}
.cca-faq-q:hover{color:#e6cc92}
.cca-faq-chev{flex-shrink:0;color:#e6cc92;transition:transform .3s cubic-bezier(.16,1,.3,1)}
.cca-faq-item.open .cca-faq-chev{transform:rotate(180deg)}
.cca-faq-a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .32s cubic-bezier(.16,1,.3,1)}
.cca-faq-item.open .cca-faq-a{grid-template-rows:1fr}
.cca-faq-a>div{overflow:hidden}
.cca-faq-a-txt{padding:0 18px 16px;margin:0;font-size:13.5px;line-height:1.6;color:rgba(244,239,230,.7)}
@media (max-width:640px){.cca-faq{padding:7vh 5vw 4vh}.cca-faq-q{font-size:14.5px;padding:14px 15px}}
`;
// ── Glossaire cliquable : glossify(text, glossary, onTerm) wrappe les termes de domaine (mot ENTIER,
//    accents/casse ignorés via repli NFD + index-map, 1re occ/terme, cap 4, longest-first) → GlossTerm
//    → tiroir focus. PUR, ne throw jamais ; texte sans terme (ou glossaire vide) = inchangé.
const GLOSS_CSS = `
.cca-gloss{display:inline;padding:0;margin:0;border:0;background:none;font:inherit;color:inherit;cursor:help;text-decoration:underline;text-decoration-style:dotted;text-decoration-thickness:1px;text-underline-offset:3px;text-decoration-color:rgba(230,204,146,.55);border-radius:3px;transition:color .16s ease,text-decoration-color .16s ease}
.cca-gloss:hover{color:#e6cc92;text-decoration-color:#e6cc92}
.cca-gloss:focus-visible{outline:2px solid rgba(230,204,146,.6);outline-offset:2px;color:#e6cc92}
@media (prefers-reduced-motion:reduce){.cca-gloss{transition:none}}
`;
function GlossTerm({ term, onTerm }) {
  return (
    <button type="button" className="cca-gloss" onClick={(e) => { e.stopPropagation(); onTerm(); }}
      aria-label={`Définition : ${term}`} title={`Définition : ${term}`}>{term}</button>
  );
}
// Repli accent/casse-insensible AVEC map d'index vers le texte source (NFD change la longueur).
function glossFold(str) {
  let folded = ''; const map = [];
  for (let i = 0; i < str.length; i += 1) {
    const f = str[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (let k = 0; k < f.length; k += 1) { folded += f[k]; map.push(i); }
  }
  map.push(str.length);
  return { folded, map };
}
const glossIsWord = (c) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
function glossify(text, glossary, onTerm) {
  try {
    if (typeof text !== 'string' || !text) return [text];
    if (!Array.isArray(glossary) || !glossary.length || typeof onTerm !== 'function') return [text];
    const CAP = 4;
    const { folded, map } = glossFold(text);
    const forms = [];
    for (const g of glossary) {
      if (!g || typeof g.term !== 'string' || !g.term.trim() || typeof g.def !== 'string') continue;
      const { folded: ff } = glossFold(g.term);
      if (ff) forms.push({ key: g.term, term: g.term, def: g.def, ff, len: ff.length });
    }
    forms.sort((a, b) => b.len - a.len); // longest-match-first
    const usedKeys = new Set(); const occupied = []; const hits = [];
    const overlaps = (s, e) => occupied.some(([a, b]) => s < b && e > a);
    for (const f of forms) {
      if (hits.length >= CAP) break;
      if (usedKeys.has(f.key)) continue;
      let from = 0; let idx;
      while ((idx = folded.indexOf(f.ff, from)) !== -1) {
        const end = idx + f.ff.length;
        const before = idx > 0 ? folded[idx - 1] : undefined;
        const after = end < folded.length ? folded[end] : undefined;
        if (!glossIsWord(before) && !glossIsWord(after) && !overlaps(idx, end)) {
          occupied.push([idx, end]); usedKeys.add(f.key);
          hits.push({ s: map[idx], e: map[end], term: f.term, def: f.def });
          break; // une seule occurrence de CE terme
        }
        from = idx + 1;
      }
    }
    if (!hits.length) return [text];
    hits.sort((a, b) => a.s - b.s);
    const out = []; let cursor = 0;
    hits.forEach((h, i) => {
      if (h.s > cursor) out.push(text.slice(cursor, h.s));
      const label = text.slice(h.s, h.e); // libellé tel qu'écrit (casse/accents d'origine)
      out.push(<GlossTerm key={`g${i}-${h.s}`} term={label} onTerm={() => onTerm(h.term, h.def)} />);
      cursor = h.e;
    });
    if (cursor < text.length) out.push(text.slice(cursor));
    return out;
  } catch { return [typeof text === 'string' ? text : '']; }
}

function FaqScene({ scene, glossary, onTerm }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="cca-faq" style={{ pointerEvents: 'auto' }}>
      <style>{FAQ_CSS}</style>
      {scene.title && <div className="cca-faq-title">{scene.title}</div>}
      <div className="cca-faq-list">
        {scene.items.map((it, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={`cca-faq-item${isOpen ? ' open' : ''}`} style={{ transitionDelay: `${i * 55 + 140}ms` }}>
              <button type="button" className="cca-faq-q" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
                <span>{it.q}</span>
                <svg className="cca-faq-chev" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <div className="cca-faq-a"><div><p className="cca-faq-a-txt">{glossify(it.a, glossary, onTerm)}</p></div></div>
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
.cca-focus-back{position:fixed;inset:0;background:rgba(10,10,9,.76);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:40;display:flex;align-items:center;justify-content:center;padding:22px;box-sizing:border-box}
.cca-focus{width:min(520px,94vw);max-height:84vh;overflow-y:auto;scrollbar-width:none;background:#262320;border:1px solid rgba(230,204,146,.28);border-radius:22px;padding:24px 24px 26px;box-shadow:0 34px 90px -22px rgba(0,0,0,.75),0 0 0 1px rgba(230,204,146,.06);animation:ccaFocusIn .3s cubic-bezier(.16,1,.3,1) both}
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
// Historique de conversation + navigation rapide (realm tenant). Le flux central ne garde pas les
// échanges → ce panneau « messagerie » (droite) les liste tous, et le mini-rail permet d'y sauter.
const CONV_CSS = `
@keyframes ccaConvIn{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}
.cca-conv-back{position:fixed;inset:0;z-index:44;background:rgba(12,12,11,.42);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
.cca-conv{position:fixed;top:0;right:0;bottom:0;z-index:45;width:min(384px,92vw);background:#211f1d;border-left:1px solid rgba(230,204,146,.16);box-shadow:-24px 0 70px -24px rgba(0,0,0,.7);display:flex;flex-direction:column;animation:ccaConvIn .3s cubic-bezier(.16,1,.3,1) both}
.cca-conv-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:18px 18px 13px;border-bottom:1px solid rgba(244,239,230,.08)}
.cca-conv-title{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:16px;color:#f4efe6;font-weight:600}
.cca-conv-close{background:none;border:none;color:rgba(244,239,230,.5);cursor:pointer;padding:4px;display:inline-flex}
.cca-conv-close:hover{color:#f4efe6}
.cca-conv-list{flex:1;overflow-y:auto;padding:13px 14px 22px;scrollbar-width:none;display:flex;flex-direction:column;gap:8px}
.cca-conv-list::-webkit-scrollbar{width:0}
.cca-conv-turn{text-align:left;background:rgba(244,239,230,.03);border:1px solid rgba(244,239,230,.08);border-radius:13px;padding:11px 13px;cursor:pointer;transition:background .16s ease,border-color .16s ease;display:flex;flex-direction:column;gap:4px;font-family:inherit}
.cca-conv-turn:hover{background:rgba(244,239,230,.06);border-color:rgba(230,204,146,.28)}
.cca-conv-turn.on{border-color:rgba(230,204,146,.5);background:rgba(230,204,146,.07)}
.cca-conv-idx{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:9px;font-weight:800;letter-spacing:.08em;color:rgba(230,204,146,.6)}
.cca-conv-q{font-family:'Fraunces','Source Serif 4',Georgia,serif;font-size:13.5px;color:#f4efe6;line-height:1.35}
.cca-conv-a{font-size:12px;color:rgba(244,239,230,.55);line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cca-mini{position:absolute;top:50%;right:15px;transform:translateY(-50%);z-index:6;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:auto}
.cca-mini-dot{height:2px;width:16px;border-radius:2px;background:rgba(244,239,230,.26);cursor:pointer;transition:width .2s ease,background .2s ease;padding:0;border:none}
.cca-mini-dot:hover{background:rgba(244,239,230,.6);width:24px}
.cca-mini-dot.on{background:#e6cc92;width:30px;height:2.5px}
@media (max-width:640px){.cca-mini{display:none}}
`;
function ConvPanel({ turns, curTurn, onGo, onClose }) {
  return (
    <div className="cca-conv-back" onClick={onClose}>
      <div className="cca-conv" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Votre conversation">
        <div className="cca-conv-head">
          <span className="cca-conv-title">Votre conversation</span>
          <button type="button" className="cca-conv-close" onClick={onClose} aria-label="Fermer"><X size={17} /></button>
        </div>
        <div className="cca-conv-list">
          {turns.map((t, i) => (
            <button key={t.id} type="button" className={`cca-conv-turn${i === curTurn ? ' on' : ''}`} onClick={() => onGo(i)}>
              <span className="cca-conv-idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="cca-conv-q">{t.q}</span>
              {t.reply && <span className="cca-conv-a">{t.reply}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function MiniNav({ turns, curTurn, onGo }) {
  if (turns.length < 2) return null;
  return (
    <div className="cca-mini" aria-label="Navigation rapide de la conversation">
      {turns.map((t, i) => (
        <button key={t.id} type="button" className={`cca-mini-dot${i === curTurn ? ' on' : ''}`} title={t.q}
          aria-label={`Aller à : ${t.q}`} onClick={(e) => { e.stopPropagation(); onGo(i); }} />
      ))}
    </div>
  );
}

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
        {item.tiers && item.tiers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            {item.tiers.map((t) => (
              t.link ? (
                <a key={t.label} className="cca-focus-act" href={t.link} target="_blank" rel="noopener noreferrer" onClick={onClose} style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{t.label}{t.price ? ` · ${t.price}` : ''}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>S'abonner <ArrowRight size={15} /></span>
                </a>
              ) : (
                <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 15px', borderRadius: 12, border: '1px solid rgba(230,204,146,.16)', color: 'rgba(244,239,230,.7)', fontSize: 13.5 }}>
                  <span>{t.label}{t.price ? ` · ${t.price}` : ''}</span>
                  <span style={{ color: GOLD, fontWeight: 600 }}>Gratuit</span>
                </div>
              )
            ))}
          </div>
        )}
        {item.actions && item.actions.length > 0 && (
          <div className="cca-focus-actions">
            {item.actions.map((a, i) => {
              const m = VNP_ACTION_META[a];
              if (!m) return null;
              // Si des paliers sont listés ci-dessus (chacun son « S'abonner »), on masque le bouton générique.
              if (a === 'acheter' && item.tiers && item.tiers.length) return null;
              // Forfait avec un Payment Link (Cimolace) : « Acheter » → lien DIRECT vers le checkout
              // Stripe hébergé (nouvel onglet), sans passer par l'edge.
              if (a === 'acheter' && item.link) {
                return (
                  <a key={a} className="cca-focus-act" href={item.link} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><m.Icon size={17} /> S'abonner</span>
                    <ArrowRight size={16} />
                  </a>
                );
              }
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

function ReaderView({ scene, idx, setIdx, onSuggest, hooks, glossary, onTerm }) {
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
        <div className="cca-reader-avatar">{avatarFromSeed(profile.avatarSeed || profile.name)}</div>
        <div className="cca-reader-name">{profile.name}</div>
        {profile.role && <div className="cca-reader-role">{profile.role}</div>}
        {(profile.facts || []).length > 0 && <div className="cca-reader-pdiv"><span /></div>}
        {(profile.facts || []).map((f, i) => {
          const Ic = readerIcon(i);
          return (
            <div key={i} className="cca-reader-fact">
              <span className="cca-reader-fic"><Ic size={16} /></span>
              <div className="cca-reader-fbody"><span>{f.k}</span><b>{f.v}</b></div>
            </div>
          );
        })}
      </div>
      <div className="cca-reader-body" ref={scrollRef} onScroll={onScroll}>
        <h2 className="cca-reader-title">{scene.title}</h2>
        <div className="cca-reader-rule"><span /></div>
        {scene.body.map((s, i) => {
          const Ic = readerIcon(i);
          return (
            <section key={i} id={`cca-sec-${i}`}>
              <div className="cca-reader-sechead">
                <span className="cca-reader-sic"><Ic size={19} /></span>
                <h4 className="cca-reader-h">{s.h}</h4>
              </div>
              {s.p.split('\n\n').map((para, j) => (<p key={j} className="cca-reader-p">{glossify(para, glossary, onTerm)}</p>))}
            </section>
          );
        })}
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

export default function CimolaceCreationAgent({ tenantSlug: tenantSlugProp = null, embedded = false } = {}) {
  const navigate = useNavigate();
  const { login, signup, ensureStudentMembership, user } = useAuth();

  // L8-P1 — realm : si un tenant est ciblé, l'OS REND ce tenant (même moteur, autre identité) au lieu
  // du tunnel de création Cimolace. isTenantRealm gate tout le flux « créer une org Cimolace ».
  const osTenant = getOsRealmSlug(tenantSlugProp);
  const isCimolaceRealm = osTenant === 'cimolace'; // Cimolace lui-même : guide VNP + tunnel de création.
  // funnelMode : dans le realm Cimolace, « Créer ma plateforme » bascule du guide VNP vers le tunnel de
  // création (= comportement Cimolace historique, isTenantRealm=false). JAMAIS activé hors Cimolace,
  // donc le realm tenant (prorascience) est strictement inchangé.
  const [funnelMode, setFunnelMode] = useState(false);
  const isTenantRealm = !!osTenant && !funnelMode;
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

  // KNOWLEDGE OS depuis la BASE (tenants.metadata.os_knowledge) — le contenu du realm n'est plus
  // hardcodé : l'agent Cimolace OS rend À PARTIR DE LA BASE (éditable, multi-tenant). Fallback sur
  // OS_KNOWLEDGE embarqué si la base ne renvoie rien (zéro régression).
  const [osKnowledge, setOsKnowledge] = useState(null);
  useEffect(() => {
    if (!osTenant) return undefined;
    let alive = true;
    fetch(`${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(osTenant)}/os-knowledge`)
      .then((r) => r.json()).then((b) => {
        const k = (b && b.data !== undefined) ? b.data : b;
        if (alive && k && typeof k === 'object' && k.identity) setOsKnowledge(k);
      }).catch(() => {});
    return () => { alive = false; };
  }, [osTenant]);
  // SOURCE DE VÉRITÉ du contenu du realm : base d'abord, fallback hardcodé ensuite.
  const activeKnowledge = osKnowledge || (osTenant ? OS_KNOWLEDGE_ALL[osTenant] : null) || null;
  const knowledgeRef = useRef(null);
  knowledgeRef.current = activeKnowledge; // callbacks : lecture toujours à jour, sans re-création

  // SEO du realm tenant (prorascience.org) : titre/description/OG/JSON-LD PROPRES au fondateur,
  // injectés côté client par react-helmet (utile pour Googlebot, qui rend le JS). ⚠️ Les scrapers
  // sociaux ne lisant PAS le JS, l'aperçu de partage complet exige en plus une injection <head>
  // host-aware à l'edge (cf. docs/SEO_EDGE_PRORASCIENCE.md). Ne rend RIEN hors realm tenant.
  const tenantSeo = useMemo(() => {
    if (!isTenantRealm) return null;
    const k = activeKnowledge;
    const id = (k && k.identity) || {};
    const name = (osBrand && osBrand.name) || id.name || 'Prorascience';
    const host = String(id.website || 'prorascience.org').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const site = `https://${host}`;
    const subtitle = (id.subtitle || '').replace(/\.\s*$/, '');
    const title = subtitle ? `${name} — ${subtitle}` : name;
    const description = (
      `${id.fullName ? id.fullName + '. ' : ''}L’étude rationnelle et vérifiable des réalités ` +
      `visibles et invisibles : comprendre, maîtriser, puis évoluer.`
    );
    const founder = (k && k.founder) || null;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: id.name || name,
      alternateName: id.fullName || undefined,
      url: site,
      logo: `${site}/prorascience-eye.png`,
      description,
      ...(founder ? { founder: { '@type': 'Person', name: founder.name, jobTitle: founder.title } } : {}),
    };
    return { title, siteName: name, description, image: `${site}/og.png`, canonical: `${site}/`, jsonLd };
  }, [isTenantRealm, osTenant, osBrand, activeKnowledge]);

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
    () => activeKnowledge ? buildVnpGraph(activeKnowledge, (osBrand && osBrand.name) || osTenant) : null,
    [osTenant, osBrand, activeKnowledge],
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
  const [signupForm, setSignupForm] = useState(null);   // Inscription INLINE (l'OS possède l'identité) : {name,email,password,sending,sent,error} | null
  const [authForm, setAuthForm] = useState(null);       // Connexion INLINE : {email,password,sending,error} | null
  const [plansPanel, setPlansPanel] = useState(null);   // Achat INLINE : les 4 cycles du tenant DANS l'OS (jamais de saut dur vers /forfaits) : { loading, plans, error } | null
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

  // HISTORIQUE DE CONVERSATION (realm tenant) : chaque échange = 1 tour navigable. Alimente le
  // panneau latéral (messagerie), le mini-rail de navigation rapide et le Retour (recule d'un tour).
  const [turns, setTurns] = useState([]);       // [{ id, q, reply, scene }]
  const [curTurn, setCurTurn] = useState(-1);   // tour affiché (-1 = accueil)
  const [histOpen, setHistOpen] = useState(false);
  const turnSeqRef = useRef(0);
  const pushTurn = useCallback((entry) => {
    setTurns((prev) => [...prev, { id: (turnSeqRef.current += 1), ...entry }].slice(-50));
  }, []);
  // Chaque nouveau tour → on l'affiche (dernier index). La navigation manuelle (goToTurn) écrase ensuite.
  useEffect(() => { setCurTurn(turns.length - 1); }, [turns.length]);

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
    const beats = buildTenantTour(knowledgeRef.current || undefined, (osBrand && osBrand.name) || osTenant);
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

  // MON ESPACE — connecté → son portail LIRI ; déconnecté → CONNEXION EN LIGNE dans l'OS
  // (jamais de saut vers /login : l'OS possède l'identité, comme le contact/RDV).
  const goToSpace = useCallback(() => {
    try { logEvent('mon_espace', {}, osTenant); } catch { /* non bloquant */ }
    setHistOpen(false); closeInput();
    if (user?.id) {
      speak('Je vous emmène à votre espace — un instant.');
      setTimeout(() => navigate('/liri'), 650);
      return;
    }
    setContactForm(null); setBookingForm(null); setSignupForm(null);
    speak('Content de vous revoir. Connectez-vous ici même.');
    setEngaged(true);
    setAuthForm({ email: '', password: '', sending: false, error: '' });
  }, [osTenant, speak, navigate, closeInput, user]);

  // CRÉER UN COMPTE — INSCRIPTION EN LIGNE dans l'OS (jamais de saut vers /signup). Le compte
  // est rattaché au tenant par le HOST (RPC ensure_student_membership) dans submitSignup.
  const goToSignup = useCallback(() => {
    try { logEvent('creer_compte', {}, osTenant); } catch { /* non bloquant */ }
    setHistOpen(false); closeInput();
    setContactForm(null); setBookingForm(null); setAuthForm(null);
    speak("Parfait — créons votre espace. Un e-mail, un mot de passe, et c'est à vous.");
    setEngaged(true);
    setSignupForm({ name: '', email: '', password: '', sending: false, sent: false, error: '' });
  }, [osTenant, speak, closeInput]);

  // B — INTENTION D'AUTH depuis l'URL (?auth=login|signup). /login (repli) renvoie l'utilisateur
  // déconnecté ICI → l'OS ouvre AUTOMATIQUEMENT son formulaire inline (une seule fois). Realm tenant only.
  const authIntentRef = useRef(false);
  useEffect(() => {
    if (authIntentRef.current || !isTenantRealm) return;
    let intent = null;
    try { intent = new URLSearchParams(window.location.search).get('auth'); } catch { /* ignore */ }
    if (intent !== 'login' && intent !== 'signup') return;
    authIntentRef.current = true;
    if (intent === 'signup') goToSignup(); else goToSpace();
  }, [isTenantRealm, goToSpace, goToSignup]);

  // CHOISIR UN FORFAIT — les 4 cycles du tenant rendus DANS l'OS (jamais de saut dur vers /forfaits, qui
  // détruisait l'expérience). Prix lus depuis billing_plans (source de vérité). Chaque « S'abonner » ouvre
  // le checkout ÉPROUVÉ (/t/:slug/paiement — Stripe + Mobile Money, checkout invité) dans un NOUVEL onglet,
  // pour que l'OS reste vivant derrière.
  const openForfaits = useCallback(async () => {
    try { logEvent('voir_forfaits', {}, osTenant); } catch { /* non bloquant */ }
    setHistOpen(false); closeInput(); exitScene(); // referme la scène comparateur pour ne pas la superposer
    setContactForm(null); setBookingForm(null); setSignupForm(null); setAuthForm(null);
    setEngaged(true);
    setPlansPanel({ loading: true, plans: [], error: '' });
    speak('Quatre chemins, quatre niveaux d’accès. Choisissez le vôtre — le paiement est sécurisé.');
    try {
      const { data, error } = await supabase.from('billing_plans')
        .select('key,label,price_cents,currency,is_active')
        .eq('is_active', true).order('price_cents', { ascending: true });
      if (error) throw error;
      const ORDER = ['autonome', 'academique', 'prive', 'privilegie'];
      const plans = (data || [])
        .filter((p) => /^(autonome|academique|prive|privilegie)-monthly$/.test(String(p.key || '').toLowerCase()))
        .map((p) => ({ key: p.key, label: p.label, cycle: String(p.key).toLowerCase().replace(/-monthly$/, ''),
          price: Math.round(Number(p.price_cents || 0) / 100), currency: p.currency || 'EUR' }))
        .sort((a, b) => ORDER.indexOf(a.cycle) - ORDER.indexOf(b.cycle));
      setPlansPanel({ loading: false, error: plans.length ? '' : 'unavailable', plans });
    } catch (_) {
      setPlansPanel({ loading: false, plans: [], error: 'unavailable' });
    }
  }, [osTenant, speak, closeInput, exitScene]);

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
      const knowledge = knowledgeRef.current ? prorascienceKnowledgeText(knowledgeRef.current) : '';
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
    const sc = VNP_SCENES_V2 ? normalizeScene(buildNodeScene(nodeId, knowledgeRef.current)) : null;
    if (sc) { pushTurn({ q: n.title, reply: n.summary || n.title, scene: sc }); enterScene(sc, () => speak(n.summary || n.title)); return; }
    const flat = `${n.summary} ${n.content}`.replace(/\s+/g, ' ').trim().slice(0, 340) || n.title;
    pushTurn({ q: n.title, reply: flat, scene: null });
    speak(flat);
  }, [vnpGraph, speak, osTenant, runEffects, enterScene, pushTurn]);

  // MODE FOCUS — cliquer un élément (carte) ouvre le tiroir d'approfondissement inline.
  const openFocus = useCallback((ref) => {
    if (!ref) return;
    setFocusItem(ref);
    try { logEvent('focus_open', { kind: ref.kind || '', title: ref.title || '' }, osTenant); } catch { /* non bloquant */ }
  }, [osTenant]);

  // GLOSSAIRE cliquable : le pack de termes du tenant + le handler qui RÉUTILISE le tiroir focus.
  const osGlossary = useMemo(
    () => (isTenantRealm && activeKnowledge && Array.isArray(activeKnowledge.glossary)) ? activeKnowledge.glossary : [],
    [isTenantRealm, osTenant, activeKnowledge],
  );
  const handleTerm = useCallback((term, def) => { openFocus({ kind: 'info', title: term, note: def }); }, [openFocus]);

  // Réponse à une QUESTION LIBRE via l'edge VNP (résout intention + nœud + suggestions + actions).
  const vnpChat = useCallback(async (message) => {
    // MEMBRE QUI REVIENT : une question de connexion → on l'emmène à son espace (pas l'edge).
    if (isTenantRealm && LOGIN_RE.test(message)) { setEngaged(true); goToSpace(); return; }
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
      // Réponse DESIGNÉE. PRIORITÉ à la SCÈNE COMPOSÉE par l'edge (l'orchestrateur choisit le layout
      // le mieux adapté à CETTE question) — restreinte aux types NARRATIFS (EDGE_OK) : le LLM ne
      // fabrique JAMAIS prix/chiffres/comparatifs (ceux-ci passent par buildNodeScene = donnée vérifiée).
      // Repli : scène du nœud (mapping figé) → narration plate. normalizeScene reste l'autorité finale.
      const EDGE_OK = { aside: 1, split: 1, reader: 1, tutorial: 1, timeline: 1 };
      // Nœuds DONNÉE (prix/chiffres/comparatif) : TOUJOURS via buildNodeScene (rendu complet + vérifié).
      // On refuse une scène composée si l'edge a ciblé un de ces nœuds OU si elle contient un motif de
      // prix (€, /mois…) — sinon le LLM peut glisser un aside de forfaits TRONQUÉ (cap 4 items) au lieu
      // des cartes complètes. Garde-fou double : nœud-donnée + scan de prix.
      const DATA_NODES = { produits: 1, realisations: 1, solutions: 1, faq: 1 };
      const onTop = data?.onTopic !== false;
      const sceneHasPrice = (() => { try { return /[€£$]|\/\s?mois|\/\s?an|\btarif|\bprix\b/i.test(JSON.stringify(data?.scene || '')); } catch { return false; } })();
      const edgeScene = (VNP_SCENES_V2 && onTop && data?.scene && EDGE_OK[data.scene.type] && !DATA_NODES[data?.nodeId] && !sceneHasPrice)
        ? normalizeScene(data.scene) : null;
      const nodeScene = (!edgeScene && VNP_SCENES_V2 && onTop && data?.nodeId)
        ? normalizeScene(buildNodeScene(data.nodeId, knowledgeRef.current)) : null;
      const sc = edgeScene || nodeScene;
      pushTurn({ q: message, reply, scene: sc || null });
      if (sc) enterScene(sc, () => speak(reply)); else speak(reply);
      if (edgeScene) { try { logEvent('vnp_scene_composed', { type: edgeScene.type }, osTenant); } catch { /* non bloquant */ } }
    } catch (_) {
      if (brainGenRef.current !== gen) return;
      // RÉSILIENCE (audit) : l'edge/LLM est momentanément indisponible, or la conversation est la SEULE
      // navigation de l'OS → on ne laisse JAMAIS le visiteur dans un cul-de-sac. Repli sur le GRAPHE
      // LOCAL : les clics de sujet (vnpOpenNode) et le formulaire de contact sont DÉTERMINISTES (zéro
      // appel edge) → le visiteur peut continuer à explorer et à convertir sans le LLM.
      const localNodes = g
        ? (g.order || []).map((id) => g.byId(id)).filter(Boolean)
            .filter((nn) => nn.id !== 'contact' && nn.id !== 'support')
            .slice(0, 4).map((nn) => ({ nodeId: nn.id, label: nn.title }))
        : [];
      setVnpSuggest(localNodes);
      setVnpActs(['contacter']); // le formulaire de contact s'ouvre en local, sans edge
      speak(localNodes.length
        ? `Je n'ai pas pu traiter votre demande à l'instant — mais vous pouvez explorer directement : choisissez un sujet ci-dessous, ou écrivez-nous.`
        : `Un souci temporaire de mon côté — réessayez dans un instant.`);
    }
  }, [vnpGraph, osBrand, osTenant, speak, sThink, enterScene, pushTurn, isTenantRealm, goToSpace]);

  // ACTION ENGINE — EXÉCUTE une action métier pour de vrai (pas un accusé de réception) :
  //  • contacter/participer → mini-formulaire inline, livré dans la table contact_requests (mailbox) ;
  //  • acheter/rejoindre/réserver → on annonce puis on emmène vers la VRAIE page /forfaits (Stripe/PawaPay).
  const vnpAction = useCallback(async (actionId, label) => {
    setError(''); setEngaged(true); setVnpActs([]);
    if (actionId === '__detail__') { if (protocolRef.current) runEffects(protocolRef.current.dispatch({ type: 'WANT_DETAIL' }).effects); return; }
    // Cimolace : « Créer ma plateforme » quitte le guide VNP pour le tunnel de création (funnelMode).
    if (actionId === 'creer_plateforme') { setFunnelMode(true); setStep('discovery'); return; }
    if (actionId === 'contacter' || actionId === 'participer') {
      setContactForm({ name: '', email: '', message: '', subject: `Contact via l'assistant ${(osBrand && osBrand.name) || osTenant}`, sending: false, sent: false, error: '' });
      return;
    }
    if (actionId === 'reserver') { // RDV : sélecteur de créneaux inline (dans la conversation)
      setBookingForm({ service: 'Consultation privée', slotIso: '', name: '', email: '', sending: false, sent: false, error: '' });
      return;
    }
    // Acheter / Rejoindre = devenir membre → les forfaits s'affichent DANS l'OS (jamais de saut vers /forfaits).
    if (actionId === 'acheter' || actionId === 'rejoindre') { openForfaits(); return; }
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
      if (kind === 'checkout') { openForfaits(); return; }                 // Forfaits INLINE (remplace le saut dur vers /forfaits qui détruisait l'OS)
      if (kind === 'booking') {                                            // RDV inline (repli si non intercepté plus haut)
        setBookingForm({ service: data?.next?.target || 'Consultation privée', slotIso: '', name: '', email: '', sending: false, sent: false, error: '' });
        return;
      }
      speak(msg);
    } catch (_) {
      if (brainGenRef.current !== gen) return;
      speak('Un instant — réessayons dans un moment.');
    }
  }, [osBrand, osTenant, speak, sThink, openForfaits]);

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

  // Inscription INLINE — l'OS crée le compte (signup tenant-aware par host) SANS quitter l'expérience.
  const submitSignup = useCallback(async () => {
    const f = signupForm; if (!f || f.sending) return;
    const email = (f.email || '').trim();
    const password = f.password || '';
    if (!/.+@.+\..+/.test(email)) { setSignupForm((c) => ({ ...c, error: "Une adresse e-mail valide, s'il vous plaît." })); return; }
    if (password.length < 6) { setSignupForm((c) => ({ ...c, error: "Un mot de passe d'au moins 6 caractères." })); return; }
    setSignupForm((c) => ({ ...c, sending: true, error: '' }));
    try {
      const { data, error } = await signup(email, password, { name: (f.name || '').trim() });
      if (error) throw error;
      if (data?.session?.user) { try { await ensureStudentMembership(data.session.user); } catch { /* non bloquant */ } }
      setSignupForm((c) => ({ ...c, sending: false, sent: true }));
      try { logEvent('signup_inline', {}, osTenant); } catch { /* non bloquant */ }
      speak(`Bienvenue${f.name ? `, ${f.name.trim()}` : ''} — votre espace ${(osBrand && osBrand.name) || osTenant} est prêt.`);
      setTimeout(() => navigate('/liri'), 1500);
    } catch (e) {
      const msg = String(e?.message || '');
      setSignupForm((c) => ({ ...c, sending: false, error: /registered|already/i.test(msg) ? 'Cet e-mail a déjà un compte — connectez-vous.' : 'Inscription impossible — réessayez.' }));
    }
  }, [signupForm, signup, ensureStudentMembership, osTenant, osBrand, speak, navigate]);

  // Connexion INLINE — l'OS ouvre la session SANS naviguer vers /login.
  const submitLogin = useCallback(async () => {
    const f = authForm; if (!f || f.sending) return;
    const email = (f.email || '').trim();
    const password = f.password || '';
    if (!/.+@.+\..+/.test(email) || !password) { setAuthForm((c) => ({ ...c, error: "E-mail et mot de passe, s'il vous plaît." })); return; }
    setAuthForm((c) => ({ ...c, sending: true, error: '' }));
    try {
      const { error } = await login(email, password);
      if (error) throw error;
      try { logEvent('login_inline', {}, osTenant); } catch { /* non bloquant */ }
      speak('Content de vous revoir — je vous emmène à votre espace.');
      setTimeout(() => navigate('/liri'), 800);
    } catch (e) {
      setAuthForm((c) => ({ ...c, sending: false, error: 'Identifiants incorrects — réessayez.' }));
    }
  }, [authForm, login, osTenant, speak, navigate]);

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

  // Rejouer un tour de conversation (clic sur le rail/panneau) : restaure sa scène + sa voix.
  const goToTurn = useCallback((i) => {
    const t = turns[i]; if (!t) return;
    sPop(); setError(''); setBusy(false); closeInput(); stopTour(); stopLesson(); setPendingLesson(false);
    setHistOpen(false); setEngaged(true); setContactForm(null); setBookingForm(null); setFocusItem(null);
    setCurTurn(i);
    if (t.scene) enterScene(t.scene, () => speak(t.reply)); else { exitScene(); speak(t.reply); }
  }, [turns, sPop, closeInput, stopTour, stopLesson, enterScene, exitScene, speak]);

  const goBack = useCallback(() => {
    sPop();
    setError('');
    setBusy(false);
    closeInput();
    stopTour(); stopLesson();
    setPendingLesson(false);
    setHistOpen(false);
    // Realm TENANT : le Retour recule dans l'HISTORIQUE (jamais vers le tunnel Cimolace).
    if (isTenantRealm) {
      setContactForm(null); setBookingForm(null); setFocusItem(null);
      if (curTurn > 0 && turns[curTurn - 1]) { goToTurn(curTurn - 1); return; }
      exitScene(); setCurTurn(-1); setEngaged(false); // → accueil éditorial (hero)
      return;
    }
    exitScene();
    if (step === 'product' || step === 'brain') { setStep('discovery'); speak(GREETING); }
    else if (step === 'brand_ask') { setStep('product'); speak(PRODUCT[chosen].reply); }
    else if (step === 'brand_confirm') { setStep('brand_ask'); speak("Quel nom pour votre organisation ?", () => openInput()); }
    else if (step === 'account') { setStep('brand_confirm'); speak(`On reprend — cimolace.space/t/${slug}. On continue ?`); }
  }, [isTenantRealm, curTurn, turns, goToTurn, step, chosen, slug, sPop, closeInput, speak, openInput, exitScene, stopTour, stopLesson]);

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
  const showSplitAction = isTenantRealm && !!(contactForm || bookingForm || signupForm || authForm || plansPanel);
  // Scène plein écran (split/reader/tutorial) : la voix centrale + actions en flux s'effacent,
  // la scène porte le message ; `aside` garde la voix au centre.
  const fullscreenScene = !!scene && scene.type !== 'aside';
  const tourTotal = tourActive ? ((tourRef.current && tourRef.current.beats.length) || (TOUR[chosen] || []).length) : 0; // points de progression (tenant ou Cimolace)

  return (
    <div
      ref={rootRef}
      onClick={onRootClick}
      className={inputOpen ? 'cca-input-open' : undefined}
      style={{
        minHeight: embedded ? '100%' : '100vh', height: embedded ? '100%' : undefined,
        background: bg, transition: 'background .8s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', padding: '0 24px',
        fontFamily: "'Inter', system-ui, sans-serif", cursor: inputOpen || !inputAllowed ? 'default' : 'text',
      }}
    >
      <style>{STYLE}</style>
      <style>{GLOSS_CSS}</style>

      {/* SEO du realm fondateur (prorascience.org) — titre/description/OG/JSON-LD propres, sans « LIRI ».
         Ne monte QUE dans le realm tenant : le realm Cimolace (app.cimolace.space) garde son <head> par défaut. */}
      {!embedded && tenantSeo && (
        <SEO
          title={tenantSeo.title}
          siteName={tenantSeo.siteName}
          description={tenantSeo.description}
          image={tenantSeo.image}
          canonical={tenantSeo.canonical}
          jsonLd={tenantSeo.jsonLd}
        />
      )}

      {/* Particules ambiantes — le vide « respire » même au repos */}
      <span className="cca-amb" style={{ width: 5, height: 5, top: '34%', left: '32%', opacity: 0.16, animation: 'ccaDriftA 11s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 4, height: 4, top: '58%', left: '65%', opacity: 0.13, background: '#e6cc92', animation: 'ccaDriftB 14s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 3, height: 3, top: '44%', left: '70%', opacity: 0.12, animation: 'ccaDriftC 9s ease-in-out infinite' }} />

      {/* L6 — Scène « réalisée » par l'IA : composition de toute la surface (fond, sous la voix).
         Realm tenant (prorascience) : rendre dès qu'une scène existe (le step Cimolace n'y vit pas). */}
      {scene && (isTenantRealm || step === 'brain' || step === 'product') && (
        <SceneStage scene={scene} visible={sceneVisible} readerIdx={readerIdx} setReaderIdx={setReaderIdx}
          onSuggest={isTenantRealm ? vnpChat : brain} onCta={isTenantRealm ? vnpChat : chooseProduct}
          hooks={isTenantRealm ? [] : brainHooks} onHook={isTenantRealm ? vnpChat : brain} onFocus={openFocus}
          suggest={isTenantRealm ? vnpSuggest : []} acts={isTenantRealm ? vnpActs : []}
          onNode={vnpOpenNode} onAct={vnpAction}
          glossary={osGlossary} onTerm={handleTerm} />
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

      {/* NAVIGATION DE CONVERSATION (realm tenant) : mini-rail rapide (bord droit) + panneau messagerie */}
      {isTenantRealm && (<style>{CONV_CSS}</style>)}
      {isTenantRealm && engaged && !histOpen && !contactForm && !bookingForm && !signupForm && !authForm && !plansPanel && (
        <MiniNav turns={turns} curTurn={curTurn} onGo={goToTurn} />
      )}
      {isTenantRealm && histOpen && turns.length > 0 && (
        <ConvPanel turns={turns} curTurn={curTurn} onGo={goToTurn} onClose={() => setHistOpen(false)} />
      )}

      {/* Écrire — affordance TOUJOURS accessible pour (ré)ouvrir la saisie (anti-blocage) */}
      {isTenantRealm && engaged && !inputOpen && !histOpen && !contactForm && !bookingForm && !signupForm && !authForm && !plansPanel && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openInput(); }}
          aria-label="Poser une question"
          style={{ position: 'absolute', bottom: 18, left: 20, zIndex: 8, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 999, border: '1px solid rgba(230,204,146,.3)', background: 'rgba(38,38,36,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', color: GOLD, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          Écrire
        </button>
      )}

      {/* Cimolace (mode guide VNP) : CTA primaire de conversion → bascule vers le tunnel de création. */}
      {isCimolaceRealm && isTenantRealm && !inputOpen && !histOpen && !contactForm && !bookingForm && !signupForm && !authForm && !plansPanel && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); vnpAction('creer_plateforme'); }}
          style={{ position: 'absolute', bottom: 18, right: 20, zIndex: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999, border: 'none', background: TERRA, color: '#231208', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 18px rgba(217,119,87,.35)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Créer ma plateforme
        </button>
      )}
      {/* Cimolace (mode tunnel) : retour au guide VNP. */}
      {isCimolaceRealm && funnelMode && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setFunnelMode(false); }}
          aria-label="Revenir à la découverte de Cimolace"
          style={{ position: 'absolute', top: 18, left: 20, zIndex: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(230,204,146,.3)', background: 'rgba(38,38,36,.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', color: GOLD, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500 }}
        >
          ← Découvrir Cimolace
        </button>
      )}

      {/* Identité du realm (où on est) : badge marque (logo + nom) + état connecté */}
      <style>{`
        @media (max-width: 640px) {
          .cca-topbrand { left: 12px !important; transform: none !important; gap: 8px !important; max-width: calc(100vw - 150px); }
          .cca-connecte { display: none !important; }
          .cca-monespace-label { display: none !important; }
          .cca-monespace { padding: 6px 8px !important; }
        }
      `}</style>
      <div className="cca-topbrand" style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'none', zIndex: 6 }}>
        {isTenantRealm ? (
          <>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 15px', border: '1px solid rgba(230,204,146,.26)', borderRadius: 999, background: 'rgba(230,204,146,.045)' }}>
              {osBrand && osBrand.logo
                ? <img src={osBrand.logo} alt={tenantName} style={{ height: 21, width: 'auto', maxWidth: 40, objectFit: 'contain' }} />
                : <span style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: GOLD, borderRadius: 1, display: 'inline-block' }} />}
              <span style={{ fontFamily: DISPLAY, fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>{tenantName}</span>
            </span>
            <span className="cca-connecte" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
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

      {/* MON ESPACE — le membre qui a déjà un compte va à sa connexion tenant (toujours visible) */}
      {isTenantRealm && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goToSpace(); }}
          aria-label="Mon espace — se connecter"
          title="Déjà un compte ? Accéder à mon espace"
          className="cca-monespace"
          style={{ position: 'absolute', top: 14, right: 88, zIndex: 7, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(230,204,146,.28)', background: 'rgba(230,204,146,.05)', color: GOLD, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
          <span className="cca-monespace-label">Mon espace</span>
        </button>
      )}

      {/* Son on/off */}
      <button
        onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
        aria-label={muted ? 'Activer le son' : 'Couper le son'}
        style={{ position: 'absolute', top: 16, right: isTenantRealm ? 52 : 18, background: 'transparent', border: 'none', color: 'rgba(244,239,230,.4)', cursor: 'pointer', zIndex: 7, padding: 4, display: 'inline-flex' }}
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>

      {/* Historique de conversation (realm tenant) — ouvre le panneau « messagerie » */}
      {isTenantRealm && turns.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setHistOpen((v) => !v); }}
          aria-label="Voir la conversation"
          title="Voir la conversation"
          style={{ position: 'absolute', top: 15, right: 16, background: histOpen ? 'rgba(230,204,146,.14)' : 'transparent', border: '1px solid', borderColor: histOpen ? 'rgba(230,204,146,.4)' : 'rgba(244,239,230,.14)', borderRadius: 9, color: histOpen ? GOLD : 'rgba(244,239,230,.55)', cursor: 'pointer', zIndex: 7, padding: '5px 6px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="13" y2="13" /></svg>
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>{turns.length}</span>
        </button>
      )}

      {/* Retour — jamais bloqué. Realm tenant : visible dès qu'on a interagi (recule dans l'historique). */}
      {((isTenantRealm && engaged) || (!isTenantRealm && step !== 'discovery' && step !== 'pret')) && (
        <button
          onClick={(e) => { e.stopPropagation(); goBack(); }}
          aria-label="Revenir en arrière"
          style={{ position: 'absolute', top: 16, left: 18, background: 'transparent', border: 'none', color: 'rgba(244,239,230,.5)', cursor: 'pointer', zIndex: 7, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontFamily: 'inherit' }}
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

      {/* Realm tenant — ACCUEIL ÉDITORIAL ÉPURÉ : DEUX COLONNES (héros à gauche + liste « Explorez »
          à droite avec descriptions). Empile en une colonne < 860px. Remplace la grille de chips
          (jugée trop chargée). L'engagé garde la grille d'intentions/actions classique plus bas. */}
      {showTenantHero && (
        <div className="cca-in cca-accueil2" style={{ display: 'flex', gap: 'clamp(28px, 5vw, 72px)', alignItems: 'center', width: '100%', maxWidth: 1080, margin: '10px auto 0', padding: '0 28px', boxSizing: 'border-box', position: 'relative', zIndex: 4, textAlign: 'left' }}>
          <style>{`
            @media (max-width: 860px) {
              .cca-accueil2 { flex-direction: column !important; align-items: stretch !important; gap: 30px !important; }
              .cca-accueil2 .cca-acc-hero { text-align: center !important; align-items: center !important; }
              .cca-accueil2 .cca-acc-hero .cca-acc-cta { align-items: center !important; }
              .cca-accueil2 .cca-acc-rule { margin-left: auto !important; margin-right: auto !important; }
            }
          `}</style>

          {/* GAUCHE — le héros éditorial */}
          <div className="cca-acc-hero" style={{ flex: '1 1 46%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="cca-display" style={{ fontSize: 13, letterSpacing: '.34em', textTransform: 'uppercase', color: TERRA, fontWeight: 600, marginBottom: 6 }}>Bienvenue sur</div>
            <h1 className="cca-display" style={{ fontWeight: 600, fontSize: 'clamp(44px, 6vw, 82px)', lineHeight: 1.02, letterSpacing: '-0.005em', color: INK, margin: 0, textWrap: 'balance' }}>{tenantName}</h1>
            <div className="cca-acc-rule" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 16px', width: 200 }}>
              <span style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, rgba(217,119,87,.5), transparent)' }} />
              <span style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: TERRA, borderRadius: 1, opacity: 0.9, flexShrink: 0 }} />
              <span style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, rgba(217,119,87,.5), transparent)' }} />
            </div>
            <p className="cca-display" style={{ fontSize: 'clamp(18px, 2vw, 23px)', lineHeight: 1.42, color: 'rgba(244,239,230,.9)', margin: 0, maxWidth: 460, textWrap: 'balance' }}>
              Je suis votre guide — je connais tout {tenantName}. Que souhaitez-vous découvrir ?
            </p>
            <div className="cca-acc-cta" style={{ marginTop: 26, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); goToSignup(); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 28px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#1c1a17', background: TERRA, boxShadow: '0 14px 36px rgba(217,119,87,.34)' }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}>
                Créer un compte
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); goToSpace(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: 'rgba(244,239,230,.5)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Déjà membre ? <span style={{ color: GOLD, fontWeight: 500 }}>Accéder à mon espace →</span>
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); startTenantTour(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: 'rgba(244,239,230,.55)', display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
                <Compass size={15} style={{ color: TERRA, flexShrink: 0 }} /> Ou laissez-vous guider — <span style={{ color: GOLD }}>Fais-moi visiter →</span>
              </button>
            </div>
          </div>

          {/* DROITE — « Explorez » : liste épurée (icône + titre + description + flèche) */}
          <div className="cca-acc-explore" style={{ flex: '1 1 54%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, letterSpacing: '.22em', textTransform: 'uppercase', color: TERRA, fontWeight: 600, marginBottom: 4 }}>Explorez {tenantName}</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(vnpGraph ? vnpGraph.accueil.filter((a) => a.intent !== 'visiter') : []).slice(0, 6).map((a, i, arr) => {
                const Icon = chipIconFor(a.label);
                return (
                  <button key={a.label} onClick={(e) => { e.stopPropagation(); if (a.nodeId) vnpOpenNode(a.nodeId); else vnpChat(a.label); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 6px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '1px solid rgba(244,239,230,.09)' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', borderRadius: 8 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,239,230,.035)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
                    <Icon size={19} style={{ color: GOLD, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: INK }}>{a.label}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(244,239,230,.5)', marginTop: 2 }}>{exploreDesc(a)}</span>
                    </span>
                    <ArrowRight size={16} style={{ color: TERRA, flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
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
      {showActions && isTenantRealm && !tourActive && !fullscreenScene && !contactForm && !bookingForm && !signupForm && !authForm && !plansPanel && !showTenantHero && (
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
                <span style={{ fontSize: 11.5, color: 'rgba(244,239,230,.6)', lineHeight: 1.35 }}>
                  En envoyant, vous acceptez d'être recontacté(e) par {tenantName} au sujet de votre demande.{' '}
                  <a href="/politique-confidentialite" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: 'underline' }}>Politique de confidentialité</a>.
                </span>
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
                <span style={{ fontSize: 11.5, color: 'rgba(244,239,230,.6)', lineHeight: 1.35 }}>
                  En demandant un créneau, vous acceptez d'être recontacté(e) par {tenantName} pour confirmer le rendez-vous.{' '}
                  <a href="/politique-confidentialite" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: 'underline' }}>Politique de confidentialité</a>.
                </span>
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

            {/* INSCRIPTION EN LIGNE — l'OS possède l'identité (miroir de contactForm) */}
            {signupForm && (signupForm.sent ? (
              <div style={{ textAlign: 'center', color: GOLD, fontFamily: DISPLAY, fontSize: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
                <Check size={18} /> Bienvenue{signupForm.name ? `, ${signupForm.name.trim()}` : ''} !
              </div>
            ) : (
              <>
                <div className="cca-display" style={{ fontSize: 18, color: INK, marginBottom: 2 }}>Créer votre espace {tenantName}</div>
                <input className="cca-field" placeholder="Votre nom (optionnel)" value={signupForm.name}
                  onChange={(e) => setSignupForm((c) => ({ ...c, name: e.target.value }))} style={VNP_FIELD} />
                <input className="cca-field" type="email" placeholder="Votre e-mail" value={signupForm.email} autoComplete="email"
                  onChange={(e) => setSignupForm((c) => ({ ...c, email: e.target.value }))} style={VNP_FIELD} />
                <input className="cca-field" type="password" placeholder="Un mot de passe (6+ caractères)" value={signupForm.password} autoComplete="new-password"
                  onChange={(e) => setSignupForm((c) => ({ ...c, password: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); submitSignup(); } }} style={VNP_FIELD} />
                {signupForm.error && <span style={{ color: '#f0997b', fontSize: 12.5 }}>{signupForm.error}</span>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); submitSignup(); }} disabled={signupForm.sending}
                    style={{ ...VNP_CHIP_BASE, flex: 1, justifyContent: 'center', fontWeight: 600, color: '#231208', background: TERRA, border: 'none', opacity: signupForm.sending ? 0.7 : 1 }}>
                    {signupForm.sending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {signupForm.sending ? 'Création…' : 'Créer mon espace'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setSignupForm(null); }}
                    style={{ ...VNP_NAV_CHIP, justifyContent: 'center', width: 108 }}>Annuler</button>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setSignupForm(null); setAuthForm({ email: signupForm.email || '', password: '', sending: false, error: '' }); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'rgba(244,239,230,.55)', textAlign: 'left', padding: 0, marginTop: 2 }}>
                  Déjà un compte ? <span style={{ color: GOLD }}>Se connecter →</span>
                </button>
              </>
            ))}

            {/* CONNEXION EN LIGNE */}
            {authForm && (
              <>
                <div className="cca-display" style={{ fontSize: 18, color: INK, marginBottom: 2 }}>Connexion à {tenantName}</div>
                <input className="cca-field" type="email" placeholder="Votre e-mail" value={authForm.email} autoComplete="email"
                  onChange={(e) => setAuthForm((c) => ({ ...c, email: e.target.value }))} style={VNP_FIELD} />
                <input className="cca-field" type="password" placeholder="Votre mot de passe" value={authForm.password} autoComplete="current-password"
                  onChange={(e) => setAuthForm((c) => ({ ...c, password: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); submitLogin(); } }} style={VNP_FIELD} />
                {authForm.error && <span style={{ color: '#f0997b', fontSize: 12.5 }}>{authForm.error}</span>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); submitLogin(); }} disabled={authForm.sending}
                    style={{ ...VNP_CHIP_BASE, flex: 1, justifyContent: 'center', fontWeight: 600, color: '#231208', background: TERRA, border: 'none', opacity: authForm.sending ? 0.7 : 1 }}>
                    {authForm.sending ? <Loader2 size={15} className="animate-spin" /> : null}
                    {authForm.sending ? 'Connexion…' : 'Se connecter'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setAuthForm(null); }}
                    style={{ ...VNP_NAV_CHIP, justifyContent: 'center', width: 108 }}>Annuler</button>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setAuthForm(null); setSignupForm({ name: '', email: authForm.email || '', password: '', sending: false, sent: false, error: '' }); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'rgba(244,239,230,.55)', textAlign: 'left', padding: 0, marginTop: 2 }}>
                  Pas encore de compte ? <span style={{ color: GOLD }}>Créer mon espace →</span>
                </button>
              </>
            )}

            {/* CHOISIR UN FORFAIT — les 4 cycles rendus DANS l'OS ; « S'abonner » ouvre le checkout en nouvel onglet */}
            {plansPanel && (
              <>
                <div className="cca-display" style={{ fontSize: 18, color: INK, marginBottom: 2 }}>Choisir votre forfait</div>
                {plansPanel.loading && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'rgba(244,239,230,.7)', fontSize: 13.5, padding: '10px 0' }}>
                    <Loader2 size={15} className="animate-spin" /> Chargement des forfaits…
                  </div>
                )}
                {!plansPanel.loading && plansPanel.error && (
                  <span style={{ color: '#f0997b', fontSize: 12.5 }}>Les forfaits sont momentanément indisponibles — réessayez dans un instant.</span>
                )}
                {!plansPanel.loading && !plansPanel.error && plansPanel.plans.map((p) => {
                  const meta = CYCLE_META[p.cycle] || {};
                  return (
                    <button key={p.key} onClick={(e) => { e.stopPropagation();
                        try { logEvent('forfait_checkout', { cycle: p.cycle }, osTenant); } catch { /* non bloquant */ }
                        window.open(`/t/${osTenant}/paiement?plan=${encodeURIComponent(p.key)}&type=subscription`, '_blank', 'noopener'); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left', cursor: 'pointer',
                        padding: '12px 15px', borderRadius: 13, border: '1px solid rgba(230,204,146,.18)', background: 'rgba(244,239,230,.035)', fontFamily: 'inherit', width: '100%' }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', color: INK, fontWeight: 600, fontSize: 14.5 }}>{meta.name || p.label}</span>
                        <span style={{ display: 'block', color: 'rgba(244,239,230,.6)', fontSize: 12, lineHeight: 1.35, marginTop: 2 }}>{meta.for || ''}</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ color: GOLD, fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap' }}>{p.price} €<span style={{ color: 'rgba(244,239,230,.5)', fontWeight: 400 }}>/mois</span></span>
                        <ArrowRight size={15} style={{ color: TERRA }} />
                      </span>
                    </button>
                  );
                })}
                {!plansPanel.loading && (
                  <span style={{ fontSize: 11.5, color: 'rgba(244,239,230,.55)', lineHeight: 1.35, marginTop: 2 }}>
                    Paiement sécurisé — carte (Stripe) ou Mobile Money (PawaPay), dans un nouvel onglet. Trimestre & année proposés au paiement.
                  </span>
                )}
                <button onClick={(e) => { e.stopPropagation(); setPlansPanel(null); }}
                  style={{ ...VNP_NAV_CHIP, justifyContent: 'center', width: 108, alignSelf: 'flex-start' }}>Fermer</button>
              </>
            )}
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
