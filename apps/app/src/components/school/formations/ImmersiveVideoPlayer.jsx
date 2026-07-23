import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize2, Rewind, FastForward, ListTree, AlignLeft, X } from 'lucide-react';

/**
 * ImmersiveVideoPlayer — rend une VRAIE vidéo (replay Zoom, rendu post-prod) dans la
 * coque immersive LIRI (fond chaud #262624, halo ambiant, typographie éditoriale),
 * au lieu du <video> encadré plat. Unifie le rendu avec le Précepteur.
 *
 * Props :
 *   src, poster, title, description
 *   crumb    { module, semaine, jour }
 *   cues     [{ t:secondes, text }]  — transcription horodatée (sync + chapitres auto)
 *   transcript  texte brut (repli si pas de cues)
 *   chapters [{ t, label }]  — sinon dérivés des cues
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

function deriveChapters(cues, duration) {
  if (!cues?.length || !duration) return [];
  const N = Math.min(9, Math.max(3, Math.round(duration / 600)));
  const step = duration / N;
  const out = [];
  for (let i = 0; i < N; i++) {
    const start = i * step;
    const cue = cues.find((c) => c.t >= start) || cues[cues.length - 1];
    const label = (cue?.text || '').split(/[.…!?]/)[0].slice(0, 48).trim() || `Partie ${i + 1}`;
    out.push({ t: start, label });
  }
  return out;
}

function ImmersiveVideoPlayer({ src, poster, title, description, crumb, cues, transcript, chapters, onExit, embedded = false }, ref) {
  const vref = useRef(null);
  const railRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('transcript');
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' && window.innerWidth < 900);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onR); return () => window.removeEventListener('resize', onR);
  }, []);

  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const chaps = useMemo(() => (chapters?.length ? chapters : deriveChapters(cues, dur)), [chapters, cues, dur]);
  const hasRail = Boolean(cues?.length || transcript || chaps.length);
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
          chaps.length ? chaps.map((c, i) => (
            <button key={i} type="button" onClick={() => seek(c.t)} className="ivp-ctl"
              style={{ display: 'flex', alignItems: 'baseline', gap: 11, width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: 12, cursor: 'pointer', marginBottom: 4,
                border: `1px solid ${i === activeChap ? 'rgba(217,119,87,0.34)' : 'transparent'}`, background: i === activeChap ? 'rgba(217,119,87,0.12)' : 'transparent' }}>
              <span style={{ fontFamily: T.grotesque, fontSize: 11, fontWeight: 800, color: i === activeChap ? T.gold : T.faint, fontVariantNumeric: 'tabular-nums', minWidth: 40 }}>{fmt(c.t)}</span>
              <span style={{ fontFamily: T.body, fontSize: 14, lineHeight: 1.4, color: i === activeChap ? T.ink : T.muted }}>{c.label}</span>
            </button>
          )) : <p style={{ color: T.faint, fontSize: 13, padding: '20px 14px', textAlign: 'center' }}>Chapitres bientôt disponibles.</p>
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
      <header style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px', borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        <button type="button" onClick={onExit} className="ivp-ctl" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: T.grotesque }}>
          <ArrowLeft size={17} /> Vidéothèque
        </button>
        <div style={{ width: 1, height: 22, background: T.line }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          {crumb && (crumb.module || crumb.semaine || crumb.jour) ? (
            <div style={{ fontFamily: T.grotesque, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: T.terra, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[crumb.module, crumb.semaine, crumb.jour].filter(Boolean).join('  ·  ')}
            </div>
          ) : null}
          <h1 style={{ margin: 0, fontFamily: T.serif, fontWeight: 600, fontSize: 'clamp(18px,2vw,26px)', lineHeight: 1.08, letterSpacing: '.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title || 'Session enregistrée'}
          </h1>
        </div>
        {narrow && hasRail && (
          <button type="button" onClick={() => setRailOpen(true)} className="ivp-ctl" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 10, border: `1px solid ${T.line}`, background: 'rgba(244,239,230,0.05)', color: T.ink, cursor: 'pointer', fontFamily: T.grotesque, fontSize: 12, fontWeight: 700 }}>
            <AlignLeft size={14} /> Transcription
          </button>
        )}
      </header>
      )}

      {/* Corps */}
      <div style={{ position: 'relative', flex: embedded ? 'none' : 1, minHeight: 0, display: 'flex' }}>
        <main style={{ flex: embedded ? 'none' : '1 1 auto', width: embedded ? '100%' : undefined, minWidth: 0, display: 'flex', flexDirection: 'column', padding: embedded ? 0 : 'clamp(14px,2.2vw,32px)', overflow: 'hidden' }}>
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
              style={{ position: 'relative', height: 16, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 4, background: 'rgba(244,239,230,0.14)' }} />
              <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 4, background: `linear-gradient(90deg, ${T.terra}, ${T.gold})`, transition: reduce ? 'none' : 'width .12s linear' }} />
              {chaps.map((c, i) => dur ? (
                <span key={i} title={c.label} style={{ position: 'absolute', left: `${(c.t / dur) * 100}%`, width: 2, height: 11, borderRadius: 2, background: i <= activeChap ? T.gold : 'rgba(244,239,230,0.3)', transform: 'translateX(-1px)' }} />
              ) : null)}
              <span style={{ position: 'absolute', left: `${pct}%`, width: 13, height: 13, borderRadius: '50%', background: T.ink, boxShadow: `0 0 0 3px ${T.terra}`, transform: 'translateX(-6px)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={toggle} className="ivp-ctl" aria-label={playing ? 'Pause' : 'Lire'} style={ctl(true)}>
                {playing ? <Pause size={18} fill={T.bg} color={T.bg} /> : <Play size={18} fill={T.bg} color={T.bg} style={{ marginLeft: 2 }} />}
              </button>
              <button type="button" onClick={() => seek(cur - 10)} className="ivp-ctl" aria-label="-10s" style={ctl(false)}><Rewind size={17} /></button>
              <button type="button" onClick={() => seek(cur + 10)} className="ivp-ctl" aria-label="+10s" style={ctl(false)}><FastForward size={17} /></button>
              <div style={{ fontFamily: T.grotesque, fontSize: 12.5, color: T.muted, fontVariantNumeric: 'tabular-nums', minWidth: 92 }}>{fmt(cur)} <span style={{ color: T.faint }}>/ {fmt(dur)}</span></div>
              <div style={{ flex: 1 }} />
              {[1, 1.25, 1.5, 2].map((r) => (
                <button key={r} type="button" onClick={() => setRate(r)} className="ivp-ctl" style={{ background: 'none', border: 'none', cursor: 'pointer', color: rate === r ? T.gold : T.faint, fontFamily: T.grotesque, fontSize: 12.5, fontWeight: 700, padding: '2px 3px' }}>{r}×</button>
              ))}
              <button type="button" onClick={() => { const v = vref.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }} className="ivp-ctl" aria-label="Son" style={ctl(false)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
              <button type="button" onClick={() => vref.current?.requestFullscreen?.()} className="ivp-ctl" aria-label="Plein écran" style={ctl(false)}><Maximize2 size={16} /></button>
            </div>
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

function ctl(primary) {
  return primary
    ? { width: 42, height: 42, borderRadius: '50%', background: '#f4efe6', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
    : { width: 36, height: 36, borderRadius: '50%', background: 'rgba(244,239,230,0.06)', border: '1px solid rgba(244,239,230,0.12)', color: '#f4efe6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
}
