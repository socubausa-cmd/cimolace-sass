import { useState, useEffect, useCallback } from 'react';
import { Shield, Download, Trash2, Check, X, AlertTriangle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Consent = {
  id: string;
  patient_id: string;
  scope: string;
  granted: boolean;
  consent_version: string;
  recorded_at: string;
  revoked_at: string | null;
};

type ExportRow = {
  id: string;
  patient_id: string;
  format: string;
  scope: string;
  status: string;
  requested_at: string;
  download_url?: string | null;
};

const CONSENT_SCOPES: { key: string; label: string; description: string }[] = [
  { key: 'general_care', label: 'Soins generaux', description: 'J\'accepte que mon praticien me prodigue des soins.' },
  { key: 'data_processing', label: 'Traitement de mes donnees', description: 'J\'autorise le traitement de mes donnees medicales conformement au RGPD.' },
  { key: 'data_sharing_practitioners', label: 'Partage entre praticiens du cabinet', description: 'J\'autorise le partage de mes informations entre les praticiens de ce cabinet.' },
  { key: 'data_sharing_research', label: 'Recherche scientifique', description: 'J\'autorise l\'utilisation anonymisee de mes donnees pour la recherche.' },
  { key: 'ai_charting', label: 'Consultation assistee par IA', description: 'J\'accepte que la consultation soit enregistree et traitee par une IA pour aider mon praticien.' },
  { key: 'teleconsult_recording', label: 'Enregistrement teleconsultation', description: 'J\'accepte que les teleconsultations soient enregistrees.' },
  { key: 'marketing_communications', label: 'Communications marketing', description: 'J\'accepte de recevoir des informations et offres du cabinet.' },
  { key: 'third_party_integration', label: 'Integrations tierces', description: 'J\'autorise le partage de mes donnees avec des services tiers (assurance, laboratoire…).' },
];

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

export function MyPrivacy() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Resolve own patient_id from /med/patients (returns the user's record).
  useEffect(() => {
    fetch(API + '/med/patients', { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const list = d.data || d || [];
        const me = list[0];
        if (me?.id) setPatientId(me.id);
      })
      .catch(() => {});
  }, []);

  const fetchConsents = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await fetch(`${API}/med/gdpr/consents/patient/${patientId}`, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setConsents(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, [patientId]);

  const fetchExports = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await fetch(`${API}/med/gdpr/exports?patient_id=${patientId}`, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setExports(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, [patientId]);

  useEffect(() => {
    if (patientId) {
      fetchConsents();
      fetchExports();
    }
  }, [patientId, fetchConsents, fetchExports]);

  // Map scope -> latest active consent
  const consentByScope: Record<string, Consent | undefined> = {};
  for (const c of consents) {
    if (c.revoked_at) continue;
    const prev = consentByScope[c.scope];
    if (!prev || new Date(c.recorded_at) > new Date(prev.recorded_at)) {
      consentByScope[c.scope] = c;
    }
  }

  async function toggleConsent(scope: string, newValue: boolean) {
    if (!patientId || working) return;
    setWorking(scope);
    setError(null);
    setSuccess(null);
    try {
      const def = CONSENT_SCOPES.find((c) => c.key === scope)!;
      // If revoking: call revoke on the existing active consent
      const existing = consentByScope[scope];
      if (existing && !newValue) {
        const res = await fetch(`${API}/med/gdpr/consents/${existing.id}/revoke`, {
          method: 'POST',
          headers: authHeaders(),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.message || `Erreur ${res.status}`);
        }
      } else if (newValue) {
        // Grant a new consent record
        const res = await fetch(`${API}/med/gdpr/consents`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: patientId,
            scope,
            granted: true,
            consent_text: def.description,
            consent_version: '1.0',
            recorded_via: 'web',
          }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.message || `Erreur ${res.status}`);
        }
      }
      await fetchConsents();
      setSuccess(`Consentement « ${def.label} » mis a jour`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Echec');
    } finally {
      setWorking(null);
    }
  }

  async function handleExport() {
    if (!patientId) return;
    setWorking('export');
    setError(null);
    try {
      const res = await fetch(`${API}/med/gdpr/exports`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          format: 'json',
          scope: 'full',
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setSuccess('Export de vos donnees demande. Vous recevrez un lien de telechargement par email.');
      await fetchExports();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Echec');
    } finally {
      setWorking(null);
    }
  }

  async function handleAnonymization() {
    if (!patientId || !deleteReason.trim()) {
      setError('Indiquez le motif de votre demande');
      return;
    }
    setWorking('anonymize');
    setError(null);
    try {
      const res = await fetch(`${API}/med/gdpr/anonymizations`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          legal_basis: deleteReason.trim(),
          method: 'pseudonymization',
          scope: 'full',
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      setDeleteConfirmOpen(false);
      setDeleteReason('');
      setSuccess('Demande de suppression enregistree. Vous serez contacte sous 30 jours conformement au RGPD.');
      setTimeout(() => setSuccess(null), 8000);
    } catch (err: any) {
      setError(err?.message || 'Echec');
    } finally {
      setWorking(null);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Shield size={22} /> Confidentialite & RGPD
      </h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        Vos droits sur vos donnees personnelles, conformement au RGPD (UE 2016/679) et aux articles 38-49 de la loi Informatique et Libertes.
      </p>

      {success && (
        <div style={{ marginBottom: 16, padding: 12, background: '#d1fae5', color: '#065f46', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={16} /> {success}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 4 }}>Mes consentements</h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0, marginBottom: 16 }}>
          Activez ou retirez votre consentement pour chaque utilisation de vos donnees.
        </p>

        {CONSENT_SCOPES.map((scope) => {
          const isGranted = !!consentByScope[scope.key];
          const isWorking = working === scope.key;
          return (
            <div
              key={scope.key}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0', borderTop: '1px solid #f1f5f9' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>{scope.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{scope.description}</div>
              </div>
              <button
                onClick={() => toggleConsent(scope.key, !isGranted)}
                disabled={!patientId || isWorking}
                style={{
                  width: 48, height: 26, borderRadius: 13, position: 'relative',
                  background: isGranted ? 'var(--brand-accent)' : '#cbd5e1',
                  border: 'none', cursor: !patientId || isWorking ? 'not-allowed' : 'pointer',
                  flexShrink: 0, transition: 'background 0.2s',
                  opacity: isWorking ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    position: 'absolute', top: 3, left: isGranted ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
          );
        })}
      </section>

      <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 4 }}>
          Telecharger mes donnees <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>· Article 20 RGPD</span>
        </h3>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0, marginBottom: 12 }}>
          Vous pouvez exporter une copie complete de votre dossier au format JSON (consultations, ordonnances, formulaires, pieces jointes).
        </p>
        <ul style={{ fontSize: 12, color: '#475569', margin: '0 0 16px 0', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Identite et informations administratives</li>
          <li>Consultations, notes praticien et ordonnances</li>
          <li>Programmes de soin et rendez-vous</li>
          <li>Formulaires remplis et pieces jointes (metadonnees)</li>
          <li>Consentements et journal d'audit</li>
          <li>
            <strong>Donnees Bio Digital Twin</strong> : biomarqueurs, scores
            d'organes, historique de la roue de transformation, evenements
            sante, alertes, hypotheses cliniques, runs et analyses IA
            (anonymises cote prompt), metadonnees des bilans avec liens
            signes 24h pour le telechargement des PDF/images.
          </li>
        </ul>
        <button
          onClick={handleExport}
          disabled={!patientId || working === 'export'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: !patientId || working === 'export' ? 'wait' : 'pointer' }}
        >
          <Download size={16} /> {working === 'export' ? 'Demande en cours…' : 'Demander un export'}
        </button>

        {exports.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#475569', margin: 0, marginBottom: 8 }}>Mes exports recents</h4>
            {exports.slice(0, 5).map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, color: '#64748b', borderTop: '1px solid #f1f5f9' }}>
                <span>{new Date(e.requested_at).toLocaleString('fr')} · format {e.format} · {e.scope}</span>
                <span style={{ padding: '1px 8px', borderRadius: 8, background: e.status === 'ready' ? '#dcfce7' : '#fef3c7', color: e.status === 'ready' ? '#166534' : '#92400e', fontWeight: 600 }}>{e.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ background: '#fef2f2', borderRadius: 12, border: '1px solid #fecaca', padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 4, color: '#991b1b' }}>
          Droit a l'oubli <span style={{ fontSize: 11, fontWeight: 400 }}>· Article 17 RGPD</span>
        </h3>
        <p style={{ fontSize: 13, color: '#7f1d1d', margin: 0, marginBottom: 16 }}>
          Vous pouvez demander la suppression de vos donnees. Apres validation par votre praticien, vos identifiants personnels seront pseudonymises. Les donnees medicales sont conservees 20 ans par obligation legale.
        </p>
        <button
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={!patientId}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          <Trash2 size={16} /> Demander la suppression
        </button>
      </section>

      {deleteConfirmOpen && (
        <div
          onClick={() => !working && setDeleteConfirmOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(520px, 92vw)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#991b1b' }}>Demande de suppression</h3>
              <button onClick={() => !working && setDeleteConfirmOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>
              Cette demande sera examinee par votre praticien. La suppression est <strong>pseudonymisation</strong> : nom/email/telephone seront remplaces par un identifiant anonyme, et les donnees medicales conservees 20 ans (obligation legale).
            </p>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>
                Motif de votre demande *
              </span>
              <textarea
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Je souhaite fermer mon compte / changer de praticien / autre raison..."
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={!!working}
                style={{ padding: '10px 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: working ? 'not-allowed' : 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={handleAnonymization}
                disabled={!!working || !deleteReason.trim()}
                style={{ padding: '10px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: working || !deleteReason.trim() ? 'not-allowed' : 'pointer' }}
              >
                {working === 'anonymize' ? 'Envoi…' : 'Confirmer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
