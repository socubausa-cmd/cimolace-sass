import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { PHASE } from '@/features/live/host/liveHostConstants';

export function LiveGuestLeftRail({
  hostCompactColOrder,
  liveShell,
  liveLeftGuestCollapsedStrip,
  lhLayoutCompact,
  liveLeftRailOpen,
  phase,
  lhStageFocusLayout,
  liveDuration,
  curEtape,
  liveParticipants,
  sessionFormationId,
  onOpen,
  onClose,
}) {
  return (
    <div
      className="lh-sy lh-sp-dim"
      style={{
        order: hostCompactColOrder.left,
        background: liveLeftGuestCollapsedStrip ? liveShell.panelBg : 'transparent',
        borderRadius: liveLeftGuestCollapsedStrip ? liveShell.panelRadius : 0,
        border: liveLeftGuestCollapsedStrip ? liveShell.panelBorder : 'none',
        padding: liveLeftGuestCollapsedStrip ? '10px 6px' : '14px',
        display: lhLayoutCompact && !liveLeftRailOpen ? 'none' : 'flex',
        flexDirection: 'column',
        gap: liveLeftGuestCollapsedStrip ? '8px' : '11px',
        alignItems: liveLeftGuestCollapsedStrip ? 'center' : undefined,
        overflow: 'hidden',
        transition: 'opacity .2s, padding .2s ease',
        opacity: lhLayoutCompact && !liveLeftRailOpen ? 0 : 1,
        pointerEvents: lhLayoutCompact && !liveLeftRailOpen ? 'none' : 'auto',
        minHeight: 0,
        minWidth: 0,
        alignSelf: 'stretch',
        boxShadow: '0 0 0 1px rgba(255,255,255,.03) inset',
      }}
    >
      {liveLeftGuestCollapsedStrip ? (
        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3 py-1">
          <button
            type="button"
            onClick={onOpen}
            title="Agrandir le panneau gauche"
            aria-label="Agrandir le panneau gauche"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/14 bg-white/[0.06] text-amber-100/90 transition hover:border-amber-400/35 hover:bg-white/[0.1]"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.85)]"
            style={{ animation: 'lhPulse 2s infinite' }}
            title="En direct"
            aria-hidden
          />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                minHeight: 46,
              }}
            >
              <LiriWordmark
                variant="mark"
                size="rail"
                letterClassName="text-white"
                className="text-white drop-shadow-[0_2px_10px_rgba(212,163,106,0.35)]"
              />
            </div>
            {phase === PHASE.LIVE && !lhStageFocusLayout ? (
              <button
                type="button"
                onClick={onClose}
                title="Fermer le panneau gauche"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-white/65 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white/90"
                aria-label="Fermer le panneau gauche"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>

          <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
            <span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#ef4444',boxShadow:'0 0 8px rgba(239,68,68,.9)',animation:'lhPulse 2s infinite',flexShrink:0}}/>
            <span style={{fontSize:'10px',fontWeight:700,color:'#ff8c42',letterSpacing:'.06em'}}>EN DIRECT</span>
            {liveDuration ? <span style={{marginLeft:'auto',fontSize:'10px',color:'rgba(255,255,255,.38)',fontVariantNumeric:'tabular-nums'}}>{liveDuration}</span> : null}
          </div>

          {curEtape?.title ? (
            <div style={{padding:'8px',borderRadius:'6px',border:'1px solid rgba(255,255,255,.07)',background:'rgba(255,255,255,.03)'}}>
              <div style={{fontSize:'8px',fontWeight:700,letterSpacing:'.1em',color:'rgba(208,187,167,.65)',marginBottom:'4px'}}>ÉTAPE EN COURS</div>
              <p style={{margin:0,fontSize:'11px',color:'rgba(255,255,255,.75)',lineHeight:1.45,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>{curEtape.title}</p>
            </div>
          ) : null}

          <p style={{margin:0,fontSize:'10px',color:'rgba(255,255,255,.35)'}}>
            {liveParticipants.length + 1} participant{liveParticipants.length > 0 ? 's' : ''} en ligne
          </p>

          {sessionFormationId ? (
            <div style={{display:'flex',flexDirection:'column',gap:'5px',marginTop:'auto'}}>
              <Link to={`/formation/${sessionFormationId}`} target="_blank" rel="noopener noreferrer"
                style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 8px',borderRadius:'6px',border:'1px solid rgba(255,255,255,.07)',background:'rgba(255,255,255,.03)',fontSize:'10px',color:'rgba(253,200,147,.85)',fontWeight:600,textDecoration:'none'}}>
                Cours de la formation
              </Link>
              <Link to={`/formation/${sessionFormationId}/forum`} target="_blank" rel="noopener noreferrer"
                style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 8px',borderRadius:'6px',border:'1px solid rgba(255,255,255,.07)',background:'rgba(255,255,255,.03)',fontSize:'10px',color:'#e3c79a',fontWeight:600,textDecoration:'none'}}>
                Forum de la formation
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
