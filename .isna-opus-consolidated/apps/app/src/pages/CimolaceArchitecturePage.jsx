import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OS_LIST } from '@/data/cimolaceOsData';
import {
  CIMOLACE_ARCHITECTURE_ENGINES,
  CIMOLACE_ENGINE_OS_MAP,
  CIMOLACE_MANAGED_SERVICES,
  CIMOLACE_SECURITY_PILLARS,
  CIMOLACE_SCALE_PILLARS,
  engineColumnTitle,
} from '@/data/cimolaceArchitectureData';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';
import CimolacePremiumShell from '@/components/cimolace/CimolacePremiumShell';
import '@/styles/cimolaceOs.css';

export default function CimolaceArchitecturePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible');
      }),
      { threshold: 0.08 }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <CimolacePremiumShell>
      <div style={{ paddingTop: 80 }}>
        <section className="arch-hero">
          <div className="arch-hero-eyebrow">
            <span style={{ color: '#00c2a8' }}>●</span>
            <span>/architecture · technical-spec.v1</span>
          </div>
          <h1 className="arch-hero-title">
            Sous le capot.<br /><span className="gradient">Là où ça pense.</span>
          </h1>
          <p className="arch-hero-lead">
            L&apos;architecture CIMOLACE en transparence totale. Pour les DSI, intégrateurs,
            architectes solutions et clients exigeants qui veulent comprendre avant d&apos;acheter.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to="/cimolace/login" style={{ background: 'white', color: 'var(--bg-deep)' }}>
              <span>Demander une démo technique</span><span>→</span>
            </Link>
            <Link
              className="btn btn-ghost"
              to="/cimolace/resources/documentation"
              style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              Documentation produit
            </Link>
          </div>
        </section>

        <div className="arch-toc">
          <div className="arch-toc-inner">
            <a href="#section-architecture">4.2 Architecture</a>
            <a href="#section-engines">4.3 Moteurs</a>
            <a href="#section-mapping">4.4 Mapping</a>
            <a href="#section-flow">4.5 Flux</a>
            <a href="#section-services">4.6 Services</a>
            <a href="#section-security">4.7 Sécurité</a>
            <a href="#section-scale">4.8 Scalabilité</a>
          </div>
        </div>

        <section className="arch-section reveal" id="section-architecture">
          <div className="container">
            <span className="arch-section-num">SECTION 4.2</span>
            <h2 className="section-title">Architecture globale.</h2>
            <p className="section-lead">
              CIMOLACE empile quatre couches : le client (votre marque), trois interfaces (frontend public,
              back-office métier, dashboard technique), six moteurs orchestrés, et l&apos;infrastructure cloud sous-jacente.
            </p>
            <div className="arch-diagram">
              <div className="arch-diagram-stack">
                <div className="arch-layer">
                  <div className="arch-layer-label">// CLIENT</div>
                  <div className="arch-box client">
                    <div className="arch-box-title">Votre marque</div>
                    <div className="arch-box-meta">domain.com · branding · UX · contenus</div>
                  </div>
                </div>
                <div className="arch-arrow">↕</div>
                <div className="arch-layer">
                  <div className="arch-layer-label">// INTERFACES UTILISATEURS</div>
                  <div className="arch-box-row cols-3">
                    <div className="arch-box layer">
                      <div className="arch-box-title">Frontend public</div>
                      <div className="arch-box-meta">Site visible aux visiteurs · pages OS · paiement</div>
                    </div>
                    <div className="arch-box layer">
                      <div className="arch-box-title">Back-office métier</div>
                      <div className="arch-box-meta">Espace admin du client · catalogue · CRM · ventes</div>
                    </div>
                    <div className="arch-box layer">
                      <div className="arch-box-title">Dashboard technique</div>
                      <div className="arch-box-meta">CIMOLACE · monitoring · pipelines · logs</div>
                    </div>
                  </div>
                </div>
                <div className="arch-arrow">↕</div>
                <div className="arch-layer">
                  <div className="arch-layer-label">// MOTEURS CIMOLACE</div>
                  <div className="arch-box engines">
                    <div className="arch-box-title">6 moteurs spécialisés assemblés à la demande</div>
                    <div className="arch-box-meta" style={{ opacity: 0.85, marginTop: 6 }}>
                      Live · School · Commerce · Marketing · Studio · Admin
                    </div>
                  </div>
                </div>
                <div className="arch-arrow">↕</div>
                <div className="arch-layer">
                  <div className="arch-layer-label">// INFRASTRUCTURE</div>
                  <div className="arch-box infra">
                    <div className="arch-box-title">Services cloud managés</div>
                    <div className="arch-box-meta" style={{ opacity: 0.7, marginTop: 6 }}>
                      Supabase · LiveKit · Netlify · OpenAI · Stripe · Resend · Cloudflare
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="arch-section reveal" id="section-engines" style={{ background: 'var(--bg-soft)' }}>
          <div className="container">
            <span className="arch-section-num">SECTION 4.3</span>
            <h2 className="section-title">Les six moteurs.</h2>
            <p className="section-lead">
              Chaque moteur est un domaine fonctionnel autonome. Ils communiquent par événements et partagent une couche
              d&apos;authentification commune. Aucun moteur n&apos;est obligatoire — vous activez ce dont vous avez besoin.
            </p>
            <div className="engines-grid">
              {CIMOLACE_ARCHITECTURE_ENGINES.map(e => (
                <div key={e.id} className="engine-card" style={{ '--c': e.color }}>
                  <div className="engine-icon">{e.icon}</div>
                  <div className="engine-card-name">{e.name}</div>
                  <div className="engine-card-fn">{e.function}</div>
                  <div className="engine-card-desc">{e.description}</div>
                  <div className="engine-card-tech">
                    {e.tech.map(t => (
                      <span key={t} className="tech-pill">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="arch-section reveal" id="section-mapping">
          <div className="container">
            <span className="arch-section-num">SECTION 4.4</span>
            <h2 className="section-title">Quel OS active quel moteur.</h2>
            <p className="section-lead">
              Chaque OS CIMOLACE est une combinaison déterministe de moteurs. La matrice ci-dessous montre l&apos;activation
              par défaut. Le plan Elite permet d&apos;activer des moteurs supplémentaires à la carte.
            </p>
            <div className="matrix-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th className="os">OS · Vertical</th>
                    {CIMOLACE_ARCHITECTURE_ENGINES.map(e => (
                      <th key={e.id}>
                        {e.icon} {engineColumnTitle(e)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OS_LIST.map(os => {
                    const row = CIMOLACE_ENGINE_OS_MAP[os.id];
                    return (
                      <tr key={os.id}>
                        <td className="os" style={{ '--mc': os.colorHex }}>
                          <span className="os-mini" />
                          {os.name}
                        </td>
                        {CIMOLACE_ARCHITECTURE_ENGINES.map(e => {
                          const has = row?.[e.id];
                          return (
                            <td key={e.id}>
                              {has ? (
                                <span className="matrix-yes" style={{ background: os.colorHex }}>●</span>
                              ) : (
                                <span className="matrix-no">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
              ● = moteur activé par défaut · · = non inclus, activable en Elite. Admin Engine est toujours présent
              (gestion utilisateurs, rôles, multi-tenancy).
            </p>
          </div>
        </section>

        <section className="arch-section dark reveal" id="section-flow">
          <div className="container">
            <span className="arch-section-num">SECTION 4.5</span>
            <h2 className="section-title">Le flux d&apos;une requête.</h2>
            <p className="section-lead">
              Une requête utilisateur traverse 5 étapes. Chacune est observable, traçable, et instrumentée pour le debugging.
            </p>
            <div className="flow-diagram">
              <div className="flow-row">
                <div className="flow-step">
                  <div className="flow-step-icon">👤</div>
                  <div className="flow-step-name">Utilisateur</div>
                  <div className="flow-step-meta">Web · Mobile · PWA</div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-step-icon">🌐</div>
                  <div className="flow-step-name">Site / App</div>
                  <div className="flow-step-meta">Netlify Edge</div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step highlight">
                  <div className="flow-step-icon">⚙️</div>
                  <div className="flow-step-name">Moteur</div>
                  <div className="flow-step-meta">Live · Studio · …</div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-step-icon">🗄️</div>
                  <div className="flow-step-name">Base de données</div>
                  <div className="flow-step-meta">Supabase / RLS</div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-step-icon">☁️</div>
                  <div className="flow-step-name">Services tiers</div>
                  <div className="flow-step-meta">Stripe · OpenAI · …</div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 24, fontFamily: 'SF Mono, Menlo, Monaco, monospace' }}>
              Auth JWT propagée à chaque étape · Row-Level Security côté DB · Tracing · Logs centralisés
            </p>
          </div>
        </section>

        <section className="arch-section reveal" id="section-services">
          <div className="container">
            <span className="arch-section-num">SECTION 4.6</span>
            <h2 className="section-title">Services managés sous-jacents.</h2>
            <p className="section-lead">
              CIMOLACE n&apos;héberge pas de base de données ni de WebRTC en propre. Nous orchestrons des services managés
              best-in-class — moins de risques opérationnels, plus de focus sur la valeur métier.
            </p>
            <div className="services-grid">
              {CIMOLACE_MANAGED_SERVICES.map(s => (
                <div key={s.name} className="service-card">
                  <div className="service-name">{s.name}</div>
                  <div className="service-role">{s.role}</div>
                  <div className="service-tech">{s.tech}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="arch-section dark reveal" id="section-security">
          <div className="container">
            <span className="arch-section-num">SECTION 4.7</span>
            <h2 className="section-title">Sécurité par défaut.</h2>
            <p className="section-lead">
              Trois piliers défensifs complémentaires : séparation des données, contrôle d&apos;accès, isolation au niveau base.
              Pas d&apos;option « sécurité avancée » payante — la sécurité fait partie du socle.
            </p>
            <div className="pillars-grid">
              {CIMOLACE_SECURITY_PILLARS.map(p => (
                <div key={p.num} className="pillar">
                  <div className="pillar-num">{p.num}</div>
                  <div className="pillar-title">{p.title}</div>
                  <div className="pillar-body">{p.body}</div>
                  <div className="pillar-tech">{p.tech}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="arch-section dark reveal"
          id="section-scale"
          style={{ background: 'linear-gradient(135deg, #1f1438 0%, #14141a 100%)' }}
        >
          <div className="container">
            <span className="arch-section-num">SECTION 4.8</span>
            <h2 className="section-title">Scalabilité native.</h2>
            <p className="section-lead">
              CIMOLACE n&apos;a pas été pensée comme un produit pour 1 client puis adapté pour 1 000. Multi-tenant et scaling
              sont natifs depuis la conception.
            </p>
            <div className="pillars-grid">
              {CIMOLACE_SCALE_PILLARS.map(p => (
                <div key={p.num} className="pillar">
                  <div className="pillar-num">{p.num}</div>
                  <div className="pillar-title">{p.title}</div>
                  <div className="pillar-body">{p.body}</div>
                  <div className="pillar-tech">{p.tech}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="arch-cta">
          <h2 className="arch-cta-title">Une question technique ?</h2>
          <p className="arch-cta-lead">
            Notre équipe répond aux audits de sécurité, intégrations API, déploiement sur votre infra et questions d&apos;architecture.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to="/cimolace/login"><span>Parler à un architecte</span><span>→</span></Link>
            <Link className="btn btn-ghost" to="/cimolace/contact">Contact commercial</Link>
          </div>
        </section>

      </div>
    </CimolacePremiumShell>
  );
}
