import { Link } from 'react-router-dom';
import { useBranding } from '../lib/branding';
import {
  Heart,
  Video,
  HeartPulse,
  FileText,
  CalendarCheck,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

/**
 * Vitrine publique auto-générée du tenant (Phase 2 — landing generator).
 *
 * Servie à la racine de {slug}.patient.cimolace.space pour les visiteurs non
 * authentifiés. 100% white-label : tout est piloté par le branding du tenant
 * (nom, logo, couleurs via les CSS vars). Le contenu est un défaut santé
 * générique tant que le tenant n'a pas personnalisé sa vitrine — chaque client
 * a donc une présence publique crédible dès la création de son espace.
 */
export function Landing() {
  const branding = useBranding();
  const site = branding.site;
  const year = '2026';

  // Contenu piloté par le tenant (metadata.site) avec repli sur des défauts
  // santé génériques — chaque tenant a une vitrine crédible sans rien saisir.
  const SERVICE_ICONS = [Video, HeartPulse, FileText];
  const defaultServices = [
    { title: 'Téléconsultation', desc: 'Consultez votre praticien à distance, en vidéo sécurisée, où que vous soyez.' },
    { title: 'Suivi personnalisé', desc: 'Programmes, mesures et objectifs de santé suivis ensemble, dans la durée.' },
    { title: 'Documents & ordonnances', desc: 'Ordonnances, comptes-rendus et pièces accessibles à tout moment, en sécurité.' },
  ];
  const services = (site?.services?.length ? site.services : defaultServices).map(
    (s, i) => ({ ...s, icon: SERVICE_ICONS[i % SERVICE_ICONS.length] }),
  );

  const heroTitle = site?.heroTitle ?? 'Votre santé,';
  const heroAccent = site?.heroAccent ?? 'accompagnée au quotidien';
  const heroSubtitle =
    site?.heroSubtitle ??
    `Prenez rendez-vous, échangez avec votre praticien et suivez votre santé — en toute simplicité et confidentialité, avec ${branding.name}.`;
  const ctaPrimary = site?.ctaPrimary ?? 'Prendre rendez-vous';

  const steps = [
    { icon: CalendarCheck, title: 'Créez votre espace', desc: 'En quelques secondes, votre espace patient personnel et confidentiel.' },
    { icon: MessageSquare, title: 'Prenez rendez-vous', desc: 'Réservez vos consultations et échangez avec votre praticien.' },
    { icon: ShieldCheck, title: 'Suivez votre santé', desc: 'Vos données protégées, votre suivi centralisé au même endroit.' },
  ];

  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '14px 24px', background: 'var(--brand-primary)', color: '#fff',
    borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none',
    border: 'none', cursor: 'pointer',
  };
  const btnGhost: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '14px 24px', background: 'transparent', color: 'var(--brand-primary)',
    borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none',
    border: '1.5px solid var(--brand-primary)', cursor: 'pointer',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#0f172a', fontFamily: 'inherit' }}>
      {/* Header */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 10, background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', maxWidth: 1120, margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} style={{ height: 36, objectFit: 'contain' }} />
          ) : (
            <Heart size={28} color="var(--brand-primary)" />
          )}
          <span style={{ fontWeight: 700, fontSize: 18 }}>{branding.name}</span>
        </div>
        <Link to="/connexion" style={{ ...btnGhost, padding: '9px 16px', fontSize: 14 }}>
          Espace patient
        </Link>
      </header>

      {/* Hero */}
      <section
        style={{
          background:
            'linear-gradient(180deg, var(--brand-primary-soft) 0%, rgba(255,255,255,0) 100%)',
          padding: '72px 24px 64px',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            {heroTitle}
            <br />
            <span style={{ color: 'var(--brand-primary)' }}>{heroAccent}</span>
          </h1>
          <p style={{ fontSize: 18, color: '#475569', maxWidth: 560, margin: '20px auto 0', lineHeight: 1.6 }}>
            {heroSubtitle}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <Link to="/connexion" style={btnPrimary}>
              {ctaPrimary} <ArrowRight size={18} />
            </Link>
            <Link to="/connexion" style={btnGhost}>
              Accéder à mon espace
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 24px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {services.map((s) => (
            <div
              key={s.title}
              style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div
                style={{
                  width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'var(--brand-primary-soft)', marginBottom: 16,
                }}
              >
                <s.icon size={24} color="var(--brand-primary)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{s.title}</h3>
              <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section style={{ background: '#f8fafc', padding: '56px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, textAlign: 'center', margin: '0 0 40px', letterSpacing: '-0.01em' }}>
            Comment ça marche
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {steps.map((st, i) => (
              <div key={st.title} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 56, height: 56, borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', background: 'var(--brand-primary)', color: '#fff', marginBottom: 16,
                  }}
                >
                  <st.icon size={26} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-accent)', marginBottom: 4 }}>
                  Étape {i + 1}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>{st.title}</h3>
                <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.6, margin: '0 auto', maxWidth: 280 }}>{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
          Prêt à commencer ?
        </h2>
        <p style={{ color: '#475569', fontSize: 17, margin: '0 0 28px' }}>
          Créez votre espace patient {branding.name} en quelques secondes.
        </p>
        <Link to="/connexion" style={btnPrimary}>
          Créer mon espace <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer — white-label : aucune mention Cimolace/MEDOS */}
      <footer style={{ borderTop: '1px solid #f1f5f9', padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} style={{ height: 22, objectFit: 'contain' }} />
          ) : (
            <Heart size={16} color="var(--brand-primary)" />
          )}
          <span style={{ fontWeight: 600, color: '#475569' }}>{branding.name}</span>
        </div>
        © {year} {branding.name}. Tous droits réservés.
      </footer>
    </div>
  );
}
