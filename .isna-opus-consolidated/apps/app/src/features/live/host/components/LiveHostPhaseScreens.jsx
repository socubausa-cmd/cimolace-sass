import { LiriWordmark } from '@/components/brand/LiriWordmark';

export function LiveHostLoadingScreen({ message, phaseError, liveShell, liriLiveUiLabel }) {
  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:liveShell.pageBg,backgroundImage:liveShell.pageMesh,color:'#fff',fontFamily:'system-ui,-apple-system,sans-serif',gap:'22px'}}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 52 }}>
        <LiriWordmark variant="official" officialBaseline={false} size="hero" className="justify-center" />
      </div>
      <div style={{fontSize:'26px',color:'#e5c47a',fontFamily:'Georgia,serif',letterSpacing:'.04em',fontWeight:600}}>{liriLiveUiLabel}</div>
      <div style={{fontSize:'13px',color:'rgba(255,255,255,.5)'}}>{message}</div>
      <div style={{display:'flex',gap:'5px'}}>
        {[0,1,2].map(i=><div key={i} style={{width:'6px',height:'6px',borderRadius:'50%',background:'rgba(200,150,12,.6)',animation:`lhPulse 1.2s ${i*0.4}s infinite`}}/>)}
      </div>
      {phaseError && <div style={{fontSize:'11px',color:'#ef4444',maxWidth:'400px',textAlign:'center',padding:'12px 18px',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.22)',borderRadius:'14px'}}>{phaseError} — Interface en mode dégradé</div>}
      <style>{`@keyframes lhPulse{0%,100%{opacity:1}50%{opacity:.2}}`}</style>
    </div>
  );
}

export function LiveHostInvalidSessionScreen({ phaseError, liveShell, liriLiveUiLabel, onOpenStudio }) {
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: liveShell.pageBg,
        backgroundImage: liveShell.pageMesh,
        color: '#fff',
        fontFamily: 'system-ui,-apple-system,sans-serif',
        gap: '18px',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: '26px', color: '#e5c47a', fontFamily: 'Georgia,serif', fontWeight: 600 }}>
        {liriLiveUiLabel}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Lien de séance invalide</div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,.55)', textAlign: 'center', maxWidth: '440px', lineHeight: 1.5 }}>
        {phaseError
          || 'L’adresse doit se terminer par l’UUID de la session (format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), sans texte ni titre collés.'}
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.4)', textAlign: 'center', maxWidth: '420px' }}>
        Exemple correct : <code style={{ color: 'rgba(253,230,138,.85)' }}>/live/host/72e1832e-3899-479e-ac78-80a2b5e3ad5d</code>
        {' — pas '}
        <code style={{ color: 'rgba(248,113,113,.9)' }}>&lt;SESSION_ID&gt;</code>
        {' ni une phrase après l’id.'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onOpenStudio}
          style={{
            borderRadius: '14px',
            background: 'rgba(124,58,237,.2)',
            border: '1px solid rgba(167,139,250,.4)',
            padding: '12px 22px',
            color: '#e9d5ff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Ouvrir le Studio live
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            borderRadius: '14px',
            background: 'rgba(200,150,12,.14)',
            border: '1px solid rgba(200,150,12,.35)',
            padding: '12px 22px',
            color: '#e5c47a',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Recharger la page
        </button>
      </div>
    </div>
  );
}

export function LiveHostEndedScreen({ isGuestUi, liveShell, liriLiveUiLabel, onContinue }) {
  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:liveShell.pageBg,backgroundImage:liveShell.pageMesh,color:'#fff',fontFamily:'system-ui,-apple-system,sans-serif',gap:'20px'}}>
      <div style={{fontSize:'26px',color:'#e5c47a',fontFamily:'Georgia,serif',fontWeight:600}}>{liriLiveUiLabel}</div>
      <div style={{fontSize:'16px',fontWeight:700,color:'#fff'}}>Session terminée</div>
      <div style={{fontSize:'13px',color:'rgba(255,255,255,.5)',textAlign:'center',maxWidth:'360px',padding:'0 16px'}}>
        {isGuestUi ? 'La diffusion live, l’ambiance et le SmartBoard sont arrêtés.' : 'La salle vidéo a été déconnectée.'}
      </div>
      <button
        type="button"
        onClick={onContinue}
        style={{borderRadius:'14px',background:'rgba(200,150,12,.14)',border:'1px solid rgba(200,150,12,.35)',padding:'12px 28px',color:'#e5c47a',fontSize:'13px',fontWeight:700,cursor:'pointer',boxShadow:'0 8px 28px rgba(0,0,0,.25)'}}
      >
        {isGuestUi ? "Retour à l'app" : "Voir l'analyse"}
      </button>
    </div>
  );
}
