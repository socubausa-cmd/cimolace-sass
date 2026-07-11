/**
 * immersiveTheme.js — LA COQUE IMMERSIVE PARTAGÉE (le « cerveau »).
 *
 * Source unique du thème chaud (#262624), de la voix serif et du CSS `cca-*`
 * (présence 5 états, croquis qui se dessine, scènes du tableau intelligent, reduced-motion).
 * Importé par LES DEUX agents : Assistant Cimolace (vend) ET Le Précepteur (enseigne),
 * pour qu'ils partagent EXACTEMENT la même coque. PURE ESM (aucun JSX, aucune dépendance).
 */

export const BG = '#262624';
export const BG_THINK = '#20232a';
export const INK = '#f4efe6';
export const TERRA = '#d97757';
export const GOLD = '#e6cc92';
export const SERIF = "'Fraunces','Source Serif 4',Georgia,serif";
// ── Système typo « Punch » (Sherpas) — les 4 rôles, source unique de marque ──
// GROTESQUE = affichage/mot-clé (titre & boîte dorée MAJUSCULE) ; SERIF_BODY = corps de narration.
// SERIF (Fraunces) reste la « voix » chaude des scènes. À importer par les DEUX agents.
export const GROTESQUE = "'Bricolage Grotesque', system-ui, sans-serif";
export const SERIF_BODY = "'Source Serif 4', Georgia, serif";
// DISPLAY = serif classique haut-contraste (Cormorant Garamond) — traitement éditorial « hero »
// (eyebrow + grand nom + filet). Chargé ici, utilisé pour l'accueil du realm tenant (prorascience).
export const DISPLAY = "'Cormorant Garamond','Cormorant',Georgia,serif";

export const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap');
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
.cca-display{font-family:${DISPLAY}!important}
@media (max-width:820px){
  .cca-actionsplit{flex-direction:column!important;gap:16px!important;align-items:stretch!important}
  .cca-actionsplit-text{text-align:center}
  .cca-actionsplit-text p{text-align:center!important;max-width:100%!important;margin:0 auto!important}
}
.cca-chip{transition:background .16s ease,border-color .16s ease;cursor:pointer}
.cca-chip:hover{background:rgba(230,204,146,.14)!important}
button.cca-chip:hover{border-color:rgba(230,204,146,.42)!important}
button.cca-chip-visit:hover{background:#e18b6b!important;border-color:transparent!important}
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
.cca-scene-on.cca-slot-split{transform:translateY(-33vh) scale(.6);opacity:0}
.cca-scene-on.cca-slot-reader{transform:translate(-42vw,-40vh) scale(.4);opacity:0}
.cca-scene-on.cca-slot-tutorial{transform:translateY(-31vh) scale(.7);opacity:0}
/* leçon (Précepteur embarqué) : la présence RESTE visible, petite, en haut — elle suit le cours */
.cca-scene-on.cca-slot-lesson{transform:translateY(-41vh) scale(.5)}
/* ═══ le Précepteur FONDU dans la coque : AUCUN arrière-plan clair, textes clairs → UN SEUL système ═══ */
.cca-lesson .cca-board-badge{display:none!important}
/* toutes les cartes/surfaces claires (tableau, atelier, boîtes) → transparentes/fondues */
.cca-lesson [class*="bg-white"],.cca-lesson .cca-board{background:transparent!important;box-shadow:none!important}
.cca-lesson [class*="ring-black"]{box-shadow:none!important}
.cca-lesson [class*="bg-slate-50"],.cca-lesson [class*="bg-slate-100"]{background:rgba(244,239,230,.05)!important}
.cca-lesson [class*="bg-emerald-50"]{background:rgba(127,224,160,.08)!important}
.cca-lesson [class*="border-slate-"]{border-color:rgba(244,239,230,.14)!important}
/* textes sombres (conçus pour tableau blanc) → clairs sur la coque sombre */
.cca-lesson [class*="text-slate-9"],.cca-lesson [class*="text-slate-8"],.cca-lesson [class*="text-slate-7"],.cca-lesson [class*="text-slate-6"],.cca-lesson [class*="text-slate-5"],.cca-lesson [class*="text-slate-4"]{color:#efe7d9!important}
/* étiquettes d'accent → versions claires */
.cca-lesson [class*="text-amber-7"]{color:#e6cc92!important}
.cca-lesson [class*="text-emerald-7"]{color:#7fe0a0!important}
.cca-lesson [class*="text-blue-7"],.cca-lesson [class*="text-blue-6"]{color:#88abff!important}
/* surlignage Sherpas : garde son texte sombre sur son fond clair (le mot-clé ressort) */
.cca-lesson mark.text-slate-900,.cca-lesson mark{color:#1a1613!important}
/* champ de saisie de l'atelier : lisible sur sombre + placeholder clair */
.cca-lesson input,.cca-lesson textarea{color:#f4efe6!important}
.cca-lesson input::placeholder,.cca-lesson textarea::placeholder{color:rgba(244,239,230,.4)!important}
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
.cca-split-headline{position:absolute;top:max(64px,8.5vh);left:50%;transform:translateX(-50%);font-family:${SERIF};font-size:18px;color:rgba(244,239,230,.62);text-align:center;opacity:0;transition:opacity .5s ease .15s;white-space:normal;max-width:min(88vw,560px);text-wrap:balance}
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
.cca-reader{position:absolute;inset:0;display:grid;grid-template-columns:200px minmax(0,640px) 190px;grid-template-rows:1fr auto;justify-content:center;gap:0 clamp(28px,3vw,60px);padding:8.5vh 4vw 3vh}
.cca-reader-profile{grid-column:1;grid-row:1;display:flex;flex-direction:column;align-items:center;gap:5px;align-self:center;padding:26px 20px 20px;border:1px solid rgba(230,204,146,.16);border-radius:20px;background:linear-gradient(180deg,rgba(244,239,230,.05),rgba(244,239,230,.012));box-shadow:0 24px 60px -34px rgba(0,0,0,.65);opacity:0;transform:translateX(-24px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-reader-profile{opacity:1;transform:none}
.cca-reader-avatar{margin-bottom:2px}
.cca-reader-name{font-family:${SERIF};font-size:20px;color:${INK};margin-top:8px;text-align:center}
.cca-reader-role{font-size:12px;color:${GOLD};letter-spacing:.02em;text-align:center}
.cca-reader-pdiv{position:relative;align-self:stretch;height:1px;margin:16px 4px 2px;background:linear-gradient(90deg,transparent,rgba(230,204,146,.3),transparent)}
.cca-reader-pdiv span{position:absolute;left:50%;top:50%;width:5px;height:5px;background:${GOLD};border-radius:1px;transform:translate(-50%,-50%) rotate(45deg)}
.cca-reader-fact{align-self:stretch;display:flex;align-items:flex-start;gap:11px;margin-top:14px}
.cca-reader-fic{flex-shrink:0;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${GOLD};border:1px solid rgba(230,204,146,.28);background:rgba(230,204,146,.05)}
.cca-reader-fbody{display:flex;flex-direction:column;gap:3px;padding-top:1px}
.cca-reader-fbody span{color:rgba(244,239,230,.44);text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:600}
.cca-reader-fbody b{color:rgba(244,239,230,.8);font-weight:400;font-size:12px;line-height:1.5}
.cca-reader-body{grid-column:2;grid-row:1;overflow-y:auto;max-width:640px;justify-self:center;width:100%;display:flex;flex-direction:column;justify-content:safe center;scrollbar-width:none;-webkit-mask-image:linear-gradient(#000 92%,transparent);mask-image:linear-gradient(#000 92%,transparent);opacity:0;transform:translateY(12px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-reader-body{opacity:1;transform:none}
.cca-reader-body::-webkit-scrollbar{width:0;height:0}
.cca-reader-title{font-family:${SERIF};font-size:30px;color:${INK};line-height:1.15;margin:0 0 8px;text-wrap:balance}
.cca-reader-rule{position:relative;height:1px;width:min(100%,320px);margin:0 0 30px;background:linear-gradient(90deg,rgba(230,204,146,.55),rgba(230,204,146,.04))}
.cca-reader-rule span{position:absolute;left:0;top:50%;width:7px;height:7px;background:${GOLD};border-radius:1px;transform:translate(-2px,-50%) rotate(45deg);box-shadow:0 0 9px rgba(230,204,146,.55)}
.cca-reader-body section{margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid rgba(244,239,230,.07)}
.cca-reader-body section:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.cca-reader-sechead{display:flex;align-items:center;gap:14px;margin-bottom:11px}
.cca-reader-sic{flex-shrink:0;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${GOLD};border:1px solid rgba(230,204,146,.3);background:rgba(230,204,146,.05)}
.cca-reader-h{font-family:${SERIF};font-size:18px;color:${GOLD};margin:0;letter-spacing:.01em;line-height:1.2}
.cca-reader-p{font-family:${SERIF};font-size:16px;line-height:1.62;color:rgba(244,239,230,.86);margin:0 0 9px;max-width:62ch}
.cca-reader-nav{grid-column:3;grid-row:1;position:relative;display:flex;flex-direction:column;gap:4px;align-self:center;padding-left:20px;opacity:0;transform:translateX(24px);transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
.cca-scene-on .cca-reader-nav{opacity:1;transform:none}
.cca-reader-nav::before{content:'';position:absolute;left:5px;top:16px;bottom:16px;width:1px;background:linear-gradient(180deg,rgba(230,204,146,.34),rgba(230,204,146,.07))}
.cca-reader-nav button{position:relative;display:block;background:none;border:none;cursor:pointer;color:rgba(244,239,230,.38);font:inherit;font-size:12.5px;line-height:1.35;padding:9px 0;text-align:left;transition:color .2s ease}
.cca-reader-nav button.on{color:${GOLD}}
.cca-reader-nav .dot{position:absolute;left:-19px;top:14px;width:9px;height:9px;border-radius:50%;background:rgba(244,239,230,.24);box-shadow:0 0 0 3px #262624;transition:background .2s ease,box-shadow .2s ease}
.cca-reader-nav button.on .dot{background:${GOLD};box-shadow:0 0 0 3px #262624,0 0 10px rgba(230,204,146,.55)}
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
.cca-tuto-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:8px}
.cca-tuto-cta{align-self:flex-start}

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
  .cca-split-headline{top:max(58px,3vh);font-size:15px}
  .cca-reader{grid-template-columns:1fr;grid-template-rows:auto 1fr auto;padding:7vh 6vw 3vh;gap:12px 0}
  .cca-reader-profile{grid-column:1;grid-row:1;flex-direction:row;align-items:center;gap:12px;flex-wrap:wrap}
  .cca-reader-body{grid-column:1;grid-row:2}
  .cca-reader-nav{grid-column:1;grid-row:3;flex-direction:row;flex-wrap:wrap;gap:6px 14px}
  .cca-reader-suggests{grid-row:4}
}

/* ═══ Voix « Punch » (Sherpas) — PARTAGÉE : l'Assistant vend et Le Précepteur enseigne
   avec le MÊME punch. Révélation mot à mot + mot-clé en boîte dorée grotesque MAJUSCULE. ═══ */
@keyframes svPop{0%{opacity:0;transform:translateY(6px) scale(.98)}60%{opacity:1;transform:translateY(0) scale(1.02)}100%{transform:translateY(0) scale(1)}}
.sv-w{display:inline-block}
.sv-pop{animation:svPop .3s cubic-bezier(.16,1,.3,1) both}
.sv-key{font-family:${GROTESQUE};text-transform:uppercase;font-weight:800;letter-spacing:-.01em;color:#2a140c;background:${GOLD};border-radius:9px;padding:0 9px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
@media (prefers-reduced-motion: reduce){ .sv-pop{animation-duration:.001s!important} }
`;
