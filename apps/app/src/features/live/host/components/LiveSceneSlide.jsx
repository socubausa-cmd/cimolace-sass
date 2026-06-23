import { SMARTBOARD_DESIGN_HEIGHT, SMARTBOARD_DESIGN_WIDTH } from '@/lib/smartboardDesignCanvas';
import { useTenantBranding } from '@/hooks/useTenantBranding';

export function LiveSceneSlide({ slide }) {
  const { branding } = useTenantBranding();
  if (!slide) return null;

  // Scène IA (ia_data sans éléments) → layout texte simplifié
  if (slide.ia_data && !slide.elements) {
    const ia = slide.ia_data;
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 110%,rgba(160,50,20,.5),rgba(100,20,70,.25) 30%,transparent 65%),linear-gradient(180deg,#0e0e24,#130d20 40%,#1c0e1e)' }}/>
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 36px', gap: '12px' }}>
          <span style={{ fontSize: '10px', letterSpacing: '.22em', fontWeight: 700, padding: '3px 10px', borderRadius: '3px', border: '1px solid rgba(200,150,12,.4)', background: 'rgba(200,150,12,.12)', color: '#C8960C', alignSelf: 'flex-start' }}>{`${branding.name} · LIRI`}</span>
          {ia.title && <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>{ia.title}</div>}
          {ia.subtitle && <div style={{ fontSize: '14px', color: 'rgba(255,255,255,.55)', fontStyle: 'italic' }}>{ia.subtitle}</div>}
          {ia.core_idea && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,.8)', lineHeight: 1.7, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '4px', flex: 1 }}>{ia.core_idea}</div>}
          {Array.isArray(ia.development) && ia.development.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {ia.development.slice(0, 3).map((developmentItem, index) => (
                <div key={index} style={{ fontSize: '11px', color: 'rgba(255,255,255,.65)', padding: '6px 10px', background: 'rgba(255,255,255,.025)', borderLeft: '2px solid rgba(200,150,12,.4)', borderRadius: '0 4px 4px 0' }}>{typeof developmentItem === 'string' ? developmentItem : (developmentItem.text || developmentItem.point || JSON.stringify(developmentItem))}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!Array.isArray(slide.elements) || slide.elements.length === 0) return null;

  const CW = SMARTBOARD_DESIGN_WIDTH;
  const CH = SMARTBOARD_DESIGN_HEIGHT;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 110%,rgba(160,50,20,.5),rgba(100,20,70,.25) 30%,transparent 65%),linear-gradient(180deg,#0e0e24,#130d20 40%,#1c0e1e)', overflow: 'hidden' }}>
      {slide.elements.map((el) => {
        const style = {
          position: 'absolute',
          left: `${(el.x / CW) * 100}%`,
          top: `${(el.y / CH) * 100}%`,
          width: `${(el.width / CW) * 100}%`,
          height: `${(el.height / CH) * 100}%`,
          zIndex: el.zIndex || 1,
        };
        if (el.type === 'badge') return (
          <div key={el.id} style={{ ...style, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', letterSpacing: '.18em', fontWeight: 700, padding: '2px 9px', borderRadius: '3px', border: '1px solid rgba(200,150,12,.4)', background: 'rgba(200,150,12,.12)', color: '#C8960C' }}>{el.content}</span>
          </div>
        );
        if (el.type === 'title') return (
          <div key={el.id} style={{ ...style, display: 'flex', alignItems: 'center', fontSize: 'clamp(18px,3vw,32px)', fontWeight: 700, color: '#fff', lineHeight: 1.2, overflow: 'hidden' }}>{el.content}</div>
        );
        if (el.type === 'paragraph') return (
          <div key={el.id} style={{ ...style, fontSize: 'clamp(11px,1.5vw,15px)', color: 'rgba(255,255,255,.82)', lineHeight: 1.75, overflow: 'hidden' }}>{el.content}</div>
        );
        if (el.type === 'quote') return (
          <div key={el.id} style={{ ...style, borderLeft: '3px solid #C8960C', paddingLeft: '12px', display: 'flex', alignItems: 'center', fontSize: 'clamp(11px,1.4vw,14px)', color: 'rgba(255,255,255,.88)', fontStyle: 'italic', lineHeight: 1.6, overflow: 'hidden' }}>{el.content}</div>
        );
        if (el.type === 'image' && el.src) return (
          <img key={el.id} src={el.src} alt={el.content || ''} style={{ ...style, objectFit: 'cover', borderRadius: '4px' }} />
        );
        if (el.type === 'document' && el.src) {
          const embedSrc = el.documentKind === 'office'
            ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(el.src)}`
            : el.src;
          return <iframe key={el.id} src={embedSrc} style={{ ...style, border: 'none', borderRadius: '4px' }} title={el.content || 'document'} />;
        }
        return null;
      })}
    </div>
  );
}
