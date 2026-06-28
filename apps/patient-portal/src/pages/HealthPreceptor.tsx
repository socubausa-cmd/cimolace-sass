import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertTriangle,
  Send,
  Volume2,
  VolumeX,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import {
  patientApi,
  ApiError,
  type MyTwinState,
  type AssistantTurn,
} from '../lib/api';
import { useBranding } from '../lib/branding';

/**
 * PRÉCEPTEUR SANTÉ — explication pédagogique, guidée et bienveillante du
 * jumeau numérique du patient.
 *
 * Réutilise EXACTEMENT les sources de données des pages existantes :
 *   • `patientApi.getMyTwin()`  → /med/twin-me/state  (comme HealthTwinPage)
 *   • `patientApi.askAssistant()`→ /med/twin-me/assistant (comme HealthAssistant)
 *
 * Les « chapitres » sont dérivés CÔTÉ CLIENT à partir des vraies données du
 * jumeau (organs_scores + wheel). Aucune nouvelle route backend. Aucun
 * diagnostic, aucun terme anxiogène : on explique en langage simple ce que le
 * score veut dire, les facteurs qui l'influencent, et 2-3 leviers d'hygiène de
 * vie concrets. Le bloc « coach » réutilise l'assistant patient (avec son
 * garde-fou d'escalade d'urgence). Disclaimer pédagogique toujours visible.
 */

// Labels FR des axes de la roue (repris de HealthTwinPage pour cohérence).
const WHEEL_LABELS: Record<string, string> = {
  digestion: 'Digestion',
  sleep: 'Sommeil',
  stress: 'Stress',
  energy: 'Énergie',
  inflammation: 'Inflammation',
  immunity: 'Immunité',
  metabolism: 'Métabolisme',
  hormones: 'Hormones',
  physical_activity: 'Activité physique',
  cognition: 'Cognition',
  environment: 'Environnement',
  emotions: 'Émotions',
};

// ── Modèle pédagogique d'un chapitre ──────────────────────────────────
type ScoreBand = 'good' | 'watch' | 'focus' | 'unknown';

type PreceptorChapter = {
  key: string;
  kind: 'intro' | 'organ' | 'axis' | 'outro';
  title: string;
  subtitle: string;
  score: number | null;
  band: ScoreBand;
  // Explication en langage simple (« ce que ça veut dire »).
  meaning: string;
  // Facteurs qui influencent ce score (jamais présenté comme une cause médicale).
  factors: string[];
  // 2-3 leviers d'hygiène de vie concrets.
  levers: string[];
};

// Bande de score → couleur (alignée sur la logique de HealthTwinPage :
// vert ≥ 70, ambre 40-70, rouge < 40), mais nommée de façon NON anxiogène.
function bandFor(score: number | null): ScoreBand {
  if (score == null) return 'unknown';
  if (score >= 70) return 'good';
  if (score >= 40) return 'watch';
  return 'focus';
}

const BAND_META: Record<ScoreBand, { color: string; soft: string; label: string }> = {
  good:    { color: '#10b981', soft: '#ecfdf5', label: 'Point fort' },
  watch:   { color: '#f59e0b', soft: '#fffbeb', label: 'À entretenir' },
  focus:   { color: '#3b82f6', soft: '#eff6ff', label: 'À soutenir en douceur' },
  unknown: { color: '#94a3b8', soft: '#f8fafc', label: 'Pas encore mesuré' },
};

// Phrase de sens générique selon la bande — bienveillante, jamais un diagnostic.
function meaningFor(name: string, band: ScoreBand): string {
  switch (band) {
    case 'good':
      return `Sur le plan « ${name} », vos indicateurs sont plutôt favorables. C'est un appui sur lequel vous pouvez vous reposer ; l'objectif est surtout d'entretenir ce bon équilibre au quotidien.`;
    case 'watch':
      return `Le domaine « ${name} » est dans une zone intermédiaire. Rien d'alarmant : c'est une invitation douce à porter un peu d'attention à quelques habitudes, qui peuvent faire une vraie différence avec le temps.`;
    case 'focus':
      return `« ${name} » mérite qu'on lui accorde un peu d'attention bienveillante en ce moment. Ce n'est pas un diagnostic : c'est un repère pour avancer pas à pas, à votre rythme, idéalement en lien avec votre praticien.`;
    default:
      return `Nous n'avons pas encore de mesure pour « ${name} ». Votre praticien pourra compléter ce repère lors d'une prochaine consultation. En attendant, prendre soin des bases (sommeil, mouvement, alimentation) reste toujours utile.`;
  }
}

// Banque de leviers d'hygiène de vie par domaine. Volontairement génériques,
// concrets et non médicaux (pas de posologie, pas d'examen à prescrire).
const LEVER_BANK: Record<string, string[]> = {
  sleep: [
    'Viser des horaires de coucher et de lever réguliers, même le week-end.',
    'Réduire les écrans lumineux dans l’heure qui précède le sommeil.',
    'Garder la chambre fraîche, sombre et calme.',
  ],
  stress: [
    'S’accorder 5 minutes de respiration lente une à deux fois par jour.',
    'Identifier une petite source de tension et l’alléger cette semaine.',
    'Prévoir des pauses courtes entre les activités exigeantes.',
  ],
  energy: [
    'Bouger un peu chaque jour, même une marche de 10-15 minutes.',
    'Privilégier un petit-déjeuner qui tient au corps.',
    'Respecter ses signaux de fatigue plutôt que de les ignorer.',
  ],
  digestion: [
    'Manger lentement et dans le calme, en mâchant bien.',
    'Ajouter progressivement des légumes et des fibres variées.',
    'Boire de l’eau régulièrement tout au long de la journée.',
  ],
  inflammation: [
    'Favoriser une assiette colorée, riche en végétaux.',
    'Limiter les aliments ultra-transformés quand c’est possible.',
    'Soigner la qualité du sommeil, allié clé de la récupération.',
  ],
  immunity: [
    'Veiller à un sommeil suffisant et régulier.',
    'Maintenir une activité physique douce mais régulière.',
    'Soigner l’hydratation et la variété alimentaire.',
  ],
  metabolism: [
    'Privilégier des repas à heures régulières.',
    'Intégrer un peu de mouvement après les repas (marche douce).',
    'Limiter les boissons sucrées au profit de l’eau.',
  ],
  hormones: [
    'Préserver la régularité du sommeil, qui soutient les rythmes du corps.',
    'Gérer le stress avec des temps de récupération réguliers.',
    'Maintenir une activité physique adaptée à votre forme.',
  ],
  physical_activity: [
    'Choisir une activité qui vous plaît pour tenir dans la durée.',
    'Commencer petit et augmenter progressivement.',
    'Intégrer le mouvement dans le quotidien (escaliers, marche).',
  ],
  cognition: [
    'Préserver un sommeil de qualité, essentiel à la concentration.',
    'Alterner temps de focus et vraies pauses.',
    'Limiter le multitâche sur les tâches importantes.',
  ],
  environment: [
    'Aérer régulièrement vos espaces de vie.',
    'Passer du temps à l’extérieur et à la lumière du jour.',
    'Réduire l’exposition aux nuisances évitables quand c’est possible.',
  ],
  emotions: [
    'Mettre des mots sur ce que vous ressentez, à l’écrit ou à l’oral.',
    'Entretenir des liens sociaux qui vous font du bien.',
    'Vous accorder chaque jour un moment rien que pour vous.',
  ],
};

// Leviers génériques quand le domaine/organe n'est pas dans la banque.
const LEVER_DEFAULT = [
  'Soigner les bases : sommeil régulier, mouvement quotidien, assiette variée.',
  'Avancer par petits pas durables plutôt que par grands changements.',
  'Noter vos questions pour en parler avec votre praticien.',
];

// Facteurs contributifs génériques (jamais présentés comme une cause médicale).
const FACTOR_HINTS = [
  'la qualité et la régularité du sommeil',
  'le niveau de stress et la récupération',
  'l’activité physique de la semaine',
  'l’alimentation et l’hydratation',
];

function leversFor(code: string): string[] {
  return LEVER_BANK[code] || LEVER_DEFAULT;
}

/**
 * Construit les chapitres pédagogiques à partir des VRAIES données du jumeau.
 * Pure (aucun effet de bord), facile à raisonner. On garde un chapitre par
 * organe puis par axe de la roue qui a une mesure ; les plus faibles d'abord
 * pour orienter l'attention là où c'est le plus utile, sans dramatiser.
 */
function buildChapters(twin: MyTwinState, brandName: string): PreceptorChapter[] {
  const chapters: PreceptorChapter[] = [];

  // 1) Intro — pose le cadre bienveillant et pédagogique.
  chapters.push({
    key: 'intro',
    kind: 'intro',
    title: 'Bienvenue dans votre parcours guidé',
    subtitle: `Votre suivi ${brandName}`,
    score: null,
    band: 'unknown',
    meaning:
      'Nous allons parcourir ensemble, pas à pas, les grands repères de votre suivi. Pour chaque thème, je vous explique simplement ce que le repère signifie, ce qui peut l’influencer, et quelques gestes concrets du quotidien. Avancez à votre rythme : précédent / suivant.',
    factors: [],
    levers: [],
  });

  // 2) Organes mesurés (ceux avec un score), triés du plus bas au plus haut.
  const organs = [...twin.organs_scores]
    .filter((o) => o.score != null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  for (const o of organs) {
    const band = bandFor(o.score);
    chapters.push({
      key: `organ:${o.organ_code}`,
      kind: 'organ',
      title: o.label,
      subtitle: 'Organe / système',
      score: o.score,
      band,
      meaning: meaningFor(o.label, band),
      factors: FACTOR_HINTS,
      levers: leversFor(o.organ_code),
    });
  }

  // 3) Axes de la roue mesurés, triés du plus bas au plus haut.
  const axes = [...twin.wheel]
    .filter((d) => d.score != null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  for (const d of axes) {
    const band = bandFor(d.score);
    const name = WHEEL_LABELS[d.domain] || d.domain;
    chapters.push({
      key: `axis:${d.domain}`,
      kind: 'axis',
      title: name,
      subtitle: 'Équilibre de vie',
      score: d.score,
      band,
      meaning: meaningFor(name, band),
      factors: FACTOR_HINTS,
      levers: leversFor(d.domain),
    });
  }

  // 4) Outro — synthèse douce + renvoi vers le coach et le praticien.
  chapters.push({
    key: 'outro',
    kind: 'outro',
    title: 'Et maintenant ?',
    subtitle: 'Vos prochains pas',
    score: null,
    band: 'unknown',
    meaning:
      'Vous avez fait le tour de vos repères. Le plus utile est souvent de choisir UN seul petit geste à tester cette semaine. Une question vous trotte dans la tête ? Posez-la à votre coach ci-dessous — et gardez vos questions importantes pour votre praticien.',
    factors: [],
    levers: [],
  });

  return chapters;
}

// Texte lu par la voix off pour un chapitre (concaténation simple et lisible).
function speechTextFor(ch: PreceptorChapter): string {
  const parts = [ch.title + '.', ch.meaning];
  if (ch.levers.length > 0) {
    parts.push('Quelques pistes : ' + ch.levers.join(' '));
  }
  return parts.join(' ');
}

export function HealthPreceptor() {
  const branding = useBranding();
  const [twin, setTwin] = useState<MyTwinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);

  // ── Chargement du jumeau (même endpoint que HealthTwinPage) ──────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    patientApi
      .getMyTwin()
      .then((d) => {
        if (!cancelled) setTwin(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chapters = useMemo(
    () => (twin ? buildChapters(twin, branding.name) : []),
    [twin, branding.name],
  );

  // Garde l'index dans les bornes si le nombre de chapitres change.
  useEffect(() => {
    if (index > chapters.length - 1) setIndex(Math.max(0, chapters.length - 1));
  }, [chapters.length, index]);

  const current = chapters[index] || null;

  // ── Voix off : speechSynthesis natif (fr-FR), togglable. Pas d'edge fn,
  //    pas de token, pas de dépendance. Déjà le pattern du projet. ───────
  const speak = (ch: PreceptorChapter | null) => {
    if (!ch || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(speechTextFor(ch));
      u.lang = 'fr-FR';
      u.rate = 0.98;
      window.speechSynthesis.speak(u);
    } catch {
      /* la voix off est un confort : on échoue en silence */
    }
  };

  // Quand la voix est active, lire le chapitre courant à chaque changement.
  useEffect(() => {
    if (voiceOn && current) speak(current);
    // Arrêt propre au démontage / changement.
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, current?.key]);

  function toggleVoice() {
    setVoiceOn((on) => {
      const next = !on;
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }

  function go(delta: number) {
    setIndex((i) => Math.min(chapters.length - 1, Math.max(0, i + delta)));
  }

  if (loading) {
    return (
      <div style={{ padding: 24, color: '#64748b' }}>
        Préparation de votre parcours guidé…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 16, background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>
        {error}
      </div>
    );
  }
  if (!twin || !current) return null;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* En-tête */}
      <header style={{ marginBottom: 18 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#0f172a',
          }}
        >
          <GraduationCap size={22} color="var(--brand-primary)" /> Précepteur santé
        </h2>
        <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>
          Un parcours guidé et bienveillant pour comprendre, pas à pas, les
          repères de votre suivi {branding.name}.
        </p>
      </header>

      {/* Disclaimer toujours visible */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: 12,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          color: '#475569',
          fontSize: 12.5,
          marginBottom: 16,
        }}
      >
        <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Information pédagogique, ne remplace pas un avis médical. Ces repères
          ne constituent pas un diagnostic.
        </span>
      </div>

      {/* Barre de progression + voix off */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            background: '#e2e8f0',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={chapters.length}
          aria-valuenow={index + 1}
        >
          <div
            style={{
              height: '100%',
              width: `${((index + 1) / chapters.length) * 100}%`,
              background: 'var(--brand-primary)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
          Chapitre {index + 1} / {chapters.length}
        </span>
        <button
          type="button"
          onClick={toggleVoice}
          aria-pressed={voiceOn}
          title={voiceOn ? 'Couper la voix off' : 'Activer la voix off'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 999,
            border: '1px solid var(--brand-primary)',
            background: voiceOn ? 'var(--brand-primary)' : '#fff',
            color: voiceOn ? '#fff' : 'var(--brand-primary)',
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          {voiceOn ? 'Voix off' : 'Voix off'}
        </button>
      </div>

      {/* Slide du chapitre */}
      <PreceptorSlide chapter={current} />

      {/* Navigation chapitre par chapitre */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          gap: 12,
        }}
      >
        <NavButton
          dir="prev"
          disabled={index === 0}
          onClick={() => go(-1)}
        />
        {/* Pastilles de chapitres */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {chapters.map((c, i) => (
            <button
              key={c.key}
              type="button"
              aria-label={`Aller au chapitre ${i + 1}`}
              onClick={() => setIndex(i)}
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background:
                  i === index ? 'var(--brand-primary)' : '#cbd5e1',
              }}
            />
          ))}
        </div>
        <NavButton
          dir="next"
          disabled={index === chapters.length - 1}
          onClick={() => go(1)}
        />
      </div>

      {/* Coach IA (réutilise l'assistant patient + son garde-fou d'escalade) */}
      <CoachBlock brandName={branding.name} contextTitle={current.title} />
    </div>
  );
}

// ── Slide bespoke (inspirée du SlideRenderer LIRI, mais branding portail) ─
function PreceptorSlide({ chapter }: { chapter: PreceptorChapter }) {
  const meta = BAND_META[chapter.band];
  const showScore = chapter.score != null;
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      {/* Bandeau coloré selon la bande de score */}
      <div
        style={{
          background: meta.soft,
          borderBottom: `1px solid ${meta.color}33`,
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {showScore ? (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: meta.color,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {Math.round(chapter.score as number)}
          </div>
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'var(--brand-primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={24} color="var(--brand-primary)" />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            {chapter.subtitle}
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, margin: '2px 0 0', color: '#0f172a' }}>
            {chapter.title}
          </h3>
          {chapter.band !== 'unknown' && (
            <span
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '2px 10px',
                borderRadius: 999,
                background: '#fff',
                border: `1px solid ${meta.color}`,
                color: meta.color,
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              {meta.label}
            </span>
          )}
        </div>
      </div>

      {/* Corps : ce que ça veut dire + facteurs + leviers */}
      <div style={{ padding: '20px 22px' }}>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#334155', margin: 0 }}>
          {chapter.meaning}
        </p>

        {chapter.factors.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: '#475569',
                marginBottom: 8,
              }}
            >
              Ce qui peut l'influencer
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {chapter.factors.map((f) => (
                <span
                  key={f}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: '#f1f5f9',
                    color: '#475569',
                    fontSize: 12,
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {chapter.levers.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: '#475569',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Lightbulb size={15} color="var(--brand-primary)" />
              Quelques leviers concrets
            </div>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chapter.levers.map((l) => (
                <li
                  key={l}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: '#334155',
                  }}
                >
                  <span
                    style={{
                      marginTop: 7,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--brand-primary)',
                      flexShrink: 0,
                    }}
                  />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function NavButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  const isPrev = dir === 'prev';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 18px',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        background: disabled ? '#f8fafc' : '#fff',
        color: disabled ? '#cbd5e1' : '#0f172a',
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {isPrev ? (
        <>
          <ChevronLeft size={16} /> Précédent
        </>
      ) : (
        <>
          Suivant <ChevronRight size={16} />
        </>
      )}
    </button>
  );
}

// ── Bloc coach : mini-fil de discussion réutilisant askAssistant ──────
type CoachBubble = {
  role: 'user' | 'assistant';
  content: string;
  disclaimer?: string;
  escalate?: boolean;
};

const UNAVAILABLE_MSG =
  "Le coach est momentanément indisponible. Votre parcours reste consultable, réessayez dans un instant.";

function CoachBlock({
  brandName,
  contextTitle,
}: {
  brandName: string;
  contextTitle: string;
}) {
  const [bubbles, setBubbles] = useState<CoachBubble[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bubbles.length, thinking]);

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || thinking) return;
    setError(null);

    // Historique = le fil courant (mêmes règles que HealthAssistant, le
    // serveur tronque). On garde role + content uniquement.
    const history: AssistantTurn[] = bubbles.map((b) => ({
      role: b.role,
      content: b.content,
    }));

    setBubbles((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setThinking(true);

    try {
      const res = await patientApi.askAssistant(text, history);
      setBubbles((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          disclaimer: res.disclaimer,
          escalate: res.escalate,
        },
      ]);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 503
          ? UNAVAILABLE_MSG
          : (e as Error)?.message || UNAVAILABLE_MSG;
      setError(msg);
    } finally {
      setThinking(false);
    }
  }

  const suggested = [
    `Comment soutenir « ${contextTitle} » au quotidien ?`,
    'Par quel petit geste commencer cette semaine ?',
  ];

  const canSend = !!input.trim() && !thinking;

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        marginTop: 22,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Sparkles size={18} color="var(--brand-primary)" />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
            Posez votre question au coach
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Réponses éducatives, basées sur votre suivi {brandName}.
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: 360,
          overflowY: 'auto',
        }}
      >
        {bubbles.length === 0 && !thinking && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggested.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                style={{
                  padding: '7px 13px',
                  background: '#fff',
                  border: '1px solid var(--brand-primary)',
                  color: 'var(--brand-primary)',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {bubbles.map((b, i) =>
          b.role === 'user' ? (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  borderBottomRightRadius: 4,
                  background: 'var(--brand-primary)',
                  color: '#fff',
                  fontSize: 14,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {b.content}
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ maxWidth: '90%', width: '100%' }}>
                {/* Garde-fou d'escalade d'urgence — repris de HealthAssistant */}
                {b.escalate && <EmergencyBanner />}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    borderBottomLeftRadius: 4,
                    background: '#f1f5f9',
                    color: '#0f172a',
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {b.content}
                </div>
                {b.disclaimer && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      padding: '8px 12px',
                      marginTop: 6,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      color: '#64748b',
                      fontSize: 11.5,
                      lineHeight: 1.45,
                    }}
                  >
                    <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{b.disclaimer}</span>
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {thinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 14,
                borderBottomLeftRadius: 4,
                background: '#f1f5f9',
                color: '#64748b',
                fontSize: 14,
              }}
            >
              Le coach réfléchit…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '10px 16px',
            background: '#fef2f2',
            color: '#991b1b',
            fontSize: 13,
            borderTop: '1px solid #fecaca',
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        style={{
          borderTop: '1px solid #e2e8f0',
          padding: 12,
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écrivez votre question…"
          disabled={thinking}
          aria-label="Votre question au coach"
          style={{
            flex: 1,
            padding: '11px 14px',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            fontSize: 14,
            background: thinking ? '#f8fafc' : '#fff',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '11px 20px',
            background: canSend ? 'var(--brand-primary)' : '#94a3b8',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: canSend ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <Send size={16} /> {thinking ? '…' : 'Envoyer'}
        </button>
      </form>
    </section>
  );
}

// Encart urgences — identique à HealthAssistant (ne pas contourner le garde-fou).
function EmergencyBanner() {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 10,
        padding: 12,
        marginBottom: 8,
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 10,
        color: '#991b1b',
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13, lineHeight: 1.45 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>
          Situation potentiellement urgente
        </div>
        Si vous êtes en situation d'urgence, appelez immédiatement le 15 ou le
        112 et contactez votre praticien.
      </div>
    </div>
  );
}
