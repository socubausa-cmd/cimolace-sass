import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { STYLE, BG, INK, GOLD, TERRA, SERIF } from '@/lib/agent/immersiveTheme';
import Presence from '@/components/agent/Presence';
import { PrecepteurPlayer } from '@/pages/dev/PrecepteurDemoPage';
import { conformCourseSync } from '@/lib/precepteur/conformCourse';
import { supabase } from '@/lib/supabaseCompat';

/**
 * PrecepteurImmersive — LE PRÉCEPTEUR dans le CERVEAU IMMERSIF (même coque que l'assistant
 * Cimolace : fond chaud #262624, présence 5 états, rail « tableau intelligent », voix serif,
 * « parler à la présence »), mais BORNÉ AU COURS.
 *
 * Il RÉUTILISE le lecteur prouvé `PrecepteurPlayer` (mode `embedded` → fond transparent, sans
 * son propre chrome) comme « tableau » au centre : toute la cadence voix + les briques A→D
 * (conformCourse, croquis, atelier, SFX) restent intactes. La coque n'ajoute que l'enveloppe
 * sensorielle + la conversation scopée au cours (edge `precepteur-brain`).
 */
export default function PrecepteurImmersive({ course }) {
  const conformed = useMemo(() => (course ? conformCourseSync(course).course : null), [course]);
  const concepts = conformed?.concepts || [];

  // Carte index-de-scène-plat → index-de-concept (le lecteur aplatit les scènes via flatMap).
  const sceneToConcept = useMemo(() => {
    const map = [];
    concepts.forEach((c, ci) => (c.scenes || []).forEach(() => map.push(ci)));
    return map;
  }, [concepts]);

  // Connaissance envoyée au cerveau : titre + 1re leçon de chaque concept (borne le périmètre).
  const knowledge = useMemo(() => ({
    title: conformed?.title || 'Cours',
    concepts: concepts.map((c) => {
      const lecon = (c.scenes || []).find((s) => s && s.type === 'lecon');
      return { title: c.title || '', lesson: String(lecon?.board_text || lecon?.narration || '').slice(0, 700) };
    }),
  }), [conformed, concepts]);

  const [presence, setPresence] = useState('connexion');
  const [activeConcept, setActiveConcept] = useState(0);
  const [started, setStarted] = useState(false);

  const [inputOpen, setInputOpen] = useState(false);
  const [value, setValue] = useState('');
  const [reply, setReply] = useState('');
  const inputRef = useRef(null);
  const askGen = useRef(0);

  // La Présence suit l'état du lecteur (onScene) — sauf pendant une question (reflexion/ecriture).
  const busyRef = useRef(false);
  const onScene = useCallback(({ type, idx, started: st, done }) => {
    setStarted(st);
    if (typeof idx === 'number' && sceneToConcept[idx] != null) setActiveConcept(sceneToConcept[idx]);
    if (busyRef.current) return; // une question est en cours → ne pas écraser la présence
    if (done) { setPresence('pret'); return; }
    if (!st) { setPresence('connexion'); return; }
    if (type === 'atelier') setPresence('attente');
    else if (type === 'croquis' || type === 'amorce_croquis') setPresence('reflexion');
    else setPresence('ecriture');
  }, [sceneToConcept]);

  const openInput = useCallback((prefill = '') => {
    setInputOpen(true);
    setValue(prefill);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);
  const closeInput = useCallback(() => { setInputOpen(false); setValue(''); }, []);

  // « type-anywhere » : taper une lettre matérialise le champ (seulement une fois le cours lancé).
  useEffect(() => {
    const onKey = (e) => {
      if (inputOpen || !started) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key && e.key.length === 1) openInput(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputOpen, started, openInput]);

  // Parler à la présence — bornée AU COURS (edge precepteur-brain). Ne bloque JAMAIS le cours.
  const ask = useCallback(async (q) => {
    const question = q.trim();
    closeInput();
    if (!question) return;
    const gen = ++askGen.current;
    busyRef.current = true;
    setReply('');
    setPresence('reflexion');
    try {
      const { data, error } = await supabase.functions.invoke('precepteur-brain', {
        body: { question, course: knowledge, concept: concepts[activeConcept]?.title || null },
      });
      if (askGen.current !== gen) return;
      if (error) throw error;
      const r = String(data?.reply || '').trim() || 'Restons sur le cours — reformule ta question ?';
      setPresence('ecriture');
      setReply(r);
      setTimeout(() => { if (askGen.current === gen) { setPresence('attente'); busyRef.current = false; } }, 500);
    } catch {
      if (askGen.current !== gen) return;
      setPresence('attente');
      setReply('Je reste sur le cours — mais je n’ai pas pu répondre à l’instant.');
      busyRef.current = false;
    }
  }, [knowledge, concepts, activeConcept, closeInput]);

  if (!conformed) return null;

  return (
    <div
      style={{
        position: 'relative', minHeight: '100vh', overflow: 'hidden',
        background: `radial-gradient(1200px 700px at 50% -8%, #2c2b28, ${BG})`,
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}
    >
      <style>{STYLE}</style>

      {/* Particules ambiantes — le vide « respire » */}
      <span className="cca-amb" style={{ width: 5, height: 5, top: '30%', left: '30%', opacity: 0.14, animation: 'ccaDriftA 11s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 4, height: 4, top: '62%', left: '68%', opacity: 0.12, background: GOLD, animation: 'ccaDriftB 14s ease-in-out infinite' }} />
      <span className="cca-amb" style={{ width: 3, height: 3, top: '44%', left: '72%', opacity: 0.1, animation: 'ccaDriftC 9s ease-in-out infinite' }} />

      {/* En-tête : identité + présence (le professeur) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, opacity: 0.85 }}>
        <GraduationCap size={16} color={GOLD} />
        <span style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700, color: GOLD }}>Le Précepteur · cours enseigné</span>
      </div>
      <div style={{ marginTop: -8, marginBottom: -18, pointerEvents: 'none' }}>
        <Presence state={presence} />
      </div>

      {/* Réplique du cerveau (parler à la présence) — la voix serif du précepteur */}
      {reply && (
        <p className="cca-in" style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.5, color: INK, maxWidth: 520, textAlign: 'center', margin: '0 20px 6px', position: 'relative', zIndex: 4 }}>
          {reply}
          {(presence === 'ecriture' || presence === 'attente') && <span className="cca-caret" />}
        </p>
      )}

      {/* Rail des CONCEPTS (le « tour du cours ») — le concept courant est allumé */}
      {started && concepts.length > 1 && (
        <div style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 3, maxWidth: 150 }}>
          <span style={{ fontSize: 9, color: 'rgba(244,239,230,.3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Le fil du cours</span>
          {concepts.map((c, ci) => {
            const cur = ci === activeConcept;
            const done = ci < activeConcept;
            return (
              <span key={ci} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: cur ? INK : done ? GOLD : 'rgba(244,239,230,.38)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: cur ? TERRA : done ? GOLD : 'rgba(244,239,230,.22)' }} />
                {c.title || `Concept ${ci + 1}`}
              </span>
            );
          })}
        </div>
      )}

      {/* Le « tableau » : le lecteur prouvé, embarqué (fond transparent, sans chrome) */}
      <div style={{ width: '100%', flex: 1, display: 'flex', position: 'relative', zIndex: 2 }}>
        <PrecepteurPlayer course={conformed} embedded onScene={onScene} />
      </div>

      {/* « Parler à la présence » */}
      {started && (
        inputOpen ? (
          <div className="cca-in" style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', width: 'min(460px, 88vw)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(244,239,230,.07)', borderRadius: 14, padding: '8px 8px 8px 15px', zIndex: 6 }}>
            <input
              ref={inputRef} className="cca-field" value={value} onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ask(value); } else if (e.key === 'Escape') closeInput(); }}
              placeholder="Pose une question sur le cours…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, fontSize: 14, fontFamily: 'inherit' }}
            />
            <button onClick={() => ask(value)} aria-label="Demander" style={{ width: 32, height: 32, borderRadius: 9, background: TERRA, color: '#2a140c', border: 'none', cursor: 'pointer' }}>↑</button>
          </div>
        ) : (
          <button
            onClick={() => openInput()}
            style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: 'rgba(244,239,230,.06)', border: '1px solid rgba(244,239,230,.1)', borderRadius: 999, padding: '9px 18px', color: 'rgba(244,239,230,.55)', fontSize: 12.5, cursor: 'text', zIndex: 6 }}
          >
            Parler à la présence — une question sur le cours ?
          </button>
        )
      )}
    </div>
  );
}
