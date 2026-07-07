import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getApiBaseUrl } from '@/lib/apiBase';
import { supabase } from '@/lib/customSupabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Écran de RÉSERVATION (marketplace praticien) — /t/:slug/reserver?service=<clé>
// Après paiement (ou accès gratuit), le client choisit un créneau. Le serveur
// (/med/booking/*) résout/crée sa fiche patient, vérifie l'access_pass (paiement),
// résout le praticien, et crée le RDV — qui atterrit chez le praticien (med-app).
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = '#b0673f';

function money(cents, cur) {
  const c = Number(cents || 0) / 100;
  const u = String(cur || 'EUR').toUpperCase();
  if (u === 'XAF' || u === 'XOF') return `${Math.round(c).toLocaleString('fr')} FCFA`;
  return `${c.toLocaleString('fr', { minimumFractionDigits: 0 })} ${u === 'EUR' ? '€' : u === 'USD' ? '$' : u}`;
}
const TYPE_LABEL = {
  teleconsult: 'Téléconsultation (visio)',
  in_person: 'Au cabinet',
  phone: 'Par téléphone',
  home_visit: 'À domicile',
};

export default function TenantReservationPage() {
  const { tenantSlug } = useParams();
  const slug = String(tenantSlug || '').toLowerCase();
  const [searchParams] = useSearchParams();
  const serviceKey = searchParams.get('service') || '';

  const [token, setToken] = useState(undefined); // undefined=chargement, null=non connecté
  const [ctx, setCtx] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(null); // le RDV créé
  const [error, setError] = useState(null);

  const authFetch = useCallback(
    async (path, opts = {}) => {
      const base = getApiBaseUrl();
      const headers = { 'X-Tenant-Slug': slug, ...(opts.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (opts.body) headers['Content-Type'] = 'application/json';
      const res = await fetch(base + path, { ...opts, headers });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message || body?.message || `Erreur ${res.status}`);
      return body?.data ?? body;
    },
    [slug, token],
  );

  // 1. Résoudre la session (token).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data?.session?.access_token || null);
    });
  }, []);

  // 2. Contexte de réservation + créneaux.
  useEffect(() => {
    if (token === undefined) return;
    if (token === null) { setLoading(false); return; }
    if (!serviceKey) { setError('Service manquant.'); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    authFetch(`/med/booking/context?service_key=${encodeURIComponent(serviceKey)}`)
      .then((c) => {
        if (!alive) return;
        setCtx(c);
        if (c?.can_book && !c?.service?.is_event) {
          setLoadingSlots(true);
          const from = new Date().toISOString();
          const to = new Date(Date.now() + 14 * 86400_000).toISOString();
          return authFetch(
            `/med/booking/slots?service_key=${encodeURIComponent(serviceKey)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          )
            .then((s) => {
              if (!alive) return;
              const list = Array.isArray(s) ? s : s?.slots ?? [];
              setSlots(Array.isArray(list) ? list : []);
            })
            .finally(() => alive && setLoadingSlots(false));
        }
        return undefined;
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token, serviceKey, authFetch]);

  const byDay = useMemo(() => {
    const groups = {};
    for (const s of slots) {
      const d = new Date(s.start);
      const key = d.toISOString().slice(0, 10);
      (groups[key] = groups[key] || []).push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  async function pick(slot) {
    setBooking(true);
    setError(null);
    try {
      const rdv = await authFetch('/med/booking/appointment', {
        method: 'POST',
        body: JSON.stringify({ service_key: serviceKey, scheduled_at: slot.start }),
      });
      setBooked(rdv);
    } catch (e) {
      setError(e.message);
    } finally {
      setBooking(false);
    }
  }

  const page = { minHeight: '100vh', background: 'linear-gradient(180deg,#faf6f1,#f3ece3)', color: '#2a2320', fontFamily: "'Inter',system-ui,sans-serif", padding: '0 0 64px' };
  const wrap = { maxWidth: 720, margin: '0 auto', padding: '0 20px' };
  const card = { background: '#fff', borderRadius: 16, border: '1px solid #eee', boxShadow: '0 6px 24px rgba(60,40,25,0.06)', padding: 22 };

  // — États bloquants —
  const banner = (title, msg, cta) => (
    <div style={page}>
      <main style={{ ...wrap, paddingTop: 60 }}>
        <div style={{ ...card, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>{title}</h1>
          <p style={{ color: '#6f6055', margin: '0 0 16px' }}>{msg}</p>
          {cta}
        </div>
      </main>
    </div>
  );

  if (token === null) {
    return banner('Connexion requise', 'Connectez-vous pour réserver votre rendez-vous.',
      <a href={`/t/${slug}/login`} style={btn}>Se connecter</a>);
  }
  if (loading) return banner('Réservation', 'Chargement…', null);
  if (error && !ctx) return banner('Oups', error, <a href={`/t/${slug}/services`} style={btn}>Retour aux services</a>);
  if (ctx && ctx.is_paid && !ctx.has_access) {
    return banner('Paiement requis', 'Ce service est payant. Réglez-le pour débloquer la prise de rendez-vous.',
      <a href={`/t/${slug}/paiement?plan=${encodeURIComponent(serviceKey)}&next=reserver`} style={btn}>Payer & réserver</a>);
  }
  if (ctx && !ctx.practitioner_id) {
    return banner('Bientôt disponible', 'Aucun créneau n\'est ouvert pour ce service pour le moment. Réessayez plus tard.',
      <a href={`/t/${slug}/services`} style={btn}>Retour aux services</a>);
  }

  // — Événement / masterclass : accès payé → inscription confirmée (pas de créneau) —
  if (ctx?.service?.is_event) {
    const d = ctx.service.scheduled_at ? new Date(ctx.service.scheduled_at) : null;
    return banner(
      'Inscription confirmée ✓',
      `Votre place pour « ${ctx.service.label} » est réservée.` +
        (d ? ` Rendez-vous le ${d.toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}.` : '') +
        ' Le lien du direct vous sera envoyé par email.',
      <a href={`/t/${slug}/services`} style={btn}>Voir d'autres offres</a>,
    );
  }

  // — Succès —
  if (booked) {
    return banner(
      'Rendez-vous demandé ✓',
      'Votre demande est envoyée au praticien. Vous recevrez la confirmation par email ; la téléconsultation se lancera à l\'heure du rendez-vous.',
      <a href={`/t/${slug}/services`} style={btn}>Voir d\'autres services</a>,
    );
  }

  // — Choix du créneau —
  const svc = ctx?.service;
  return (
    <div style={page}>
      <header style={{ borderBottom: '1px solid rgba(120,80,50,0.12)', background: 'rgba(255,255,255,0.6)', padding: '16px 0', marginBottom: 26 }}>
        <div style={wrap}>
          <a href={`/t/${slug}/services`} style={{ fontSize: 13, color: '#8a7a6c', textDecoration: 'none' }}>← Services</a>
        </div>
      </header>
      <main style={wrap}>
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: ACCENT }}>Réserver</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 4px' }}>{svc?.label}</h1>
          <div style={{ fontSize: 14, color: '#6f6055' }}>
            {TYPE_LABEL[svc?.appointment_type] || 'Rendez-vous'} · {svc?.duration_minutes} min
            {ctx?.is_paid ? ` · ${money(svc?.price_cents, svc?.currency)} payé ✓` : ' · Gratuit'}
          </div>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 12px' }}>Choisissez un créneau</h2>
        {error && <div style={{ background: '#fdecec', color: '#a11', padding: 12, borderRadius: 10, marginBottom: 12 }}>{error}</div>}
        {loadingSlots && <div style={{ color: '#8a7a6c' }}>Recherche des créneaux disponibles…</div>}
        {!loadingSlots && byDay.length === 0 && (
          <div style={{ ...card, color: '#8a7a6c', textAlign: 'center' }}>
            Aucun créneau libre sur les 14 prochains jours. Le praticien n'a pas encore ouvert de disponibilités.
          </div>
        )}
        <div style={{ display: 'grid', gap: 16 }}>
          {byDay.map(([day, daySlots]) => (
            <div key={day} style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#5f5348', textTransform: 'capitalize', marginBottom: 10 }}>
                {new Date(day + 'T12:00:00').toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {daySlots.map((s) => (
                  <button
                    key={s.start}
                    onClick={() => pick(s)}
                    disabled={booking}
                    style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${ACCENT}`, background: '#fff', color: ACCENT, fontSize: 14, fontWeight: 700, cursor: booking ? 'default' : 'pointer', opacity: booking ? 0.5 : 1 }}
                  >
                    {new Date(s.start).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const btn = {
  display: 'inline-block', padding: '11px 20px', borderRadius: 11, background: ACCENT,
  color: '#fff', fontSize: 14.5, fontWeight: 700, textDecoration: 'none', cursor: 'pointer',
};
