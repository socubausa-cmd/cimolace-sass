/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BACK-OFFICE — Sites (+ tenants techniques)
 * ═══════════════════════════════════════════════════════════════
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { siteEngine } from '@/modules/cimolace/sites/siteEngine.js';
import { SitePlan, SiteStatus } from '@/modules/cimolace/sites/siteTypes.js';

const inputStyle = {
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '14px',
};

const CARD = {
  flex: '1',
  minWidth: '120px',
  padding: '14px 16px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

function statusBadgeStyle(status) {
  const active = status === SiteStatus.ACTIVE;
  return {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    backgroundColor: active ? '#dcfce7' : '#fef3c7',
    color: active ? '#166534' : '#92400e',
  };
}

export default function CimolaceAdminSites() {
  const [sites, setSites] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForms, setShowForms] = useState(false);

  const [siteForm, setSiteForm] = useState({
    tenant_id: '',
    name: '',
    plan: SitePlan.STARTER,
    subdomain: '',
    domain: '',
  });
  const [tenantForm, setTenantForm] = useState({ name: '', email: '', phone: '' });
  const [savingSite, setSavingSite] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [formError, setFormError] = useState(null);

  const refresh = useCallback(async () => {
    const [allSites, allTenants] = await Promise.all([siteEngine.getAllSites(), siteEngine.getAllTenants()]);
    setSites(allSites);
    setTenants(allTenants);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        console.error(e);
        setError(e.message || 'Chargement impossible');
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (tenants.length === 1 && !siteForm.tenant_id) {
      setSiteForm((f) => ({ ...f, tenant_id: tenants[0].id }));
    }
  }, [tenants, siteForm.tenant_id]);

  const filteredSites = useMemo(() => {
    if (filterStatus === 'all') return sites;
    return sites.filter((s) => s.status === filterStatus);
  }, [sites, filterStatus]);

  const stats = useMemo(() => {
    const active = sites.filter((s) => s.status === SiteStatus.ACTIVE).length;
    return { total: sites.length, active };
  }, [sites]);

  async function handleCreateSite(e) {
    e.preventDefault();
    setFormError(null);
    if (!siteForm.tenant_id) {
      setFormError('Choisis un tenant technique.');
      return;
    }
    setSavingSite(true);
    try {
      await siteEngine.createSite({
        tenant_id: siteForm.tenant_id,
        name: siteForm.name.trim(),
        plan: siteForm.plan,
        subdomain: siteForm.subdomain.trim() || null,
        domain: siteForm.domain.trim() || null,
        status: SiteStatus.PENDING,
      });
      setSiteForm((f) => ({
        ...f,
        name: '',
        subdomain: '',
        domain: '',
      }));
      await refresh();
    } catch (err) {
      setFormError(err.message || 'Création site impossible');
    } finally {
      setSavingSite(false);
    }
  }

  async function handleCreateTenant(e) {
    e.preventDefault();
    setFormError(null);
    setSavingTenant(true);
    try {
      const t = await siteEngine.createTenant({
        name: tenantForm.name.trim(),
        email: tenantForm.email.trim(),
        phone: tenantForm.phone.trim() || undefined,
      });
      setTenantForm({ name: '', email: '', phone: '' });
      await refresh();
      setSiteForm((f) => ({ ...f, tenant_id: t.id }));
    } catch (err) {
      setFormError(err.message || 'Création tenant impossible (email unique ?)');
    } finally {
      setSavingTenant(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <CimolaceSidebar />
        <div style={{ padding: '20px', flex: 1, maxWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Sites</h1>
            <button
              type="button"
              onClick={() => {
                setShowForms((v) => !v);
                setFormError(null);
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {showForms ? 'Fermer les formulaires' : '+ Tenant / Site'}
            </button>
          </div>

          {error ? (
            <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={CARD}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827' }}>{loading ? '…' : stats.total}</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Sites</div>
            </div>
            <div style={CARD}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827' }}>{loading ? '…' : stats.active}</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Actifs</div>
            </div>
            <div style={CARD}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#111827' }}>{loading ? '…' : tenants.length}</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Tenants techniques</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {['all', SiteStatus.ACTIVE, SiteStatus.PENDING, SiteStatus.DEPLOYING, SiteStatus.SUSPENDED].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: filterStatus === st ? '#1d4ed8' : 'white',
                  color: filterStatus === st ? 'white' : '#374151',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {st === 'all' ? 'Tous' : st}
              </button>
            ))}
          </div>

          {showForms ? (
            <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
              <form
                onSubmit={handleCreateTenant}
                style={{ backgroundColor: 'white', padding: '18px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
              >
                <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0', color: '#111827' }}>Nouveau tenant technique</h2>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px 0' }}>
                  Un site doit être rattaché à un tenant <code>cimolace_tenants</code> (hébergement). Les clients métier sont dans <code>cimolace_clients</code> puis liés par contrat.
                </p>
                {formError ? <p style={{ color: '#b91c1c', fontSize: '13px', marginBottom: '8px' }}>{formError}</p> : null}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                  <input required placeholder="Nom" value={tenantForm.name} onChange={(e) => setTenantForm((x) => ({ ...x, name: e.target.value }))} style={inputStyle} />
                  <input required type="email" placeholder="Email" value={tenantForm.email} onChange={(e) => setTenantForm((x) => ({ ...x, email: e.target.value }))} style={inputStyle} />
                  <input placeholder="Téléphone" value={tenantForm.phone} onChange={(e) => setTenantForm((x) => ({ ...x, phone: e.target.value }))} style={inputStyle} />
                </div>
                <button type="submit" disabled={savingTenant} style={{ padding: '8px 16px', backgroundColor: savingTenant ? '#93c5fd' : '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  {savingTenant ? '…' : 'Créer le tenant'}
                </button>
              </form>

              <form onSubmit={handleCreateSite} style={{ backgroundColor: 'white', padding: '18px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0', color: '#111827' }}>Nouveau site</h2>
                <div style={{ display: 'grid', gap: '10px', marginBottom: '10px' }}>
                  <select
                    required
                    value={siteForm.tenant_id}
                    onChange={(e) => setSiteForm((f) => ({ ...f, tenant_id: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">Tenant *</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                    ))}
                  </select>
                  <input required placeholder="Nom du site *" value={siteForm.name} onChange={(e) => setSiteForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <select value={siteForm.plan} onChange={(e) => setSiteForm((f) => ({ ...f, plan: e.target.value }))} style={inputStyle}>
                      <option value={SitePlan.STARTER}>starter</option>
                      <option value={SitePlan.PRO}>pro</option>
                      <option value={SitePlan.ELITE}>elite</option>
                    </select>
                    <input placeholder="Sous-domaine" value={siteForm.subdomain} onChange={(e) => setSiteForm((f) => ({ ...f, subdomain: e.target.value }))} style={inputStyle} />
                  </div>
                  <input placeholder="Domaine (optionnel)" value={siteForm.domain} onChange={(e) => setSiteForm((f) => ({ ...f, domain: e.target.value }))} style={inputStyle} />
                </div>
                <button type="submit" disabled={savingSite} style={{ padding: '8px 16px', backgroundColor: savingSite ? '#93c5fd' : '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  {savingSite ? '…' : 'Créer le site'}
                </button>
              </form>
            </div>
          ) : null}

          <div style={{ backgroundColor: 'white', padding: '18px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            {loading ? (
              <p style={{ color: '#6b7280' }}>Chargement…</p>
            ) : filteredSites.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>
                Aucun site{filterStatus !== 'all' ? ' pour ce filtre' : ''}. Crée un tenant puis un site, ou rattache les contrats côté client.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {filteredSites.map((site) => {
                  const ten = site.cimolace_tenants;
                  return (
                    <div
                      key={site.id}
                      style={{
                        padding: '14px 16px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#111827' }}>{site.name}</div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>{site.domain || site.subdomain || 'Pas de domaine'}</div>
                        {ten ? (
                          <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '6px' }}>
                            Tenant&nbsp;: {ten.name} · {ten.email}
                          </div>
                        ) : null}
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                          Plan {site.plan} · env {site.environment || '—'}
                        </div>
                      </div>
                      <div style={statusBadgeStyle(site.status)}>{site.status}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
