import React, { useEffect, useMemo, useState } from 'react';
import { Track } from 'livekit-client';
import LiveHostVideoCell from '@/components/liri/live-room/LiveHostVideoCell';
import { ARENA_MEMBERS_WALL_MAX_VISIBLE } from '@/lib/liriArenaLayout';

/**
 * Scène CONFÉRENCE (type Google Meet) de l'arène live LIRI.
 * - Vue GRILLE adaptative (colonnes selon le nombre) avec densité réglable (S/M/L).
 * - Vue ORATEUR : 1 grand cadre (épinglé OU auto-suivi de qui parle) + bande de vignettes.
 * - Orateur actif détecté via LiveKit `isSpeaking` (sondage 600 ms) → surlignage émeraude
 *   + auto-bascule du grand cadre quand « Auto-suivi » est actif.
 * Réutilise `LiveHostVideoCell` (flux LiveKit) ; fallback avatar si caméra coupée.
 */

const ACCENT = '#34d399';

const hasCamera = (lk) =>
  lk
  && Array.from(lk.videoTrackPublications?.values?.() || []).some(
    (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
  );

const ToolbarBtn = ({ active, onClick, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      borderRadius: 8,
      border: `1px solid ${active ? 'rgba(52,211,153,.55)' : 'rgba(255,255,255,.12)'}`,
      background: active ? 'rgba(16,185,129,.22)' : 'rgba(0,0,0,.45)',
      color: active ? ACCENT : 'rgba(255,255,255,.78)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.04em',
      padding: '5px 10px',
      cursor: 'pointer',
      flexShrink: 0,
    }}
  >
    {children}
  </button>
);

const EmptyState = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 13, color: 'rgba(255,255,255,.4)' }}>
    En attente de participants…
  </div>
);

const Tile = ({ m, lk, mediaEpoch, speaking, big = false, onClick, pinned = false }) => {
  const showVid = hasCamera(lk);
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        borderRadius: big ? 18 : 12,
        overflow: 'hidden',
        border: speaking ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,.1)',
        background: 'rgba(0,0,0,.45)',
        boxShadow: speaking ? `0 0 0 3px rgba(52,211,153,.28)` : 'none',
        transition: 'box-shadow .18s ease, border-color .18s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {showVid && lk ? (
        <LiveHostVideoCell
          participant={lk}
          mediaEpoch={mediaEpoch}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${m.color}22` }}>
          <div
            style={{
              width: big ? 96 : 52,
              height: big ? 96 : 52,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: big ? 32 : 18,
              fontWeight: 800,
              color: m.color,
              background: `${m.color}1f`,
              border: `1px solid ${m.color}55`,
            }}
          >
            {m.init}
          </div>
        </div>
      )}
      {pinned ? (
        <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 700, color: ACCENT, background: 'rgba(6,78,59,.65)', borderRadius: 6, padding: '2px 6px' }}>
          épinglé
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: big ? '7px 12px' : '5px 8px',
          fontSize: big ? 13 : 10.5,
          fontWeight: 700,
          color: '#fff',
          background: 'linear-gradient(transparent, rgba(0,0,0,.78))',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {speaking ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, flexShrink: 0 }} /> : null}
        {m.name}
      </div>
    </div>
  );
};

export default function ConferenceStage({ liveParticipants, livekitParticipantsMap, liveKitMediaEpoch }) {
  const [view, setView] = useState('grid'); // 'grid' | 'speaker'
  const [autoFollow, setAutoFollow] = useState(true);
  const [pinnedId, setPinnedId] = useState(null);
  const [density, setDensity] = useState('m'); // 's' | 'm' | 'l'
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const visible = useMemo(
    () => (liveParticipants || []).slice(0, ARENA_MEMBERS_WALL_MAX_VISIBLE),
    [liveParticipants],
  );
  const lkOf = (m) => livekitParticipantsMap[m.id] || livekitParticipantsMap[String(m.id)] || null;

  // Détection de l'orateur actif (LiveKit isSpeaking) — sondage léger, ne dépend pas d'un re-render.
  useEffect(() => {
    const tick = () => {
      let sp = null;
      for (const m of visible) {
        if (lkOf(m)?.isSpeaking) { sp = m.id; break; }
      }
      setActiveSpeakerId((prev) => (String(prev) === String(sp) ? prev : sp));
    };
    tick();
    const id = setInterval(tick, 600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, livekitParticipantsMap]);

  const n = visible.length;
  const focusId = pinnedId || (autoFollow ? activeSpeakerId : null) || visible[0]?.id || null;
  const focus = visible.find((m) => String(m.id) === String(focusId)) || visible[0] || null;
  const others = visible.filter((m) => m !== focus);

  // Densité : S = tuiles plus petites (1 colonne de plus), L = plus grandes (1 de moins).
  const baseCols = n <= 1 ? 1 : n <= 2 ? 2 : n <= 6 ? 3 : n <= 12 ? 4 : 5;
  const cols = Math.max(1, Math.min(6, baseCols + (density === 's' ? 1 : density === 'l' ? -1 : 0)));

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 15, background: '#0a0b0f', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexShrink: 0 }}>
        <ToolbarBtn active={view === 'grid'} onClick={() => setView('grid')} title="Tous les participants en grille">Grille</ToolbarBtn>
        <ToolbarBtn active={view === 'speaker'} onClick={() => setView('speaker')} title="Un grand cadre + vignettes">Orateur</ToolbarBtn>
        {view === 'speaker' ? (
          <ToolbarBtn
            active={autoFollow}
            onClick={() => { setAutoFollow((v) => !v); setPinnedId(null); }}
            title="Le grand cadre suit automatiquement qui parle"
          >
            {`Auto-suivi ${autoFollow ? 'ON' : 'OFF'}`}
          </ToolbarBtn>
        ) : null}
        {view === 'grid' ? (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: 'rgba(255,255,255,.4)', marginRight: 2 }}>TAILLE</span>
            {['s', 'm', 'l'].map((d) => (
              <ToolbarBtn key={d} active={density === d} onClick={() => setDensity(d)} title={d === 's' ? 'Petites' : d === 'l' ? 'Grandes' : 'Moyennes'}>
                {d.toUpperCase()}
              </ToolbarBtn>
            ))}
          </div>
        ) : null}
      </div>

      {view === 'grid' ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: '0 14px 14px',
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridAutoRows: '1fr',
            gap: 10,
            alignContent: 'center',
          }}
        >
          {n === 0 ? (
            <div style={{ gridColumn: '1 / -1' }}><EmptyState /></div>
          ) : (
            visible.map((m) => (
              <div key={m.id} style={{ aspectRatio: '16 / 9', minHeight: 0 }}>
                <Tile
                  m={m}
                  lk={lkOf(m)}
                  mediaEpoch={liveKitMediaEpoch}
                  speaking={String(activeSpeakerId) === String(m.id)}
                  onClick={() => { setPinnedId(m.id); setAutoFollow(false); setView('speaker'); }}
                />
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px 14px' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            {focus ? (
              <Tile
                m={focus}
                lk={lkOf(focus)}
                mediaEpoch={liveKitMediaEpoch}
                speaking={String(activeSpeakerId) === String(focus.id)}
                pinned={Boolean(pinnedId)}
                big
              />
            ) : (
              <EmptyState />
            )}
          </div>
          {others.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', height: 88, flexShrink: 0 }}>
              {others.map((m) => (
                <div key={m.id} style={{ width: 150, height: 84, flexShrink: 0 }}>
                  <Tile
                    m={m}
                    lk={lkOf(m)}
                    mediaEpoch={liveKitMediaEpoch}
                    speaking={String(activeSpeakerId) === String(m.id)}
                    onClick={() => { setPinnedId(m.id); setAutoFollow(false); }}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
