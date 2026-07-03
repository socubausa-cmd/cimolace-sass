/**
 * PedagogicalBlockRenderer — Rendu étudiant d'un bloc pédagogique.
 * Pédagogie du Futur / ISNA Platform V2
 *
 * Props:
 *   block       { id, type, title, data (JSONB), sort_order }
 *   isActive    boolean — bordure dorée lumineuse
 *   isCompleted boolean — overlay coche verte
 *   onComplete  (score?) => void
 *   onNavigate  (path: string) => void
 */
import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  Monitor,
  FlaskConical,
  Brain,
  FileText,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  Sparkles,
  Radio,
  BookOpen,
} from 'lucide-react';

/* ─── design tokens ────────────────────────────────────────────────────── */
const T = {
  bg: '#262624',
  surface: '#2e2b28',
  surface2: 'rgba(46,43,40,0.5)',
  surface3: '#332f2b',
  border: 'rgba(245,244,238,0.08)',
  borderMid: 'rgba(245,244,238,0.12)',
  // Charte chaude : `gold` (nom hérité) = coral #d97757, plus l'or #D4AF37 d'ISNA.
  gold: '#d97757',
  goldDim: 'rgba(217,119,87,0.14)',
  goldGlow: 'rgba(217,119,87,0.25)',
  teal: '#e08a5f',
  tealDim: 'rgba(224,138,95,0.12)',
  tealGlow: 'rgba(224,138,95,0.25)',
  success: '#22C55E',
  successDim: 'rgba(34,197,94,0.12)',
  danger: '#EF4444',
  warning: '#F59E0B',
  warningDim: 'rgba(245,158,11,0.12)',
  violet: '#e0a458',
  cyan: '#e3aa6b',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
};

/* ─── card shell ───────────────────────────────────────────────────────── */
function BlockCard({ isActive, isCompleted, accentColor, children, style = {} }) {
  const borderColor = isActive
    ? T.gold
    : isCompleted
    ? T.success
    : T.border;

  const shadow = isActive
    ? `0 0 0 1px ${T.goldGlow}, 0 0 18px ${T.goldGlow}`
    : isCompleted
    ? `0 0 0 1px rgba(34,197,94,0.15)`
    : 'none';

  return (
    <div
      style={{
        position: 'relative',
        background: T.bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: shadow,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        ...style,
      }}
    >
      {/* Left accent stripe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: accentColor || T.border,
          borderRadius: '16px 0 0 16px',
        }}
      />

      {/* Completed overlay */}
      {isCompleted && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 4,
          }}
        >
          <CheckCircle2 size={22} color={T.success} fill="rgba(34,197,94,0.15)" />
        </div>
      )}

      <div style={{ padding: '18px 20px 18px 22px' }}>{children}</div>
    </div>
  );
}

/* ─── shared UI helpers ────────────────────────────────────────────────── */
function Badge({ children, color, bg }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: color || T.t1,
        background: bg || T.surface2,
        border: `1px solid ${color || T.border}33`,
      }}
    >
      {children}
    </span>
  );
}

function ActionButton({ onClick, color, children, style = {} }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 18px',
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        border: 'none',
        background: hover
          ? color || T.teal
          : `${color || T.teal}22`,
        color: hover ? '#0b0b0f' : color || T.teal,
        transition: 'background 0.18s, color 0.18s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function BlockTitle({ children, completed }) {
  return (
    <p
      style={{
        margin: '6px 0 0',
        fontSize: 15,
        fontWeight: 700,
        color: completed ? T.t3 : T.t1,
        textDecoration: completed ? 'line-through' : 'none',
        lineHeight: 1.4,
        paddingRight: completed ? 28 : 0,
      }}
    >
      {children}
    </p>
  );
}

/* ─── PulsingDot ───────────────────────────────────────────────────────── */
function PulsingDot({ color }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color || T.teal,
        boxShadow: `0 0 0 0 ${color || T.teal}`,
        animation: 'pbr-pulse 1.6s ease-in-out infinite',
      }}
    />
  );
}

/* ─── keyframes injected once ──────────────────────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('pbr-styles')) {
  const style = document.createElement('style');
  style.id = 'pbr-styles';
  style.textContent = `
    @keyframes pbr-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(224,138,95,0.6); }
      70%  { box-shadow: 0 0 0 7px rgba(224,138,95,0); }
      100% { box-shadow: 0 0 0 0 rgba(224,138,95,0); }
    }
    @keyframes pbr-pulse-gold {
      0%   { box-shadow: 0 0 0 0 rgba(217,119,87,0.6); }
      70%  { box-shadow: 0 0 0 7px rgba(217,119,87,0); }
      100% { box-shadow: 0 0 0 0 rgba(217,119,87,0); }
    }
  `;
  document.head.appendChild(style);
}

/* ══════════════════════════════════════════════════════════════════════
   BLOCK RENDERERS (one per type)
══════════════════════════════════════════════════════════════════════ */

/* ── VideoBlock (previsualisation_video / doctrinal_video) ──────────── */
function VideoBlock({ block, isActive, isCompleted, onComplete, onOpenClassroom }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);
  const { video_url = '' } = block.data || {};

  const isYoutube =
    video_url.includes('youtube.com') || video_url.includes('youtu.be');

  const isVimeo = video_url.includes('vimeo.com');

  const isEmbed = isYoutube || isVimeo;

  function getEmbedSrc() {
    if (isYoutube) {
      const match =
        video_url.match(/[?&]v=([^&]+)/) ||
        video_url.match(/youtu\.be\/([^?]+)/);
      const id = match ? match[1] : '';
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (isVimeo) {
      const match = video_url.match(/vimeo\.com\/(\d+)/);
      const id = match ? match[1] : '';
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    return video_url;
  }

  const accentColor = T.warning;
  const label =
    block.type === 'doctrinal_video' ? 'Vidéo doctrinale' : 'Prévisualisation vidéo';

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
      <Badge color={T.warning} bg={T.warningDim}>
        {label}
      </Badge>
      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>

      {/* Video area */}
      <div
        style={{
          marginTop: 14,
          borderRadius: 10,
          overflow: 'hidden',
          background: '#000',
          aspectRatio: '16/9',
          position: 'relative',
        }}
      >
        {!playing ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)',
              cursor: 'pointer',
              minHeight: 160,
            }}
            onClick={() => setPlaying(true)}
            role="button"
            aria-label="Lancer la vidéo"
          >
            <PlayCircle size={52} color={T.warning} opacity={0.9} />
          </div>
        ) : isEmbed ? (
          <iframe
            src={getEmbedSrc()}
            allow="autoplay; fullscreen; picture-in-picture"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={block.title}
          />
        ) : (
          <video
            ref={videoRef}
            src={video_url}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      {/* Pont « Salle de classe » immersive — si ce bloc vidéo est relié à un cours
          généré (data.content_id), on propose le plein écran narré (le tableau qui
          enseigne). Sinon, ce bouton n'apparaît pas (lecture vidéo classique). */}
      {block?.data?.content_id && onOpenClassroom ? (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => onOpenClassroom(block)}
            title="Voir ce cours en plein écran — le tableau qui enseigne (narré)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(212,163,106,0.14)', border: '1px solid rgba(212,163,106,0.45)',
              borderRadius: 999, padding: '7px 14px', cursor: 'pointer',
              color: '#b07f3c', fontSize: 12.5, fontWeight: 700,
            }}
          >
            <Sparkles size={14} /> Salle de classe
          </button>
        </div>
      ) : null}

      {!isCompleted && (
        <div style={{ marginTop: 14 }}>
          <ActionButton color={T.warning} onClick={onComplete}>
            <CheckCircle2 size={14} />
            Marquer comme vu
          </ActionButton>
        </div>
      )}
    </BlockCard>
  );
}

/* ── LiveBlock (opening_live / closure_live) ────────────────────────── */
function LiveBlock({ block, isActive, isCompleted, onNavigate }) {
  const { scheduled_at } = block.data || {};
  const isOpening = block.type === 'opening_live';
  const accentColor = T.gold;

  // Neutral intra-LIRI target : la salle live précise si le bloc porte un id de
  // session, sinon le hub « Lives » partagé. On ne route JAMAIS vers /t/:slug/*
  // (frontière stricte des 3 realms — un bloc pédagogique LIRI ne doit pas
  // entrer dans le realm tenant).
  const liveSessionId = block.data?.live_session_id ?? block.data?.session_id ?? null;
  const liveHref = liveSessionId ? `/live/${liveSessionId}` : '/lives';

  function formatDate(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  }

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge color={T.gold} bg={T.goldDim}>
          <PulsingDot color={T.gold} />
          EN DIRECT
        </Badge>
        <Badge color={T.t3} bg="transparent">
          {isOpening ? 'Live d\'ouverture' : 'Live de clôture'}
        </Badge>
      </div>

      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>

      <p style={{ margin: '8px 0 0', fontSize: 13, color: T.t3 }}>
        {scheduled_at ? (
          <>
            <Radio size={13} style={{ verticalAlign: 'middle', marginRight: 5, color: T.gold }} />
            {formatDate(scheduled_at)}
          </>
        ) : (
          <span style={{ fontStyle: 'italic', color: T.t4 }}>
            Session non planifiée
          </span>
        )}
      </p>

      {!isCompleted && scheduled_at && (
        <div style={{ marginTop: 14 }}>
          <ActionButton
            color={T.gold}
            onClick={() => onNavigate(liveHref)}
          >
            <Radio size={14} />
            Rejoindre le LIVE
          </ActionButton>
        </div>
      )}
    </BlockCard>
  );
}

/* ── SmartboardBlock ────────────────────────────────────────────────── */
function SmartboardBlock({ block, isActive, isCompleted, onNavigate }) {
  const { deck_id } = block.data || {};
  const accentColor = T.violet;

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
      <Badge color={T.violet} bg="rgba(224,164,88,0.12)">
        SmartBoard
      </Badge>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 14,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: 'rgba(224,164,88,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Monitor size={26} color={T.teal} />
        </div>
        <div>
          <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: T.t3 }}>
            Session interactive
          </p>
        </div>
      </div>

      {!isCompleted && (
        <div style={{ marginTop: 14 }}>
          <ActionButton
            color={T.teal}
            onClick={() =>
              onNavigate(
                `/studio/smartboard-designer${deck_id ? `?deckId=${deck_id}` : ''}`
              )
            }
          >
            <Monitor size={14} />
            Ouvrir le SmartBoard
          </ActionButton>
        </div>
      )}
    </BlockCard>
  );
}

/* ── FrictionBlock ──────────────────────────────────────────────────── */
function FrictionBlock({ block, isActive, isCompleted, onComplete }) {
  const [hintOpen, setHintOpen] = useState(false);
  const { challenge_text = '', hint_text = '' } = block.data || {};
  const accentColor = T.danger;

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <Badge color={T.warning} bg={T.warningDim}>
          Défi de la semaine
        </Badge>
      </div>

      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>

      {challenge_text && (
        <blockquote
          style={{
            margin: '12px 0 0',
            paddingLeft: 14,
            borderLeft: `3px solid ${T.danger}66`,
            color: T.t2,
            fontSize: 13,
            lineHeight: 1.6,
            fontStyle: 'italic',
          }}
        >
          {challenge_text}
        </blockquote>
      )}

      {hint_text && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setHintOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.t3,
              fontSize: 12,
              padding: 0,
            }}
          >
            {hintOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Lightbulb size={13} />
            Afficher l'indice
          </button>

          {hintOpen && (
            <div
              style={{
                marginTop: 8,
                padding: '10px 14px',
                background: 'rgba(245,158,11,0.07)',
                border: `1px dashed ${T.warning}44`,
                borderRadius: 8,
                color: T.t2,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              💡 {hint_text}
            </div>
          )}
        </div>
      )}

      {!isCompleted && (
        <div style={{ marginTop: 14 }}>
          <ActionButton color={T.danger} onClick={onComplete}>
            <CheckCircle2 size={14} />
            J'ai relevé le défi
          </ActionButton>
        </div>
      )}
    </BlockCard>
  );
}

/* ── ExperimentBlock ────────────────────────────────────────────────── */
function ExperimentBlock({ block, isActive, isCompleted, onComplete }) {
  const { instructions = '' } = block.data || {};
  const accentColor = T.teal;

  const steps = instructions
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FlaskConical size={16} color={T.success} />
        <Badge color={T.success} bg={T.successDim}>
          Expérimentation
        </Badge>
      </div>

      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>

      {steps.length > 0 && (
        <ol
          style={{
            margin: '12px 0 0',
            paddingLeft: 20,
            color: T.t2,
            fontSize: 13,
            lineHeight: 1.8,
          }}
        >
          {steps.map((step, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {step}
            </li>
          ))}
        </ol>
      )}

      {!isCompleted && (
        <div style={{ marginTop: 14 }}>
          <ActionButton color={T.success} onClick={onComplete}>
            <FlaskConical size={14} />
            J'ai expérimenté
          </ActionButton>
        </div>
      )}
    </BlockCard>
  );
}

/* ── RecallBlock ────────────────────────────────────────────────────── */
function RecallBlock({ block, isActive, isCompleted, onNavigate }) {
  const accentColor = T.cyan;

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Brain size={16} color={T.teal} />
        <Badge color={T.teal} bg={T.tealDim}>
          Révision SM-2
        </Badge>
      </div>

      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>

      <p style={{ margin: '8px 0 0', fontSize: 13, color: T.t3, lineHeight: 1.5 }}>
        Renforcez votre mémoire à long terme grâce à la répétition espacée.
      </p>

      {!isCompleted && (
        <div style={{ marginTop: 14 }}>
          <ActionButton
            color={T.teal}
            onClick={() => onNavigate('/student-school-life/neuro-recall')}
          >
            <Brain size={14} />
            Lancer la révision
          </ActionButton>
        </div>
      )}
    </BlockCard>
  );
}

/* ── QuizBlock ──────────────────────────────────────────────────────── */
function QuizBlock({ block, isActive, isCompleted, onComplete }) {
  const { questions = [] } = block.data || {};
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect'
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const accentColor = '#dd8f74';

  function handleAnswer(answerIdx) {
    if (selected !== null) return;
    const q = questions[current];
    const correct = answerIdx === q.correct_index;
    setSelected(answerIdx);
    setFeedback(correct ? 'correct' : 'incorrect');
    if (correct) setScore((s) => s + 1);
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setFeedback(null);
    }
  }

  if (!questions.length) {
    return (
      <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
        <Badge color={accentColor} bg="rgba(221,143,116,0.12)">
          Quiz
        </Badge>
        <BlockTitle>{block.title}</BlockTitle>
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: T.t3,
            fontStyle: 'italic',
          }}
        >
          Quiz en préparation…
        </p>
      </BlockCard>
    );
  }

  const q = questions[current];
  const total = questions.length;

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Badge color={accentColor} bg="rgba(221,143,116,0.12)">
          Quiz
        </Badge>
        {!finished && (
          <span style={{ fontSize: 11, color: T.t3 }}>
            {current + 1} / {total}
          </span>
        )}
      </div>

      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>

      {finished ? (
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <p
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: accentColor,
              margin: 0,
            }}
          >
            {score} / {total}
          </p>
          <p style={{ fontSize: 13, color: T.t2, marginTop: 4 }}>
            {score === total
              ? 'Parfait ! Toutes les réponses sont correctes.'
              : score > total / 2
              ? 'Bon résultat !'
              : 'Continuez à réviser !'}
          </p>
          {!isCompleted && (
            <div style={{ marginTop: 14 }}>
              <ActionButton color={accentColor} onClick={() => onComplete(score)}>
                <CheckCircle2 size={14} />
                Valider le quiz
              </ActionButton>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {/* Progress bar */}
          <div
            style={{
              height: 3,
              background: T.border,
              borderRadius: 3,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${((current + (feedback ? 1 : 0)) / total) * 100}%`,
                background: accentColor,
                borderRadius: 3,
                transition: 'width 0.3s',
              }}
            />
          </div>

          <p style={{ fontSize: 14, fontWeight: 600, color: T.t1, margin: '0 0 12px' }}>
            {q.question}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(q.answers || q.options || []).map((answer, ai) => {
              const isSelected = selected === ai;
              const isCorrectAnswer = ai === q.correct_index;
              let bg = T.surface2;
              let borderColor = T.border;
              let textColor = T.t2;

              if (feedback) {
                if (isCorrectAnswer) {
                  bg = T.successDim;
                  borderColor = T.success;
                  textColor = T.success;
                } else if (isSelected && feedback === 'incorrect') {
                  bg = 'rgba(239,68,68,0.12)';
                  borderColor = T.danger;
                  textColor = T.danger;
                }
              } else if (isSelected) {
                bg = `${accentColor}18`;
                borderColor = accentColor;
                textColor = accentColor;
              }

              return (
                <button
                  key={ai}
                  type="button"
                  disabled={selected !== null}
                  onClick={() => handleAnswer(ai)}
                  style={{
                    textAlign: 'left',
                    padding: '9px 14px',
                    borderRadius: 9,
                    border: `1px solid ${borderColor}`,
                    background: bg,
                    color: textColor,
                    fontSize: 13,
                    cursor: selected !== null ? 'default' : 'pointer',
                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                    fontWeight: isSelected || (feedback && isCorrectAnswer) ? 600 : 400,
                  }}
                >
                  {answer}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div style={{ marginTop: 12 }}>
              <p
                style={{
                  fontSize: 12,
                  color: feedback === 'correct' ? T.success : T.danger,
                  margin: '0 0 10px',
                  fontWeight: 600,
                }}
              >
                {feedback === 'correct' ? '✓ Bonne réponse !' : '✗ Mauvaise réponse'}
              </p>
              <ActionButton color={accentColor} onClick={handleNext}>
                {current + 1 >= total ? 'Voir les résultats' : 'Question suivante →'}
              </ActionButton>
            </div>
          )}
        </div>
      )}
    </BlockCard>
  );
}

/* ── MindmapBlock ───────────────────────────────────────────────────── */
function MindmapNode({ node, depth = 0 }) {
  const indent = depth * 18;
  const colors = [T.gold, T.teal, '#dd8f74', T.warning, T.success];
  const color = colors[depth % colors.length];

  if (typeof node === 'string') {
    return (
      <li
        style={{
          marginLeft: indent,
          padding: '3px 0',
          color: T.t2,
          fontSize: 13,
          listStyle: 'none',
          borderLeft: depth > 0 ? `1px solid ${T.border}` : 'none',
          paddingLeft: depth > 0 ? 12 : 0,
          position: 'relative',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            marginRight: 8,
            flexShrink: 0,
            verticalAlign: 'middle',
          }}
        />
        {node}
      </li>
    );
  }

  if (typeof node === 'object' && node !== null) {
    const entries = Object.entries(node);
    return (
      <>
        {entries.map(([key, val]) => (
          <li
            key={key}
            style={{
              listStyle: 'none',
              marginLeft: indent,
              borderLeft: depth > 0 ? `1px solid ${T.border}` : 'none',
              paddingLeft: depth > 0 ? 12 : 0,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                color,
                padding: '3px 0',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }}
              />
              {key}
            </span>
            {Array.isArray(val) ? (
              <ul style={{ margin: 0, padding: 0 }}>
                {val.map((child, i) => (
                  <MindmapNode key={i} node={child} depth={depth + 1} />
                ))}
              </ul>
            ) : val && typeof val === 'object' ? (
              <ul style={{ margin: 0, padding: 0 }}>
                <MindmapNode node={val} depth={depth + 1} />
              </ul>
            ) : (
              <MindmapNode node={String(val)} depth={depth + 1} />
            )}
          </li>
        ))}
      </>
    );
  }

  return null;
}

function MindmapBlock({ block, isActive, isCompleted }) {
  const { mindmap_data } = block.data || {};
  const accentColor = '#d97757';

  const renderTree = (data) => {
    if (Array.isArray(data)) {
      return (
        <ul style={{ margin: 0, padding: 0 }}>
          {data.map((item, i) => (
            <MindmapNode key={i} node={item} depth={0} />
          ))}
        </ul>
      );
    }
    if (typeof data === 'object' && data !== null) {
      return (
        <ul style={{ margin: 0, padding: 0 }}>
          <MindmapNode node={data} depth={0} />
        </ul>
      );
    }
    return null;
  };

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={accentColor}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={15} color={accentColor} />
        <Badge color={accentColor} bg="rgba(52,211,153,0.12)">
          Mindmap
        </Badge>
      </div>

      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>

      {mindmap_data ? (
        <div
          style={{
            marginTop: 14,
            padding: '14px 16px',
            background: T.surface2,
            borderRadius: 10,
            border: `1px solid ${T.border}`,
          }}
        >
          {renderTree(mindmap_data)}
        </div>
      ) : (
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: T.t3,
            fontStyle: 'italic',
          }}
        >
          Mindmap IA disponible après le cours
        </p>
      )}
    </BlockCard>
  );
}

/* ── SummaryBlock ───────────────────────────────────────────────────── */
function SummaryBlock({ block, isActive, isCompleted, onComplete }) {
  const { key_points = [] } = block.data || {};
  const accentColor = T.t2;

  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={T.gold}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FileText size={15} color={T.gold} />
        <Badge color={T.gold} bg={T.goldDim}>
          Points clés à retenir
        </Badge>
      </div>

      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>

      {key_points.length > 0 ? (
        <ol
          style={{
            margin: '14px 0 0',
            paddingLeft: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {key_points.map((pt, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                fontSize: 13,
                color: T.t2,
                lineHeight: 1.6,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: T.goldDim,
                  border: `1px solid ${T.gold}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  color: T.gold,
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              {pt}
            </li>
          ))}
        </ol>
      ) : (
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: T.t3,
            fontStyle: 'italic',
          }}
        >
          Aucun point clé renseigné pour ce bloc.
        </p>
      )}

      {!isCompleted && (
        <div style={{ marginTop: 14 }}>
          <ActionButton color={T.gold} onClick={onComplete}>
            <CheckCircle2 size={14} />
            J'ai mémorisé
          </ActionButton>
        </div>
      )}
    </BlockCard>
  );
}

/* ── GenericFallback ────────────────────────────────────────────────── */
function GenericBlock({ block, isActive, isCompleted }) {
  return (
    <BlockCard isActive={isActive} isCompleted={isCompleted} accentColor={T.t4}>
      <Badge color={T.t3} bg={T.surface2}>
        {block.type || 'Bloc'}
      </Badge>
      <BlockTitle completed={isCompleted}>{block.title}</BlockTitle>
      <p style={{ marginTop: 8, fontSize: 13, color: T.t3 }}>
        Ce type de bloc n'a pas encore de rendu spécifique.
      </p>
    </BlockCard>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════ */
export default function PedagogicalBlockRenderer({
  block,
  isActive = false,
  isCompleted = false,
  onComplete,
  onNavigate,
  onOpenClassroom,
}) {
  if (!block) return null;

  const props = { block, isActive, isCompleted, onComplete, onNavigate, onOpenClassroom };

  switch (block.type) {
    case 'previsualisation_video':
    case 'doctrinal_video':
      return <VideoBlock {...props} />;

    case 'opening_live':
    case 'closure_live':
      return <LiveBlock {...props} />;

    case 'smartboard_session':
      return <SmartboardBlock {...props} />;

    case 'friction_block':
      return <FrictionBlock {...props} />;

    case 'experiment_block':
      return <ExperimentBlock {...props} />;

    case 'recall_block':
      return <RecallBlock {...props} />;

    case 'quiz_block':
      return <QuizBlock {...props} />;

    case 'mindmap_block':
      return <MindmapBlock {...props} />;

    case 'summary_block':
      return <SummaryBlock {...props} />;

    default:
      return <GenericBlock {...props} />;
  }
}
