import React, { useEffect, useRef, useState } from 'react';
import { NotebookPen, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { loadSourceNote, saveSourceNote } from '@/lib/liri/studentNotes';

/**
 * NoteComposer — prise de notes élève rattachée à une SOURCE (live / précepteur / …).
 * Monté dans un lecteur (replay live, cours Précepteur…) : l'élève écrit une note libre,
 * elle est sauvegardée dans `formation_student_notes` avec sa source et remonte au hub
 * « Mes notes » (filtre + lien d'origine). Auto-save débounce + sauvegarde au blur.
 *
 * Props : sourceType ('live'|'precepteur'|…), sourceId, sourceTitle?, sourceRef?, compact?
 */
export default function NoteComposer({ sourceType, sourceId, sourceTitle = null, sourceRef = '', compact = false }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | dirty | saving | saved | error
  const timer = useRef(null);
  const loadedFor = useRef(null);

  // Charge la note existante quand la source change.
  useEffect(() => {
    let alive = true;
    const key = `${sourceType}:${sourceId}:${sourceRef}`;
    if (!user?.id || !sourceType || !sourceId) { setStatus('idle'); return; }
    loadedFor.current = key;
    setStatus('loading');
    (async () => {
      try {
        const n = await loadSourceNote({ studentId: user.id, sourceType, sourceId, sourceRef });
        if (!alive || loadedFor.current !== key) return;
        setText(n?.content || '');
        setStatus('saved');
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [user?.id, sourceType, sourceId, sourceRef]);

  const persist = async (value) => {
    if (!user?.id || !sourceType || !sourceId) return;
    setStatus('saving');
    try {
      await saveSourceNote({ studentId: user.id, sourceType, sourceId, sourceRef, sourceTitle, content: value });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    setStatus('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(v), 900);
  };

  const onBlur = () => {
    if (timer.current) clearTimeout(timer.current);
    if (status === 'dirty') persist(text);
  };

  const disabled = !user?.id || !sourceId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: 'rgba(245,241,233,0.72)', letterSpacing: '0.02em' }}>
          <NotebookPen size={15} color="var(--school-accent, #d97757)" /> Mes notes
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(245,241,233,0.45)' }}>
          {status === 'saving' && <><Loader2 size={12} className="animate-spin" /> Enregistrement…</>}
          {status === 'saved' && <><Check size={12} color="#4ea172" /> Enregistré</>}
          {status === 'dirty' && 'Modifié…'}
          {status === 'error' && <span style={{ color: '#e88' }}>Erreur d'enregistrement</span>}
        </span>
      </div>
      <textarea
        value={text}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={disabled ? 'Connecte-toi pour prendre des notes…' : 'Écris ta note… (rattachée à cette source, retrouvable dans « Mes notes »)'}
        rows={compact ? 4 : 7}
        style={{
          width: '100%', resize: 'vertical', minHeight: compact ? 90 : 140,
          background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(245,244,238,0.10)', borderRadius: 12,
          padding: '12px 14px', fontSize: 13.5, lineHeight: 1.55, color: 'rgba(245,241,233,0.92)',
          fontFamily: 'inherit', outline: 'none',
        }}
      />
    </div>
  );
}
