import React, { useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { ArrowLeft, Play, FileText, HelpCircle, Network, Check, X } from 'lucide-react';
import VideoPlayer from '@/components/school/formations/VideoPlayer';
import { INK, TERRA, SERIF } from '@/lib/agent/immersiveTheme';

const htmlToText = (html) => String(html || '').replace(/<br\s*\/?>(?=)/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

/**
 * Rendu NATIF d'un jour de cours par l'OS — aucune carte/conteneur, tout fondu
 * dans la surface immersive. La vidéo est bord-à-bord, le support passe par la
 * scène `reader` de l'OS, le quiz est rendu nativement. L'OS « affiche tout ».
 */
export default function FormationOsDayView({ day, onBack, backLabel = 'Programme' }) {
  const videos = Array.isArray(day?.videos) ? day.videos : (day?.video ? [day.video] : []);
  const support = day?.powerpoint || day?.reader || null;
  const quiz = day?.quiz || null;
  const mindmap = day?.mindmap || videos.find?.((v) => v?.mindmap)?.mindmap || null;

  const blocks = useMemo(() => {
    const b = [];
    if (videos.length) b.push({ key: 'video', label: 'Vidéo', Icon: Play });
    if (support) b.push({ key: 'support', label: 'Support', Icon: FileText });
    if (quiz) b.push({ key: 'quiz', label: 'Quiz', Icon: HelpCircle });
    if (mindmap) b.push({ key: 'mindmap', label: 'Mindmap', Icon: Network });
    return b;
  }, [videos.length, support, quiz, mindmap]);

  const [step, setStep] = useState(blocks[0]?.key || 'video');

  const currentVideo = videos[0] ? { url: videos[0].url, type: videos[0].type, storagePath: videos[0].storagePath || videos[0].storage_path, title: videos[0].title } : null;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* En-tête minimal — pas de carte : retour + titre serif + pastilles de blocs */}
      <div style={{ flexShrink: 0, padding: '18px 26px 10px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(245,244,238,0.14)', background: 'rgba(38,38,36,.72)', color: INK, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500 }}>
          <ArrowLeft size={14} /> {backLabel}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: SERIF, fontSize: 'clamp(19px,2.4vw,26px)', fontWeight: 600, color: '#f5f4ee', lineHeight: 1.12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{day?.title || 'Leçon'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {blocks.map(({ key, label, Icon }) => {
            const on = step === key;
            return (
              <button key={key} type="button" onClick={() => setStep(key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, border: on ? `1px solid ${TERRA}` : '1px solid rgba(245,244,238,0.10)', background: on ? 'rgba(217,119,87,0.16)' : 'transparent', color: on ? '#f0c3ac' : 'rgba(245,244,238,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, transition: 'all .18s ease' }}>
                <Icon size={13} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Corps du bloc — plein, sans carte */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {step === 'video' && currentVideo && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 clamp(16px,6vw,90px) 24px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 1180 }}>
              <div style={{ position: 'absolute', inset: '-8%', pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 45%, rgba(217,119,87,0.13), rgba(8,8,11,0) 66%)', filter: 'blur(46px)' }} />
              <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: 'inset 0 0 140px 60px #08080b' }}>
                <VideoPlayer video={currentVideo} />
              </div>
            </div>
          </div>
        )}

        {step === 'support' && support && <OsReader support={support} title={day?.title} />}

        {step === 'quiz' && quiz && <OsQuiz quiz={quiz} />}

        {step === 'mindmap' && mindmap && <OsMindmap mindmap={mindmap} title={day?.title} />}
      </div>
    </div>
  );
}

// Support NATIF OS — le contenu du support fondu dans la surface (titres serif + paragraphes), sans carte.
function OsReader({ support, title }) {
  const slides = Array.isArray(support?.slides) ? support.slides : [];
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 'clamp(18px,4vh,44px) clamp(18px,7vw,120px) 118px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontFamily: SERIF, fontSize: 'clamp(22px,3vw,32px)', fontWeight: 600, color: '#f5f4ee', marginBottom: 26 }}>{support?.title || title || 'Support'}</div>
        {slides.length ? slides.map((s, i) => (
          <section key={i} style={{ marginBottom: 30 }}>
            {s.title && <h3 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: '#f0ede4', margin: '0 0 8px' }}>{s.title}</h3>}
            <div style={{ fontSize: 15.5, lineHeight: 1.64, color: 'rgba(245,244,238,.72)', whiteSpace: 'pre-wrap' }}>{htmlToText(s.content) || '—'}</div>
          </section>
        )) : (
          <div style={{ color: 'rgba(245,244,238,.5)', fontSize: 14 }}>Support de présentation externe.</div>
        )}
      </div>
    </div>
  );
}

// Un nœud-branche de la carte (aligné vers le centre : dot côté centre, texte à l'opposé).
function MindBranch({ b, i, side, dotRef }) {
  const kp = Array.isArray(b.keyPoints) ? b.keyPoints : [];
  const kids = Array.isArray(b.children) ? b.children : [];
  const isLeft = side === 'left';
  return (
    <div style={{ display: 'flex', flexDirection: isLeft ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10, textAlign: isLeft ? 'right' : 'left' }}>
      <span ref={dotRef} style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(217,119,87,.9)', flexShrink: 0, marginTop: 7, boxShadow: '0 0 0 4px rgba(217,119,87,.12)' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: 17.5, fontWeight: 600, color: '#f0ede4', lineHeight: 1.2 }}>{b.label || b.title || `Idée ${i + 1}`}</div>
        {b.summary && <div style={{ fontSize: 13, color: 'rgba(245,244,238,.6)', marginTop: 5, lineHeight: 1.5 }}>{b.summary}</div>}
        {kp.length > 0 && (
          <ul style={{ margin: '7px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {kp.map((k, ki) => (<li key={ki} style={{ fontSize: 13, color: 'rgba(245,244,238,.72)', display: 'flex', flexDirection: isLeft ? 'row-reverse' : 'row', gap: 7 }}><span style={{ color: TERRA }}>·</span>{k}</li>))}
          </ul>
        )}
        {kids.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9, justifyContent: isLeft ? 'flex-end' : 'flex-start' }}>
            {kids.map((c, ci) => (<span key={ci} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(245,244,238,.05)', border: '1px solid rgba(245,244,238,.08)', color: 'rgba(245,244,238,.7)' }}>{c.label || c.title || c.name}</span>))}
          </div>
        )}
      </div>
    </div>
  );
}

// Mindmap NATIF OS — VRAIE carte mentale : nœud central + branches gauche/droite reliées
// par des connecteurs SVG courbes. Fondu dans la surface, sans carte. Fallback empilé si étroit.
function OsMindmap({ mindmap, title }) {
  const root = mindmap || {};
  const rootLabel = root.label || root.title || root.name || title || 'Carte mentale';
  const branches = Array.isArray(root.children) ? root.children : [];
  const half = Math.ceil(branches.length / 2);
  const left = branches.slice(0, half);
  const right = branches.slice(half);

  const wrapRef = useRef(null);
  const centerRef = useRef(null);
  const dotRefs = useRef([]);
  const [paths, setPaths] = useState([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [wide, setWide] = useState(true);

  const measure = useCallback(() => {
    const wrap = wrapRef.current, c = centerRef.current;
    if (!wrap || !c) return;
    const wr = wrap.getBoundingClientRect();
    const isWide = wr.width >= 760;
    setWide(isWide);
    setDims({ w: wr.width, h: wr.height });
    if (!isWide) { setPaths([]); return; }
    const cc = c.getBoundingClientRect();
    const cx = cc.left + cc.width / 2 - wr.left;
    const cy = cc.top + cc.height / 2 - wr.top;
    const next = [];
    dotRefs.current.forEach((el) => {
      if (!el) return;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2 - wr.left;
      const by = b.top + b.height / 2 - wr.top;
      const mx = (cx + bx) / 2;
      next.push(`M ${cx.toFixed(1)} ${cy.toFixed(1)} C ${mx.toFixed(1)} ${cy.toFixed(1)} ${mx.toFixed(1)} ${by.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
    });
    setPaths(next);
  }, [branches.length]);

  useLayoutEffect(() => {
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', measure);
    const t = setTimeout(measure, 250); // après reflow des polices
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', measure); clearTimeout(t); };
  }, [measure]);

  const centerNode = (
    <div ref={centerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <span style={{ width: 15, height: 15, borderRadius: '50%', background: TERRA, boxShadow: '0 0 0 7px rgba(217,119,87,.14), 0 0 40px rgba(217,119,87,.35)' }} />
      <div style={{ fontFamily: SERIF, fontSize: 'clamp(21px,2.8vw,32px)', fontWeight: 600, color: '#f5f4ee', textAlign: 'center', maxWidth: 260, lineHeight: 1.14 }}>{rootLabel}</div>
    </div>
  );

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 'clamp(22px,5vh,54px) clamp(18px,5vw,70px) 118px' }}>
      {wide && paths.length > 0 && (
        <svg width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }} aria-hidden>
          {paths.map((d, i) => (<path key={i} d={d} fill="none" stroke="rgba(217,119,87,0.34)" strokeWidth="1.5" />))}
        </svg>
      )}

      {!branches.length ? (
        <div style={{ position: 'relative', maxWidth: 1040, margin: '0 auto', textAlign: 'center' }}>
          {centerNode}
        </div>
      ) : wide ? (
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 'clamp(28px,4vw,64px)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px,3vh,34px)' }}>
            {left.map((b, i) => <MindBranch key={i} b={b} i={i} side="left" dotRef={(el) => { dotRefs.current[i] = el; }} />)}
          </div>
          {centerNode}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px,3vh,34px)' }}>
            {right.map((b, i) => <MindBranch key={i} b={b} i={half + i} side="right" dotRef={(el) => { dotRefs.current[half + i] = el; }} />)}
          </div>
        </div>
      ) : (
        // étroit : empilé, sans connecteurs (lisibilité mobile)
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 620, margin: '0 auto' }}>
          <div style={{ marginBottom: 30 }}>{centerNode}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {branches.map((b, i) => <MindBranch key={i} b={b} i={i} side="right" dotRef={() => {}} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// Quiz NATIF OS — questions fondues dans la surface, options en pastilles, validation inline.
function OsQuiz({ quiz }) {
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const correctOf = (q) => (typeof q.correctAnswer === 'number' ? q.correctAnswer : (typeof q.correct === 'number' ? q.correct : 0));
  const score = submitted ? questions.reduce((a, q, i) => a + (answers[i] === correctOf(q) ? 1 : 0), 0) : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 'clamp(18px,4vh,44px) clamp(18px,7vw,120px) 118px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ fontFamily: SERIF, fontSize: 'clamp(22px,3vw,32px)', fontWeight: 600, color: '#f5f4ee', marginBottom: 6 }}>{quiz.title || 'Quiz de validation'}</div>
        <div style={{ fontSize: 13, color: 'rgba(245,244,238,.5)', marginBottom: 28 }}>{questions.length} question{questions.length > 1 ? 's' : ''}</div>
        {questions.map((q, qi) => {
          const opts = q.options || q.choices || [];
          const cor = correctOf(q);
          return (
            <div key={qi} style={{ marginBottom: 30 }}>
              <div style={{ fontSize: 16.5, fontWeight: 600, color: '#f5f4ee', marginBottom: 12 }}>{qi + 1}. {q.question || q.statement || `Question ${qi + 1}`}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {opts.map((opt, oi) => {
                  const sel = answers[qi] === oi;
                  const showRight = submitted && oi === cor;
                  const showWrong = submitted && sel && oi !== cor;
                  return (
                    <button key={oi} type="button" disabled={submitted} onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '12px 15px', borderRadius: 12, cursor: submitted ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14.5,
                        border: `1px solid ${showRight ? 'rgba(122,181,122,.6)' : showWrong ? 'rgba(214,116,96,.6)' : sel ? TERRA : 'rgba(245,244,238,0.10)'}`,
                        background: showRight ? 'rgba(122,181,122,.12)' : showWrong ? 'rgba(214,116,96,.10)' : sel ? 'rgba(217,119,87,0.12)' : 'rgba(245,244,238,0.02)',
                        color: '#f0ede4', transition: 'all .15s ease' }}>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {showRight && <Check size={16} color="#8fce8f" />}
                      {showWrong && <X size={16} color="#e08a72" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!submitted ? (
          <button type="button" onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < questions.length}
            style={{ marginTop: 6, padding: '12px 22px', borderRadius: 999, border: 'none', background: TERRA, color: '#231208', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: Object.keys(answers).length < questions.length ? 'not-allowed' : 'pointer', opacity: Object.keys(answers).length < questions.length ? 0.5 : 1 }}>
            Valider le quiz
          </button>
        ) : (
          <div style={{ marginTop: 10, fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: '#f5f4ee' }}>
            {score} / {questions.length} — {score === questions.length ? 'Parfait !' : score >= questions.length * 0.6 ? 'Bien joué.' : 'À revoir.'}
          </div>
        )}
      </div>
    </div>
  );
}
