import React from 'react';
import { Link } from 'react-router-dom';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import LiveGuestLongiaPanel from '@/components/live-room/LiveGuestLongiaPanel';
import GuestLivekitInterpreterAudios from '@/components/live-room/GuestLivekitInterpreterAudios';
import { formatMeshCountdown } from '@/features/live/host/liveHostUtils';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Colonne droite côté invité — bandeau chat désactivé, bandeau LIRI traduction,
 * panneau LONGIA, état mesh / JoyKit et lien forum formation.
 */
export const LiveGuestLongiaSidebar = ({
  isGuestUi,
  phase,
  sessionCommFlags,
  guestMultilangConfig,
  guestLivekitInterpreterParticipants,
  guestLivekitInterpreterVolume,
  setGuestLivekitInterpreterVolume,
  liveKitMediaEpoch,
  guestMultilangViewLang,
  setGuestMultilangViewLang,
  guestMultilangRolling,
  guestTeacherTranscript,
  guestTeacherTranscriptPartial,
  sessionId,
  user,
  supabase,
  sessionTitle,
  curEtape,
  chatMessages,
  publishGuestLongiaBusEvent,
  guestLongiaSessionDigests,
  toast,
  guestMultilangBrowserTtsOn,
  setGuestMultilangBrowserTtsOnPersist,
  guestMultilangEdgeTtsOn,
  setGuestMultilangEdgeTtsOnPersist,
  assertGuestLongiaSignal,
  guestMeshGrant,
  guestMeshRemainSec,
  guestMediaDrive,
  sessionFormationId,
}) => {
  if (!isGuestUi) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', gap: '11px' }}>
      {sessionCommFlags.chat_enabled === false ? (
        <div
          className="lh-sp-keep lh-sp-glow"
          style={{
            border: '1px solid rgba(148,163,184,.2)',
            background: 'rgba(15,23,42,.45)',
            padding: '10px',
            borderRadius: '4px',
            flexShrink: 0,
          }}
        >
          <p style={{ fontSize: '10px', color: 'rgba(226,232,240,.85)', lineHeight: 1.5, margin: 0 }}>
            Le <strong style={{ color: '#94a3b8' }}>chat de session</strong> est désactivé par le formateur.
          </p>
        </div>
      ) : null}
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: '#a78bfa', flexShrink: 0 }}>
        PROF. VIRTUEL · LONGIA
      </div>
      {guestMultilangConfig.livekit_interpreter_enabled && phase === PHASE.LIVE ? (
        <div style={{ flexShrink: 0 }}>
          <GuestLivekitInterpreterAudios
            participants={guestLivekitInterpreterParticipants}
            volume={guestLivekitInterpreterVolume}
            mediaEpoch={liveKitMediaEpoch}
          />
        </div>
      ) : null}
      {guestMultilangConfig.enabled ? (
        <div
          style={{
            flexShrink: 0,
            borderRadius: '10px',
            border: '1px solid rgba(167,139,250,.25)',
            background: 'linear-gradient(135deg,rgba(109,40,217,.12) 0%,rgba(16,12,26,.85) 100%)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <LiriWordmark
              variant="official"
              officialBaseline={false}
              size="footer"
              subtleGlow
              className="opacity-95"
            />
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: '#a78bfa' }}>
              · TRADUCTION
            </span>
            {guestMultilangConfig.sourceLang ? (
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)' }}>
                {String(guestMultilangConfig.sourceLang).toUpperCase()} →
              </span>
            ) : null}
          </div>
          {Array.isArray(guestMultilangConfig.targetLangs) && guestMultilangConfig.targetLangs.length > 1 ? (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {guestMultilangConfig.targetLangs.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setGuestMultilangViewLang(lang)}
                  style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '20px',
                    border:
                      guestMultilangViewLang === lang ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,.15)',
                    background: guestMultilangViewLang === lang ? 'rgba(139,92,246,.25)' : 'rgba(255,255,255,.04)',
                    color: guestMultilangViewLang === lang ? '#c4b5fd' : 'rgba(255,255,255,.5)',
                    cursor: 'pointer',
                    transition: 'all .15s',
                    textTransform: 'uppercase',
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>
          ) : null}
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              fontWeight: 500,
              lineHeight: 1.55,
              color: guestMultilangRolling[guestMultilangViewLang] ? '#e9d5ff' : 'rgba(255,255,255,.3)',
              fontStyle: guestMultilangRolling[guestMultilangViewLang] ? 'normal' : 'italic',
              minHeight: '18px',
            }}
          >
            {guestMultilangRolling[guestMultilangViewLang] || 'En attente de traduction…'}
          </p>
          {guestTeacherTranscript ? (
            <p
              style={{
                margin: 0,
                fontSize: '9px',
                color: 'rgba(255,255,255,.3)',
                lineHeight: 1.4,
                borderTop: '1px solid rgba(255,255,255,.06)',
                paddingTop: '5px',
              }}
            >
              {guestTeacherTranscript.slice(0, 120)}
              {guestTeacherTranscript.length > 120 ? '…' : ''}
            </p>
          ) : null}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {sessionId && user?.id ? (
          <LiveGuestLongiaPanel
            supabase={supabase}
            sessionId={sessionId}
            user={user}
            sessionTitle={sessionTitle}
            stepTitle={curEtape?.title}
            chatMessages={chatMessages}
            teacherTranscriptSnippet={guestTeacherTranscript}
            teacherTranscriptPartial={guestTeacherTranscriptPartial}
            publishLongiaBusEvent={publishGuestLongiaBusEvent}
            sessionDigests={guestLongiaSessionDigests}
            chatEnabled={sessionCommFlags.chat_enabled !== false}
            toast={toast}
            multilangGuest={
              guestMultilangConfig.enabled
                ? {
                    sourceLang: guestMultilangConfig.sourceLang,
                    targetLangs: guestMultilangConfig.targetLangs,
                    viewLang: guestMultilangViewLang,
                    onViewLangChange: setGuestMultilangViewLang,
                    rollingByLang: guestMultilangRolling,
                  }
                : null
            }
            multilangAudio={
              guestMultilangConfig.enabled
                ? {
                    browserTtsOffered: guestMultilangConfig.guest_browser_tts_offered !== false,
                    browserTtsOn: guestMultilangBrowserTtsOn,
                    onBrowserTtsChange: setGuestMultilangBrowserTtsOnPersist,
                    edgeTtsOffered: guestMultilangConfig.guest_edge_tts_offered === true,
                    edgeTtsOn: guestMultilangEdgeTtsOn,
                    onEdgeTtsChange: setGuestMultilangEdgeTtsOnPersist,
                    livekitOffered: guestMultilangConfig.livekit_interpreter_enabled === true,
                    livekitParticipantCount: guestLivekitInterpreterParticipants.length,
                    interpreterVolume: guestLivekitInterpreterVolume,
                    onInterpreterVolumeChange: setGuestLivekitInterpreterVolume,
                  }
                : null
            }
            assertCriticalGuestAction={assertGuestLongiaSignal}
          />
        ) : (
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.45)', padding: '8px 0' }}>
            Connexion requise pour LONGIA.
          </div>
        )}
      </div>
      {guestMeshGrant ? (
        <div
          style={{
            flexShrink: 0,
            borderRadius: '6px',
            border: guestMediaDrive ? '1px solid rgba(52,211,153,.35)' : '1px solid rgba(200,150,12,.35)',
            background: guestMediaDrive ? 'rgba(16,185,129,.08)' : 'rgba(200,150,12,.1)',
            padding: '8px',
            fontSize: '10px',
            color: guestMediaDrive ? '#a7f3d0' : '#fde68a',
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: guestMediaDrive ? '#34d399' : '#C8960C' }}>
            {guestMediaDrive ? 'Piste média' : 'JoyKit actif'}
          </strong>
          {guestMeshRemainSec != null ? (
            <span style={{ marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
              {formatMeshCountdown(guestMeshRemainSec)}
            </span>
          ) : null}
        </div>
      ) : null}
      {sessionFormationId ? (
        <Link
          to={`/formation/${sessionFormationId}/forum`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '9px', color: '#c4b5fd', fontWeight: 600, flexShrink: 0 }}
        >
          Forum formation
        </Link>
      ) : null}
    </div>
  );
};

export default LiveGuestLongiaSidebar;
