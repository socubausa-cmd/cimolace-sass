import { LiriWordmark } from '@/components/brand/LiriWordmark';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';

// Marque blanche : nom du tenant sur son domaine, logo LIRI sur l'hôte produit.
const _LPS_BRAND = activeTenantConfig?.branding?.name || 'LIRI';
const _LPS_IS_TENANT = !!activeTenantConfig?.slug;
const _LPS_TENANT_LOGO = String(activeTenantConfig?.branding?.logo || '').trim();

/**
 * Bandeau de marque des écrans de phase du live — CALQUÉ SUR LA TÉLÉCONSULTATION
 * (pages/liri/TeleconsultJoinPage.tsx:112-124), qui est la référence validée :
 * logo LIRI, puis pastille « logo du tenant + son nom ».
 *
 * ⚠️ CE QUI ÉTAIT CASSÉ : sur un domaine tenant, `_LPS_BRAND` et `liriLiveUiLabel`
 * valent TOUS LES DEUX le nom du tenant (liveHostTheme.js:154-157 —
 * `host: _LH_IS_TENANT ? _LH_BRAND : 'Liri hôte'`). L'écran affichait donc
 * « Prorascience » DEUX FOIS d'affilée, une fois en sans-serif 38 px et une fois
 * en Georgia 26 px, et ne montrait aucun logo — ni LIRI, ni celui du tenant.
 *
 * Le nom du tenant ne vit plus qu'à UN endroit : la pastille. `liriLiveUiLabel`
 * n'est donc plus affiché ici — il reste le titre d'onglet
 * (useLiveHostDocumentTitle) et sert aux autres écrans de phase.
 */
function LiveBrandHeader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {_LPS_IS_TENANT ? (
        <img
          src="/lirilogo.png"
          alt="LIRI"
          style={{ height: 38, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 10px rgba(212,163,106,0.4))' }}
        />
      ) : (
        <LiriWordmark variant="official" officialBaseline={false} size="hero" className="justify-center" />
      )}
      {_LPS_IS_TENANT && (
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: _LPS_TENANT_LOGO ? '6px 13px 6px 8px' : '7px 15px',
            borderRadius: 999, background: 'rgba(48,48,46,.9)',
            border: '1px solid rgba(245,244,238,.09)',
          }}
        >
          {_LPS_TENANT_LOGO ? (
            <img
              src={_LPS_TENANT_LOGO}
              alt=""
              style={{ height: 22, width: 'auto', maxWidth: 70, objectFit: 'contain', borderRadius: 5 }}
              // Un logo cassé ne doit pas laisser une pastille bancale : on le retire,
              // le nom du tenant suffit à identifier la salle.
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : null}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f4ee' }}>{_LPS_BRAND}</span>
        </div>
      )}
    </div>
  );
}

export function LiveHostLoadingScreen({ message, phaseError, liveShell }) {
  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:liveShell.pageBg,backgroundImage:liveShell.pageMesh,color:'#fff',fontFamily:'system-ui,-apple-system,sans-serif',gap:'22px'}}>
      <LiveBrandHeader />
      <div style={{fontSize:'13px',color:'rgba(255,255,255,.5)'}}>{message}</div>
      <div style={{display:'flex',gap:'5px'}}>
        {[0,1,2].map(i=><div key={i} style={{width:'6px',height:'6px',borderRadius:'50%',background:'rgba(200,150,12,.6)',animation:`lhPulse 1.2s ${i*0.4}s infinite`}}/>)}
      </div>
      {phaseError && <div style={{fontSize:'11px',color:'#ef4444',maxWidth:'400px',textAlign:'center',padding:'12px 18px',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.22)',borderRadius:'14px'}}>{phaseError} — Interface en mode dégradé</div>}
      <style>{`@keyframes lhPulse{0%,100%{opacity:1}50%{opacity:.2}}`}</style>
    </div>
  );
}

export function LiveHostInvalidSessionScreen({ phaseError, liveShell, onOpenStudio }) {
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: liveShell.pageBg,
        backgroundImage: liveShell.pageMesh,
        color: '#fff',
        fontFamily: 'system-ui,-apple-system,sans-serif',
        gap: '18px',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <LiveBrandHeader />
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Lien de séance invalide</div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,.55)', textAlign: 'center', maxWidth: '440px', lineHeight: 1.5 }}>
        {phaseError
          || 'L\'adresse doit se terminer par l\'UUID de la session (format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), sans texte ni titre collés.'}
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.4)', textAlign: 'center', maxWidth: '420px' }}>
        Exemple correct : <code style={{ color: 'rgba(253,230,138,.85)' }}>/live/host/72e1832e-3899-479e-ac78-80a2b5e3ad5d</code>
        {' — pas '}
        <code style={{ color: 'rgba(248,113,113,.9)' }}>&lt;SESSION_ID&gt;</code>
        {' ni une phrase après l\'id.'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onOpenStudio}
          style={{
            borderRadius: '14px',
            background: 'rgba(212,163,106,.2)',
            border: '1px solid rgba(212,163,106,.4)',
            padding: '12px 22px',
            color: '#f3e8d2',
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

export function LiveHostEndedScreen({ isGuestUi, liveShell, onContinue }) {
  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:liveShell.pageBg,backgroundImage:liveShell.pageMesh,color:'#fff',fontFamily:'system-ui,-apple-system,sans-serif',gap:'20px'}}>
      <LiveBrandHeader />
      <div style={{fontSize:'16px',fontWeight:700,color:'#fff'}}>Session terminée</div>
      <div style={{fontSize:'13px',color:'rgba(255,255,255,.5)',textAlign:'center',maxWidth:'360px',padding:'0 16px'}}>
        {isGuestUi ? 'La diffusion live, l\'ambiance et le SmartBoard sont arrêtés.' : 'La salle vidéo a été déconnectée.'}
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
