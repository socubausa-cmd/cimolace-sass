import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import '@/pages/LiriPortal.css'; // fournit les variables/classes lp-* (charte CRM warm-dark)
import CrmPipelineBoard from '@/components/liri/crm/CrmPipelineBoard';
import CrmAnalytics from '@/components/liri/crm/CrmAnalytics';
import CrmContacts from '@/components/liri/crm/CrmContacts';
import CrmCompanies from '@/components/liri/crm/CrmCompanies';
import CrmActivity from '@/components/liri/crm/CrmActivity';

/**
 * CRM de gestion des TENANTS-CLIENTS, DANS le back-office propriétaire Cimolace.
 * Réutilise le moteur CRM (mêmes composants que /liri/crm) mais SCOPÉ sur le tenant `cimolace`
 * via `?tenant=cimolace` (prioritaire dans authStore.getTenantSlug → header X-Tenant-Slug).
 * Le tenant Cimolace est peuplé automatiquement par le trigger tenants→CRM (chaque client =
 * société + contact owner + deal). Accès : owner du tenant cimolace (cimolace@ / socubausa@).
 */

const VIEWS = [
  { v: 'pipeline', label: 'Pipeline' },
  { v: 'dashboard', label: 'Tableau de bord' },
  { v: 'companies', label: 'Clients' },
  { v: 'contacts', label: 'Contacts' },
  { v: 'activity', label: 'Activité' },
];

export default function CimolaceAdminCrmPage() {
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState('pipeline');
  const scoped = sp.get('tenant') === 'cimolace';

  useEffect(() => {
    if (!scoped) {
      const p = new URLSearchParams(sp);
      p.set('tenant', 'cimolace');
      setSp(p, { replace: true });
    }
  }, [scoped]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CimolaceSidebar />
        <div className="lp-root" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h1 className="lp-ink" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>CRM — Gestion des clients</h1>
              <span className="lp-faint" style={{ fontSize: 12.5 }}>Vos tenants-clients : pipeline, sociétés, contacts.</span>
            </div>
            <div style={{ display: 'flex', gap: 2, marginTop: 14, borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
              {VIEWS.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setView(t.v)}
                  className={view === t.v ? 'lp-ink' : 'lp-muted'}
                  style={{
                    padding: '8px 14px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                    whiteSpace: 'nowrap', background: 'none', border: 'none',
                    borderBottom: view === t.v ? '2px solid var(--coral)' : '2px solid transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {scoped && (
            <div className="lp-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 20px' }}>
              {view === 'pipeline' && <CrmPipelineBoard />}
              {view === 'dashboard' && <CrmAnalytics />}
              {view === 'companies' && <CrmCompanies />}
              {view === 'contacts' && <CrmContacts />}
              {view === 'activity' && <CrmActivity />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
