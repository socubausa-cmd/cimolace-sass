import { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, Eye } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type AuditEntry = {
  id: string;
  actor_id: string;
  resource: string;
  resource_id: string;
  action: string;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type Anonymization = {
  id: string;
  patient_id: string;
  status: string;
  legal_basis: string;
  requested_at: string;
  requested_by_role: string;
  method: string;
  scope: string;
};

const RESOURCES = ['patient', 'note', 'form', 'form_response', 'prescription', 'program', 'health_entry', 'charting_job', 'appointment'];
const ACTIONS = ['create', 'read', 'list', 'update', 'delete', 'sign', 'share'];

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

const actionColor: Record<string, string> = {
  create: '#10b981', read: '#0ea5e9', list: '#0ea5e9',
  update: '#f59e0b', delete: '#dc2626', sign: 'var(--zw-violet)', share: '#0d9488',
};

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [anonymizations, setAnonymizations] = useState<Anonymization[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterResource, setFilterResource] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [inspectEntry, setInspectEntry] = useState<AuditEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (filterResource) params.set('resource', filterResource);
      if (filterAction) params.set('action', filterAction);
      const res = await fetch(`${API}/med/gdpr/audit-log?${params}`, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setEntries(d.data || d || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [filterResource, filterAction]);

  const fetchAnonymizations = useCallback(async () => {
    try {
      const res = await fetch(`${API}/med/gdpr/anonymizations`, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setAnonymizations(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchAnonymizations();
  }, [fetchEntries, fetchAnonymizations]);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Shield size={22} /> Audit & RGPD
      </h2>
      <p style={{ color: 'var(--zw-text-muted)', fontSize: 14, marginBottom: 24 }}>
        Journal des actions effectuees sur les donnees medicales (acces, modifications, exports) et demandes patient.
      </p>

      {/* Pending anonymization requests — pop to the top */}
      {anonymizations.filter((a) => a.status === 'pending').length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#991b1b', margin: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            🚨 Demandes de suppression patient en attente
          </h3>
          {anonymizations.filter((a) => a.status === 'pending').map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #fecaca', fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600, color: '#7f1d1d' }}>Patient {(a.patient_id || '').slice(0, 8)}…</div>
                <div style={{ fontSize: 12, color: '#991b1b', marginTop: 2 }}>
                  {new Date(a.requested_at).toLocaleString('fr')} · {a.method} · {a.scope}
                </div>
                <div style={{ fontSize: 11, color: '#7f1d1d', fontStyle: 'italic', marginTop: 2 }}>« {a.legal_basis} »</div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>A TRAITER</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#fff', padding: 12, borderRadius: 10, border: '1px solid var(--zw-border)', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <select value={filterResource} onChange={(e) => setFilterResource(e.target.value)} style={filterStyle}>
          <option value="">Toutes ressources</option>
          {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={filterStyle}>
          <option value="">Toutes actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button
          onClick={fetchEntries}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: loading ? 'wait' : 'pointer' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Rafraichir
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--zw-text-muted)' }}>{entries.length} entrees</span>
      </div>

      {/* Audit log table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--zw-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--zw-bg)' }}>
              <th style={th}>Quand</th>
              <th style={th}>Acteur</th>
              <th style={th}>Action</th>
              <th style={th}>Ressource</th>
              <th style={th}>IP</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 30, color: 'var(--zw-text-faint)', textAlign: 'center' }}>
                  Aucune entree dans le journal d'audit avec ces filtres.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid var(--zw-bg-subtle)' }}>
                <td style={td}>
                  <div style={{ fontWeight: 500 }}>{new Date(e.created_at).toLocaleDateString('fr')}</div>
                  <div style={{ fontSize: 10, color: 'var(--zw-text-faint)' }}>{new Date(e.created_at).toLocaleTimeString('fr')}</div>
                </td>
                <td style={td}>
                  <code style={{ fontSize: 11, color: 'var(--zw-text-soft)' }}>{e.actor_id ? e.actor_id.slice(0, 8) + '…' : 'système'}</code>
                </td>
                <td style={td}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: (actionColor[e.action] || 'var(--zw-text-muted)') + '22', color: actionColor[e.action] || 'var(--zw-text-muted)', textTransform: 'uppercase' }}>
                    {e.action}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 500 }}>{e.resource}</div>
                  <code style={{ fontSize: 10, color: 'var(--zw-text-faint)' }}>{e.resource_id ? e.resource_id.slice(0, 8) + '…' : '—'}</code>
                </td>
                <td style={td}>
                  <code style={{ fontSize: 11, color: 'var(--zw-text-muted)' }}>{e.ip_address || '—'}</code>
                </td>
                <td style={td}>
                  <button
                    onClick={() => setInspectEntry(e)}
                    style={{ background: 'none', border: '1px solid var(--zw-border)', borderRadius: 4, padding: 4, cursor: 'pointer', color: 'var(--zw-text-soft)' }}
                    title="Inspecter"
                  >
                    <Eye size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inspectEntry && (
        <div
          onClick={() => setInspectEntry(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(640px, 92vw)', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 12 }}>Detail audit</h3>
            <pre style={{ background: 'var(--zw-text)', color: 'var(--zw-border)', padding: 12, borderRadius: 8, fontSize: 11, overflow: 'auto' }}>
              {JSON.stringify(inspectEntry, null, 2)}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setInspectEntry(null)}
                style={{ padding: '8px 16px', background: 'var(--zw-text)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite } @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

const filterStyle: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid var(--zw-border)', borderRadius: 6,
  fontSize: 13, background: '#fff', cursor: 'pointer',
};
const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--zw-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5,
};
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
