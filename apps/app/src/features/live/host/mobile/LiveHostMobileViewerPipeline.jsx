import React, { useRef, useEffect } from 'react';

/**
 * LiveHostMobileViewerPipeline
 *
 * Le "viewport live" principal — affiché quand aucun contenu SmartBoard n'est actif.
 *
 * Layout TikTok Live :
 * ┌────────────────────────────────────┐
 * │  🔴 EN DIRECT   ⏱ 00:12  👁 42   │  ← badges top-droit
 * │                                    │
 * │   [VIDEO HÔTE plein écran]         │
 * │                                    │
 * │ [●] Prof. Dupont           ●●●●●   │
 * │     Cours : Introduction React     │
 * │     ──── Étape 2 / 5 ────          │  ← info bottom-left
 * └────────────────────────────────────┘
 *
 * Props :
 *  hostLiveKitParticipant  — participant LiveKit de l'hôte
 *  liveKitMediaEpoch       — epoch pour re-attacher la track
 *  cameraOn                — caméra hôte active ?
 *  hostCameraSlot          — slot vidéo rendu par le parent (prioritaire)
 *  user                    — objet utilisateur (nom, avatar)
 *  sessionTitle            — titre du cours
 *  liveDuration            — durée formatée (ex. "00:12:34")
 *  onlineMemberCount       — nb spectateurs
 *  step / stepCount        — étape courante / total
 *  etapeLabel              — label de l'étape courante
 *  liveShell               — branding { school_name, logo_url, primary_color }
 */
export function LiveHostMobileViewerPipeline({
  hostLiveKitParticipant,
  liveKitMediaEpoch,
  cameraOn,
  hostCameraSlot,
  user,
  sessionTitle,
  liveDuration,
  onlineMemberCount,
  step,
  stepCount,
  etapeLabel,
  liveShell,
}) {
  // ── Attache la track camera de l'hôte ─────────────────────────────────────
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !hostLiveKitParticipant) return;
    const camPub = Array.from(
      hostLiveKitParticipant.videoTrackPublications?.values?.() ?? [],
    ).find((pub) => pub.source === 'camera' || pub.kind === 'video');
    if (!camPub?.track) return;
    camPub.track.attach(videoRef.current);
    return () => {
      try { camPub.track.detach(videoRef.current); } catch (_) {}
    };
  }, [hostLiveKitParticipant, liveKitMediaEpoch]);

  // ── Dérivations ───────────────────────────────────────────────────────────
  const displayName =
    user?.display_name || user?.displayName ||
    user?.full_name    || user?.fullName     ||
    user?.name         || user?.email?.split('@')[0] || 'Hôte';

  const avatarUrl   = user?.avatar_url || user?.avatarUrl || user?.photoURL || null;
  const avatarLetter = displayName[0]?.toUpperCase() || '?';
  const schoolName  = liveShell?.school_name || liveShell?.schoolName || '';
  const accentColor = liveShell?.primary_color || liveShell?.primaryColor || '#a78bfa';
  // Fond réel de l'école depuis liveShell (évite le bleu hardcodé)
  const pageBg      = liveShell?.pageBg  || '#0f1117';
  const pageMesh    = liveShell?.pageMesh || '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      background: pageBg,
    }}>

      {/* ── VIDEO (ou avatar centré si cam off) ─────────────────────────── */}
      {cameraOn ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          {hostCameraSlot ?? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )}
        </div>
      ) : (
        /* Fond réel de l'école quand caméra éteinte */
        <div style={{
          position: 'absolute',
          inset: 0,
          background: pageMesh ? `${pageMesh}, ${pageBg}` : pageBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Avatar géant centré */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            userSelect: 'none',
          }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                style={{
                  width: 96, height: 96, borderRadius: '50%',
                  objectFit: 'cover',
                  border: `3px solid ${accentColor}60`,
                  boxShadow: `0 0 40px ${accentColor}30`,
                }}
              />
            ) : (
              <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: `${accentColor}22`,
                border: `2px solid ${accentColor}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 700, color: accentColor,
                boxShadow: `0 0 40px ${accentColor}20`,
              }}>
                {avatarLetter}
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 11, fontWeight: 600,
                margin: 0, letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                Caméra désactivée
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 16, fontWeight: 700,
                margin: '6px 0 0',
              }}>
                {displayName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── GRADIENT OVERLAY haut (top vignette) ────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '28%',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── GRADIENT OVERLAY bas (bottom vignette) ───────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '55%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── INFO PROF + COURS — bas-gauche ──────────────────────────────── */}
      {/* TopBar gère déjà LIVE + durée + membres — pas de duplication ici */}
      <div style={{
        position: 'absolute',
        left: 14,
        bottom: 140,          // au-dessus du handle drawer (28) + BottomBar (80) + marge
        right: 72,            // évite la FabStack droite
        zIndex: 3,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}>

        {/* Étape courante (pill) */}
        {(etapeLabel || (stepCount > 0)) && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            alignSelf: 'flex-start',
          }}>
            <div style={{
              padding: '3px 10px',
              borderRadius: 20,
              background: `${accentColor}22`,
              border: `1px solid ${accentColor}44`,
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {/* Indicateur étapes */}
              {stepCount > 0 && (
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  {Array.from({ length: Math.min(stepCount, 7) }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: i === step ? 14 : 5,
                        height: 5,
                        borderRadius: 3,
                        background: i === step ? accentColor : `${accentColor}44`,
                        transition: 'width 0.3s ease, background 0.3s ease',
                      }}
                    />
                  ))}
                </div>
              )}
              {etapeLabel && (
                <span style={{
                  color: accentColor,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {etapeLabel}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Ligne principale : avatar + nom + infos */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>

          {/* Avatar */}
          <div style={{ flexShrink: 0 }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                style={{
                  width: 46, height: 46, borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid ${accentColor}66`,
                  boxShadow: `0 0 16px ${accentColor}30, 0 2px 10px rgba(0,0,0,0.6)`,
                }}
              />
            ) : (
              <div style={{
                width: 46, height: 46, borderRadius: '50%',
                background: `${accentColor}28`,
                border: `2px solid ${accentColor}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, color: accentColor,
                boxShadow: `0 0 16px ${accentColor}25, 0 2px 10px rgba(0,0,0,0.5)`,
                flexShrink: 0,
              }}>
                {avatarLetter}
              </div>
            )}
          </div>

          {/* Textes */}
          <div style={{ minWidth: 0, flex: 1 }}>
            {schoolName && (
              <p style={{
                color: `${accentColor}bb`,
                fontSize: 10,
                fontWeight: 700,
                margin: 0,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {schoolName}
              </p>
            )}
            <p style={{
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 700,
              margin: schoolName ? '2px 0 0' : 0,
              textShadow: '0 1px 8px rgba(0,0,0,0.9)',
              letterSpacing: '0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {displayName}
            </p>
            {sessionTitle && (
              <p style={{
                color: 'rgba(255,255,255,0.62)',
                fontSize: 12,
                fontWeight: 500,
                margin: '3px 0 0',
                textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {sessionTitle}
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
