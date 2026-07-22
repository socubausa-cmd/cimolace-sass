/**
 * ═══════════════════════════════════════════════════════════════
 * LIRI LIVE — Page embed (iframe)
 * Rendue dans une iframe sur les sites clients (WordPress, Wix, etc.)
 * Aucun header, sidebar ou nav — uniquement la salle vidéo.
 *
 * URL : /embed/live/:sessionId?et=EMBED_TOKEN&tenant=SLUG
 * ═══════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';
import LiveDataSaverEffect from '@/features/live/LiveDataSaverEffect';

/**
 * SÉCURITÉ postMessage : ne PAS diffuser les événements (room, session, erreurs)
 * à `'*'` (toute origine peut alors les lire depuis une iframe cachée). On cible
 * l'origine RÉELLE de la page hôte, dérivée de document.referrer (l'URL de la
 * page qui a chargé l'iframe). Repli same-origin si le referrer est masqué.
 */
function getParentOrigin() {
  try {
    if (document.referrer) return new URL(document.referrer).origin;
  } catch { /* referrer illisible */ }
  return window.location.origin;
}

// ── Styles inline (pas de Tailwind — page embed minimaliste) ─────────────────
const S = {
  root: {
    width: '100%',
    height: '100vh',
    background: '#262624',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
    margin: 0,
    padding: 0,
    overflow: 'hidden',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    color: '#f0f6fc',
    textAlign: 'center',
    padding: '24px',
  },
  icon: { fontSize: '48px' },
  title: { fontSize: '18px', fontWeight: 700, color: '#f0f6fc', margin: 0 },
  sub: { fontSize: '13px', color: '#8b949e', margin: 0, maxWidth: '320px', lineHeight: 1.6 },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #21262d',
    borderTop: '3px solid #d97757',
    borderRadius: '50%',
    animation: 'liri-spin 0.8s linear infinite',
  },
  badge: (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '999px',
    background: `${color}20`,
    border: `1px solid ${color}44`,
    color,
    fontSize: '12px',
    fontWeight: 700,
  }),
  dot: (color) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: color,
    animation: color === '#10b981' ? 'liri-pulse 1.4s ease-in-out infinite' : 'none',
  }),
  room: {
    width: '100%',
    height: '100vh',
  },
  poweredBy: {
    position: 'fixed',
    bottom: '8px',
    right: '12px',
    fontSize: '10px',
    color: '#30363d',
    pointerEvents: 'none',
    zIndex: 100,
  },
};

// ── Composant principal ────────────────────────────────────────────────────────

export default function LiveEmbedPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const embedToken = searchParams.get('et');
  const tenantSlug = searchParams.get('tenant') ?? '';
  // role transmis via URL : viewer | co_host | host
  const urlRole = searchParams.get('role') ?? 'viewer';
  const displayName = searchParams.get('display') ?? undefined;

  const [phase, setPhase] = useState('loading'); // loading | joining | live | scheduled | ended | error
  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState('');
  const [roomName, setRoomName] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [resolvedRole, setResolvedRole] = useState(urlRole); // role finalement émis par l'API
  const [errorMsg, setErrorMsg] = useState('');
  // White-label (offre 3 / tenant EMBARQUÉ) : masque « Powered by LIRI » — 0 marque
  // LIRI dans l'embed du client. Défaut = affiché (attribution) tant que non résolu.
  const [whitelabel, setWhitelabel] = useState(false);
  const joinedRef = useRef(false);

  // Récupérer les infos publiques + rejoindre la session
  useEffect(() => {
    if (!sessionId || !embedToken || joinedRef.current) return;
    joinedRef.current = true;

    const apiBase = import.meta.env.VITE_API_BASE ?? '/api';

    async function init() {
      try {
        // 1. Infos publiques de la session (titre, statut)
        const infoRes = await fetch(
          `${apiBase}/lives/embed/${sessionId}/info?tenant=${encodeURIComponent(tenantSlug)}`,
        );
        if (infoRes.ok) {
          const info = await infoRes.json();
          setSessionInfo(info?.data ?? info);

          // Si la session est terminée, on affiche l'état final
          if ((info?.data ?? info)?.status === 'ended') {
            setPhase('ended');
            return;
          }
          // Si pas encore démarrée
          if ((info?.data ?? info)?.status === 'scheduled') {
            setPhase('scheduled');
            // On continue quand même pour obtenir le token (la room sera prête)
          }
        }

        setPhase('joining');

        // 2. Échanger l'embed token contre un token LiveKit
        const joinRes = await fetch(
          `${apiBase}/lives/embed/${sessionId}/join`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${embedToken}`,
            },
          },
        );

        if (!joinRes.ok) {
          const err = await joinRes.json().catch(() => ({}));
          throw new Error(err?.message ?? `Erreur ${joinRes.status}`);
        }

        const result = await joinRes.json();
        const data = result?.data ?? result;

        const livekitWsUrl =
          import.meta.env.VITE_LIVEKIT_URL ??
          (typeof window !== 'undefined' && window.__LIVEKIT_URL__) ??
          '';

        setLivekitToken(data.livekit_token);
        setRoomName(data.room_name);
        setLivekitUrl(livekitWsUrl);
        if (data.role) setResolvedRole(data.role);
        setPhase('live');

        // Notifier le parent via postMessage (origine hôte ciblée, jamais '*')
        window.parent?.postMessage(
          { type: 'LIRI_SESSION_JOINED', sessionId, room: data.room_name },
          getParentOrigin(),
        );
      } catch (err) {
        setErrorMsg(err?.message ?? 'Impossible de rejoindre la session');
        setPhase('error');
        window.parent?.postMessage(
          { type: 'LIRI_ERROR', sessionId, message: err?.message },
          getParentOrigin(),
        );
      }
    }

    init();
  }, [sessionId, embedToken, tenantSlug]);

  // Résout le niveau de marque du tenant (endpoint branding public, read-only) :
  // un tenant EMBARQUÉ (offre 3) ne doit afficher AUCUNE marque LIRI dans l'embed.
  useEffect(() => {
    if (!tenantSlug) return undefined;
    const apiBase = import.meta.env.VITE_API_BASE ?? '/api';
    let cancelled = false;
    fetch(`${apiBase}/tenants/by-slug/${encodeURIComponent(tenantSlug)}/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (cancelled || !res) return;
        const data = res?.data ?? res;
        if (data?.embedded) setWhitelabel(true);
      })
      .catch(() => { /* défaut sûr : garder l'attribution */ });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  // ── Render phases ────────────────────────────────────────────────────────────

  // Marque « Powered by LIRI » — masquée pour un tenant EMBARQUÉ (offre 3, 0 marque).
  const poweredBy = whitelabel ? null : <div style={S.poweredBy}>Powered by LIRI</div>;

  if (phase === 'loading' || phase === 'joining') {
    return (
      <div style={S.root}>
        <style>{`
          @keyframes liri-spin { to { transform: rotate(360deg) } }
          @keyframes liri-pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        `}</style>
        <div style={S.center}>
          <div style={S.spinner} />
          <p style={S.sub}>
            {phase === 'loading' ? 'Connexion au live…' : 'Authentification en cours…'}
          </p>
        </div>
        {poweredBy}
      </div>
    );
  }

  if (phase === 'scheduled') {
    const scheduledAt = sessionInfo?.scheduled_at
      ? new Date(sessionInfo.scheduled_at).toLocaleString('fr-FR', {
          dateStyle: 'long',
          timeStyle: 'short',
        })
      : null;
    return (
      <div style={S.root}>
        <style>{`@keyframes liri-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={S.center}>
          <span style={S.icon}>🎙️</span>
          <div style={S.badge('#f59e0b')}>
            <span style={S.dot('#f59e0b')} />
            Bientôt
          </div>
          <h2 style={S.title}>{sessionInfo?.title ?? 'Live à venir'}</h2>
          {scheduledAt && (
            <p style={S.sub}>Ce live commencera le {scheduledAt}</p>
          )}
        </div>
        {poweredBy}
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <div style={S.root}>
        <div style={S.center}>
          <span style={S.icon}>🎬</span>
          <h2 style={S.title}>Session terminée</h2>
          <p style={S.sub}>Ce live est terminé. Le replay sera disponible prochainement.</p>
        </div>
        {poweredBy}
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={S.root}>
        <div style={S.center}>
          <span style={S.icon}>⚠️</span>
          <h2 style={S.title}>Impossible de rejoindre</h2>
          <p style={S.sub}>{errorMsg}</p>
        </div>
        {poweredBy}
      </div>
    );
  }

  // ── Phase "live" — room LiveKit ──────────────────────────────────────────────
  if (phase === 'live' && livekitToken && livekitUrl) {
    const isHost = resolvedRole === 'host';
    const isCoHost = resolvedRole === 'co_host';
    const canPublish = isHost || isCoHost;

    return (
      <div style={S.root}>
        <style>{`
          @keyframes liri-pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
          .lk-room-container { height: 100vh !important; }
        `}</style>

        {/* Badge rôle hôte */}
        {isHost && (
          <div style={{
            position: 'fixed', top: 10, left: 12, zIndex: 200,
            background: '#d97757', color: '#fff', borderRadius: 6,
            padding: '3px 10px', fontSize: 11, fontWeight: 700,
            fontFamily: 'system-ui', letterSpacing: '0.05em',
          }}>HÔTE</div>
        )}
        {isCoHost && (
          <div style={{
            position: 'fixed', top: 10, left: 12, zIndex: 200,
            background: '#c0603f', color: '#fff', borderRadius: 6,
            padding: '3px 10px', fontSize: 11, fontWeight: 700,
            fontFamily: 'system-ui', letterSpacing: '0.05em',
          }}>CO-HÔTE</div>
        )}

        <div style={S.room}>
          <LiveKitRoom
            serverUrl={livekitUrl}
            token={livekitToken}
            connect={true}
            video={canPublish}
            audio={canPublish}
            options={getStableLiveKitRoomOptions({ adaptiveStream: true, dynacast: true })}
            connectOptions={stableLiveKitConnectOptions}
            onDisconnected={() => {
              setPhase('ended');
              window.parent?.postMessage(
                { type: 'LIRI_SESSION_ENDED', sessionId },
                getParentOrigin(),
              );
            }}
          >
            <LiveDataSaverEffect />
            <RoomAudioRenderer />
            <VideoConference />
            {/* Hôte : tous les contrôles — Viewer : aucun */}
            {canPublish ? (
              <ControlBar
                controls={{
                  microphone: true,
                  camera: true,
                  screenShare: true,
                  leave: true,
                  ...(isHost ? { settings: true } : {}),
                }}
              />
            ) : (
              <ControlBar controls={{ microphone: false, camera: false, screenShare: false, leave: true }} />
            )}
          </LiveKitRoom>
        </div>
        {poweredBy}
      </div>
    );
  }

  return null;
}
