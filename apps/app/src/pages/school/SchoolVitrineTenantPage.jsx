import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { getApiBaseUrl } from '@/lib/apiBase';

/** Prix affichable depuis billing_plans (price_cents + currency + billing_cycle). */
function formatOfferPrice(offer) {
  const cents = Number(offer?.price_cents);
  if (!Number.isFinite(cents) || cents <= 0) return '';
  const amount = (cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const symbol = String(offer?.currency || 'EUR').toUpperCase() === 'EUR' ? '€' : ` ${String(offer?.currency || '').toUpperCase()}`;
  const cycle = String(offer?.billing_cycle || '').toLowerCase();
  const suffix = cycle === 'monthly' ? ' /mois' : cycle === 'yearly' || cycle === 'annual' ? ' /an' : '';
  return `${amount}${symbol}${suffix}`;
}

/**
 * Page vitrine publique générique d'une école-tenant.
 * Utilise useTenantBranding() — aucun import ISNA.
 * Route : /t/:tenantSlug/* (tenantSlug lu via useParams)
 */
export default function SchoolVitrineTenantPage() {
  const { tenantSlug } = useParams();
  const { branding, shellTheme } = useTenantBranding({ forceRefresh: true });
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    if (!tenantSlug) {
      setCoursesLoading(false);
      return;
    }
    const asList = (data) => (Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
    fetch(`${getApiBaseUrl()}/tenants/public/${encodeURIComponent(tenantSlug)}/courses`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setCourses(asList(data)))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoading(false));
    fetch(`${getApiBaseUrl()}/tenants/public/${encodeURIComponent(tenantSlug)}/offers`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setOffers(asList(data)))
      .catch(() => setOffers([]));
  }, [tenantSlug]);

  const primary = branding.primaryColor || '#0b1115';
  const secondary = branding.secondaryColor || '#162331';
  const accent = branding.accentColor || '#d97757';
  const slogan = branding.slogan || '';
  const vision = branding.vision || '';
  const siteDescription = branding.siteDescription || '';
  const contactEmail = branding.vitrineContactEmail || '';
  const fallbackName = tenantSlug
    ? tenantSlug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Mon École';
  const schoolName = branding.name && branding.name !== 'Mon École' ? branding.name : fallbackName;
  const schoolFullName = branding.fullName && branding.fullName !== 'Mon École' ? branding.fullName : schoolName;
  const logo = branding.logo || '';

  const rootStyle = {
    minHeight: '100vh',
    backgroundColor: primary,
    color: '#f9fafb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    ...shellTheme?.cssVars,
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 32px',
    backgroundColor: secondary,
    borderBottom: `2px solid ${accent}`,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  };

  const logoStyle = {
    height: '40px',
    width: 'auto',
    objectFit: 'contain',
  };

  const schoolNameStyle = {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '-0.01em',
  };

  const heroStyle = {
    padding: '80px 32px 64px',
    textAlign: 'center',
    background: `linear-gradient(135deg, ${secondary} 0%, ${primary} 60%)`,
    borderBottom: `1px solid rgba(255,255,255,0.08)`,
  };

  const heroTitleStyle = {
    fontSize: 'clamp(28px, 5vw, 52px)',
    fontWeight: '800',
    color: '#ffffff',
    margin: '0 0 16px',
    lineHeight: 1.1,
  };

  const heroSubStyle = {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.7)',
    margin: '0 0 36px',
    maxWidth: '560px',
    marginLeft: 'auto',
    marginRight: 'auto',
  };

  const ctaBtnStyle = {
    display: 'inline-block',
    padding: '14px 36px',
    backgroundColor: accent,
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    transition: 'opacity 0.15s',
  };

  const sectionStyle = {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '64px 32px',
  };

  const sectionTitleStyle = {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '32px',
    paddingBottom: '12px',
    borderBottom: `2px solid ${accent}`,
    display: 'inline-block',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  };

  const cardStyle = {
    backgroundColor: secondary,
    border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: '12px',
    padding: '24px',
  };

  const cardTitleStyle = {
    fontSize: '17px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '8px',
  };

  const cardDescStyle = {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
    marginBottom: '16px',
  };

  const cardLinkStyle = {
    display: 'inline-block',
    padding: '8px 20px',
    backgroundColor: accent,
    color: '#ffffff',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    textDecoration: 'none',
  };

  const placeholderCardStyle = {
    ...cardStyle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '120px',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '14px',
    fontStyle: 'italic',
    gridColumn: '1 / -1',
  };

  const footerStyle = {
    backgroundColor: secondary,
    borderTop: `1px solid rgba(255,255,255,0.08)`,
    padding: '32px',
    textAlign: 'center',
  };

  const footerTextStyle = {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
  };

  const footerLinkStyle = {
    color: accent,
    textDecoration: 'none',
    fontWeight: '600',
  };

  const signupPath = tenantSlug ? `/t/${tenantSlug}/signup` : '#';
  const loginPath  = tenantSlug ? `/t/${tenantSlug}/login`  : '#';
  // Checkout réel (PaiementPage) — gère lui-même l'utilisateur non connecté.
  const offerCheckoutPath = (planKey) =>
    tenantSlug ? `/t/${tenantSlug}/paiement?plan=${encodeURIComponent(planKey)}` : '#';

  return (
    <div style={rootStyle}>
      <Helmet>
        <title>{schoolFullName}</title>
        {(slogan || siteDescription) && <meta name="description" content={slogan || siteDescription} />}
        <meta property="og:title" content={schoolFullName} />
        {(slogan || siteDescription) && <meta property="og:description" content={slogan || siteDescription} />}
        {logo && <meta property="og:image" content={logo} />}
        <meta property="og:type" content="website" />
      </Helmet>
      {/* Header */}
      <header style={{ ...headerStyle, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {logo && (
            <img src={logo} alt={`Logo ${schoolName}`} style={logoStyle} />
          )}
          <span style={schoolNameStyle}>{schoolName}</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a
            href={loginPath}
            style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
          >
            Se connecter
          </a>
          <a
            href={signupPath}
            style={{ padding: '8px 20px', background: accent, color: '#fff', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
          >
            S'inscrire
          </a>
        </nav>
      </header>

      {/* Hero — slogan + description édités par le tenant (metadata.site) */}
      <section style={heroStyle}>
        <h1 style={heroTitleStyle}>{schoolFullName}</h1>
        {slogan && (
          <p style={{ fontSize: '20px', fontStyle: 'italic', color: accent, margin: '0 0 14px', fontWeight: 600 }}>
            « {slogan} »
          </p>
        )}
        <p style={heroSubStyle}>
          {siteDescription || "Découvrez nos formations et rejoignez notre communauté d'apprentissage."}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={signupPath} style={ctaBtnStyle}>
            Commencer maintenant
          </a>
          <a
            href={loginPath}
            style={{ ...ctaBtnStyle, background: 'transparent', border: `2px solid ${accent}`, color: '#fff' }}
          >
            J'ai déjà un compte
          </a>
        </div>
      </section>

      {/* Nos formations */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Nos formations</h2>

        {coursesLoading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>
            Chargement des formations…
          </div>
        ) : (
          <div style={gridStyle}>
            {courses.length === 0 ? (
              <div style={placeholderCardStyle}>
                <span>
                  Les formations arrivent bientôt —{' '}
                  <a href={signupPath} style={{ color: accent, fontStyle: 'normal', fontWeight: 600 }}>
                    inscrivez-vous
                  </a>{' '}
                  pour être prévenu.
                </span>
              </div>
            ) : (
              courses.map((course) => {
                const courseId = course.id || course.slug || Math.random();
                const courseTitle = course.title || course.name || 'Formation';
                const courseDesc = course.description || course.short_description || '';
                const courseLink = tenantSlug
                  ? `/t/${tenantSlug}/courses/${course.slug || course.id}`
                  : '#';
                return (
                  <div key={courseId} style={cardStyle}>
                    <div style={cardTitleStyle}>{courseTitle}</div>
                    {courseDesc && <p style={cardDescStyle}>{courseDesc}</p>}
                    <a href={courseLink} style={cardLinkStyle}>
                      Voir la formation
                    </a>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Nos offres — billing_plans actifs du tenant */}
      {offers.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Nos offres</h2>
          <div style={gridStyle}>
            {offers.map((offer) => {
              const price = formatOfferPrice(offer);
              return (
                <div key={offer.key} style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
                  <div style={cardTitleStyle}>{offer.label || offer.key}</div>
                  {price && (
                    <div style={{ fontSize: '24px', fontWeight: 800, color: accent, marginBottom: '10px' }}>
                      {price}
                    </div>
                  )}
                  {(offer.tagline || offer.description) && (
                    <p style={{ ...cardDescStyle, flex: 1 }}>{offer.tagline || offer.description}</p>
                  )}
                  <a href={offerCheckoutPath(offer.key)} style={cardLinkStyle}>
                    Choisir cette offre
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Notre vision — éditée par le tenant (metadata.site.vision) */}
      {vision && (
        <section style={{ ...sectionStyle, paddingTop: 0 }}>
          <h2 style={sectionTitleStyle}>Notre vision</h2>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: 'rgba(255,255,255,0.75)', maxWidth: '720px' }}>
            {vision}
          </p>
        </section>
      )}

      {/* Footer */}
      <footer style={footerStyle}>
        <p style={footerTextStyle}>
          {schoolName}
          {contactEmail && (
            <>
              {' · '}
              <a href={`mailto:${contactEmail}`} style={footerLinkStyle}>
                {contactEmail}
              </a>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
