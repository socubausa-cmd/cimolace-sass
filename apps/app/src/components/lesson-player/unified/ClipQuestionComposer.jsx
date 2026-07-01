import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Capture de CLIP par timestamp + poser une question — brique réutilisable extraite
 * du player de cours ISNA (CoursePlayerInterface : Définir IN/OUT, sliders, « Lire le
 * clip », clip_start/end_seconds). Utilisée dans le player unifié (modal Questions),
 * pour cours ET replay. Le parent gère l'envoi via onSubmit.
 */
const round05 = (v) => Math.round(Number(v) * 2) / 2;
const fmt = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

export default function ClipQuestionComposer({ videoUrl = '', storagePath = '', onSubmit, submitting = false }) {
  const clipVideoRef = useRef(null);
  const clipStopAtRef = useRef(null);
  const [clipDuration, setClipDuration] = useState(null);
  const [playable, setPlayable] = useState(videoUrl || '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [question, setQuestion] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Résout une URL signée si la vidéo est dans le bucket privé 'videos'.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!storagePath) { setPlayable(videoUrl || ''); return; }
      try {
        const { data, error } = await supabase.storage.from('videos').createSignedUrl(storagePath, 60 * 60);
        if (!alive) return;
        setPlayable((!error && data?.signedUrl) ? data.signedUrl : (videoUrl || ''));
      } catch { if (alive) setPlayable(videoUrl || ''); }
    })();
    return () => { alive = false; };
  }, [videoUrl, storagePath]);

  const setStartSafe = (v) => {
    const s = v === '' ? '' : String(round05(Math.max(0, Number(v))));
    setStart(s);
    if (s !== '' && end !== '' && Number(end) < Number(s)) setEnd(s);
  };
  const setEndSafe = (v) => {
    const e = v === '' ? '' : String(round05(Math.max(0, Number(v))));
    if (e !== '' && start !== '' && Number(e) < Number(start)) { setEnd(start); return; }
    setEnd(e);
  };

  const markIn = () => setStartSafe(round05(Number(clipVideoRef.current?.currentTime || 0)));
  const markOut = () => setEndSafe(round05(Number(clipVideoRef.current?.currentTime || 0)));
  const playClip = () => {
    if (!clipVideoRef.current || start === '' || end === '') return;
    const s = Math.max(0, Math.min(Number(start), Number(end)));
    const e = Math.max(Number(start), Number(end));
    clipVideoRef.current.currentTime = s;
    clipStopAtRef.current = e;
    clipVideoRef.current.play();
  };

  const canSend = question.trim().length > 0 && !submitting;
  const submit = () => {
    if (!canSend) return;
    const cs = start === '' ? null : round05(Number(start));
    const ce = end === '' ? null : round05(Number(end));
    onSubmit?.({
      question: question.trim(),
      clipStart: cs != null && ce != null ? Math.min(cs, ce) : cs,
      clipEnd: cs != null && ce != null ? Math.max(cs, ce) : ce,
      isPublic,
    });
    setQuestion('');
  };

  const T = { line: 'rgba(245,241,233,0.09)', t2: 'rgba(245,241,233,0.72)', t3: 'rgba(245,241,233,0.5)', coral: '#d97757', field: '#1c1b19' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Preview vidéo pour marquer IN/OUT */}
      {playable ? (
        <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', border: `1px solid ${T.line}` }}>
          <video
            ref={clipVideoRef}
            src={playable}
            className="w-full aspect-video"
            controls
            onLoadedMetadata={(e) => { const d = Number(e?.currentTarget?.duration); if (Number.isFinite(d) && d > 0) setClipDuration(d); }}
            onTimeUpdate={(e) => {
              const stopAt = clipStopAtRef.current;
              if (stopAt == null) return;
              const t = Number(e?.currentTarget?.currentTime);
              if (Number.isFinite(t) && t >= stopAt - 0.05) { e.currentTarget.pause(); clipStopAtRef.current = null; }
            }}
          />
        </div>
      ) : null}

      {/* Boutons IN / OUT / Lire le clip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={markIn} style={btn(T)}>⟤ Définir IN</button>
        <button type="button" onClick={markOut} style={btn(T)}>⟥ Définir OUT</button>
        <button type="button" onClick={playClip} disabled={start === '' || end === ''}
          style={{ ...btn(T), background: 'rgba(217,119,87,0.16)', border: `1px solid rgba(217,119,87,0.4)`, color: T.coral, fontWeight: 600, opacity: (start === '' || end === '') ? 0.5 : 1 }}>
          ▶ Lire le clip
        </button>
        {start !== '' || end !== '' ? (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.coral }}>
            {start === '' ? '—' : fmt(start)} → {end === '' ? '—' : fmt(end)}
          </span>
        ) : null}
      </div>

      {/* Sliders visuels */}
      {clipDuration != null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: T.t3 }}>Navigation visuelle (début / fin)</div>
          <input type="range" min="0" max={Math.floor(clipDuration)} step="0.5" value={start === '' ? 0 : Number(start)} onChange={(e) => setStartSafe(e.target.value)} style={{ accentColor: T.coral }} />
          <input type="range" min="0" max={Math.floor(clipDuration)} step="0.5" value={end === '' ? Math.floor(clipDuration) : Number(end)} onChange={(e) => setEndSafe(e.target.value)} style={{ accentColor: T.coral }} />
        </div>
      ) : null}

      {/* Champs secondes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ fontSize: 11, color: T.t3 }}>Début (s)
          <input type="number" min="0" step="0.5" value={start} onChange={(e) => setStartSafe(e.target.value)} placeholder="ex: 12" style={field(T)} />
        </label>
        <label style={{ fontSize: 11, color: T.t3 }}>Fin (s)
          <input type="number" min="0" step="0.5" value={end} onChange={(e) => setEndSafe(e.target.value)} placeholder="ex: 32" style={field(T)} />
        </label>
      </div>

      {/* Question */}
      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Écris ta question sur cet extrait…" rows={3}
        style={{ ...field(T), resize: 'vertical', minHeight: 70 }} />

      {/* Visibilité + envoi */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 13, color: T.t2 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" name="clipq_vis" checked={isPublic} onChange={() => setIsPublic(true)} style={{ accentColor: T.coral }} /> Publique
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="radio" name="clipq_vis" checked={!isPublic} onChange={() => setIsPublic(false)} style={{ accentColor: T.coral }} /> Privée
          </label>
        </div>
        <button type="button" onClick={submit} disabled={!canSend}
          style={{ padding: '9px 18px', borderRadius: 9, border: 'none', cursor: canSend ? 'pointer' : 'not-allowed', background: T.coral, color: '#1a1108', fontWeight: 700, fontSize: 13, opacity: canSend ? 1 : 0.5 }}>
          {submitting ? 'Envoi…' : 'Poser la question'}
        </button>
      </div>
    </div>
  );
}

function btn(T) {
  return { padding: '6px 12px', borderRadius: 8, background: 'rgba(255,247,240,0.03)', border: `1px solid ${T.line}`, color: T.t2, fontSize: 12.5, cursor: 'pointer' };
}
function field(T) {
  return { width: '100%', marginTop: 4, padding: '8px 11px', borderRadius: 8, background: T.field, border: `1px solid ${T.line}`, color: '#f5f1e9', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
}
