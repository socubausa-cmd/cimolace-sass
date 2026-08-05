import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { getApiBaseUrl } from '@/lib/apiBase';
import { getLiveModeConfig, labelForLiveMode } from '@/lib/liveModeConfig';

/**
 * ÉCRAN DE CONNEXION invité d'un live PUBLIC — SANS login. Fonctionnalité COMMUNE à tous
 * les modes du moteur LIRI (formation / consultation / culte / débat) : c'est le socle
 * `liveModeConfig` qui décline le vocabulaire selon `session_type` (Rejoindre le cours /
 * la consultation / l'assemblée…). Aligné sur la salle d'attente brandée de la
 * téléconsultation (ProcheRoom) : logo du tenant, titre, hôte, compte à rebours, statut.
 *
 * Parcours : lien token-gaté `/live/:sessionId/invite/:inviteId?tenant=slug`
 *   1. POST /lives-public/:id/info  → métadonnées de session (aucun effet de bord)
 *   2. l'invité voit l'écran de connexion brandé → clique « Rejoindre »
 *   3. POST /lives-public/:id/guest-token → token LiveKit invité (viewer, canSubscribe)
 */

const BG = '#262624'; // fond LIRI chaud
const SURFACE = '#302e2b';
const CORAL = '#d97757';
const INK = '#f4efe9';
const MUTED = '#b7b0a6';

async function postJsonUnwrap(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let d = await res.json().catch(() => null);
  while (d && typeof d === 'object' && !Array.isArray(d) && 'data' in d) d = d.data;
  return { ok: res.ok, data: d };
}

function Shell({ children }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(1200px 600px at 50% -10%, rgba(217,119,87,0.14), transparent 60%), ${BG}`,
        color: INK,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: 20,
        overflowY: 'auto',
      }}
    >
      {children}
    </div>
  );
}

/** Compte à rebours vers une ISO ; null si passée / invalide / absente. */
function useCountdown(targetIso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetIso]);
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - now;
  if (Number.isNaN(diff) || diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function GuestStage() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  if (!tracks.length) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: MUTED,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 15,
          textAlign: 'center',
          padding: 24,
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 9,
              height: 9,
              borderRadius: 999,
              background: CORAL,
              marginRight: 8,
              animation: 'liri-pulse 1.4s ease-in-out infinite',
            }}
          />
          En attente du démarrage du direct par l'animateur…
        </span>
      </div>
    );
  }
  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  );
}

export default function LiveInvitePage() {
  const { sessionId, inviteId } = useParams();
  const [searchParams] = useSearchParams();
  const tenant = searchParams.get('tenant') || undefined;
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL;

  const [info, setInfo] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState(null);

  const [entering, setEntering] = useState(false);
  const [token, setToken] = useState(null);
  const [joinError, setJoinError] = useState(null);

  // 1) Métadonnées de session (aucun effet de bord) + branding tenant.
  useEffect(() => {
    let alive = true;
    setLoadingInfo(true);
    setInfoError(null);
    (async () => {
      const { ok, data } = await postJsonUnwrap(
        `${getApiBaseUrl()}/lives-public/${sessionId}/info`,
        { invite_id: inviteId, tenant },
      );
      if (!alive) return;
      if (!ok || !data) {
        setInfoError(data?.message || "Ce lien d'accès est invalide ou expiré.");
        setLoadingInfo(false);
        return;
      }
      setInfo(data);
      setLoadingInfo(false);
      const slug = data?.tenant?.slug || tenant;
      if (slug) {
        try {
          const res = await fetch(
            `${getApiBaseUrl()}/tenants/by-slug/${encodeURIComponent(slug)}/branding`,
          );
          let b = await res.json().catch(() => null);
          while (b && typeof b === 'object' && !Array.isArray(b) && 'data' in b) b = b.data;
          if (alive && b?.logo_url) setLogoUrl(b.logo_url);
        } catch {
          /* branding facultatif */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, inviteId, tenant]);

  const mode = useMemo(() => getLiveModeConfig(info?.session_type), [info?.session_type]);
  const isLive = info?.status === 'live';
  const isEnded = info?.status === 'ended' || info?.status === 'archived';
  const countdown = useCountdown(!isLive && !isEnded ? info?.scheduled_at : null);

  // 2) Entrée effective → token invité → montage LiveKit.
  const handleJoin = async () => {
    setEntering(true);
    setJoinError(null);
    const { ok, data } = await postJsonUnwrap(
      `${getApiBaseUrl()}/lives-public/${sessionId}/guest-token`,
      { invite_id: inviteId, tenant },
    );
    if (!ok || !data?.token) {
      setJoinError(data?.message || "Accès impossible pour le moment.");
      setEntering(false);
      return;
    }
    setToken(data.token);
  };

  // ── Viewer LiveKit (après entrée) ───────────────────────────────────────────
  if (token) {
    if (!serverUrl) return <Shell>Configuration vidéo indisponible.</Shell>;
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#141414' }}>
        {(logoUrl || info?.title) && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent)',
              pointerEvents: 'none',
            }}
          >
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                style={{ height: 24, width: 'auto', borderRadius: 6, objectFit: 'contain' }}
              />
            )}
            <span
              style={{
                color: '#fff',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {info?.title || labelForLiveMode(info?.session_type)}
            </span>
          </div>
        )}
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          audio={false}
          video={false}
          style={{ height: '100%' }}
        >
          <GuestStage />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }

  // ── États de chargement / erreur ────────────────────────────────────────────
  if (loadingInfo) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', color: MUTED }}>
          <div
            style={{
              width: 34,
              height: 34,
              margin: '0 auto 14px',
              borderRadius: 999,
              border: `2px solid ${CORAL}`,
              borderTopColor: 'transparent',
              animation: 'liri-spin 0.8s linear infinite',
            }}
          />
          Connexion sécurisée…
        </div>
        <style>{keyframes}</style>
      </Shell>
    );
  }
  if (infoError) {
    return (
      <Shell>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>Lien indisponible</p>
          <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.5 }}>{infoError}</p>
        </div>
      </Shell>
    );
  }

  // ── Écran de connexion brandé (salle d'attente) ─────────────────────────────
  return (
    <Shell>
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: SURFACE,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22,
          padding: 'clamp(22px, 6vw, 34px)',
          boxShadow: '0 24px 60px -24px rgba(0,0,0,0.6)',
          textAlign: 'center',
        }}
      >
        {/* Branding tenant */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 20,
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{ height: 34, width: 'auto', maxWidth: 150, objectFit: 'contain' }}
            />
          ) : (
            info?.tenant?.name && (
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.2 }}>
                {info.tenant.name}
              </span>
            )
          )}
        </div>

        {/* Badge mode + statut */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            borderRadius: 999,
            background: isLive ? 'rgba(217,119,87,0.16)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${isLive ? 'rgba(217,119,87,0.4)' : 'rgba(255,255,255,0.1)'}`,
            fontSize: 12,
            fontWeight: 600,
            color: isLive ? CORAL : MUTED,
            marginBottom: 16,
          }}
        >
          {isLive && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: CORAL,
                animation: 'liri-pulse 1.4s ease-in-out infinite',
              }}
            />
          )}
          {isLive ? 'En direct' : labelForLiveMode(info?.session_type)}
        </div>

        {/* Titre + hôte */}
        <h1
          style={{
            fontSize: 'clamp(20px, 5.5vw, 26px)',
            fontWeight: 700,
            lineHeight: 1.2,
            margin: '0 0 8px',
            textWrap: 'balance',
          }}
        >
          {info?.title || labelForLiveMode(info?.session_type)}
        </h1>
        {info?.host_name && (
          <p style={{ fontSize: 14, color: MUTED, margin: '0 0 4px' }}>
            {mode.vocab.host} · {info.host_name}
          </p>
        )}

        {/* Compte à rebours (si programmé et pas encore en direct) */}
        {!isLive && !isEnded && countdown && (
          <div style={{ margin: '18px 0 4px' }}>
            <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 8px' }}>
              {mode.vocab.session.charAt(0).toUpperCase() + mode.vocab.session.slice(1)} commence
              dans
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {(countdown.d > 0
                ? [
                    ['j', countdown.d],
                    ['h', countdown.h],
                    ['min', countdown.m],
                  ]
                : [
                    ['h', countdown.h],
                    ['min', countdown.m],
                    ['s', countdown.s],
                  ]
              ).map(([label, val]) => (
                <div
                  key={label}
                  style={{
                    minWidth: 58,
                    padding: '10px 4px',
                    borderRadius: 12,
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {pad(val)}
                  </div>
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isEnded && (
          <p style={{ fontSize: 14, color: MUTED, margin: '18px 0 4px' }}>
            {mode.vocab.session.charAt(0).toUpperCase() + mode.vocab.session.slice(1)} est terminé.
            Merci de votre présence.
          </p>
        )}

        {/* CTA d'entrée */}
        {!isEnded && (
          <button
            type="button"
            onClick={handleJoin}
            disabled={entering}
            style={{
              width: '100%',
              marginTop: 22,
              padding: '14px 18px',
              borderRadius: 14,
              border: 'none',
              cursor: entering ? 'default' : 'pointer',
              background: CORAL,
              color: '#1c1a18',
              fontSize: 15.5,
              fontWeight: 700,
              opacity: entering ? 0.7 : 1,
              transition: 'opacity 0.2s, transform 0.1s',
              boxShadow: '0 10px 30px -10px rgba(217,119,87,0.6)',
            }}
          >
            {entering
              ? 'Connexion…'
              : isLive
                ? mode.vocab.join
                : `Entrer dans la salle d'attente`}
          </button>
        )}

        {joinError && (
          <p style={{ fontSize: 13, color: '#e8a08a', margin: '12px 0 0' }}>{joinError}</p>
        )}

        <p style={{ fontSize: 11, color: 'rgba(183,176,166,0.6)', margin: '18px 0 0' }}>
          Accès invité · aucun compte requis
        </p>
      </div>
      <style>{keyframes}</style>
    </Shell>
  );
}

const keyframes = `
@keyframes liri-spin { to { transform: rotate(360deg); } }
@keyframes liri-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
`;
