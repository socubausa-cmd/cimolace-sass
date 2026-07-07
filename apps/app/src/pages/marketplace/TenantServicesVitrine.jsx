import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '@/lib/apiBase';

// ─────────────────────────────────────────────────────────────────────────────
// Vitrine SERVICES d'un tenant (page d'accueil marketplace praticien).
// Publique (sans login) : liste les services actifs du tenant
// (GET /tenants/public/:slug/offers) et enchaîne vers le paiement/gratuit
// (/t/:slug/paiement?plan=<clé>) — qui pose l'access_pass (Phase 1) et, pour un
// service « réservable », débloque la prise de RDV. Tenant-agnostique.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = '#b0673f'; // brun chaud neutre (repli si pas de couleur tenant)

function money(cents, currency) {
  const c = Number(cents || 0);
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'XAF' || cur === 'XOF') return `${Math.round(c / 100).toLocaleString('fr')} FCFA`;
  const v = c / 100;
  if (cur === 'EUR') return `${v.toLocaleString('fr', { minimumFractionDigits: 0 })} €`;
  if (cur === 'USD') return `$${v.toLocaleString('fr', { minimumFractionDigits: 0 })}`;
  return `${v.toLocaleString('fr')} ${cur}`;
}

const CAT_LABEL = {
  consultation: 'Consultation',
  mentorat: 'Coaching',
  masterclass: 'Masterclass',
  temple: 'Temple',
  cycle: 'Programme',
  custom: 'Service',
};

export default function TenantServicesVitrine() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const slug = String(tenantSlug || '').toLowerCase();
  const [brand, setBrand] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const base = getApiBaseUrl();
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${base}/tenants/by-slug/${encodeURIComponent(slug)}/branding`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${base}/tenants/public/${encodeURIComponent(slug)}/offers`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([b, o]) => {
        if (!alive) return;
        const brandData = b?.data ?? b ?? null;
        setBrand(brandData);
        const list = o?.data ?? o ?? [];
        // On n'affiche que de VRAIS services (pas les lignes de config internes :
        // config boutique __storefront__*, category storefront_config…).
        const services = (Array.isArray(list) ? list : []).filter(
          (s) => s && s.category !== 'storefront_config' && !String(s.key || '').startsWith('__'),
        );
        setOffers(services);
      })
      .catch((e) => alive && setError(e?.message || 'Chargement impossible'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  const name = brand?.name || slug;
  const logo = brand?.logo_url || null;

  // Services groupés : consultations/coaching (réservables) d'abord.
  const sorted = useMemo(() => {
    return [...offers].sort((a, b) => {
      const ba = a?.metadata?.bookable ? 0 : 1;
      const bb = b?.metadata?.bookable ? 0 : 1;
      if (ba !== bb) return ba - bb;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [offers]);

  function ctaFor(o) {
    const bookable = !!o?.metadata?.bookable;
    const isEvent = !!o?.metadata?.event;
    const am = o.access_model || (Number(o.price_cents || 0) > 0 ? 'paid' : 'free');
    if (am === 'community') return 'Rejoindre la communauté';
    if (isEvent) return am === 'free' ? 'Réserver ma place (gratuit)' : 'Réserver ma place';
    if (am === 'free') return bookable ? 'Réserver gratuitement' : 'Accéder gratuitement';
    return bookable ? 'Payer & réserver' : 'Choisir cette offre';
  }

  function go(o) {
    // Réutilise le tunnel de paiement existant (/t/:slug/paiement) : il détecte
    // access_model (paid → Stripe/PawaPay ; free/community → claim), pose l'accès,
    // puis — pour un service réservable OU un événement — enchaîne (/reserver).
    const params = new URLSearchParams({ plan: o.key });
    if (o?.metadata?.bookable || o?.metadata?.event) params.set('next', 'reserver');
    navigate(`/t/${encodeURIComponent(slug)}/paiement?${params.toString()}`);
  }

  const page = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #faf6f1 0%, #f3ece3 100%)',
    color: '#2a2320',
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: '0 0 64px',
  };
  const wrap = { maxWidth: 1040, margin: '0 auto', padding: '0 20px' };
  const card = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #eee',
    boxShadow: '0 6px 24px rgba(60,40,25,0.06)',
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  return (
    <div style={page}>
      {/* En-tête tenant */}
      <header style={{ borderBottom: '1px solid rgba(120,80,50,0.12)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(6px)', padding: '18px 0', marginBottom: 34 }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', gap: 12 }}>
          {logo ? (
            <img src={logo} alt={name} style={{ height: 40, width: 40, borderRadius: 10, objectFit: 'cover' }} />
          ) : (
            <div style={{ height: 40, width: 40, borderRadius: 10, background: ACCENT, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{name}</div>
            <div style={{ fontSize: 12.5, color: '#8a7a6c' }}>Prendre rendez-vous · Services</div>
          </div>
        </div>
      </header>

      <main style={wrap}>
        <div style={{ marginBottom: 26 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Nos consultations & accompagnements</h1>
          <p style={{ fontSize: 15, color: '#6f6055', margin: '8px 0 0', maxWidth: 620 }}>
            Choisissez une prestation. Après le paiement (ou l'accès gratuit), vous choisissez votre créneau et le praticien lance la consultation.
          </p>
        </div>

        {loading && <div style={{ color: '#8a7a6c', fontSize: 14 }}>Chargement des services…</div>}
        {error && <div style={{ background: '#fdecec', color: '#a11', padding: 12, borderRadius: 10 }}>{error}</div>}

        {!loading && !error && sorted.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: '#8a7a6c' }}>
            Aucun service publié pour le moment.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {sorted.map((o) => {
            const am = o.access_model || (Number(o.price_cents || 0) > 0 ? 'paid' : 'free');
            const isFree = am !== 'paid' || !(Number(o.price_cents || 0) > 0);
            const bookable = !!o?.metadata?.bookable;
            const isEvent = !!o?.metadata?.event;
            const eventDate = o?.metadata?.scheduled_at ? new Date(o.metadata.scheduled_at) : null;
            return (
              <div key={o.key} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: ACCENT, background: ACCENT + '16', padding: '3px 9px', borderRadius: 999 }}>
                    {CAT_LABEL[o.category] || 'Service'}
                  </span>
                  {bookable && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0d8a6a', background: '#0d8a6a15', padding: '3px 9px', borderRadius: 999 }}>
                      Sur RDV
                    </span>
                  )}
                  {isEvent && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b0673f', background: '#b0673f18', padding: '3px 9px', borderRadius: 999 }}>
                      En direct
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{o.label}</div>
                {isEvent && eventDate && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#b0673f', textTransform: 'capitalize' }}>
                    📅 {eventDate.toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long' })} · {eventDate.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                {o.tagline && <div style={{ fontSize: 13.5, color: '#6f6055', lineHeight: 1.5 }}>{o.tagline}</div>}
                {Array.isArray(o.features) && o.features.length > 0 && (
                  <ul style={{ margin: '2px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
                    {o.features.slice(0, 4).map((f, i) => (
                      <li key={i} style={{ fontSize: 12.5, color: '#5f5348', display: 'flex', gap: 7 }}>
                        <span style={{ color: ACCENT }}>•</span> {f}
                      </li>
                    ))}
                  </ul>
                )}
                <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#2a2320' }}>
                    {isFree ? (am === 'community' ? 'Communauté' : 'Gratuit') : money(o.price_cents, o.currency)}
                  </span>
                  {!isFree && o.category === 'mentorat' && o.billing_cycle === 'monthly' && (
                    <span style={{ fontSize: 13, color: '#8a7a6c' }}>/ mois</span>
                  )}
                </div>
                <button
                  onClick={() => go(o)}
                  style={{
                    marginTop: 6, width: '100%', padding: '12px 16px', borderRadius: 11, border: 'none',
                    background: ACCENT, color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(176,103,63,0.28)',
                  }}
                >
                  {ctaFor(o)}
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ marginTop: 34, fontSize: 12, color: '#a2938660', textAlign: 'center' }}>
          Paiement sécurisé · propulsé par LIRI
        </p>
      </main>
    </div>
  );
}
