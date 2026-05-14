import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Track } from 'livekit-client';
import LiveHostVideoCell from '@/components/live-room/LiveHostVideoCell';
import { LH_SIDEBAR_CARD_GLOW } from '@/features/live/host/liveHostTheme';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { ARENA_LAYOUT } from '@/lib/liriArenaLayout';

/**
 * Carte « HOTE EN DIRECT » de la colonne droite côté hôte : vidéo principale (formateur
 * ou flux promu), PiP locale optionnelle, contrôles micro/caméra/partage d'écran.
 * Affichée uniquement pour l'hôte (pas pour les invités).
 */
export const LiveHostRightRailVideoCard = ({
  isGuestUi,
  phase,
  antennaSoloMode,
  liveParticipants,
  setAntennaSoloMode,
  setPromotedId,
  liveDuration,
  lhStageFocusLayout,
  arenaHostCameraCenter,
  lhHostShowsRemoteMain,
  rightRailShowsLocalHost,
  setHostRightRailLocalVideoOpen,
  setLiveRightRailOpen,
  showHostRightRailVideoFrame,
  hostVidHeight,
  videoFxActive,
  videoFilterCSS,
  arenaLayoutMode,
  applyHostArenaLayoutMode,
  lhMainRemoteParticipant,
  liveKitMediaEpoch,
  livekitParticipantsMap,
  cameraOn,
  promotedId,
  user,
  hostRightRailVideoIsCenterCameraOnly,
  guestMicLocked,
  toggleMic,
  micOn,
  guestCamLocked,
  toggleCamera,
  guestScreenShareLocked,
  toggleScreenShare,
  sharingScreen,
  debateArena,
}) => {
  if (isGuestUi) return null;

  return (
    <div
      className="lh-sp-dim lh-premium-card"
      style={{
        ...LH_SIDEBAR_CARD_GLOW,
        border: '1px solid rgba(251,191,36,.26)',
        background:
          'radial-gradient(120% 90% at 10% -8%, rgba(251,191,36,.12), transparent 54%), linear-gradient(160deg, rgba(29,19,43,.9), rgba(11,12,24,.96))',
      }}
    >
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px',gap:'6px',flexWrap:'wrap'}}>
        <span style={{fontSize:'11px',fontWeight:700,color:'#e9bf72',letterSpacing:'.07em'}}>HOTE EN DIRECT</span>
        <div style={{display:'flex',alignItems:'center',gap:'5px',flexWrap:'wrap',justifyContent:'flex-end'}}>
          {!isGuestUi && phase === PHASE.LIVE && antennaSoloMode && liveParticipants.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                const id = liveParticipants[0]?.id;
                if (id) {
                  setAntennaSoloMode(false);
                  setPromotedId(id);
                }
              }}
              title="Afficher le flux du premier membre dans le cadre principal"
              style={{
                borderRadius: '8px',
                border: '1px solid rgba(16,185,129,.35)',
                background: 'rgba(16,185,129,.1)',
                padding: '4px 10px',
                fontSize: '9px',
                fontWeight: 700,
                color: '#6ee7b7',
                cursor: 'pointer',
              }}
            >
              Réafficher le panel
            </button>
          ) : null}
          {liveDuration && <span style={{fontSize:'9px',color:'rgba(255,255,255,.5)',fontVariantNumeric:'tabular-nums'}}>{liveDuration}</span>}
          <span style={{background:'#c63b3b',borderRadius:'3px',padding:'2px 7px',fontSize:'9px',fontWeight:700,color:'#fff'}}>LIVE</span>
          {phase === PHASE.LIVE && !lhStageFocusLayout && !arenaHostCameraCenter && !lhHostShowsRemoteMain ? (
            rightRailShowsLocalHost ? (
              <button
                type="button"
                onClick={() => setHostRightRailLocalVideoOpen(false)}
                title="Masquer la vidéo ici — vignette dans le bandeau uniquement (plus de place pour mindmap et MasterScript)"
                className="shrink-0 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100/95 transition hover:border-amber-400/55 hover:bg-amber-500/18"
              >
                Bandeau
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setHostRightRailLocalVideoOpen(true);
                  setLiveRightRailOpen(true);
                }}
                title="Afficher votre caméra dans ce panneau (la vignette disparaît du bandeau)"
                className="shrink-0 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100/95 transition hover:border-amber-400/55 hover:bg-amber-500/18"
              >
                Ici
              </button>
            )
          ) : null}
          {phase === PHASE.LIVE && !lhStageFocusLayout ? (
            <button
              type="button"
              onClick={() => setLiveRightRailOpen(false)}
              title="Fermer le panneau droit"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-white/65 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white/90"
              aria-label="Fermer le panneau droit"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {showHostRightRailVideoFrame ? (
      <div style={{height:`${hostVidHeight}px`,borderRadius:'4px',border:'1px solid rgba(255,255,255,.07)',overflow:'hidden',position:'relative',isolation:'isolate',background:'linear-gradient(135deg,#1e1830,#2a1f40)',transition:'height .3s ease',filter: videoFxActive && !lhHostShowsRemoteMain ? videoFilterCSS : undefined}}>
        {lhHostShowsRemoteMain ? (
          <>
            <button
              type="button"
              onClick={() => {
                setAntennaSoloMode(true);
                setPromotedId(null);
                if (arenaLayoutMode === ARENA_LAYOUT.GUEST_FOCUS) {
                  applyHostArenaLayoutMode(ARENA_LAYOUT.SMARTBOARD);
                }
              }}
              title="Revenir à la vue hôte plein cadre ; le panel ne diffuse plus le flux principal."
              className="lh-premium-btn"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 20,
                borderRadius: '8px',
                border: '1px solid rgba(251,191,36,.4)',
                background: 'rgba(0,0,0,.55)',
                padding: '4px 8px',
                fontSize: '9px',
                fontWeight: 700,
                color: '#fde68a',
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
              }}
            >
              Libérer l&apos;antenne
            </button>
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
              {Array.from(lhMainRemoteParticipant.videoTrackPublications?.values?.() || []).some((p) => p.source === Track.Source.Camera && !p.isMuted && p.track)
                ? <LiveHostVideoCell participant={lhMainRemoteParticipant} mediaEpoch={liveKitMediaEpoch} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>
                : <><div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 65% 22%,rgba(255,200,140,.22),transparent 35%)'}}/>
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:'78px',height:'78px',borderRadius:'50%',background:'radial-gradient(circle at 40% 32%,#d4a870,#8b5e3c 50%,#5c3a1e)',border:'2px solid rgba(255,255,255,.18)',boxShadow:'0 4px 20px rgba(0,0,0,.5)'}}/></div>
                </>}
            </div>
            {livekitParticipantsMap['local'] && cameraOn ? (
              <div style={{position:'absolute',bottom:'8px',right:'8px',width:'112px',height:'84px',borderRadius:'10px',overflow:'hidden',border:'1px solid rgba(255,255,255,.28)',boxShadow:'0 4px 14px rgba(0,0,0,.55)',zIndex:10,isolation:'isolate',background:'#0a0612',filter:videoFxActive ? videoFilterCSS : undefined}}>
                <LiveHostVideoCell participant={livekitParticipantsMap['local']} mediaEpoch={liveKitMediaEpoch} style={{position:'absolute',inset:0,width:'100%',height:'100%'}} />
                <div style={{position:'absolute',bottom:'3px',left:'6px',zIndex:11,fontSize:'8px',fontWeight:700,color:'#fff',textShadow:'0 1px 3px rgba(0,0,0,.9)'}}>Vous</div>
              </div>
            ) : null}
            <div style={{position:'absolute',bottom:'6px',left:'8px',zIndex:12,fontSize:'9px',color:'rgba(255,255,255,.85)',background:'rgba(0,0,0,.5)',backdropFilter:'blur(2px)',padding:'1px 6px',borderRadius:'3px',maxWidth:'72%'}}>
              <span style={{color:'#fde68a',fontWeight:700,marginRight:'6px'}}>À l&apos;antenne</span>
              {liveParticipants.find((x) => String(x.id) === String(promotedId))?.name || lhMainRemoteParticipant?.name || '—'}
            </div>
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
              {livekitParticipantsMap['local'] && cameraOn
                ? <LiveHostVideoCell participant={livekitParticipantsMap['local']} mediaEpoch={liveKitMediaEpoch} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>
                : <><div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 65% 22%,rgba(255,200,140,.22),transparent 35%)'}}/>
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:'78px',height:'78px',borderRadius:'50%',background:'radial-gradient(circle at 40% 32%,#d4a870,#8b5e3c 50%,#5c3a1e)',border:'2px solid rgba(255,255,255,.18)',boxShadow:'0 4px 20px rgba(0,0,0,.5)'}}/></div>
                </>}
            </div>
            <div style={{position:'absolute',bottom:'6px',left:'8px',zIndex:12,fontSize:'9px',color:'rgba(255,255,255,.65)',background:'rgba(0,0,0,.5)',backdropFilter:'blur(2px)',padding:'1px 5px',borderRadius:'3px',maxWidth:'85%'}}>
              <span style={{display:'block'}}>{user?.full_name||'Prof. LIRI'}</span>
              {antennaSoloMode && liveParticipants.length > 0 ? (
                <span style={{display:'block',marginTop:'3px',fontSize:'8px',color:'rgba(253,230,138,.85)',fontWeight:600}}>Antenne libérée — vue hôte</span>
              ) : null}
            </div>
          </>
        )}
      </div>
      ) : hostRightRailVideoIsCenterCameraOnly ? (
        <p className="mb-1 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-2 py-1 text-[8px] leading-snug text-amber-100/75">
          Caméra au centre — pas de cadre ici.
        </p>
      ) : null}
      <div style={{display:'flex',gap:'4px',marginTop: showHostRightRailVideoFrame || hostRightRailVideoIsCenterCameraOnly ? '6px' : '4px'}}>
        <button onClick={() => { if (!guestMicLocked) toggleMic(); }} title={guestMicLocked ? 'Micro désactivé par le formateur' : (micOn ? 'Couper micro' : 'Activer micro')} style={{borderRadius:'8px',border:`1px solid ${micOn?'rgba(251,191,36,.55)':'rgba(255,255,255,.09)'}`,background:micOn?'rgba(251,191,36,.16)':'rgba(255,255,255,.04)',padding:'4px',color:micOn?'#fde68a':'rgba(255,255,255,.7)',display:'flex',alignItems:'center',cursor:guestMicLocked?'not-allowed':'pointer',opacity:guestMicLocked?0.45:1}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
        </button>
        <button onClick={() => { if (!guestCamLocked) toggleCamera(); }} title={guestCamLocked ? 'Caméra désactivée par le formateur' : (cameraOn ? 'Couper caméra' : 'Activer caméra')} style={{borderRadius:'8px',border:`1px solid ${cameraOn?'rgba(167,139,250,.5)':'rgba(255,255,255,.09)'}`,background:cameraOn?'rgba(109,40,217,.2)':'rgba(255,255,255,.04)',padding:'4px',color:cameraOn?'#ddd6fe':'rgba(255,255,255,.7)',display:'flex',alignItems:'center',cursor:guestCamLocked?'not-allowed':'pointer',opacity:guestCamLocked?0.45:1}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"/></svg>
        </button>
        <button
          type="button"
          onClick={() => { if (!guestScreenShareLocked) toggleScreenShare(); }}
          title={
            guestScreenShareLocked
              ? (debateArena?.myRole === 'viewer' ? 'Partage d’écran indisponible (spectateur débat)' : 'Partage d’écran désactivé par le formateur')
              : (sharingScreen ? 'Arrêter partage' : 'Partager écran')
          }
          style={{
            borderRadius: '8px',
            border: `1px solid ${sharingScreen ? 'rgba(109,40,217,.5)' : 'rgba(255,255,255,.09)'}`,
            background: sharingScreen ? 'rgba(109,40,217,.18)' : 'rgba(255,255,255,.04)',
            padding: '4px',
            color: sharingScreen ? '#c4b5fd' : 'rgba(255,255,255,.7)',
            display: 'flex',
            alignItems: 'center',
            cursor: guestScreenShareLocked ? 'not-allowed' : 'pointer',
            opacity: guestScreenShareLocked ? 0.45 : 1,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </button>
      </div>
    </div>
  );
};
