import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageCircleQuestion, Send, ArrowRight, Sparkles } from 'lucide-react';
import SketchRenderer from './SketchRenderer';
import { speakText, cancelSpeech } from './TableauVivant';

/**
 * ATELIER — l'interaction socratique NOMINATIVE.
 * cf. docs/CAHIER_DE_CHARGE_PRECEPTEUR.md (§4, §5, §7).
 *
 * Interpelle l'élève par son prénom, attend sa réponse, la classe (juge), répond en
 * VARIANT les formulations (jamais le même mot), puis révèle (souvent + 2e croquis).
 *
 * Démo publique : le juge est un HEURISTIQUE LOCAL (mots-clés). En production, c'est
 * l'edge function `liri-preceptor-atelier-judge` (LLM) qui classe la réponse.
 */

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function classifyLocal(answer, expectedAnswers = [], expectedErrors = []) {
  const a = norm(answer);
  if (!a.trim()) return 'partial';
  if (expectedAnswers.some((k) => a.includes(norm(k)))) return 'ok';
  if (expectedErrors.some((k) => a.includes(norm(k)))) return 'wrong';
  const partial = expectedAnswers.some((k) => norm(k).split(/\s+/).some((w) => w.length > 3 && a.includes(w)));
  return partial ? 'partial' : 'wrong';
}

const pick = (arr, fallback) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback);

const ACK_TONE = {
  ok: 'text-green-700',
  partial: 'text-amber-700',
  wrong: 'text-rose-700',
  skip: 'text-slate-500',
};

export default function AtelierPrompt({ scene, studentName = '', speak = false, onNarrate, onContinue }) {
  const name = (studentName || '').trim() || 'l’élève';
  const question = String(scene?.question || '').replace('{{student_name}}', name);
  const [phase, setPhase] = useState('asking'); // asking | revealed
  const [answer, setAnswer] = useState('');
  const [ack, setAck] = useState(null);
  const inputRef = useRef(null);

  // voix : ElevenLabs (onNarrate) si fourni, sinon synthèse navigateur
  const say = useCallback((t) => { if (onNarrate) onNarrate(t); else if (speak) speakText(t); }, [onNarrate, speak]);

  useEffect(() => {
    say(`${name}. ${question}`);
    const id = window.setTimeout(() => inputRef.current?.focus?.(), 300);
    return () => { window.clearTimeout(id); if (speak) cancelSpeech(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goReveal = useCallback((cat) => {
    const msg = cat === 'skip' ? '' : pick((scene.ack_variants || {})[cat], 'Voyons ensemble.');
    setAck({ cat, msg });
    const delay = msg ? 1500 : 200;
    if (msg) say(msg);
    window.setTimeout(() => {
      setPhase('revealed');
      say(scene.reveal_narration || '');
    }, delay);
  }, [scene, say]);

  const submit = () => { if (phase !== 'asking') return; goReveal(classifyLocal(answer, scene.expected_answers, scene.expected_errors)); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[28px] bg-white p-7 shadow-2xl ring-1 ring-black/5 md:p-9"
    >
      <div className="mb-3 flex items-center gap-2 text-blue-700">
        <MessageCircleQuestion className="h-5 w-5" />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Atelier — à toi de réfléchir</span>
      </div>

      {/* La question, nominative */}
      <p className="text-lg font-semibold leading-snug text-slate-900 md:text-xl">
        <span className="text-blue-700">{name},</span> {question}
      </p>
      {scene?.hint && phase === 'asking' ? (
        <p className="mt-2 text-sm italic text-slate-500">Indice : {scene.hint}</p>
      ) : null}

      {phase === 'asking' ? (
        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="Écris ta lecture de la situation…"
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={submit}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
            >
              Répondre <Send className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={() => goReveal('skip')} className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-600">
            Voir la réponse du professeur →
          </button>
        </div>
      ) : null}

      {/* Réaction du professeur (variée) */}
      {ack && ack.msg ? (
        <motion.p
          initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          className={`mt-4 text-base font-bold ${ACK_TONE[ack.cat] || 'text-slate-700'}`}
        >
          {ack.msg}
        </motion.p>
      ) : null}

      {/* Révélation : narration + 2e croquis */}
      {phase === 'revealed' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-amber-700">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">La réponse</span>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-700 md:text-base">{scene.reveal_narration}</p>
          {scene.reveal_sketch ? (
            <div className="mt-4 h-64 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 md:h-72">
              <SketchRenderer sketch={scene.reveal_sketch} play />
            </div>
          ) : null}
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={() => { if (speak) cancelSpeech(); onContinue?.(); }} className="flex items-center gap-2 rounded-full bg-[var(--school-accent,#d4a36a)] px-6 py-2.5 text-sm font-bold text-black hover:opacity-90">
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
