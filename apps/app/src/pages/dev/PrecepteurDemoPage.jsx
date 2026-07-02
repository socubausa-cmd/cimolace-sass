import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Volume2, Play, RotateCcw, Check, PenLine } from 'lucide-react';
import {
  Handwriting, speakText, cancelSpeech, canSpeak, estSpeechMs, primeSpeech,
  setPreferredVoiceURI, listFrVoices, setSpeakRate,
} from '@/components/school/course-builder/TableauVivant';
import SketchRenderer from '@/components/school/course-builder/SketchRenderer';
import AnimatedExample from '@/components/school/course-builder/AnimatedExample';
import AnimatedImage from '@/components/school/course-builder/AnimatedImage';
import AtelierPrompt from '@/components/school/course-builder/AtelierPrompt';
import { supabase } from '@/lib/supabaseCompat';
import { invokeGenerateVisualImage } from '@/features/smartboard-konva-editor/lib/designerIaImageHistory';
import { CANONICAL_COURSE } from './precepteurCanonicalCourse';
import { masterclassProjectToPrecepteurCourse } from '@/lib/precepteur/fromMasterclass';

// Clé localStorage : un MasterclassProject déposé ici est transformé et joué à la
// place du cours canonique figé (qui reste le FALLBACK). Voir fromMasterclass.js.
const SOURCE_PROJECT_KEY = 'precepteur:sourceProject';

// Lit un MasterclassProject en localStorage → PrecepteurCourse ; null si absent/invalide.
// Ne jette JAMAIS (démo publique) : toute erreur → null → repli sur le canonique.
function loadCourseFromStorage() {
  try {
    const raw = window.localStorage.getItem(SOURCE_PROJECT_KEY);
    if (!raw) return null;
    const project = JSON.parse(raw);
    const course = masterclassProjectToPrecepteurCourse(project);
    // Garde-fou : un cours sans concept exploitable ne doit pas remplacer le canonique.
    if (!course || !Array.isArray(course.concepts) || course.concepts.length === 0) return null;
    const hasScenes = course.concepts.some((c) => Array.isArray(c.scenes) && c.scenes.length > 0);
    return hasScenes ? course : null;
  } catch { return null; }
}

// décode base64 MP3 -> URL blob jouable
function b64ToAudioUrl(b64, mime) {
  const bin = atob(String(b64));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime || 'audio/mpeg' }));
}

// liri-tts (ElevenLabs Multilingual v2 = le plus réaliste) — EXIGE le token de session.
// Renvoie { b64, mime } en cas de succès, sinon { error } (pour diagnostiquer).
async function ttsFetch(text) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return { error: 'non connecté (pas de session)' };
    const { data, error } = await supabase.functions.invoke('liri-tts', {
      body: { text: String(text || '').slice(0, 4500), languageCode: 'fr', tier: 'export' },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data?.audioBase64) return { b64: data.audioBase64, mime: data.mimeType };
    const detail = (typeof data?.error === 'string' && data.error) || error?.message || 'échec liri-tts';
    return { error: detail };
  } catch (e) { return { error: String(e?.message || e) }; }
}

// Mistral Voxtral TTS (voix française) — edge `mistral-tts`. Renvoie { b64, mime } ou { error }.
async function mistralTtsFetch(text) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return { error: 'non connecté (pas de session)' };
    const { data, error } = await supabase.functions.invoke('mistral-tts', {
      body: { text: String(text || '').slice(0, 4000) },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data?.audioBase64) return { b64: data.audioBase64, mime: data.mimeType };
    const base = (typeof data?.error === 'string' && data.error) || error?.message || 'échec mistral-tts';
    const detail = data?.detail ? ` — ${String(data.detail).slice(0, 120)}` : '';
    const v = data?.voice ? ` [voix:${data.voice}]` : '';
    return { error: base + detail + v };
  } catch (e) { return { error: String(e?.message || e) }; }
}

// OpenAI TTS (gpt-4o-mini-tts) — voix NATURELLE type NotebookLM/ChatGPT — edge `openai-tts`.
async function openaiTtsFetch(text, voice, speed) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return { error: 'non connecté (pas de session)' };
    const { data, error } = await supabase.functions.invoke('openai-tts', {
      body: { text: String(text || '').slice(0, 4000), voice: voice || 'coral', speed: speed || 1.0 },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data?.audioBase64) return { b64: data.audioBase64, mime: data.mimeType };
    const base = (typeof data?.error === 'string' && data.error) || error?.message || 'échec openai-tts';
    const detail = data?.detail ? ` — ${String(data.detail).slice(0, 120)}` : '';
    return { error: base + detail };
  } catch (e) { return { error: String(e?.message || e) }; }
}

// Aiguillage : OpenAI (naturelle) · ElevenLabs · Mistral selon le choix.
const serverTtsFetch = (text, provider, opts) => {
  if (provider === 'mistral') return mistralTtsFetch(text);
  if (provider === 'elevenlabs') return ttsFetch(text);
  return openaiTtsFetch(text, opts?.voice, opts?.speed); // 'openai' (défaut)
};

// JUGE de l'atelier (edge `liri-preceptor-atelier-judge`, LLM) — EXIGE le token de session.
// Même patron que ttsFetch. Renvoie { verdict, ack } (data déballée) ou null sur TOUTE erreur.
// Non bloquant côté AtelierPrompt : null → repli local via resolveAtelierVerdict.
async function judgeAnswerFetch(payload) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return null; // non connecté → repli local
    const { data, error } = await supabase.functions.invoke('liri-preceptor-atelier-judge', {
      body: payload,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) return null;
    if (data && typeof data.verdict === 'string') return { verdict: data.verdict, ack: data.ack };
    return null;
  } catch { return null; }
}

const imgCacheKey = (prompt) => {
  try { return 'precepteur_img_' + btoa(unescape(encodeURIComponent(prompt))).slice(0, 48); } catch { return null; }
};

/**
 * LE PRÉCEPTEUR — lecteur immersif (preuve « temps → spirale »).
 * cf. docs/CAHIER_DE_CHARGE_PRECEPTEUR.md. Route publique /precepteur.
 *
 * Joue la partition scène par scène : leçon écrite à la main + voix → amorce →
 * croquis vectoriel tracé main (balayage) → atelier nominatif (saisie) → analogie animée.
 */

const EXPO = [0.16, 1, 0.3, 1];

function Board({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99, filter: 'blur(2px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, ease: EXPO }}
      className={`relative w-full max-w-4xl overflow-hidden rounded-[28px] bg-white p-7 shadow-2xl ring-1 ring-black/5 md:p-10 ${className}`}
    >
      <div className="pointer-events-none absolute right-5 top-5 flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
        </span>
        <span className="text-[11px] font-semibold text-slate-500">Le Précepteur</span>
      </div>
      {children}
    </motion.div>
  );
}

/**
 * PrecepteurPlayer — LE MOTEUR DE RENDU réutilisable (voix, croquis, atelier, images…).
 * Prend un `course` (forme `PrecepteurCourse`, cf. contrat) et le joue scène par scène.
 * Réutilisé tel quel par la démo canonique (`PrecepteurDemoPage`) ET par le cours
 * numérique issu d'un MasterclassProject (`PrecepteurCoursePage`).
 * @param {{ course: { title: string, concepts: Array<{ title: string, scenes: Object[] }> } }} props
 */
export function PrecepteurPlayer({ course }) {
  const scenes = useMemo(
    () => course.concepts.flatMap((c) => c.scenes.map((s) => ({ ...s, conceptTitle: c.title }))),
    [course],
  );

  const [started, setStarted] = useState(false);
  const [name, setName] = useState('');
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [analogyImages, setAnalogyImages] = useState({}); // sceneIndex -> { url?, loading?, error? }
  const [narrAudio, setNarrAudio] = useState({}); // sceneIndex -> blob URL (voix ElevenLabs)
  const [ttsStatus, setTtsStatus] = useState('pending'); // 'pending' | 'ok' | { error }
  const [voiceChoice, setVoiceChoice] = useState('openai'); // 'openai' | 'elevenlabs' | 'mistral' | voiceURI navigateur
  const [openaiVoice, setOpenaiVoice] = useState('coral'); // timbre OpenAI
  const [frVoices, setFrVoices] = useState([]); // voix françaises du navigateur
  const [voiceSpeed, setVoiceSpeed] = useState(1.0); // débit (Studio Voix)
  const speak = canSpeak();
  // 'openai' | 'elevenlabs' | 'mistral' = voix SERVEUR (TTS réaliste) ; sinon = voix navigateur.
  const serverTts = ['openai', 'elevenlabs', 'mistral'].includes(voiceChoice) ? voiceChoice : null;
  const useServerVoice = !!serverTts;
  const [connected, setConnected] = useState(false); // session présente ? (pour les voix premium)

  // Détecte la session (les voix premium OpenAI/ElevenLabs/Mistral l'exigent).
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setConnected(!!data?.session?.access_token); }).catch(() => {});
    let sub = null;
    try { sub = supabase.auth.onAuthStateChange?.((_e, s) => setConnected(!!s?.access_token))?.data || null; } catch { /* */ }
    return () => { active = false; try { sub?.subscription?.unsubscribe?.(); } catch { /* */ } };
  }, []);

  // Liste des voix FR du navigateur (peut se charger en async → on écoute voiceschanged).
  useEffect(() => {
    if (!speak) return undefined;
    const load = () => setFrVoices(listFrVoices());
    load();
    try { window.speechSynthesis.addEventListener('voiceschanged', load); } catch { /* */ }
    return () => { try { window.speechSynthesis.removeEventListener('voiceschanged', load); } catch { /* */ } };
  }, [speak]);

  // applique le choix de voix navigateur (sinon voix serveur)
  useEffect(() => { setPreferredVoiceURI(useServerVoice ? null : voiceChoice); }, [voiceChoice, useServerVoice]);
  // applique le débit (Studio Voix) à la voix navigateur
  useEffect(() => { setSpeakRate(voiceSpeed); }, [voiceSpeed]);
  const audioRef = useRef(null); // élément <audio> courant
  const narrateTokenRef = useRef(0); // jeton anti-doublon pour les narrations à la demande

  const stopAudio = useCallback(() => {
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; } } catch { /* */ }
  }, []);
  const playAudioUrl = useCallback((url) => {
    stopAudio();
    try { const a = new Audio(url); audioRef.current = a; void a.play().catch(() => {}); } catch { /* */ }
  }, [stopAudio]);

  // VOIX RÉELLE (ElevenLabs via liri-tts) : pré-génère l'audio de chaque scène au
  // démarrage (élève CONNECTÉ). Indépendant des voix du navigateur => fiable.
  useEffect(() => {
    if (!started || !useServerVoice) return undefined;
    let cancelled = false;
    const urls = [];
    scenes.forEach((s, i) => {
      const text = s.narration || s.board_text;
      if (!text) return;
      serverTtsFetch(text, serverTts, { voice: openaiVoice, speed: voiceSpeed }).then((r) => {
        if (cancelled || !r) return;
        if (r.b64) {
          const url = b64ToAudioUrl(r.b64, r.mime);
          urls.push(url);
          setNarrAudio((m) => ({ ...m, [i]: url }));
          setTtsStatus('ok');
        } else if (r.error) {
          setTtsStatus((prev) => (prev === 'ok' ? prev : { error: r.error }));
        }
      });
    });
    return () => { cancelled = true; urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* */ } }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, useServerVoice, serverTts, openaiVoice, voiceSpeed]);

  // PRÉFETCH des images d'analogie dès le départ : Le Précepteur « dessine » l'image
  // (generate-visual-image / Imagen) — pour un élève CONNECTÉ. Sinon repli sur le SVG.
  // En production, ces images sont générées à la création du cours et mises en cache.
  useEffect(() => {
    if (!started) return;
    scenes.forEach((s, i) => {
      if (s.type !== 'image_analogie' || !s.image_prompt) return;
      const ck = imgCacheKey(s.image_prompt);
      let cached = null;
      try { cached = ck ? window.localStorage.getItem(ck) : null; } catch { /* */ }
      if (cached) { setAnalogyImages((m) => ({ ...m, [i]: { url: cached } })); return; }
      setAnalogyImages((m) => ({ ...m, [i]: { loading: true } }));
      invokeGenerateVisualImage(supabase, { prompt: s.image_prompt, size: '1792x1024' })
        .then(({ data, error }) => {
          const url = data?.imageUrl || data?.url;
          if (url) {
            try { if (ck) window.localStorage.setItem(ck, url); } catch { /* */ }
            setAnalogyImages((m) => ({ ...m, [i]: { url } }));
          } else {
            setAnalogyImages((m) => ({ ...m, [i]: { error: error?.message || data?.error || 'indisponible' } }));
          }
        })
        .catch((e) => setAnalogyImages((m) => ({ ...m, [i]: { error: String(e?.message || e) } })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const sc = scenes[idx];
  const advance = useCallback(() => {
    setIdx((i) => {
      if (i >= scenes.length - 1) { setDone(true); return i; }
      return i + 1;
    });
  }, [scenes.length]);

  // ElevenLabs a-t-il CONFIRMÉ son échec ? (sinon on attend la vraie voix, jamais de doublon)
  const ttsFailed = (ttsStatus && typeof ttsStatus === 'object' && ttsStatus.error) ? ttsStatus.error : null;

  // VOIX + CADENCE fusionnées : UNE SEULE voix joue. On avance QUAND LA VOIX A FINI
  // (rythme naturel d'un prof). Filet : durée MIN (le croquis finit de se dessiner) + cap MAX.
  // Tant qu'ElevenLabs n'a pas échoué, on ATTEND son audio (re-run quand il arrive) — pas de
  // synthèse navigateur EN PARALLÈLE (sinon deux voix se croisent).
  useEffect(() => {
    if (!started || done || !sc || sc.type === 'atelier') return undefined;
    let advanced = false;
    const go = () => { if (advanced) return; advanced = true; advance(); };
    cancelSpeech(); stopAudio();
    const text = sc.narration || sc.board_text || '';
    const speechMs = estSpeechMs(text);
    const minMs = sc.type === 'croquis'
      ? ((sc.sketch?.elements?.length || 1) * 1700 + 1800)
      : sc.type === 'image_analogie' ? 3500 : 700;
    let t0 = 0; try { t0 = performance.now(); } catch { t0 = 0; }
    const goAfterMin = () => {
      let el = minMs; try { el = performance.now() - t0; } catch { /* */ }
      if (el < minMs) window.setTimeout(go, minMs - el); else go();
    };
    const url = narrAudio[idx];
    if (useServerVoice && url) {
      // ── VRAIE voix serveur (ElevenLabs / Mistral) : la SEULE qui joue ──
      const a = new Audio(url); audioRef.current = a;
      a.onended = goAfterMin;
      a.onerror = goAfterMin;
      void a.play().catch(() => {});
    } else if (!useServerVoice && speak) {
      // ── voix NAVIGATEUR choisie (française) ──
      speakText(text, { onEnd: goAfterMin });
    } else if (useServerVoice && ttsFailed && speak) {
      // ── voix serveur CONFIRMÉE indispo → repli synthèse (jamais en parallèle) ──
      speakText(text, { onEnd: goAfterMin });
    }
    // sinon (voix serveur choisie, audio pas encore prêt, pas d'échec) : on attend — l'effet
    // se relance quand narrAudio[idx] arrive. Cap de sécurité au cas où.
    const cap = window.setTimeout(go, Math.max(minMs, speechMs * 2.8) + 4500);
    return () => { advanced = true; window.clearTimeout(cap); stopAudio(); cancelSpeech(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, started, done, narrAudio[idx], ttsFailed, useServerVoice]);

  // débloque l'audio DANS le geste (sinon les navigateurs muettent <audio> et la synthèse)
  const begin = () => {
    primeSpeech();
    try { const a = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'); a.volume = 0; void a.play().catch(() => {}); } catch { /* */ }
    setStarted(true);
  };
  const replay = () => { setDone(false); setStarted(true); setIdx(0); };

  // voix À LA DEMANDE (atelier) : ElevenLabs si possible, sinon synthèse navigateur.
  // Jeton : si une narration plus récente démarre, l'ancienne ne joue pas (pas de doublon).
  const narrateNow = useCallback(async (text) => {
    if (!text) return;
    const my = (narrateTokenRef.current += 1);
    cancelSpeech(); stopAudio();
    if (!useServerVoice) { if (speak) speakText(text); return; } // voix navigateur choisie
    const r = await serverTtsFetch(text, serverTts, { voice: openaiVoice, speed: voiceSpeed });
    if (narrateTokenRef.current !== my) return; // dépassée par une narration plus récente
    if (r?.b64) { playAudioUrl(b64ToAudioUrl(r.b64, r.mime)); setTtsStatus('ok'); return; }
    if (r?.error) setTtsStatus((prev) => (prev === 'ok' ? prev : { error: r.error }));
    if (speak) speakText(text);
  }, [speak, stopAudio, playAudioUrl, useServerVoice, serverTts, openaiVoice, voiceSpeed]);

  // JUGE de l'atelier (edge LLM, token de session) — passé à AtelierPrompt.
  // Renvoie { verdict, ack } ou null (repli local). Jamais bloquant.
  const judgeAnswer = useCallback((payload) => judgeAnswerFetch(payload), []);

  // --- rendu d'une scène ---
  const renderScene = (s) => {
    if (s.type === 'lecon') {
      const txt = s.board_text || '';
      const perChar = speak ? Math.max(26, Math.min(70, Math.round((estSpeechMs(s.narration || txt) * 0.7) / Math.max(1, txt.length)))) : 18;
      return (
        <Board>
          {s.title ? <h2 className="mb-3 text-xl font-extrabold text-slate-900 md:text-2xl">{s.title}</h2> : null}
          <div className="text-[17px] leading-relaxed text-slate-700 md:text-lg">
            <Handwriting text={txt} perCharMs={perChar} writing />
          </div>
        </Board>
      );
    }
    if (s.type === 'amorce_croquis') {
      return (
        <Board className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-amber-700">
            <PenLine className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Au tableau</span>
          </div>
          <div className="text-2xl font-bold italic text-slate-800 md:text-3xl">
            <Handwriting text={s.narration} perCharMs={speak ? 46 : 24} writing />
          </div>
        </Board>
      );
    }
    if (s.type === 'croquis') {
      // ÉCRAN DIVISÉ : le texte est poussé à gauche, l'espace de DESSIN s'ouvre à droite.
      return (
        <div className="flex w-full items-stretch gap-3 md:gap-5">
          <motion.div
            initial={{ x: -38, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, ease: EXPO }}
            className="hidden w-[32%] flex-col justify-center md:flex"
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-amber-300/90">
                <PenLine className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Au tableau</span>
              </div>
              <p className="text-[15px] leading-relaxed text-white/75">{s.narration}</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ x: 42, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.55, ease: EXPO }}
            className="min-w-0 flex-1"
          >
            <Board className="!max-w-none">
              <div className="h-[62vh] max-h-[540px] w-full"><SketchRenderer sketch={s.sketch} play /></div>
            </Board>
          </motion.div>
        </div>
      );
    }
    if (s.type === 'image_analogie') {
      const img = analogyImages[idx] || {};
      const showImg = !!(img.url || img.loading);
      return (
        <Board>
          <div className="grid items-stretch gap-6 md:grid-cols-2">
            {/* L'ANALOGIE : texte + image GÉNÉRÉE puis ANIMÉE (Ken Burns) */}
            <div className="flex flex-col">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">L’analogie</div>
              <p className="text-[16px] leading-relaxed text-slate-700 md:text-[17px]">{s.analogie}</p>
              {showImg ? (
                <AnimatedImage src={img.url} loading={img.loading && !img.url} alt={s.analogie} className="mt-4 aspect-[4/3] w-full" />
              ) : s.analogy_anim ? (
                // pas de photo générée (non connecté) → illustration ANIMÉE pertinente de l'analogie
                <div className="mt-3 h-44 w-full md:h-48"><AnimatedExample subject={s.analogy_anim} /></div>
              ) : null}
            </div>
            {/* DANS LA NATURE : l'exemple animé (mouvement réel, SVG) */}
            {s.animated_example ? (
              <div className="flex flex-col items-center justify-center">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Dans la nature</div>
                <AnimatedExample subject={s.animated_example.subject} caption={s.animated_example.caption} />
              </div>
            ) : null}
          </div>
        </Board>
      );
    }
    if (s.type === 'atelier') {
      return (
        <div className="w-full max-w-4xl">
          <AtelierPrompt scene={s} studentName={name} speak={speak} onNarrate={narrateNow} onContinue={advance} judgeAnswer={judgeAnswer} />
        </div>
      );
    }
    // transition
    return (
      <Board className="text-center">
        <p className="text-xl font-medium italic text-slate-600 md:text-2xl">{s.narration}</p>
      </Board>
    );
  };

  const strong = sc && sc.type === 'image_analogie';
  const wide = sc && (sc.type === 'croquis' || sc.type === 'image_analogie');

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0f17] px-4 py-6 md:py-8" style={{ '--school-accent': '#d4a36a' }}>
      <div className={`mx-auto flex w-full flex-1 flex-col transition-[max-width] duration-500 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {/* En-tête */}
        <div className="mb-2 flex items-center justify-center gap-2 text-amber-400/90">
          <GraduationCap className="h-5 w-5" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Le Précepteur · cours enseigné</span>
        </div>

        {/* Indicateur de voix (diagnostic) */}
        {started ? (
          <div className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider">
            {!useServerVoice ? (
              <span className="text-sky-400/80">🔊 Voix navigateur : {(frVoices.find((v) => v.uri === voiceChoice) || {}).name || 'sélectionnée'}</span>
            ) : ttsStatus === 'ok' ? (
              <span className="text-emerald-400/80">🔊 Voix {serverTts === 'openai' ? 'OpenAI naturelle' : serverTts === 'mistral' ? 'Mistral Voxtral' : 'ElevenLabs'} · réaliste</span>
            ) : ttsStatus === 'pending' ? (
              <span className="text-white/30">🔊 préparation de la voix…</span>
            ) : (
              <span className="text-amber-400/70">🔊 voix navigateur (repli) — {serverTts === 'openai' ? 'OpenAI' : serverTts === 'mistral' ? 'Mistral' : 'ElevenLabs'} indispo : {ttsStatus.error}</span>
            )}
          </div>
        ) : null}

        {/* Progression */}
        {started && !done ? (
          <div className="mb-5 flex items-center justify-center gap-1.5">
            {scenes.map((_, i) => (
              <span key={i} className={`h-1 rounded-full transition-all ${i === idx ? 'w-7 bg-[var(--school-accent)]' : i < idx ? 'w-3 bg-white/35' : 'w-3 bg-white/12'}`} />
            ))}
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-center">
          {!started && !done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EXPO }}
              className="w-full max-w-lg rounded-[28px] border border-white/10 bg-gradient-to-b from-[#11161f] to-[#0c1119] p-9 text-center shadow-2xl md:p-12"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--school-accent)]/15 text-[var(--school-accent)]">
                <Volume2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">{course.title}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
                Cours <strong className="text-white/80">narré et dessiné à la main</strong>. Le professeur t’appellera par ton prénom. Monte le son 🔊.
              </p>

              {/* Bandeau CONNEXION : les voix premium (OpenAI/ElevenLabs/Mistral) exigent une session */}
              {!connected && useServerVoice ? (
                <a
                  href={`/login?redirect=${encodeURIComponent('/precepteur')}`}
                  className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/20"
                >
                  🔊 Connecte-toi pour la <strong>voix premium</strong> (OpenAI) — sinon voix navigateur →
                </a>
              ) : null}

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') begin(); }}
                placeholder="Ton prénom (ex. Badika)"
                className="mt-6 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-base text-white outline-none placeholder:text-white/30 focus:border-[var(--school-accent)]"
              />

              {/* SÉLECTEUR DE VOIX */}
              <div className="mt-4 text-left">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/45">Voix du professeur</label>
                <select
                  value={voiceChoice}
                  onChange={(e) => setVoiceChoice(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-[var(--school-accent)]"
                >
                  <option value="openai" className="bg-[#11161f]">✨ OpenAI — voix naturelle (NotebookLM/ChatGPT)</option>
                  <option value="elevenlabs" className="bg-[#11161f]">⭐ ElevenLabs — réaliste</option>
                  <option value="mistral" className="bg-[#11161f]">🇫🇷 Mistral Voxtral — voix française</option>
                  {frVoices.length ? (
                    <optgroup label="Voix françaises du navigateur" className="bg-[#11161f]">
                      {frVoices.map((v) => (
                        <option key={v.uri} value={v.uri} className="bg-[#11161f]">{v.name} ({v.lang})</option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                {voiceChoice !== 'openai' && !useServerVoice && !frVoices.length ? (
                  <p className="mt-1 text-[11px] text-white/30">Aucune voix navigateur détectée — ElevenLabs/OpenAI restent dispo.</p>
                ) : null}
              </div>

              {/* TIMBRE OpenAI (quand OpenAI choisi) */}
              {voiceChoice === 'openai' ? (
                <div className="mt-3 text-left">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/45">Timbre</label>
                  <select
                    value={openaiVoice}
                    onChange={(e) => setOpenaiVoice(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-[var(--school-accent)]"
                  >
                    <option value="coral" className="bg-[#11161f]">Coral — chaleureuse (femme)</option>
                    <option value="nova" className="bg-[#11161f]">Nova — claire (femme)</option>
                    <option value="shimmer" className="bg-[#11161f]">Shimmer — douce (femme)</option>
                    <option value="sage" className="bg-[#11161f]">Sage — posée (femme)</option>
                    <option value="onyx" className="bg-[#11161f]">Onyx — grave (homme)</option>
                    <option value="ash" className="bg-[#11161f]">Ash — naturelle (homme)</option>
                    <option value="ballad" className="bg-[#11161f]">Ballad — expressive (homme)</option>
                  </select>
                </div>
              ) : null}

              {/* CONTRÔLE DE VITESSE (Studio Voix) — voix navigateur + OpenAI */}
              {(!useServerVoice || voiceChoice === 'openai') ? (
                <div className="mt-3 text-left">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/45">Débit</label>
                  <div className="flex gap-2">
                    {[{ v: 0.85, l: 'Posé' }, { v: 1.0, l: 'Normal' }, { v: 1.15, l: 'Vif' }].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setVoiceSpeed(o.v)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${voiceSpeed === o.v ? 'border-[var(--school-accent)] bg-[var(--school-accent)]/15 text-white' : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'}`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={begin}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--school-accent)] px-7 py-3 text-base font-bold text-black hover:opacity-90"
              >
                <Play className="h-5 w-5" /> Commencer le cours
              </button>
            </motion.div>
          ) : done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EXPO }}
              className="w-full max-w-lg rounded-[28px] border border-white/10 bg-gradient-to-b from-[#11161f] to-[#0c1119] p-12 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--school-accent)]/15 text-[var(--school-accent)]">
                <Check className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Cours terminé</h2>
              <p className="mt-2 text-sm text-white/50">Le temps courbé par l’espace — leçon, croquis, atelier et analogie.</p>
              <button type="button" onClick={replay} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--school-accent)] px-5 py-2.5 text-sm font-bold text-black hover:opacity-90">
                <RotateCcw className="h-4 w-4" /> Revoir le cours
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={idx}
              initial={{ x: strong ? '55%' : '7%', opacity: 0, filter: 'blur(3px)' }}
              animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: strong ? 0.6 : 0.45, ease: EXPO }}
              className="flex w-full justify-center"
            >
              {renderScene(sc)}
            </motion.div>
          )}
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-white/35">
          Démo « Le Précepteur » — leçon → amorce → croquis dessiné (balayage) → atelier nominatif → analogie animée.
          Voix off : ElevenLabs (réaliste) si connecté, sinon synthèse du navigateur.
        </p>
      </div>
    </div>
  );
}

/**
 * PrecepteurDemoPage — route publique /precepteur (démo « temps → spirale »).
 * Si un MasterclassProject est déposé dans localStorage → on joue CE cours (transformé) ;
 * sinon on garde le cours canonique figé (fallback, démo intacte). Lu UNE fois au montage.
 */
export default function PrecepteurDemoPage() {
  const course = useMemo(() => loadCourseFromStorage() || CANONICAL_COURSE, []);
  return <PrecepteurPlayer course={course} />;
}
