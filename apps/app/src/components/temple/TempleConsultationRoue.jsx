import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, ArrowRight, ArrowLeft, RotateCcw, CalendarPlus, Sparkles } from 'lucide-react';
import { QUESTIONS, SCALE, AXES, POLES, scoreAnswers, topAxes } from '@/lib/temple/roueModel';
import RoueTransformation from '@/components/temple/RoueTransformation';

/**
 * Bilan spirituel du Temple : questionnaire d'intake → Roue de Transformation.
 * Phase 1 (démonstrative, autonome). Le RDV / la salle live existent déjà dans la section
 * Consultations ; ici on ajoute la ROUE + le QUESTIONNAIRE (modèle éditable via roueModel).
 */
const AXIS_BY_ID = Object.fromEntries(AXES.map((a) => [a.id, a]));
const POLE_ACCENT = Object.fromEntries(POLES.map((p) => [p.id, p.accent]));

export default function TempleConsultationRoue() {
  const [step, setStep] = useState('intro'); // intro | quiz | result
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});

  const scores = useMemo(() => scoreAnswers(answers), [answers]);
  const top = useMemo(() => topAxes(scores, 3), [scores]);
  const q = QUESTIONS[i];
  const answered = q ? answers[q.id] != null : false;
  const progress = Math.round(((i + (answered ? 1 : 0)) / QUESTIONS.length) * 100);

  const choose = (val) => {
    setAnswers((a) => ({ ...a, [q.id]: val }));
    setTimeout(() => { if (i < QUESTIONS.length - 1) setI(i + 1); else setStep('result'); }, 220);
  };
  const restart = () => { setAnswers({}); setI(0); setStep('intro'); };

  const Panel = ({ children }) => (
    <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--line, rgba(255,255,255,.08))', background: 'color-mix(in srgb, var(--coral, #d97757) 5%, transparent)' }}>{children}</div>
  );

  if (step === 'intro') {
    return (
      <Panel>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--coral, #d97757)' }}>
          <Sparkles size={14} /> Bilan spirituel
        </div>
        <h3 className="mt-2 text-[19px] font-bold text-white">La Roue de Transformation</h3>
        <p className="mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed" style={{ color: 'rgba(205,199,191,.9)' }}>
          {QUESTIONS.length} questions pour situer ta transformation sur 12 axes (karma, lignée, purification, guidance…).
          Ta roue s'affiche à la fin — elle sera affinée avec ton praticien lors de la consultation.
        </p>
        <button onClick={() => { setStep('quiz'); setI(0); }}
          className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-black"
          style={{ background: 'var(--coral, #d97757)' }}>
          <Flame size={16} /> Commencer mon bilan
        </button>
      </Panel>
    );
  }

  if (step === 'quiz') {
    return (
      <Panel>
        <div className="flex items-center justify-between text-[11px] font-medium" style={{ color: 'rgba(143,136,128,.9)' }}>
          <span>Question {i + 1} / {QUESTIONS.length}</span><span>{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.06)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--coral, #d97757)' }} />
        </div>
        <h3 className="mt-4 text-[17px] font-semibold leading-snug text-white">{q.text}</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {SCALE.map((s) => {
            const sel = answers[q.id] === s.value;
            return (
              <button key={s.value} onClick={() => choose(s.value)}
                className="rounded-xl border px-4 py-3 text-left text-[14px] font-medium transition-all"
                style={sel
                  ? { background: 'var(--coral, #d97757)', color: '#20140f', borderColor: 'var(--coral, #d97757)' }
                  : { background: 'rgba(0,0,0,.18)', color: 'rgba(205,199,191,.92)', borderColor: 'var(--line, rgba(255,255,255,.08))' }}>
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <button onClick={() => (i > 0 ? setI(i - 1) : setStep('intro'))}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium" style={{ color: 'rgba(143,136,128,.95)' }}>
            <ArrowLeft size={15} /> Retour
          </button>
          {answered && (
            <button onClick={() => (i < QUESTIONS.length - 1 ? setI(i + 1) : setStep('result'))}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium text-white"
              style={{ borderColor: 'var(--line, rgba(255,255,255,.14))' }}>
              {i < QUESTIONS.length - 1 ? 'Suivant' : 'Voir ma roue'} <ArrowRight size={15} />
            </button>
          )}
        </div>
      </Panel>
    );
  }

  // result
  return (
    <Panel>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--coral, #d97757)' }}>
        <Sparkles size={14} /> Ta Roue de Transformation
      </div>
      <div className="mt-3 grid gap-6 md:grid-cols-[300px_1fr] md:items-center">
        <div className="grid place-items-center">
          <RoueTransformation scores={scores} size={300} />
        </div>
        <div>
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'rgba(205,199,191,.9)' }}>
            Voici où se concentre ton travail aujourd'hui. Les <b>3 axes prioritaires</b> :
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {top.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
                style={{ borderColor: 'var(--line, rgba(255,255,255,.08))', background: 'rgba(0,0,0,.15)' }}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-black" style={{ background: POLE_ACCENT[a.pole] }}>{a.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-white">{a.name}</span>
                  <span className="block text-[11.5px]" style={{ color: 'rgba(143,136,128,.95)' }}>{a.desc}</span>
                </span>
                <span className="shrink-0 text-[15px] font-bold" style={{ color: 'var(--coral, #d97757)' }}>{a.v.toFixed(0)}<span className="text-[10px]" style={{ color: 'rgba(143,136,128,.9)' }}>/10</span></span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link to="/appointment/request?flow=ngowazulu-consultation"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-black" style={{ background: 'var(--coral, #d97757)' }}>
              <CalendarPlus size={16} /> Réserver ma consultation
            </Link>
            <button onClick={restart}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium text-white" style={{ borderColor: 'var(--line, rgba(255,255,255,.14))' }}>
              <RotateCcw size={15} /> Refaire
            </button>
          </div>
          <p className="mt-3 text-[11.5px]" style={{ color: 'rgba(143,136,128,.85)' }}>
            Ce bilan est indicatif — ton praticien affinera la roue pendant la consultation.
          </p>
        </div>
      </div>
    </Panel>
  );
}
