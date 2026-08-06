import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize2, Rewind, FastForward, ListTree, AlignLeft, X, Sparkles, Loader2 } from 'lucide-react';
import { useEcran, taillePointage } from '@/hooks/useEcran';

/**
 * ImmersiveVideoPlayer — rend une VRAIE vidéo (replay Zoom, rendu post-prod) dans la
 * coque immersive LIRI (fond chaud #262624, halo ambiant, typographie éditoriale),
 * au lieu du <video> encadré plat. Unifie le rendu avec le Précepteur.
 *
 * Props :
 *   src, poster, title, description
 *   crumb    { module, semaine, jour }
 *   cues     [{ t:secondes, text }]  — transcription horodatée (sync + repères auto)
 *   transcript  texte brut (repli si pas de cues)
 *   chapters [{ t, label, summary }] — chapitrage IA persisté ; sinon repères dérivés localement
 *   chaptersSource  'ia' | 'repli'   — origine de `chapters` : 'repli' = heuristique
 *                                      SERVEUR (l'IA a échoué). On continue alors
 *                                      d'annoncer des « repères automatiques » : sans
 *                                      cela, un résultat dégradé passait pour un vrai
 *                                      chapitrage dès que le parent l'injectait.
 *   onGenerateChapters  (force:boolean) => void — si fourni (créateur), bouton
 *                                      « Chapitrer avec l'IA ». `force` vaut vrai
 *                                      quand le bouton dit « Rechapitrer » : sans
 *                                      lui, l'API renvoie son cache et le clic ne
 *                                      régénère RIEN tout en annonçant le contraire.
 *   chaptersState  { state:'idle'|'working'|'error'|'done', message }
 *   onExit
 */

const T = {
  bg: '#262624', ink: '#f4efe6', terra: '#d97757', gold: '#e6cc92',
  line: 'rgba(244,239,230,0.10)', muted: 'rgba(244,239,230,0.62)', faint: 'rgba(244,239,230,0.40)',
  serif: "'Cormorant Garamond','Source Serif 4',Georgia,serif",
  body: "'Source Serif 4', Georgia, serif",
  grotesque: "'Bricolage Grotesque', system-ui, sans-serif",
};

const CSS = `
@keyframes ivpBreathe { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.9;transform:scale(1.06)} }
@keyframes ivpSpin { to{transform:rotate(360deg)} }
.ivp-scroll::-webkit-scrollbar{width:8px}
.ivp-scroll::-webkit-scrollbar-thumb{background:rgba(217,119,87,.28);border-radius:8px}
.ivp-cue{transition:background .2s ease, color .2s ease}
.ivp-ctl{transition:background .18s ease, border-color .18s ease, transform .12s ease}
.ivp-ctl:hover{transform:translateY(-1px)}
@media (prefers-reduced-motion: reduce){ .ivp-amb{animation:none!important} .ivp-cue,.ivp-ctl{transition:none!important} }
`;

const fmt = (s) => {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + ':' + String(x).padStart(2, '0');
};

/**
 * Débuts d'étiquette refusés. Deux niveaux, parce qu'un seul ne suffit pas :
 *
 *  - STRICT : tout ce qui trahit un fragment d'oral ou une phrase anaphorique —
 *    connecteurs, tics de langue, pronoms, démonstratifs. On le tente d'abord :
 *    ce qui passe ce filtre ressemble à un vrai titre.
 *  - SOUPLE : uniquement les connecteurs et les tics. Second passage, quand le
 *    filtre strict n'a rien laissé : une phrase complète (« Nous allons voir la
 *    digestion ») reste MILLE fois plus lisible qu'un « Partie 4 » anonyme.
 *
 * ⚠️ « la » (article) n'est PAS interdit — « La circulation sanguine… » est un
 * excellent repère. Seul « là » (adverbe, accentué) l'est. La confusion des deux
 * faisait retomber TOUTES les étiquettes sur « Partie N » (vérifié en test).
 * Mêmes listes côté API (replay-chapters.service.ts) : le front et l'API ne
 * partagent aucun bundle, la duplication est assumée.
 */
const TICS = "et|mais|donc|or|alors|car|parce|puis|ensuite|voilà|voila|bon|ben|euh|ok|okay|oui|non|que|qu'|qui|quoi|dont|ou|enfin|bref|du coup|en fait|attends|attendez|excuse|excusez|alright|so|well";
const ANAPHORES = "où|c'est|ça|ca|cela|ce|cet|cette|ces|je|j'|tu|il|elle|on|nous|vous|ils|elles|là|ici|si|quand|comme|par exemple";
const DEBUT_INTERDIT = new RegExp(`^(${TICS}|${ANAPHORES})\\b`, 'i');
const DEBUT_INTERDIT_SOUPLE = new RegExp(`^(${TICS})\\b`, 'i');

/**
 * Cherche AU VOISINAGE d'une borne un cue exploitable comme étiquette.
 * Exigences (dans l'ordre où elles éliminent les faux chapitres constatés en prod
 * — « Excuse », « Mais deux fois, c'est no », « parce que vo ») :
 *   1. le cue doit COMMENCER une phrase : le cue précédent se termine par . ! ? … »
 *      (sinon on tombe au milieu d'une phrase, d'où les débuts absurdes) ;
 *   2. au moins 4 mots (« Excuse » n'est pas un chapitre) ;
 *   3. ne commence pas par une conjonction / un mot vide ;
 *   4. coupe sur une FRONTIÈRE DE MOT, avec ellipse (jamais « parce que vo »).
 * On tolère un décalage de quelques cues autour de la borne : mieux vaut un repère
 * lisible 20 s plus loin qu'un fragment illisible pile à l'heure.
 */
function labelDepuisCues(cues, t) {
  let idx = cues.findIndex((c) => c.t >= t);
  if (idx < 0) idx = cues.length - 1;
  for (const filtre of [DEBUT_INTERDIT, DEBUT_INTERDIT_SOUPLE]) {
    for (const d of [0, 1, 2, -1, 3, -2]) {
      const i = idx + d;
      if (i < 0 || i >= cues.length) continue;
      const texte = String(cues[i]?.text || '').trim();
      const precedent = i > 0 ? String(cues[i - 1]?.text || '').trim() : '';
      if (i > 0 && !/[.!?…»]$/.test(precedent)) continue;
      if (texte.split(/\s+/).filter(Boolean).length < 4) continue;
      if (filtre.test(texte)) continue;
      let phrase = texte.split(/[.!?…]/)[0].trim();
      if (phrase.length > 52) phrase = `${phrase.slice(0, 52).replace(/\s+\S*$/, '')}…`;
      if (phrase.split(/\s+/).filter(Boolean).length < 4) continue;
      return phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
  }
  return '';
}

/**
 * REPÈRES AUTOMATIQUES (repli local) — utilisés UNIQUEMENT quand aucun chapitrage
 * IA n'existe pour ce replay.
 *
 * POURQUOI PAS UN DÉCOUPAGE RÉGULIER (l'ancienne version) : diviser la durée en N
 * parts égales produit des bornes qui ne correspondent à RIEN dans le discours ;
 * l'étiquette tombe alors en plein milieu d'une phrase. Sur un direct de 3 h 44 cela
 * donnait « Excuse », « Mais deux fois, c'est no », « Alright So dit que tu… ».
 *
 * CE QU'ON FAIT À LA PLACE : on pose les bornes aux plus grands SILENCES. Les cues
 * étant des paragraphes fusionnés, l'écart entre deux départs consécutifs est un bon
 * proxy du temps de parole + pause qui les sépare : un grand écart = une respiration,
 * donc un candidat naturel à la rupture.
 * Sans étiquette acceptable, on écrit « Partie N » — plus honnête qu'un fragment.
 *
 * ⚠️ PIÈGE CORRIGÉ (couverture) : avec un pas FIXE de 4 à 15 min et un plafond de
 * 14 repères, la fin d'un long direct n'était JAMAIS atteinte — et comme on retient
 * le PREMIER cue de plus grand écart, le pas réel s'écrasait sur son minimum. Mesuré
 * sur « L'arbre du Manikongo » (3 h 44, 1 121 cues) : dernier repère à 02:10:23, donc
 * 1 h 33 de vidéo (42 %) sans aucun repère — et l'entrée surlignée restait la même
 * pendant tout ce temps. Le pas est donc RECALCULÉ à chaque tour depuis le temps
 * restant et le nombre de repères encore posables : la couverture s'auto-corrige.
 * Sur un très long direct les chapitres dépassent forcément 15 min : c'est la
 * conséquence assumée du plafond de 14 entrées (au-delà, la liste devient illisible).
 *
 * Cela reste une HEURISTIQUE : elle ne lit pas le sens. Le vrai chapitrage est celui
 * de l'IA (POST /masterclass-factory/chapters-from-replay), rendu via la prop `chapters`.
 * ⚠️ Miroir EXACT de `repli()` côté API (replay-chapters.service.ts) : toute correction
 * ici doit y être reportée — les deux applications ne partagent aucun bundle.
 */
const MAX_CHAPITRES = 14; // plafond dur : au-delà, la liste devient illisible

function deriveChapters(cues, duration) {
  const MIN = 240;  // 4 min : en dessous, ce n'est plus un chapitre
  if (!cues?.length || cues.length < 4 || !duration) return [];

  // On ne pose des repères que sur ce qui est TRANSCRIT : si les cues s'arrêtent
  // à mi-parcours (VTT partiel), rien à étiqueter au-delà.
  const fin = Math.min(duration, cues[cues.length - 1].t + 60);
  const bornes = [0];
  let courant = 0;
  while (courant + MIN < fin && bornes.length < MAX_CHAPITRES) {
    // Pas CIBLE : ce qu'il reste à couvrir, réparti sur les repères restants.
    const pas = Math.max(MIN, (fin - courant) / (MAX_CHAPITRES - bornes.length));
    const bas = courant + Math.max(MIN, pas * 0.6);
    const haut = Math.min(courant + pas * 1.4, fin);
    if (bas >= fin) break;
    let meilleur = -1;
    let meilleurEcart = -1;
    let meilleureDist = Infinity;
    for (let i = 1; i < cues.length; i++) {
      const t = cues[i].t;
      if (t < bas) continue;
      if (t > haut) break;
      const ecart = t - cues[i - 1].t; // proxy du silence précédant ce cue
      const dist = Math.abs(t - (courant + pas)); // écart au pas cible
      // À silence ÉGAL (débit régulier : le cas le plus fréquent), on prend le
      // candidat le plus proche du pas cible. Sans ce départage, le premier cue
      // de la fenêtre gagnait toujours et le pas retombait à son minimum.
      if (ecart > meilleurEcart || (ecart === meilleurEcart && dist < meilleureDist)) {
        meilleurEcart = ecart; meilleureDist = dist; meilleur = i;
      }
    }
    if (meilleur < 0) { // blanc dans la transcription : on avance d'un cran
      courant = haut;
      if (haut >= fin) break;
      continue;
    }
    courant = cues[meilleur].t;
    bornes.push(courant);
  }

  return bornes.map((t, i) => ({ t, label: labelDepuisCues(cues, t) || `Partie ${i + 1}` }));
}

function ImmersiveVideoPlayer({ src, poster, title, description, crumb, cues, transcript, chapters, chaptersSource, onGenerateChapters, chaptersState, onExit, embedded = false, headerAction = null }, ref) {
  const vref = useRef(null);
  const railRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('transcript');
  const [railOpen, setRailOpen] = useState(false);

  // 900 px = point de rupture DICTÉ PAR LE CONTENU : c'est la largeur sous
  // laquelle le rail de transcription (clamp(300px,27vw,384px)) ne cohabite plus
  // avec une vidéo lisible. Rien à voir avec une taille de téléphone.
  // `tactile` est mesuré séparément : la largeur ne dit pas si on vise au doigt.
  const { etroit: narrow, tactile } = useEcran(900);
  // ⚠️ DEUX seuils DISTINCTS, et le piège qu'ils évitent : `narrow` (<900) décide
  // si le rail est en colonne ou en tiroir — donc son DÉCLENCHEUR doit exister sur
  // toute cette plage. `etroit` (<768) ne décide que de la COMPACITÉ de l'en-tête.
  // Les confondre rouvrait le défaut d'origine entre 768 et 900 px : rail en
  // tiroir, mais plus aucun bouton pour l'ouvrir.
  const { etroit } = useEcran(768);
  // Second seuil, lui aussi dicté par le contenu : la rangée de contrôles réclame
  // ~420 px (6 cibles + le chrono + les écarts). Elle casse donc bien plus bas que
  // le rail. Deux contenus, deux ruptures — pas un seuil unique plaqué partout.
  const { etroit: etroitCtl } = useEcran(560);
  const cible = taillePointage(40, tactile);
  const cyclerVitesse = useCallback(
    () => setRate((r) => VITESSES[(VITESSES.indexOf(r) + 1) % VITESSES.length] ?? 1),
    [],
  );

  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Chapitrage IA (persisté) s'il existe, sinon repères dérivés localement. On
  // garde l'origine : elle change ce qu'on annonce à l'élève (de vrais chapitres
  // vs de simples repères), et on ne veut pas faire passer l'heuristique pour un
  // travail éditorial.
  const chapsFournis = Array.isArray(chapters) && chapters.length ? chapters : null;
  // Des chapitres fournis mais issus du REPLI serveur restent une heuristique :
  // on ne les fait pas passer pour un vrai chapitrage (même mention, même bouton
  // « Chapitrer » plutôt que « Rechapitrer »).
  const chapsIa = chapsFournis && chaptersSource !== 'repli' ? chapsFournis : null;
  const chapsLocaux = useMemo(() => deriveChapters(cues, dur), [cues, dur]);
  const chaps = chapsFournis || chapsLocaux;
  const chapsDerives = !chapsIa && chaps.length > 0;
  const chapWorking = chaptersState?.state === 'working';
  // Le bouton de chapitrage vit dans le rail : on ouvre le rail dès qu'un créateur
  // peut agir, même sans transcription affichable (sinon l'action serait inatteignable).
  const hasRail = Boolean(cues?.length || transcript || chaps.length || onGenerateChapters);
  const activeCue = useMemo(() => {
    if (!cues?.length) return -1;
    let lo = 0, hi = cues.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (cues[mid].t <= cur + 0.25) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }, [cues, cur]);
  const activeChap = useMemo(() => {
    if (!chaps.length) return -1;
    let ans = 0; for (let i = 0; i < chaps.length; i++) if (chaps[i].t <= cur + 0.25) ans = i;
    return ans;
  }, [chaps, cur]);

  const seek = useCallback((t) => { const v = vref.current; if (v) { v.currentTime = Math.max(0, Math.min(t, v.duration || t)); setCur(v.currentTime); } }, []);
  const toggle = useCallback(() => { const v = vref.current; if (!v) return; if (v.paused) v.play(); else v.pause(); }, []);
  // API impérative (seek depuis un nœud du mindmap dans la coque classe)
  useImperativeHandle(ref, () => ({ seekTo: seek, play: () => vref.current?.play(), pause: () => vref.current?.pause() }), [seek]);

  useEffect(() => {
    if (tab !== 'transcript' || activeCue < 0 || !railRef.current) return;
    const el = railRef.current.querySelector(`[data-cue="${activeCue}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [activeCue, tab, reduce]);

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') seek(cur + 10);
      else if (e.key === 'ArrowLeft') seek(cur - 10);
      else if (e.key === 'Escape') { if (railOpen) setRailOpen(false); else onExit?.(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [cur, seek, toggle, onExit, railOpen]);

  useEffect(() => { const v = vref.current; if (v) v.playbackRate = rate; }, [rate]);
  const pct = dur ? (cur / dur) * 100 : 0;

  const rail = (
    <aside style={{ width: narrow ? '100%' : 'clamp(300px, 27vw, 384px)', flexShrink: 0, borderLeft: narrow ? 'none' : `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', background: narrow ? T.bg : 'rgba(0,0,0,0.16)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 14px 2px' }}>
        {[['transcript', 'Transcription', AlignLeft], ['chapters', 'Chapitres', ListTree]].map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="ivp-ctl"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: T.grotesque, fontSize: 12.5, fontWeight: 700,
              border: `1px solid ${tab === k ? 'rgba(217,119,87,0.4)' : 'transparent'}`, background: tab === k ? 'rgba(217,119,87,0.15)' : 'transparent', color: tab === k ? T.ink : T.faint }}>
            <Icon size={14} /> {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {narrow && <button type="button" onClick={() => setRailOpen(false)} className="ivp-ctl" style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 6 }}><X size={18} /></button>}
      </div>
      <div ref={railRef} className="ivp-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 6px 26px' }}>
        {tab === 'transcript' ? (
          cues?.length ? cues.map((c, i) => (
            <button key={i} data-cue={i} type="button" onClick={() => seek(c.t)} className="ivp-cue"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 2,
                background: i === activeCue ? 'rgba(217,119,87,0.16)' : 'transparent', color: i === activeCue ? T.ink : (i < activeCue ? T.faint : T.muted) }}>
              <span style={{ fontFamily: T.grotesque, fontSize: 10.5, color: i === activeCue ? T.gold : T.faint, fontVariantNumeric: 'tabular-nums', marginRight: 8 }}>{fmt(c.t)}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.55, fontWeight: i === activeCue ? 600 : 400 }}>{c.text}</span>
            </button>
          )) : transcript ? <p style={{ whiteSpace: 'pre-wrap', color: T.muted, fontSize: 13.5, lineHeight: 1.75, padding: '4px 14px' }}>{transcript}</p>
            : <p style={{ color: T.faint, fontSize: 13, padding: '20px 14px', textAlign: 'center' }}>Transcription bientôt disponible.</p>
        ) : (
          <>
            {/* Action créateur : le chapitrage sémantique consomme des jetons IA,
                il n'est donc proposé que si le parent fournit le handler (l'élève
                n'a pas ce bouton, et l'API le refuserait de toute façon). */}
            {onGenerateChapters && (
              <div style={{ padding: '4px 8px 10px' }}>
                {/* `force` = REFAIRE le chapitrage. Vrai uniquement quand le bouton
                    dit « Rechapitrer » (des chapitres IA existent déjà en base) :
                    sans ce paramètre, l'API renvoyait son cache et le clic annonçait
                    une génération qui n'avait pas eu lieu. Faux au premier chapitrage :
                    il n'y a rien à écraser, et forcer coûterait un appel modèle. */}
                <button type="button" onClick={() => onGenerateChapters(Boolean(chapsIa))} disabled={chapWorking} className="ivp-ctl"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999, width: '100%', justifyContent: 'center',
                    border: '1px solid rgba(217,119,87,0.42)', background: 'rgba(217,119,87,0.14)', color: '#f0c3ac',
                    cursor: chapWorking ? 'wait' : 'pointer', opacity: chapWorking ? 0.7 : 1,
                    fontFamily: T.grotesque, fontSize: 12.5, fontWeight: 700 }}>
                  {chapWorking
                    ? <Loader2 size={14} style={{ animation: reduce ? 'none' : 'ivpSpin .9s linear infinite' }} />
                    : <Sparkles size={14} />}
                  {chapWorking ? 'Chapitrage en cours…' : chapsIa ? 'Rechapitrer avec l\'IA' : 'Chapitrer avec l\'IA'}
                </button>
                {chaptersState?.message ? (
                  <p style={{ margin: '7px 2px 0', fontSize: 11.5, lineHeight: 1.45, color: chaptersState.state === 'error' ? '#f6b8ab' : T.muted }}>
                    {chaptersState.message}
                  </p>
                ) : null}
              </div>
            )}
            {/* Honnêteté : on annonce quand ces repères sont dérivés des silences
                et non d'une lecture du contenu.
                ⚠️ L'APPEL À L'ACTION est réservé à qui PEUT agir : un élève n'a pas
                le bouton (et l'API lui répondrait 403). Lui ordonner de « lancer le
                chapitrage IA » revenait à lui demander l'impossible tout en lui
                annonçant que ce qu'il lit est de seconde zone. */}
            {/* T.muted et non T.faint : à 11 px, T.faint plafonne à 3,4:1 sur le fond
                du rail — sous la norme WCAG (4,5:1) pour du texte courant. Une
                mention d'honnêteté illisible ne remplit pas son office. */}
            {chapsDerives && (
              <p style={{ margin: '0 10px 8px', fontSize: 11, lineHeight: 1.45, color: T.muted }}>
                {onGenerateChapters
                  ? 'Repères automatiques — lance le chapitrage IA pour de vrais chapitres.'
                  : 'Repères automatiques, générés à partir de la transcription.'}
              </p>
            )}
            {chaps.length ? chaps.map((c, i) => (
              <button key={i} type="button" onClick={() => seek(c.t)} className="ivp-ctl"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: 12, cursor: 'pointer', marginBottom: 4,
                  border: `1px solid ${i === activeChap ? 'rgba(217,119,87,0.34)' : 'transparent'}`, background: i === activeChap ? 'rgba(217,119,87,0.12)' : 'transparent' }}>
                <span style={{ fontFamily: T.grotesque, fontSize: 11, fontWeight: 800, color: i === activeChap ? T.gold : T.faint, fontVariantNumeric: 'tabular-nums', minWidth: 40, paddingTop: 3 }}>{fmt(c.t)}</span>
                {/* L'ÉTAT ACTIF SE DIT PAR LE TITRE (couleur + graisse), jamais en
                    éteignant le résumé : une opacité additionnelle sur T.muted le
                    faisait tomber à 3,9:1 (norme 4,5:1) — le texte le moins lisible
                    de l'écran était précisément l'apport du chapitrage IA. À plein
                    T.muted il tient 6,3:1 sur le rail, 6,0:1 en slide-over mobile. */}
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: T.body, fontSize: 14, lineHeight: 1.4, fontWeight: i === activeChap ? 600 : 400, color: i === activeChap ? T.ink : T.muted }}>{c.label}</span>
                  {c.summary ? (
                    <span style={{ display: 'block', marginTop: 3, fontFamily: T.body, fontSize: 12, lineHeight: 1.45, color: T.muted }}>{c.summary}</span>
                  ) : null}
                </span>
              </button>
            )) : <p style={{ color: T.faint, fontSize: 13, padding: '20px 14px', textAlign: 'center' }}>Chapitres bientôt disponibles.</p>}
          </>
        )}
      </div>
    </aside>
  );

  return (
    <div style={{ ...(embedded ? { position: 'relative', width: '100%', height: '100%' } : { position: 'fixed', inset: 0, zIndex: 4000 }), background: T.bg, color: T.ink, fontFamily: T.body, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{CSS}</style>
      {/* Atmosphère */}
      <div aria-hidden className="ivp-amb" style={{ position: 'absolute', top: '-14%', left: '50%', transform: 'translateX(-50%)', width: 'min(1200px,92vw)', height: 520, pointerEvents: 'none', borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(217,119,87,0.20), rgba(217,119,87,0) 72%)', filter: 'blur(8px)', animation: 'ivpBreathe 9s ease-in-out infinite' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(900px 560px at 110% 120%, rgba(230,204,146,0.08), transparent 60%)' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 260px 70px rgba(0,0,0,0.5)' }} />

      {/* En-tête (masqué en mode intégré : l'OS fournit son propre en-tête) */}
      {!embedded && (
      /* ⭐ EN-TÊTE — LA RÈGLE ICI : « ne jamais rendre une fonction inatteignable
         sur mobile ». Cette rangée était un `display:flex` SANS `flexWrap` portant
         QUATRE éléments de largeur intrinsèque (retour, titre, action, rail). À
         375 px elle débordait de 159 px, et le parent étant en `overflow:hidden`,
         le bouton « Transcription » se retrouvait à 85 px HORS ÉCRAN, sans même
         un défilement pour aller le chercher : l'élève ne pouvait plus ouvrir ni
         la transcription ni les chapitres. Tout le chapitrage sémantique — mis en
         avant dans la vidéothèque par un badge « 14 chapitres » — devenait mort
         au doigt.

         La correction n'est pas un `flexWrap` posé par-dessus (il aurait produit
         une rangée en escalier) : c'est une STRUCTURE par contexte.
           • large  → une rangée, comme avant, rien ne bouge ;
           • étroit → rangée 1 = retour (icône seule) + titre + rail (icône seule,
             cible tactile pleine) ; rangée 2 = l'action principale, pleine largeur,
             en bas de portée du pouce.
         `paddingTop` respecte l'encoche : ce lecteur est en `position:fixed` et
         collerait sinon à la barre d'état de l'iPhone. */
      <header style={{
        position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: etroit ? 10 : 16,
        padding: etroit ? '10px 14px' : '14px 22px',
        paddingTop: `calc(${etroit ? 10 : 14}px + env(safe-area-inset-top, 0px))`,
        borderBottom: `1px solid ${T.line}`, flexShrink: 0,
      }}>
        <button type="button" onClick={onExit} className="ivp-ctl"
          aria-label="Retour à la vidéothèque"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: 'none', border: 'none', color: T.muted, cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600, fontFamily: T.grotesque, flexShrink: 0,
            // Au doigt : carré de 44 px, libellé retiré (l'icône flèche suffit,
            // c'est la convention de tous les lecteurs mobiles). À la souris :
            // libellé conservé, il coûte zéro place sur grand écran.
            ...(etroit ? { width: cible, height: cible, padding: 0 } : {}),
          }}>
          <ArrowLeft size={etroit ? 20 : 17} />{etroit ? null : ' Vidéothèque'}
        </button>
        {!etroit && <div style={{ width: 1, height: 22, background: T.line }} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          {crumb && (crumb.module || crumb.semaine || crumb.jour) ? (
            <div style={{ fontFamily: T.grotesque, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: T.terra, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[crumb.module, crumb.semaine, crumb.jour].filter(Boolean).join('  ·  ')}
            </div>
          ) : null}
          {/* Registre produit : échelle de type FIXE, pas fluide. `clamp(…,2vw,…)`
              faisait maigrir le titre selon la fenêtre alors qu'il est déjà tronqué
              par ellipse — deux mécanismes pour un seul problème. */}
          <h1 style={{ margin: 0, fontFamily: T.serif, fontWeight: 600, fontSize: etroit ? 17 : 24, lineHeight: 1.15, letterSpacing: '.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title || 'Session enregistrée'}
          </h1>
        </div>
        {/* Déclencheur du rail : présent sur TOUTE la plage où le rail est en
            tiroir (<900), icône seule seulement quand la place manque (<768). */}
        {narrow && hasRail && (
          <button type="button" onClick={() => setRailOpen(true)} className="ivp-ctl"
            aria-label="Ouvrir la transcription et les chapitres"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0, height: cible, width: etroit ? cible : 'auto', padding: etroit ? 0 : '0 13px', borderRadius: 12, border: `1px solid ${T.line}`, background: 'rgba(244,239,230,0.05)', color: T.ink, cursor: 'pointer', fontFamily: T.grotesque, fontSize: 12.5, fontWeight: 700 }}>
            <AlignLeft size={etroit ? 19 : 15} />{etroit ? null : 'Transcription'}
          </button>
        )}
        {/* En étroit l'action principale prend sa propre ligne, pleine largeur :
            c'est elle qu'on vise le plus souvent, et le bas de l'en-tête est ce
            que le pouce atteint le mieux. En large elle reste dans la rangée.
            (Aucun déclencheur de rail ici en large : le rail y est déjà affiché
            en colonne, cf. plus bas.) */}
        {headerAction ? (
          <div style={etroit ? { flexBasis: '100%', display: 'flex' } : undefined}>{headerAction}</div>
        ) : null}
      </header>
      )}

      {/* Corps */}
      <div style={{ position: 'relative', flex: embedded ? 'none' : 1, minHeight: 0, display: 'flex' }}>
        {/* Le lecteur est en `position:fixed` : sans marge de sécurité basse, les
            contrôles passent sous la barre d'accueil de l'iPhone, qui avale le
            geste. `env()` vaut 0 partout ailleurs — aucun coût sur les autres
            appareils. (Nécessite `viewport-fit=cover` dans index.html.) */}
        <main style={{ flex: embedded ? 'none' : '1 1 auto', width: embedded ? '100%' : undefined, minWidth: 0, display: 'flex', flexDirection: 'column', padding: embedded ? 0 : 'clamp(14px,2.2vw,32px)', paddingBottom: embedded ? 0 : 'calc(clamp(14px,2.2vw,32px) + env(safe-area-inset-bottom, 0px))', overflow: 'hidden' }}>
          <div style={{ position: 'relative', ...(embedded ? { width: '100%', aspectRatio: '16 / 9' } : { flex: 1, minHeight: 0 }), borderRadius: embedded ? 12 : 20, overflow: 'hidden', background: '#000',
            border: '1px solid rgba(217,119,87,0.26)', boxShadow: embedded ? '0 0 90px -40px rgba(217,119,87,0.4)' : '0 34px 100px -34px rgba(0,0,0,0.85), 0 0 130px -42px rgba(217,119,87,0.4)' }}>
            <video ref={vref} src={src} poster={poster} playsInline preload="metadata" onClick={toggle}
              onLoadedMetadata={(e) => { setDur(e.currentTarget.duration || 0); setReady(true); }}
              onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000', cursor: 'pointer' }} />
            {/* Vignette + reflet bas — « posé dans la scène » */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 120px 20px rgba(0,0,0,0.5)', background: 'linear-gradient(to top, rgba(38,38,36,0.5), transparent 22%)' }} />
            {/* Chargement */}
            {!ready && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', border: '2.5px solid rgba(217,119,87,0.25)', borderTopColor: T.terra, animation: reduce ? 'none' : 'ivpSpin .8s linear infinite' }} />
              </div>
            )}
            {/* Play central */}
            {ready && !playing && (
              <button type="button" onClick={toggle} aria-label="Lire" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,19,17,0.24)', border: 'none', cursor: 'pointer' }}>
                <span style={{ width: 78, height: 78, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.96), rgba(217,119,87,0.72))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 10px rgba(217,119,87,0.15), 0 16px 48px -8px rgba(217,119,87,0.62)' }}>
                  <Play size={30} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
                </span>
              </button>
            )}
          </div>

          {/* Contrôles */}
          <div style={{ marginTop: 13, flexShrink: 0 }}>
            <div role="slider" tabIndex={0} aria-label="Progression"
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * dur); }}
              // La barre VISIBLE reste fine (4 px) ; c'est la zone SAISISSABLE qui
              // grandit au doigt. Viser un rail de 16 px de haut en marchant est
              // le geste le plus raté d'un lecteur mobile — et il coûte une
              // reprise de lecture au mauvais endroit, pas juste un clic perdu.
              style={{ position: 'relative', height: tactile ? 30 : 16, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 4, background: 'rgba(244,239,230,0.14)' }} />
              <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 4, background: `linear-gradient(90deg, ${T.terra}, ${T.gold})`, transition: reduce ? 'none' : 'width .12s linear' }} />
              {chaps.map((c, i) => dur ? (
                <span key={i} title={c.label} style={{ position: 'absolute', left: `${(c.t / dur) * 100}%`, width: 2, height: 11, borderRadius: 2, background: i <= activeChap ? T.gold : 'rgba(244,239,230,0.3)', transform: 'translateX(-1px)' }} />
              ) : null)}
              <span style={{ position: 'absolute', left: `${pct}%`, width: 13, height: 13, borderRadius: '50%', background: T.ink, boxShadow: `0 0 0 3px ${T.terra}`, transform: 'translateX(-6px)' }} />
            </div>
            {/* ⭐ CONTRÔLES — deux mises en page, pas un enroulement subi.
                Cette rangée unique en `flexWrap:'wrap'` portait 9 contrôles : à
                375 px elle retombait sur TROIS lignes en escalier (151 px de haut
                mesurés), les vitesses coupées en « 1× 1.25× » puis « 1.5× 2× ».
                Un `wrap` n'est pas une mise en page mobile, c'est l'absence de
                décision. On en prend une :
                  • large  → la rangée unique d'origine, inchangée ;
                  • étroit → rangée d'UTILITAIRES (temps + vitesse + son + plein
                    écran) puis rangée de TRANSPORT centrée et large, là où le
                    pouce tombe. Les quatre boutons de vitesse deviennent UN
                    bouton qui cycle — le geste standard des lecteurs mobiles,
                    et trois cibles de moins à rater. */}
            {etroitCtl ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <div style={{ fontFamily: T.grotesque, fontSize: 13, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(cur)} <span style={{ color: T.faint }}>/ {fmt(dur)}</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  <button type="button" onClick={cyclerVitesse} className="ivp-ctl"
                    aria-label={`Vitesse de lecture : ${rate}×. Toucher pour changer.`}
                    style={{ ...ctl(false, cible), width: 'auto', minWidth: cible, padding: '0 12px', borderRadius: cible / 2, color: rate === 1 ? T.ink : T.gold, fontFamily: T.grotesque, fontSize: 13.5, fontWeight: 700 }}>
                    {rate}×
                  </button>
                  <button type="button" onClick={() => { const v = vref.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }} className="ivp-ctl" aria-label={muted ? 'Rétablir le son' : 'Couper le son'} style={ctl(false, cible)}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
                  <button type="button" onClick={() => vref.current?.requestFullscreen?.()} className="ivp-ctl" aria-label="Plein écran" style={ctl(false, cible)}><Maximize2 size={17} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, marginTop: 12 }}>
                  <button type="button" onClick={() => seek(cur - 10)} className="ivp-ctl" aria-label="Reculer de 10 secondes" style={ctl(false, cible)}><Rewind size={20} /></button>
                  <button type="button" onClick={toggle} className="ivp-ctl" aria-label={playing ? 'Pause' : 'Lire'} style={ctl(true, Math.max(cible + 12, 56))}>
                    {playing ? <Pause size={22} fill={T.bg} color={T.bg} /> : <Play size={22} fill={T.bg} color={T.bg} style={{ marginLeft: 2 }} />}
                  </button>
                  <button type="button" onClick={() => seek(cur + 10)} className="ivp-ctl" aria-label="Avancer de 10 secondes" style={ctl(false, cible)}><FastForward size={20} /></button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={toggle} className="ivp-ctl" aria-label={playing ? 'Pause' : 'Lire'} style={ctl(true)}>
                  {playing ? <Pause size={18} fill={T.bg} color={T.bg} /> : <Play size={18} fill={T.bg} color={T.bg} style={{ marginLeft: 2 }} />}
                </button>
                <button type="button" onClick={() => seek(cur - 10)} className="ivp-ctl" aria-label="-10s" style={ctl(false)}><Rewind size={17} /></button>
                <button type="button" onClick={() => seek(cur + 10)} className="ivp-ctl" aria-label="+10s" style={ctl(false)}><FastForward size={17} /></button>
                <div style={{ fontFamily: T.grotesque, fontSize: 12.5, color: T.muted, fontVariantNumeric: 'tabular-nums', minWidth: 92 }}>{fmt(cur)} <span style={{ color: T.faint }}>/ {fmt(dur)}</span></div>
                <div style={{ flex: 1 }} />
                {VITESSES.map((r) => (
                  <button key={r} type="button" onClick={() => setRate(r)} className="ivp-ctl" style={{ background: 'none', border: 'none', cursor: 'pointer', color: rate === r ? T.gold : T.faint, fontFamily: T.grotesque, fontSize: 12.5, fontWeight: 700, padding: '2px 3px' }}>{r}×</button>
                ))}
                <button type="button" onClick={() => { const v = vref.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }} className="ivp-ctl" aria-label="Son" style={ctl(false)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
                <button type="button" onClick={() => vref.current?.requestFullscreen?.()} className="ivp-ctl" aria-label="Plein écran" style={ctl(false)}><Maximize2 size={16} /></button>
              </div>
            )}
            {description ? <p style={{ color: T.muted, fontSize: 14.5, lineHeight: 1.6, margin: '14px 2px 0', maxWidth: '72ch' }}>{description}</p> : null}
          </div>
        </main>

        {/* Rail : latéral (large) ou slide-over (mobile) — masqué en mode intégré */}
        {hasRail && !embedded && !narrow && rail}
        {hasRail && !embedded && narrow && railOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={() => setRailOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
            <div style={{ position: 'relative', width: 'min(420px, 88vw)', boxShadow: '-20px 0 60px -20px rgba(0,0,0,0.7)' }}>{rail}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default forwardRef(ImmersiveVideoPlayer);

/** Liste unique des vitesses : la rangée large les affiche toutes, l'étroite les cycle. */
const VITESSES = [1, 1.25, 1.5, 2];

/**
 * `taille` surcharge le diamètre historique (42 primaire / 36 secondaire) : au
 * doigt on remonte à 44 px minimum, à la souris on garde la densité d'origine.
 * Les 36 px d'avant se rataient une fois sur trois sur un écran tactile.
 */
function ctl(primary, taille) {
  const d = taille ?? (primary ? 42 : 36);
  return primary
    ? { width: d, height: d, borderRadius: '50%', background: '#f4efe6', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
    : { width: d, height: d, borderRadius: '50%', background: 'rgba(244,239,230,0.06)', border: '1px solid rgba(244,239,230,0.12)', color: '#f4efe6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
}
