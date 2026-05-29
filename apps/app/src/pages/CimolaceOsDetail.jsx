import React, { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { OS_LIST } from '@/data/cimolaceOsData';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';
import '@/styles/cimolaceOs.css';

export default function CimolaceOsDetail() {
  const { osId } = useParams();
  const navigate = useNavigate();
  const os = OS_LIST.find(o => o.id === osId);

  useEffect(() => { window.scrollTo(0, 0); }, [osId]);

  if (!os) {
    return (
      <div style={{ padding: '120px 24px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h2>OS introuvable</h2>
        <Link to="/cimolace" style={{ color: '#5b3df5' }}>← Retour</Link>
      </div>
    );
  }

  const { pricingFocus: pf } = os;

  return (
    <div style={{ fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter", sans-serif', background: '#fff', color: '#0a0a0f', overflowX: 'hidden' }}>

      {/* HERO */}
      <section className="os-hero" style={{ '--c': os.colorHex }}>
        <Link className="os-hero-back" to="/cimolace">← Tous les OS CIMOLACE</Link>
        <div className="os-hero-eyebrow">
          <span className="os-hero-icon" style={{ background: os.colorHex }}>{os.icon}</span>
          <span>OS CIMOLACE · Vertical métier</span>
        </div>
        <h1 className="os-hero-title">
          <span className="accent" style={{ color: os.colorHex }}>{os.icon}</span> {os.name}
        </h1>
        <p className="os-hero-impact">{os.impactPhrase}</p>
        <div className="os-hero-cta">
          <Link className="btn btn-primary" to={`/cimolace/contact?intent=activate&os=${encodeURIComponent(os.id)}`} style={{ background: os.colorHex }}>
            <span>Activer {os.name}</span><span>→</span>
          </Link>
          <Link className="btn btn-ghost" to={`/cimolace/contact?intent=demo&os=${encodeURIComponent(os.id)}`}>Demander une démo</Link>
        </div>
      </section>

      {/* PERSONAS */}
      <section className="os-section alt" style={{ '--c': os.colorHex }}>
        <div className="container">
          <span className="section-eyebrow">Pour qui ?</span>
          <h2 className="section-title">Conçu pour vous, si vous êtes…</h2>
          <p className="section-lead">{os.audience}</p>
          <div className="personas-grid">
            {os.audiencePersonas.map((p, i) => (
              <div key={i} className="persona-card">
                <div className="persona-role">{p.role}</div>
                <div className="persona-desc">{p.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVRABLES */}
      <section className="os-section" style={{ '--c': os.colorHex }}>
        <div className="container">
          <span className="section-eyebrow">Ce que vous obtenez</span>
          <h2 className="section-title">Tout ce dont vous avez besoin. Rien de superflu.</h2>
          <p className="section-lead">{os.description}</p>
          <div className="deliv-grid">
            {os.deliverables.map((d, i) => (
              <div key={i} className="deliv-card">
                <div className="deliv-icon">{d.icon}</div>
                <div className="deliv-title">{d.title}</div>
                <div className="deliv-body">{d.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXPÉRIENCE */}
      <section className="os-section alt" style={{ '--c': os.colorHex }}>
        <div className="container">
          <span className="section-eyebrow">Comment ça marche</span>
          <h2 className="section-title">Votre workflow, simplifié.</h2>
          <div className="exp-grid">
            {os.experience.map((e, i) => (
              <div key={i} className="exp-card">
                <span className="exp-step" style={{ background: os.colorHex }}>{e.step}</span>
                <div className="exp-title">{e.title}</div>
                <div className="exp-body">{e.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MOTEURS */}
      <section className="os-section dark" style={{ '--c': os.colorHex }}>
        <div className="container">
          <span className="section-eyebrow">Sous le capot</span>
          <h2 className="section-title">{os.enginesDetail.length} moteurs spécialisés.</h2>
          <p className="section-lead">{os.name} combine {os.enginesDetail.length} moteurs spécialisés. Vous activez l'OS, ils s\'orchestrent automatiquement.</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 32 }}>
            {os.enginesDetail.map((e, i) => (
              <div key={i} style={{ padding: '18px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{e.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'right', maxWidth: 400 }}>{e.function}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="os-section" style={{ '--c': os.colorHex }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <span className="section-eyebrow">Tarifs {os.name}</span>
          <h2 className="section-title">Choisissez votre plan.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 32 }}>
            {['starter', 'pro', 'elite'].map(key => {
              const plan = pf[key];
              const isRec = pf.recommended === key;
              return (
                <div key={key} className={`price-card${isRec ? ' featured' : ''}`}>
                  <div className="price-name">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                  <div className="price-amount"><span className="currency">€</span>{plan.price.replace('€','')}<span className="per">/mois</span></div>
                  <div className="price-tagline" style={{ fontSize: 12 }}>{plan.limit}</div>
                  <Link className="price-cta" to={`/cimolace/contact?intent=activate&os=${encodeURIComponent(os.id)}&plan=${encodeURIComponent(key)}`} style={isRec ? { background: os.colorHex } : {}}>
                    {isRec ? `Activer ce plan →` : 'Choisir →'}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CROSS-SELL */}
      {os.crossSell?.length > 0 && (
        <section className="os-section alt" style={{ '--c': os.colorHex }}>
          <div className="container">
            <span className="section-eyebrow">Vous pourriez aussi aimer</span>
            <h2 className="section-title">Explorez d'autres OS.</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18, marginTop: 32 }}>
              {os.crossSell.map(cid => {
                const other = OS_LIST.find(o => o.id === cid);
                if (!other) return null;
                return (
                  <Link key={cid} className="os-card" style={{ '--c': other.colorHex }} to={`/cimolace/os/${other.id}`}>
                    <div className="os-icon">{other.icon}</div>
                    <div className="os-name">{other.name}</div>
                    <div className="os-tagline">{other.tagline}</div>
                    <div className="os-cta">Découvrir →</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section style={{ background: os.colorHex, color: 'white', padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 16 }}>
          Prêt à activer {os.name} ?
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)', maxWidth: 560, margin: '0 auto 28px' }}>
          Mise en route en 24h. Setup 500€. Plan {pf.recommended === 'pro' ? 'Pro' : pf.recommended === 'starter' ? 'Starter' : 'Elite'} recommandé.
        </p>
        <div className="os-hero-cta">
          <Link className="btn btn-primary" to={`/cimolace/contact?intent=activate&os=${encodeURIComponent(os.id)}`} style={{ background: 'white', color: os.colorHex }}>
            <span>Activer {os.name}</span><span>→</span>
          </Link>
          <Link className="btn btn-ghost" to={`/cimolace/contact?intent=demo&os=${encodeURIComponent(os.id)}`} style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>
            Demander une démo
          </Link>
        </div>
      </section>

      {/* FOOTER MINIMAL */}
      <footer style={{ background: '#0a0a0f', color: 'rgba(255,255,255,0.5)', padding: '30px 24px', textAlign: 'center', fontSize: 13 }}>
        <Link to="/cimolace" style={{ color: 'white', fontWeight: 700, textDecoration: 'none', marginRight: 20 }}>
          CIMOLACE<span style={{ color: os.colorHex }}>.</span>
        </Link>
        {cimolacePlatformConfig.copyrightLine} · <Link to="/cimolace" style={{ color: 'rgba(255,255,255,0.5)' }}>Tous les OS</Link>
      </footer>
    </div>
  );
}
