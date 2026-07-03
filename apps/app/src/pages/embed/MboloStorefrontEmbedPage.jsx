/**
 * ═══════════════════════════════════════════════════════════════
 * mbolo — Boutique EMBED (iframe publique)
 * Chargée sur N'IMPORTE QUEL site client via le SDK Cimolace :
 *   Cimolace.mount(el, { engine: 'mbolo', tenant: '<slug>' })
 *
 * URL : /embed/boutique?tenant=SLUG[&category=ID][&theme=dark|light]
 * Lecture SEULE du catalogue public (GET /v1/mbolo/embed/:slug/catalog) —
 * AUCUNE clé API dans le navigateur. Le clic « Voir » ouvre la fiche produit
 * sur la boutique hébergée (nouvel onglet), où panier/checkout sont gérés.
 * ═══════════════════════════════════════════════════════════════
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiBaseUrl } from '@/lib/apiBase';

/** postMessage sûr : cible l'origine RÉELLE de la page hôte (jamais '*'). */
function getParentOrigin() {
  try {
    if (document.referrer) return new URL(document.referrer).origin;
  } catch { /* referrer illisible */ }
  return window.location.origin;
}

function money(cents, currency) {
  if (cents == null) return '';
  const v = Number(cents) / 100;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'XAF', maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${v.toLocaleString('fr-FR')} ${currency || ''}`.trim();
  }
}

function primaryImage(p) {
  const imgs = Array.isArray(p?.images) ? p.images : [];
  const primary = imgs.find((i) => i?.is_primary) || imgs[0];
  return primary?.url || null;
}

export default function MboloStorefrontEmbedPage() {
  const [params] = useSearchParams();
  const tenant = (params.get('tenant') || '').trim().toLowerCase();
  const category = params.get('category') || '';
  const dark = (params.get('theme') || 'dark') !== 'light';

  const [phase, setPhase] = useState('loading'); // loading | ready | error | empty
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const t = useMemo(() => {
    const bg = dark ? '#0f1419' : '#ffffff';
    const surface = dark ? '#161d25' : '#f6f7f9';
    const ink = dark ? '#f4efe6' : '#141414';
    const muted = dark ? '#aeb6bf' : '#6b7280';
    const border = dark ? 'rgba(244,239,230,.10)' : 'rgba(0,0,0,.08)';
    const accent = data?.tenant?.colors?.primary || '#d8b468';
    return { bg, surface, ink, muted, border, accent };
  }, [dark, data]);

  useEffect(() => {
    let cancelled = false;
    if (!tenant) { setErr('Paramètre « tenant » manquant.'); setPhase('error'); return; }
    (async () => {
      try {
        const base = getApiBaseUrl();
        const url = `${base}/v1/mbolo/embed/${encodeURIComponent(tenant)}/catalog${category ? `?category=${encodeURIComponent(category)}` : ''}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.message || body?.message || `Erreur ${res.status}`);
        // L'intercepteur API enveloppe dans { data: ... } — déballer si présent.
        const payload = body && typeof body === 'object' && 'data' in body ? body.data : body;
        if (cancelled) return;
        const products = Array.isArray(payload?.products) ? payload.products : [];
        setData(payload);
        setPhase(products.length ? 'ready' : 'empty');
        try {
          window.parent?.postMessage(
            { source: 'cimolace', type: 'ready', engine: 'mbolo', count: products.length },
            getParentOrigin(),
          );
        } catch { /* pas de parent */ }
      } catch (e) {
        if (cancelled) return;
        setErr(e?.message || 'Catalogue indisponible.');
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, category]);

  // Remonte la hauteur au parent pour un iframe auto-dimensionné.
  useEffect(() => {
    if (phase === 'loading') return;
    const notify = () => {
      try {
        window.parent?.postMessage(
          { source: 'cimolace', type: 'resize', height: document.documentElement.scrollHeight },
          getParentOrigin(),
        );
      } catch { /* ignore */ }
    };
    notify();
    const ro = 'ResizeObserver' in window ? new ResizeObserver(notify) : null;
    if (ro) ro.observe(document.documentElement);
    return () => ro?.disconnect();
  }, [phase, data]);

  const hostedProductUrl = (p) => {
    const base = window.location.origin;
    return `${base}/boutique?tenant=${encodeURIComponent(tenant)}#${encodeURIComponent(p.slug || p.id)}`;
  };

  const wrap = {
    minHeight: '100%', background: t.bg, color: t.ink,
    fontFamily: "'Inter', system-ui, sans-serif", padding: '18px', boxSizing: 'border-box',
  };

  if (phase === 'loading') {
    return <div style={{ ...wrap, display: 'grid', placeItems: 'center', minHeight: '220px' }}>
      <div style={{ color: t.muted, fontSize: 14 }}>Chargement de la boutique…</div>
    </div>;
  }
  if (phase === 'error') {
    return <div style={{ ...wrap, display: 'grid', placeItems: 'center', minHeight: '160px', textAlign: 'center' }}>
      <div>
        <div style={{ color: '#e88', fontSize: 14, fontWeight: 600 }}>Boutique indisponible</div>
        <div style={{ color: t.muted, fontSize: 12.5, marginTop: 6 }}>{err}</div>
      </div>
    </div>;
  }

  const products = data?.products || [];
  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {data?.tenant?.logo_url
          ? <img src={data.tenant.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover' }} />
          : <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: t.accent, color: '#20160f', fontWeight: 700 }}>
              {(data?.tenant?.name || 'B').slice(0, 1).toUpperCase()}
            </span>}
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{data?.tenant?.name || 'Boutique'}</div>
          <div style={{ fontSize: 12, color: t.muted }}>{products.length} produit{products.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      {phase === 'empty' ? (
        <div style={{ color: t.muted, fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
          Aucun produit pour le moment.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {products.map((p) => {
            const img = primaryImage(p);
            return (
              <a
                key={p.id}
                href={hostedProductUrl(p)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', flexDirection: 'column', textDecoration: 'none', color: t.ink,
                  background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden',
                }}
              >
                <div style={{ aspectRatio: '1 / 1', background: dark ? '#0f1419' : '#eceef1', display: 'grid', placeItems: 'center' }}>
                  {img
                    ? <img src={img} alt={p.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: t.muted, fontSize: 12 }}>—</span>}
                </div>
                <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>{p.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>{money(p.price_cents, p.currency)}</div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 18, textAlign: 'center', fontSize: 11, color: t.muted }}>
        Propulsé par <span style={{ color: t.accent }}>Cimolace</span>
      </div>
    </div>
  );
}
