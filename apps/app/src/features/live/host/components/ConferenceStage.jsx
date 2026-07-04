import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { Search, SlidersHorizontal, MoreHorizontal, Mic, MicOff, Pin, Maximize2, UserPlus, MonitorUp, Users } from 'lucide-react';
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

const ACCENT = 'var(--lh-accent, #d4a36a)';

const hasCamera = (lk) =>
  lk
  && Array.from(lk.videoTrackPublications?.values?.() || []).some(
    (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
  );

const pickScreenSharePub = (lk) =>
  (lk
    && (Array.from(lk.videoTrackPublications?.values?.() || lk.trackPublications?.values?.() || []).find(
      (p) => p.source === Track.Source.ScreenShare && p.track && !p.isMuted,
    ) || null))
  || null;

/** Attache la piste « partage d'écran » LiveKit à un <video> (objectFit contain = écran entier). */
function ScreenShareCell({ lk, mediaEpoch, style }) {
  const vRef = useRef(null);
  useEffect(() => {
    if (!lk || !vRef.current) return undefined;
    const pub = pickScreenSharePub(lk);
    if (!pub?.track) return undefined;
    pub.track.attach(vRef.current);
    return () => { try { pub.track?.detach(vRef.current); } catch { /* ignore */ } };
  }, [lk, mediaEpoch]);
  return <video ref={vRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', ...style }} />;
}

const ToolbarBtn = ({ active, onClick, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      borderRadius: 8,
      border: `1px solid ${active ? 'rgba(var(--lh-accent-rgb,212,163,106),.55)' : 'rgba(255,255,255,.12)'}`,
      background: active ? 'rgba(var(--lh-accent-rgb,200,148,62),.22)' : 'rgba(0,0,0,.45)',
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

const Tile = ({ m, lk, mediaEpoch, speaking, big = false, onClick, pinned = false, mic = false }) => {
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
        border: speaking ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,.09)',
        background: 'rgba(255,255,255,.02)',
        boxShadow: speaking ? `0 0 0 3px rgba(var(--lh-accent-rgb,212,163,106),.28)` : 'none',
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
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.015)' }}>
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
        <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 700, color: ACCENT, background: 'rgba(var(--lh-accent-rgb,212,163,106),.16)', borderRadius: 6, padding: '2px 6px' }}>
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
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {speaking ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, flexShrink: 0 }} /> : null}
          {m.name}
        </span>
        {mic ? (
          speaking
            ? <Mic size={big ? 15 : 12} color={ACCENT} style={{ flexShrink: 0 }} />
            : <MicOff size={big ? 15 : 12} color="#f87171" style={{ flexShrink: 0 }} />
        ) : null}
      </div>
    </div>
  );
};

/** Meilleur nombre de colonnes pour N tuiles CARRÉES qui remplissent au mieux un cadre w×h. */
function bestGridCols(n, w, h, gap) {
  if (n <= 1) return 1;
  if (!w || !h) return Math.min(5, Math.ceil(Math.sqrt(n)));
  let best = 1;
  let bestSize = 0;
  for (let c = 1; c <= n; c += 1) {
    const rows = Math.ceil(n / c);
    const tileW = (w - gap * (c - 1)) / c;
    const tileH = (h - gap * (rows - 1)) / rows;
    const size = Math.min(tileW, tileH);
    if (size > bestSize + 0.5) { bestSize = size; best = c; }
  }
  return best;
}

export default function ConferenceStage({ liveParticipants, livekitParticipantsMap, liveKitMediaEpoch, hostId = null, sharingScreen = false, cameraOn = false, selfName = 'Vous', onStop = null, stopBusy = false, onOpenLongia = null, onMemberPreview = null }) {
  // Défaut = vue Orateur + panneau latéral (flux vidéo membres) : l'« interface conférence »
  // attendue (grand cadre à l'écran + colonne Membres). Togglable vers Grille / Vignettes bas.
  const [view, setView] = useState('speaker'); // 'grid' | 'speaker'
  const [autoFollow, setAutoFollow] = useState(true);
  const [pinnedId, setPinnedId] = useState(null);
  const [density, setDensity] = useState('m'); // 's' | 'm' | 'l'
  const [panelPos, setPanelPos] = useState('side'); // 'bottom' (bande) | 'side' (panneau latéral 2 colonnes)
  const [search, setSearch] = useState('');
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const gridRef = useRef(null);
  const [gridBox, setGridBox] = useState({ w: 0, h: 0 });

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

  // Mesure du conteneur grille → tuiles CARRÉES dimensionnées pour remplir (adaptées au nombre).
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setGridBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const n = visible.length;
  const focusId = pinnedId || (autoFollow ? activeSpeakerId : null) || visible[0]?.id || null;
  const focus = visible.find((m) => String(m.id) === String(focusId)) || visible[0] || null;
  const others = visible.filter((m) => m !== focus);
  const q = search.trim().toLowerCase();
  // Panneau membres : si l'hôte (Animateur) est connu, il coiffe la liste ; sinon = la personne à l'écran.
  const host = hostId ? visible.find((m) => String(m.id) === String(hostId)) : null;
  // Vignette « à l'écran » du panneau membres = SELF-VIEW : la caméra LOCALE sortante de l'utilisateur
  // (retour vidéo de soi façon Zoom/Meet), PAS l'orateur. Le grand cadre central, lui, suit l'orateur actif.
  const localLk = livekitParticipantsMap['local'] || livekitParticipantsMap.local || null;
  const panelTop = { id: 'local', name: selfName, init: String(selfName || 'VO').substring(0, 2).toUpperCase(), color: '#C8960C' };
  const panelTopLabel = 'Vous · votre caméra';
  const panelRest = visible.filter((m) => String(m.id) !== 'local' && !m.isLocal);
  const filteredPanelRest = q ? panelRest.filter((m) => String(m.name || '').toLowerCase().includes(q)) : panelRest;
  const panelTopSpeaking = Boolean(localLk?.isSpeaking);
  const panelTopLk = cameraOn ? localLk : null;
  const focusSpeaking = focus ? String(activeSpeakerId) === String(focus.id) : false;
  const focusLk = focus ? lkOf(focus) : null;
  const focusShowVid = hasCamera(focusLk);

  // Partage d'écran (data-driven : la piste écran est dans la map LiveKit ; hôte local = clé 'local').
  const shareFsRef = useRef(null);
  let screenShareLk = null;
  let screenSharerName = '';
  for (const [key, lk] of Object.entries(livekitParticipantsMap || {})) {
    if (pickScreenSharePub(lk)) {
      screenShareLk = lk;
      if (key === 'local') screenSharerName = host?.name || 'Vous';
      else screenSharerName = visible.find((m) => String(m.id) === String(key))?.name || lk?.name || 'Un participant';
      break;
    }
  }
  const isSharing = Boolean(screenShareLk) || Boolean(sharingScreen);
  if (!screenSharerName && isSharing) screenSharerName = host?.name || "L'animateur";

  // Densité : S = tuiles plus petites (1 colonne de plus), L = plus grandes (1 de moins).
  // Vue GRILLE : tuiles CARRÉES dont le nombre de colonnes + la taille s'adaptent au nombre de
  // membres ET au cadre mesuré, pour remplir sans grand vide. La densité S/M/L ajuste la finesse.
  const GRID_GAP = 12;
  const gridCols = Math.max(1, Math.min(n || 1, bestGridCols(n, gridBox.w, gridBox.h, GRID_GAP) + (density === 's' ? 1 : density === 'l' ? -1 : 0)));
  const gridRows = Math.max(1, Math.ceil(n / Math.max(1, gridCols)));
  const gridTileSize = (gridBox.w && gridBox.h)
    ? Math.max(72, Math.floor(Math.min(
        (gridBox.w - GRID_GAP * (gridCols - 1)) / gridCols,
        (gridBox.h - GRID_GAP * (gridRows - 1)) / gridRows,
      )))
    : 200;

  // STOP relogé dans la barre d'options (la bande du haut est masquée en conférence) —
  // c'est le seul moyen d'arrêter le live, il doit rester accessible.
  const stopBtn = onStop ? (
    <button
      type="button"
      onClick={() => { if (!stopBusy) onStop(); }}
      disabled={stopBusy}
      title="Arrêter la session live"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8, border: '1px solid rgba(239,68,68,.5)', background: 'rgba(239,68,68,.16)', color: '#fca5a5', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', padding: '6px 12px', cursor: stopBusy ? 'default' : 'pointer', opacity: stopBusy ? 0.6 : 1, flexShrink: 0 }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', flexShrink: 0 }} />
      STOP
    </button>
  ) : null;

  // Barre de recherche membre — remontée dans la barre d'options (à gauche des bascules de vue).
  const searchBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '6px 10px', minWidth: 0, flex: 1 }}>
      <Search size={14} color="rgba(255,255,255,.4)" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un membre"
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 12.5 }}
      />
      <SlidersHorizontal size={14} color="rgba(255,255,255,.4)" />
    </div>
  );

  // Panneau membres — colonne DROITE pleine hauteur, IMMERSIF : pas de carte de section
  // (fond/bordure), juste les en-têtes + les vidéos avec leur fin liseré (le « tracé »).
  const membersPanel = (
    <aside style={{ width: 324, flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px 12px', borderLeft: '1px solid rgba(245,244,238,0.09)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{`Membres (${visible.length})`}</span>
        <MoreHorizontal size={16} color="rgba(255,255,255,.45)" />
      </div>
      {panelTop ? (
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(227,199,154,.8)', margin: '2px 2px 8px' }}>{panelTopLabel}</div>
          <div style={{ aspectRatio: '16 / 9' }}>
            <Tile m={panelTop} lk={panelTopLk} mediaEpoch={liveKitMediaEpoch} speaking={panelTopSpeaking} mic pinned={Boolean(pinnedId && String(pinnedId) === String(panelTop.id))} />
          </div>
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(227,199,154,.8)', padding: '6px 2px 8px', flexShrink: 0 }}>{`Participants (${filteredPanelRest.length})`}</div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 2px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {filteredPanelRest.map((m) => (
              <div key={m.id} style={{ aspectRatio: '16 / 9' }}>
                <Tile m={m} lk={lkOf(m)} mediaEpoch={liveKitMediaEpoch} speaking={String(activeSpeakerId) === String(m.id)} mic onClick={() => { setPinnedId(m.id); setAutoFollow(false); setView('speaker'); }} />
              </div>
            ))}
            <button type="button" style={{ aspectRatio: '16 / 9', borderRadius: 12, border: '1px dashed rgba(255,255,255,.18)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', fontSize: 10.5, fontWeight: 700 }}>
              <UserPlus size={18} />
              Inviter
            </button>
          </div>
        </div>
      </div>
      <button type="button" style={{ flexShrink: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '10px', cursor: 'pointer' }}>
        <UserPlus size={16} />
        Inviter un membre
      </button>
    </aside>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'var(--lh-stage-bg, #1f1e1c)', display: 'flex', flexDirection: 'row', minHeight: 0 }}>
      {/* Colonne GAUCHE : barre d'options + scène (orateur / grille). */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {isSharing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#fff' }}><MonitorUp size={16} color={ACCENT} />{`${screenSharerName} partage son écran`}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)' }}><Users size={13} /> {visible.length}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>{stopBtn}<ToolbarBtn onClick={() => { try { shareFsRef.current?.requestFullscreen?.(); } catch { /* ignore */ } }} title="Plein écran">{<Maximize2 size={14} />}</ToolbarBtn></div>
        </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', flexShrink: 0 }}>
        {/* Gauche : recherche membre (remontée depuis le panneau membres). */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 320, display: 'flex' }}>{searchBar}</div>
        {/* Centre : bascules de vue Grille / Orateur / Longia (+ options de vue). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ToolbarBtn active={view === 'grid'} onClick={() => setView('grid')} title="Tous les participants en grille">Grille</ToolbarBtn>
          <ToolbarBtn active={view === 'speaker'} onClick={() => setView('speaker')} title="Un grand cadre + vignettes">Orateur</ToolbarBtn>
          {onOpenLongia ? (
            <ToolbarBtn onClick={onOpenLongia} title="Ouvrir le hub Longia (assistant IA)">Longia</ToolbarBtn>
          ) : null}
          {view === 'speaker' ? (
            <>
              <ToolbarBtn
                active={autoFollow}
                onClick={() => { setAutoFollow((v) => !v); setPinnedId(null); }}
                title="Le grand cadre suit automatiquement qui parle"
              >
                {`Auto-suivi ${autoFollow ? 'ON' : 'OFF'}`}
              </ToolbarBtn>
              <ToolbarBtn
                active={panelPos === 'side'}
                onClick={() => setPanelPos((p) => (p === 'side' ? 'bottom' : 'side'))}
                title="Vignettes des membres : bande en bas ou panneau latéral (2 colonnes, pleine hauteur)"
              >
                {panelPos === 'side' ? 'Vignettes : côté' : 'Vignettes : bas'}
              </ToolbarBtn>
            </>
          ) : null}
          {view === 'grid' ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: 'rgba(255,255,255,.4)', marginRight: 2 }}>TAILLE</span>
              {['s', 'm', 'l'].map((d) => (
                <ToolbarBtn key={d} active={density === d} onClick={() => setDensity(d)} title={d === 's' ? 'Petites' : d === 'l' ? 'Grandes' : 'Moyennes'}>
                  {d.toUpperCase()}
                </ToolbarBtn>
              ))}
            </div>
          ) : null}
        </div>
        {/* Droite : STOP. */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>{stopBtn}</div>
      </div>
      )}

      {!isSharing && view === 'grid' ? (
        <div
          ref={gridRef}
          style={{
            flex: 1,
            minHeight: 0,
            padding: '10px 14px 14px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: GRID_GAP,
            alignContent: 'center',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {n === 0 ? (
            <EmptyState />
          ) : (
            visible.map((m) => (
              <div key={m.id} style={{ width: gridTileSize, height: gridTileSize, flexShrink: 0 }}>
                <Tile
                  m={m}
                  lk={lkOf(m)}
                  mediaEpoch={liveKitMediaEpoch}
                  speaking={String(activeSpeakerId) === String(m.id)}
                  mic
                  onClick={() => { setPinnedId(m.id); setAutoFollow(false); setView('speaker'); }}
                />
              </div>
            ))
          )}
        </div>
      ) : (isSharing || panelPos === 'side') ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12, padding: '10px 14px 14px' }}>
          <div ref={shareFsRef} style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 18, overflow: 'hidden', border: `1px solid ${isSharing ? 'rgba(var(--lh-accent-rgb,212,163,106),.4)' : focusSpeaking ? ACCENT : 'rgba(255,255,255,.1)'}`, background: isSharing ? '#000' : 'rgba(255,255,255,.02)', boxShadow: focusSpeaking && !isSharing ? '0 0 0 3px rgba(var(--lh-accent-rgb,212,163,106),.22)' : 'none' }}>
            {isSharing ? (
              <>
                {screenShareLk ? (
                  <ScreenShareCell lk={screenShareLk} mediaEpoch={liveKitMediaEpoch} style={{ position: 'absolute', inset: 0 }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,.55)' }}>
                    <MonitorUp size={42} color={ACCENT} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{"Partage d'écran en cours…"}</span>
                  </div>
                )}
                <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.5)', borderRadius: 9, padding: '6px 10px' }}>
                  <MonitorUp size={14} color={ACCENT} /> {`${screenSharerName} partage son écran`}
                </div>
              </>
            ) : focus ? (
              <>
                {focusShowVid && focusLk ? (
                  <LiveHostVideoCell participant={focusLk} mediaEpoch={liveKitMediaEpoch} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.015)' }}>
                    <div style={{ width: 112, height: 112, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 800, color: focus.color, background: `${focus.color}22`, border: `1px solid ${focus.color}55` }}>{focus.init}</div>
                  </div>
                )}
                <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.9)' }}>{focus.name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: ACCENT, background: 'rgba(var(--lh-accent-rgb,212,163,106),.16)', borderRadius: 7, padding: '2px 8px' }}>{"À l'écran"}</span>
                </div>
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.85)', background: 'rgba(0,0,0,.5)', borderRadius: 9, padding: '6px 10px' }}><Pin size={13} /> Épingler</span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.85)', background: 'rgba(0,0,0,.5)', borderRadius: 9, padding: 7 }}><Maximize2 size={14} /></span>
                </div>
                <div style={{ position: 'absolute', left: 14, bottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.5)', borderRadius: 9, padding: '6px 10px' }}>
                  {focusSpeaking ? <Mic size={14} color={ACCENT} /> : <MicOff size={14} color="#f87171" />}
                  {focus.name}
                </div>
              </>
            ) : (
              <EmptyState />
            )}
          </div>
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
      {(isSharing || (view !== 'grid' && panelPos === 'side')) ? membersPanel : null}
    </div>
  );
}
