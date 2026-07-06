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
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Stethoscope, ShoppingBag, ArrowUp, ArrowRight, ArrowLeft, Check, Loader2, Mail, Lock, Volume2, VolumeX } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { authStore } from '@/lib/auth-store';
import { supabase } from '@/lib/supabase';

const BG = '#262624';
const BG_THINK = '#20232a';
const INK = '#f4efe6';
const TERRA = '#d97757';
const GOLD = '#e6cc92';
const SERIF = "'Fraunces','Source Serif 4',Georgia,serif";

const GREETING = "Bonjour. Dites-moi ce que vous voulez lancer — je m'occupe du reste.";

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

const STYLE = `
@keyframes ccaBreath{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.6}50%{transform:translate(-50%,-50%) scale(1.18);opacity:.95}}
@keyframes ccaLine{0%{background-position:-90px 0}100%{background-position:130px 0}}
@keyframes ccaEq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes ccaBoot{0%{transform:translate(-50%,-50%) scale(.4);opacity:.8}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}
@keyframes ccaHalo{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.5}50%{transform:translate(-50%,-50%) scale(1.1);opacity:.85}}
@keyframes ccaFade{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
@keyframes ccaPing{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.4);opacity:0}}
.cca-form{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0;transition:opacity .5s ease}
.cca-dot{width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(217,119,87,.82),rgba(217,119,87,.05) 70%)}
.cca-line{width:96px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,#d97757,#e6cc92,transparent);background-size:90px 100%}
.cca-wave{display:flex;gap:4px;height:26px;align-items:center}
.cca-wave i{width:3px;height:26px;border-radius:2px;background:#d97757;display:block;transform-origin:center;animation:ccaEq .62s ease-in-out infinite}
.cca-boot{width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(217,119,87,.8)}
.cca-done{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle,rgba(63,191,106,.28),transparent 70%);color:#7fe0a0}
.cca-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(217,119,87,.15),transparent 60%);transition:background .7s ease;pointer-events:none}
/* Les animations ne tournent QUE dans l'état actif (sinon leurs keyframes d'opacité écrasent le masquage). */
.cca-connexion .cca-boot{opacity:1;animation:ccaBoot 1.4s ease-out infinite}
.cca-attente .cca-dot{opacity:1;animation:ccaBreath 3s ease-in-out infinite}
.cca-reflexion .cca-line{opacity:1;animation:ccaLine 2s linear infinite}
.cca-reflexion .cca-glow{background:radial-gradient(circle,rgba(230,204,146,.18),transparent 60%)}
.cca-ecriture .cca-wave{opacity:1}
.cca-pret .cca-done{opacity:1;animation:ccaHalo 2.6s ease-in-out infinite}
.cca-pret .cca-glow{background:radial-gradient(circle,rgba(63,191,106,.16),transparent 60%)}
.cca-in{animation:ccaFade .5s cubic-bezier(.22,1,.36,1) both}
.cca-chip{transition:background .16s ease;cursor:pointer}
.cca-chip:hover{background:rgba(230,204,146,.14)!important}
.cca-field::placeholder{color:rgba(244,239,230,.35)}
/* — Effets « vivants » — */
@keyframes ccaCaret{0%,44%{opacity:1}50%,94%{opacity:0}100%{opacity:1}}
@keyframes ccaOrbit{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes ccaGlowPulse{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(1)}50%{opacity:.95;transform:translate(-50%,-50%) scale(1.13)}}
@keyframes ccaRipple{0%{transform:translate(-50%,-50%) scale(.45);opacity:.5}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
@keyframes ccaDriftA{0%,100%{transform:translate(0,0)}50%{transform:translate(16px,-12px)}}
@keyframes ccaDriftB{0%,100%{transform:translate(0,0)}50%{transform:translate(-14px,10px)}}
@keyframes ccaDriftC{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,14px)}}
.cca-caret{display:inline-block;width:2px;height:0.92em;margin-left:3px;vertical-align:-1px;border-radius:1px;background:#e6cc92;animation:ccaCaret 1s step-end infinite}
.cca-ripple{position:absolute;top:50%;left:50%;width:44px;height:44px;border-radius:50%;border:1px solid rgba(217,119,87,.55);transform:translate(-50%,-50%);animation:ccaRipple .85s ease-out forwards;pointer-events:none}
.cca-orbit{position:absolute;top:50%;left:50%;width:72px;height:72px;transform:translate(-50%,-50%);opacity:0;transition:opacity .4s ease;pointer-events:none}
.cca-orbit span{position:absolute;left:50%;width:5px;height:5px;border-radius:50%;transform:translateX(-50%)}
.cca-orbit span:first-child{top:-2px;background:#e6cc92}
.cca-orbit span:last-child{bottom:-2px;background:#d97757}
.cca-reflexion .cca-orbit{opacity:1;animation:ccaOrbit 2.3s linear infinite}
.cca-ecriture .cca-glow{animation:ccaGlowPulse 1.5s ease-in-out infinite}
.cca-amb{position:absolute;border-radius:50%;background:#d97757;pointer-events:none}
@keyframes ccaDraw{to{stroke-dashoffset:0}}
.cca-dr{stroke-dasharray:1;stroke-dashoffset:1;animation:ccaDraw .7s ease forwards}

/* ═══ L6 — Scènes : l'IA compose toute la surface ═══ */
/* Décalage de la présence selon la scène (wrapper à transition permanente → retour au centre « gratuit ») */
.cca-presence-holder{transition:transform .6s cubic-bezier(.16,1,.3,1),opacity .5s ease}
.cca-scene-on.cca-slot-aside{transform:translateX(-16%)}
.cca-scene-on.cca-slot-aside.cca-aside-left{transform:translateX(16%)}
.cca-scene-on.cca-slot-split{transform:translateY(-33vh) scale(.6)}
.cca-scene-on.cca-slot-reader{transform:translate(-42vw,-40vh) scale(.4);opacity:0}
.cca-scene-on.cca-slot-tutorial{transform:translateY(-31vh) scale(.7)}
/* Voix centrale / actions atténuées quand la scène occupe le plein écran */
.cca-voicecol{transition:opacity .4s ease}
.cca-voicecol.cca-dim{opacity:0;pointer-events:none}
.cca-rail-dim{opacity:.2!important;pointer-events:none}

/* Conteneur de scène : contenu rendu dès scene!=null ; -on = mouvement seulement */
.cca-scene{opacity:0;transition:opacity .5s ease}
.cca-scene.cca-scene-on{opacity:1}

/* aside — panneau qui glisse d'un bord (transform only), lignes en cascade */
.cca-aside{position:absolute;top:50%;right:3.2vw;transform:translate(120%,-50%);opacity:0;width:min(300px,33vw);display:flex;flex-direction:column;gap:11px;transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .4s ease}
.cca-aside.cca-aside-left{left:3.2vw;right:auto;transform:translate(-120%,-50%)}
.cca-scene-on .cca-aside{transform:translate(0,-50%);opacity:1}
.cca-aside-title{font-family:${SERIF};font-size:15px;color:rgba(244,239,230,.6);letter-spacing:.01em;margin-bottom:2px}
.cca-aside-row{opacity:0;transform:translateY(9px);transition:opacity .4s ease,transform .4s cubic-bezier(.16,1,.3,1);background:rgba(244,239,230,.05);border-radius:12px;padding:11px 14px;display:flex;flex-direction:column;gap:3px}
.cca-scene-on .cca-aside-row{opacity:1;transform:none}
.cca-aside-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.cca-aside-label{font-size:12.5px;color:rgba(244,239,230,.75);letter-spacing:.02em}
.cca-aside-value{font-family:${SERIF};font-size:16px;color:${INK}}
.cca-aside-note{font-size:11.5px;color:rgba(244,239,230,.42);line-height:1.35}

/* split — rideau (clip-path) + ligne + 2 colonnes qui montent */
.cca-split{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr}
.cca-split-veil{position:absolute;inset:0;opacity:0;transform:scale(1.06);background:radial-gradient(circle at 50% 46%,transparent,rgba(20,22,27,.55));transition:opacity .5s ease,transform .6s cubic-bezier(.16,1,.3,1);pointer-events:none}
.cca-scene-on .cca-split-veil{opacity:1;transform:scale(1)}
.cca-split-headline{position:absolute;top:8.5vh;left:50%;transform:translateX(-50%);font-family:${SERIF};font-size:18px;color:rgba(244,239,230,.62);text-align:center;opacity:0;transition:opacity .5s ease .15s;white-space:nowrap}
.cca-scene-on .cca-split-headline{opacity:1}
.cca-split-line{position:absolute;left:50%;top:20%;bottom:16%;width:1px;transform:translateX(-50%);background:linear-gradient(180deg,transparent,#d97757,#e6cc92,transparent);clip-path:inset(0 0 100% 0);transition:clip-path .42s cubic-bezier(.16,1,.3,1) .12s}
.cca-scene-on .cca-split-line{clip-path:inset(0 0 0 0)}
.cca-split-col{display:flex;flex-direction:column;justify-content:center;padding:0 5.5vw;opacity:0;transform:translateY(24px);transition:opacity .48s ease,transform .48s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-split-col{opacity:1;transform:none}
.cca-scene-on .cca-split-col.cca-col-r{transition-delay:.1s}
.cca-split-h{font-family:${SERIF};font-size:23px;margin:0 0 3px;font-weight:600}
.cca-split-sub{font-size:12px;color:rgba(244,239,230,.45);margin:0 0 15px;letter-spacing:.04em;text-transform:uppercase}
.cca-split-b{display:flex;align-items:center;gap:10px;font-size:14px;color:${INK};padding:6px 0;opacity:0;transform:translateY(6px);transition:opacity .4s ease,transform .4s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-split-b{opacity:1;transform:none}
.cca-split-tick{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.cca-split-hooks{position:absolute;left:50%;bottom:5vh;transform:translateX(-50%);display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:82vw;opacity:0;transition:opacity .5s ease .5s}
.cca-scene-on .cca-split-hooks{opacity:1}

/* reader — profil (gauche) · texte scrollable (centre, masque bas = « il reste du texte ») · nav (droite) · suggestions (bas) */
.cca-reader{position:absolute;inset:0;display:grid;grid-template-columns:210px minmax(0,1fr) 176px;grid-template-rows:1fr auto;gap:0 3vw;padding:8.5vh 4vw 3vh}
.cca-reader-profile{grid-column:1;grid-row:1;display:flex;flex-direction:column;gap:7px;align-self:start;opacity:0;transform:translateX(-24px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-reader-profile{opacity:1;transform:none}
.cca-reader-name{font-family:${SERIF};font-size:18px;color:${INK};margin-top:6px}
.cca-reader-role{font-size:12px;color:${GOLD};letter-spacing:.02em}
.cca-reader-fact{display:flex;flex-direction:column;gap:1px;margin-top:8px;font-size:12px}
.cca-reader-fact span{color:rgba(244,239,230,.4);text-transform:uppercase;letter-spacing:.06em;font-size:10px}
.cca-reader-fact b{color:rgba(244,239,230,.8);font-weight:500}
.cca-reader-body{grid-column:2;grid-row:1;overflow-y:auto;max-width:640px;justify-self:center;width:100%;scrollbar-width:none;-webkit-mask-image:linear-gradient(#000 90%,transparent);mask-image:linear-gradient(#000 90%,transparent);opacity:0;transform:translateY(12px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-reader-body{opacity:1;transform:none}
.cca-reader-body::-webkit-scrollbar{width:0;height:0}
.cca-reader-title{font-family:${SERIF};font-size:26px;color:${INK};line-height:1.2;margin:0 0 20px;text-wrap:balance}
.cca-reader-body section{margin-bottom:22px}
.cca-reader-h{font-family:${SERIF};font-size:15px;color:${GOLD};margin:0 0 7px;letter-spacing:.01em}
.cca-reader-p{font-family:${SERIF};font-size:16px;line-height:1.62;color:rgba(244,239,230,.86);margin:0 0 9px;max-width:62ch}
.cca-reader-nav{grid-column:3;grid-row:1;display:flex;flex-direction:column;gap:2px;align-self:start;opacity:0;transform:translateX(24px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-reader-nav{opacity:1;transform:none}
.cca-reader-nav button{display:flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;color:rgba(244,239,230,.4);font:inherit;font-size:12.5px;padding:6px 0;text-align:left;transition:color .2s ease}
.cca-reader-nav button.on{color:${GOLD}}
.cca-reader-nav .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:rgba(244,239,230,.22);transition:background .2s ease}
.cca-reader-nav button.on .dot{background:${TERRA}}
.cca-reader-suggests{grid-column:1 / -1;grid-row:2;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding-top:14px;opacity:0;transition:opacity .5s ease .4s}
.cca-scene-on .cca-reader-suggests{opacity:1}

/* tutorial — étapes numérotées en cascade + CTA */
.cca-tuto{position:absolute;inset:0;display:flex;flex-direction:column;gap:16px;justify-content:center;padding:10vh 8vw 6vh;overflow-y:auto;scrollbar-width:none}
.cca-tuto::-webkit-scrollbar{width:0}
.cca-tuto-title{font-family:${SERIF};font-size:22px;color:${INK};margin-bottom:4px;text-wrap:balance}
.cca-tuto-steps{display:flex;flex-direction:column;gap:15px}
.cca-tuto-step{display:flex;gap:15px;align-items:flex-start;opacity:0;transform:translateY(14px);transition:opacity .45s ease,transform .45s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-tuto-step{opacity:1;transform:none}
.cca-tuto-n{flex-shrink:0;width:28px;height:28px;border-radius:50%;background:rgba(217,119,87,.16);color:${TERRA};font-family:${SERIF};font-size:15px;display:inline-flex;align-items:center;justify-content:center;margin-top:1px}
.cca-tuto-txt{flex:1;min-width:0}
.cca-tuto-h{font-size:15.5px;color:${INK};font-weight:500;margin-bottom:2px}
.cca-tuto-d{font-size:13px;color:rgba(244,239,230,.55);line-height:1.5}
.cca-tuto-sketch{flex-shrink:0;opacity:.9}
.cca-tuto-cta{align-self:flex-start;margin-top:6px}

/* reduced-motion : l'état final s'applique direct (cca-scene-on posé instantanément par enterScene) */
@media (prefers-reduced-motion: reduce){
  .cca-presence-holder,.cca-scene,.cca-scene *{transition-duration:.001s!important;animation-duration:.001s!important}
}
/* responsive mobile : split empilé, reader en une colonne */
@media (max-width:640px){
  .cca-scene-on.cca-slot-reader{transform:translate(-30vw,-30vh) scale(.5)}
  .cca-aside{width:min(280px,72vw);right:5vw}
  .cca-split{grid-template-columns:1fr;grid-template-rows:1fr 1fr}
  .cca-split-line{left:12%;right:12%;top:50%;bottom:auto;width:auto;height:1px;transform:translateY(-50%);background:linear-gradient(90deg,transparent,#d97757,#e6cc92,transparent);clip-path:inset(0 100% 0 0)}
  .cca-scene-on .cca-split-line{clip-path:inset(0 0 0 0)}
  .cca-split-col{padding:0 8vw}
  .cca-split-headline{top:3vh;font-size:15px}
  .cca-reader{grid-template-columns:1fr;grid-template-rows:auto 1fr auto;padding:7vh 6vw 3vh;gap:12px 0}
  .cca-reader-profile{grid-column:1;grid-row:1;flex-direction:row;align-items:center;gap:12px;flex-wrap:wrap}
  .cca-reader-body{grid-column:1;grid-row:2}
  .cca-reader-nav{grid-column:1;grid-row:3;flex-direction:row;flex-wrap:wrap;gap:6px 14px}
  .cca-reader-suggests{grid-row:4}
}
`;

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
// Surligne le mot-clé (style « Sherpas » : le terme fort ressort en accent) dans la reply.
function highlightReply(text, kw) {
  if (!kw) return text;
  const i = text.toLowerCase().indexOf(kw.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ color: '#e6cc92', fontWeight: 500 }}>{text.slice(i, i + kw.length)}</span>
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
const SCENE_TYPES = ['aside', 'split', 'reader', 'tutorial'];
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
      return { type: 'aside', side: raw.side === 'left' ? 'left' : 'right',
        title: cut(raw.title, 80) || undefined, items,
        highlight: typeof raw.highlight === 'string' ? cut(raw.highlight, 24) : undefined };
    }
    if (raw.type === 'split') {
      const pane = (o) => (o && o.title && Array.isArray(o.points) && o.points.length)
        ? { title: cut(o.title, 60), subtitle: cut(o.subtitle, 80) || undefined, points: arr(o.points, 4, 90) } : null;
      const left = pane(raw.left), right = pane(raw.right);
      if (!left || !right || !left.points.length || !right.points.length) return null;
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
function SceneStage({ scene, visible, readerIdx, setReaderIdx, onSuggest, onCta, hooks, onHook }) {
  if (!scene) return null;
  return (
    <div className={`cca-scene cca-stage-${scene.type} ${visible ? 'cca-scene-on' : ''}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      {scene.type === 'aside' && <AsidePanel scene={scene} />}
      {scene.type === 'split' && <SplitWorlds scene={scene} hooks={hooks} onHook={onHook} />}
      {scene.type === 'reader' && <ReaderView scene={scene} idx={readerIdx} setIdx={setReaderIdx} onSuggest={onSuggest} />}
      {scene.type === 'tutorial' && <TutorialFlow scene={scene} onCta={onCta} />}
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

function ReaderView({ scene, idx, setIdx, onSuggest }) {
  const scrollRef = useRef(null);
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
      {scene.suggestions && scene.suggestions.length > 0 && (
        <div className="cca-reader-suggests">
          {scene.suggestions.map((s, i) => (
            <span key={i} className="cca-chip" onClick={() => onSuggest(s)}
              style={{ fontSize: 12, color: GOLD, background: 'rgba(244,239,230,.05)', borderRadius: 999, padding: '6px 13px' }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function TutorialFlow({ scene, onCta }) {
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
      {scene.cta && (
        <button className="cca-chip cca-tuto-cta" onClick={onCta}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#2a140c', background: TERRA, border: 'none', borderRadius: 12, padding: '11px 22px', fontWeight: 500, fontSize: 13.5, cursor: 'pointer' }}>
          {scene.cta}<ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

export default function CimolaceCreationAgent() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [presence, setPresence] = useState('connexion'); // connexion|attente|reflexion|ecriture|pret
  const [message, setMessage] = useState('');
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

  const inputAllowed = step === 'discovery' || step === 'brand_ask' || step === 'brain' || step === 'product';

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
    clearTimeout(sceneTimer.current);
    if (!sceneRef.current) { setSceneVisible(false); if (done) done(); return; }
    setSceneVisible(false); // retire cca-scene-on → sortie animée, présence revient au centre
    const dur = (document.hidden || prefersReduced()) ? 0 : 320;
    sceneTimer.current = setTimeout(() => { setScene(null); setReaderIdx(0); if (done) done(); }, dur);
  }, []);

  const enterScene = useCallback((next, speakReply) => {
    clearTimeout(sceneTimer.current);
    if (!next) { exitScene(speakReply); return; }
    const instant = document.hidden || prefersReduced();
    setReaderIdx(0);
    setScene(next);
    if (instant) { setSceneVisible(true); if (speakReply) speakReply(); return; }
    setSceneVisible(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setSceneVisible(true)));
    if (next.type === 'split') sThink(); // grand geste → appui sonore
    const voiceDelay = next.type === 'aside' ? 500 : 360; // laisse la scène se poser avant la voix
    sceneTimer.current = setTimeout(() => { if (speakReply) speakReply(); }, voiceDelay);
  }, [exitScene, sThink]);

  // Éveil
  useEffect(() => {
    const t = setTimeout(() => speak(GREETING), 900);
    return () => { clearTimeout(t); clearInterval(typeTimer.current); clearTimeout(thinkTimer.current); clearTimeout(sceneTimer.current); };
  }, [speak]);

  const openInput = useCallback((prefill = '') => {
    setInputOpen(true);
    setValue(prefill);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);
  const closeInput = useCallback(() => { setInputOpen(false); setValue(''); }, []);

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
    exitScene();
    setChosen(k);
    setError('');
    think(() => { setStep('product'); speak(PRODUCT[k].reply); });
  }, [think, speak, sPop, exitScene]);

  const chooseProduct = useCallback(() => {
    sPop();
    exitScene();
    setStep('brand_ask');
    speak("Comment s'appelle votre organisation ? Dites-le moi.", () => openInput());
  }, [speak, openInput, sPop, exitScene]);

  const submitName = useCallback((name) => {
    exitScene();
    const s = slugify(name);
    setOrgName(name);
    setSlug(s);
    checkSlug(s);
    think(() => { setStep('brand_confirm'); speak(`Parfait. Votre espace : cimolace.space/t/${s || '…'}. On continue ?`); });
  }, [think, speak, checkSlug, exitScene]);

  const continueToAccount = useCallback(() => {
    sPop();
    exitScene();
    setStep('account');
    speak("Dernière étape : votre e-mail et un mot de passe (8 caractères min). Vous saisissez, je crée l'espace.");
  }, [speak, sPop, exitScene]);

  // Le « cerveau » : appelle l'edge agent-brain (LLM) → reply générative + produit + hooks.
  // Repli hors-ligne : détection par mots-clés.
  const brain = useCallback(async (message) => {
    setError('');
    setBrainHooks([]);
    setKeyword('');
    exitScene(); // la scène précédente s'efface pendant que l'IA réfléchit
    setPresence('reflexion');
    sThink();
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('agent-brain', {
        body: { message, chosen, covered: coveredRef.current },
      });
      if (fnErr) throw fnErr;
      setKeyword(String(data?.keyword || ''));
      const reply = String(data?.reply || '').trim() || "Je vous écoute — dites-m'en un peu plus ?";
      const product = data?.product && PRODUCT[data.product] ? data.product : null;
      const t = TOPIC_ORDER.includes(data?.topic) ? data.topic : null;
      setTopic(t);
      if (t) setCovered((prev) => (prev.includes(t) ? prev : [...prev, t]));
      setBrainHooks(Array.isArray(data?.hooks) ? data.hooks : []);
      const nextScene = normalizeScene(data?.scene); // autorité finale, ne throw jamais
      if (product) setChosen(product);
      setStep(product ? 'product' : 'brain');
      enterScene(nextScene, () => speak(reply)); // scene null → speak immédiat (mode L5)
    } catch (_) {
      exitScene();
      setTopic(null);
      const k = guessKind(message);
      setChosen(k);
      setStep('product');
      speak(PRODUCT[k].reply);
    }
  }, [chosen, speak, sThink, enterScene, exitScene]);

  const submitInput = useCallback(() => {
    const v = value.trim();
    closeInput();
    if (!v) return;
    sPop();
    if (step === 'brand_ask') { submitName(v); return; }
    brain(v);
  }, [value, step, closeInput, submitName, brain, sPop]);

  const createAccount = useCallback(async () => {
    setError('');
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
  }, [email, password, slug, orgName, chosen, login, navigate, sPop, sThink, sChime, exitScene]);

  const goBack = useCallback(() => {
    sPop();
    setError('');
    setBusy(false);
    closeInput();
    exitScene();
    if (step === 'product' || step === 'brain') { setStep('discovery'); speak(GREETING); }
    else if (step === 'brand_ask') { setStep('product'); speak(PRODUCT[chosen].reply); }
    else if (step === 'brand_confirm') { setStep('brand_ask'); speak("Quel nom pour votre organisation ?", () => openInput()); }
    else if (step === 'account') { setStep('brand_confirm'); speak(`On reprend — cimolace.space/t/${slug}. On continue ?`); }
  }, [step, chosen, slug, sPop, closeInput, speak, openInput, exitScene]);

  const onRootClick = (e) => {
    if (inputOpen || !inputAllowed) return;
    if (rootRef.current && e.target === rootRef.current) openInput();
  };

  const bg = presence === 'reflexion' ? BG_THINK : BG;
  const showActions = presence === 'attente' && !inputOpen;
  // Scène plein écran (split/reader/tutorial) : la voix centrale + actions en flux s'effacent,
  // la scène porte le message ; `aside` garde la voix au centre.
  const fullscreenScene = !!scene && scene.type !== 'aside';

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

      {/* L6 — Scène « réalisée » par l'IA : composition de toute la surface (fond, sous la voix) */}
      {scene && (step === 'brain' || step === 'product') && (
        <SceneStage scene={scene} visible={sceneVisible} readerIdx={readerIdx} setReaderIdx={setReaderIdx}
          onSuggest={brain} onCta={chooseProduct} hooks={brainHooks} onHook={brain} />
      )}

      {/* Connecté */}
      <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 7, opacity: 0.7, pointerEvents: 'none' }}>
        <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#3fbf6a', animation: 'ccaPing 1.9s ease-out infinite' }} />
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fbf6a' }} />
        </span>
        <span style={{ fontSize: 11, color: 'rgba(244,239,230,.55)', letterSpacing: '.03em' }}>assistant cimolace · connecté</span>
      </div>

      {/* L5 — rail de sujets « tableau intelligent » : liste à gauche, clic → le cerveau compose au centre.
          Sert aussi de barre de couverture (le tunnel) : sujets abordés = allumés. */}
      {(step === 'brain' || step === 'product') && (
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
        <div className={`cca-${presence}`} style={{ position: 'relative', width: 200, height: 120, pointerEvents: 'none' }}>
          <div className="cca-glow" />
          <span key={presence} className="cca-ripple" />
          <div className="cca-orbit"><span /><span /></div>
          <span className="cca-form cca-boot" />
          <span className="cca-form cca-dot" />
          <span className="cca-form cca-line" />
          <span className="cca-form cca-wave"><i /><i style={{ animationDelay: '.1s' }} /><i style={{ animationDelay: '.2s' }} /><i style={{ animationDelay: '.3s' }} /><i style={{ animationDelay: '.4s' }} /></span>
          <span className="cca-form cca-done"><Check size={20} /></span>
        </div>
      </div>

      {/* Croquis « Précepteur » — se dessine quand le cerveau explique un sujet */}
      {topic && (step === 'brain' || step === 'product') && (
        <div key={topic} className="cca-in cca-voicecol" style={{ marginTop: 8, marginBottom: 2, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 4, opacity: fullscreenScene ? 0 : 1, pointerEvents: fullscreenScene ? 'none' : undefined }}>
          {croquisFor(topic)}
        </div>
      )}

      {/* Voix */}
      <div className={`cca-voicecol${fullscreenScene ? ' cca-dim' : ''}`} style={{ minHeight: 34, marginTop: 14, textAlign: 'center', position: 'relative', zIndex: 4 }}>
        {message ? (
          <p className="cca-in" style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.5, color: INK, maxWidth: 470, margin: 0 }}>
            {keyword && (step === 'brain' || step === 'product') ? highlightReply(message, keyword) : message}
            {(presence === 'ecriture' || presence === 'attente') && <span className="cca-caret" />}
          </p>
        ) : (
          showActions && step === 'discovery' && <span style={{ fontSize: 12, color: 'rgba(244,239,230,.4)' }}>touchez l'écran pour parler</span>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <p className="cca-in" style={{ marginTop: 10, fontSize: 12.5, color: '#f0997b' }}>{error}</p>
      )}

      {/* Actions par étape */}
      {showActions && step === 'discovery' && (
        <div className="cca-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center', marginTop: 18, maxWidth: 470 }}>
          {SUGG.map(({ kind, label, Icon }) => (
            <span key={kind} className="cca-chip" onClick={(e) => { e.stopPropagation(); pickKind(kind); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: GOLD, background: 'rgba(244,239,230,.05)', borderRadius: 999, padding: '8px 15px' }}>
              <Icon size={14} />{label}
            </span>
          ))}
        </div>
      )}

      {showActions && step === 'product' && !fullscreenScene && (
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
        </div>
      )}

      {showActions && step === 'brain' && !fullscreenScene && (
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

      {/* Saisie « parler à la présence » */}
      {inputOpen && (
        <div className="cca-in" onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)', width: 'min(440px, 86vw)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(244,239,230,.07)', borderRadius: 14, padding: '8px 8px 8px 15px' }}>
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
