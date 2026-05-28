import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Activity, UserPlus, X, Copy, Check } from 'lucide-react';
import { AttachmentsPanel } from '../components/AttachmentsPanel';
import { ClinicalListsPanel } from '../components/ClinicalListsPanel';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ invited_email: '', invited_name: '', custom_message: '' });
  const [inviteResult, setInviteResult] = useState<{ accept_url: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('supabase_token');
    if (!token || !id) return;
    const headers = { Authorization: 'Bearer ' + token, 'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '' };
    fetch(API + '/med/patients/' + id, { headers }).then(r => r.json()).then(d => setPatient(d.data || d)).catch(() => {});
    fetch(API + '/med/patients/' + id + '/notes', { headers }).then(r => r.json()).then(d => setNotes(d.data || d || [])).catch(() => {});
  }, [id]);

  function openInvite() {
    setInviteForm({ invited_email: patient?.email || '', invited_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(), custom_message: '' });
    setInviteResult(null);
    setInviteError(null);
    setCopied(false);
    setInviteOpen(true);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!inviteForm.invited_email && !inviteForm.invited_name) {
      setInviteError('Email + nom requis');
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(API + '/med/invitations', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: id,
          invited_email: inviteForm.invited_email || undefined,
          invited_name: inviteForm.invited_name,
          custom_message: inviteForm.custom_message || undefined,
          sent_via: 'manual',
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      const body = await res.json();
      setInviteResult({ accept_url: body?.accept_url || body?.data?.accept_url || '' });
    } catch (err: any) {
      setInviteError(err?.message || 'Echec');
    } finally {
      setInviting(false);
    }
  }

  async function copyLink() {
    if (!inviteResult?.accept_url) return;
    try {
      await navigator.clipboard.writeText(inviteResult.accept_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (!patient) return <div style={{ padding: 24 }}>Chargement...</div>;

  return (
    <div>
      <Link to="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748b', marginBottom: 16, fontSize: 14 }}>
        <ArrowLeft size={14} /> Retour
      </Link>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{patient.first_name} {patient.last_name}</h2>
          {!patient.patient_user_id && (
            <button
              onClick={openInvite}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              <UserPlus size={14} /> Inviter au portail
            </button>
          )}
          {patient.patient_user_id && (
            <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#166534', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
              ✓ Compte patient actif
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Date de naissance</span><br />{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('fr') : '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Genre</span><br />{patient.gender || '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Groupe sanguin</span><br />{patient.blood_type || '-'}</div>
          <div><span style={{ color: '#64748b', fontSize: 12 }}>Statut</span><br />{patient.status || 'actif'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={18} /> Notes de consultation</h3>
          {notes.length === 0 && <p style={{ color: '#94a3b8', fontSize: 14 }}>Aucune note</p>}
          {notes.map((n: any) => (
            <div key={n.id} style={{ padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
              <Link to={'/notes/' + n.id} style={{ fontWeight: 500, color: '#3b82f6' }}>Note du {new Date(n.created_at).toLocaleDateString('fr')}</Link>
              <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 8, background: n.is_signed ? '#dcfce7' : '#fef3c7', color: n.is_signed ? '#166534' : '#92400e' }}>{n.is_signed ? 'Signée' : 'Brouillon'}</span>
            </div>
          ))}
          <Link to={'/patients/' + id + '/notes/new'} style={{ display: 'inline-block', marginTop: 12, padding: '8px 16px', background: '#10b981', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>+ Nouvelle note</Link>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={18} /> Suivi sante</h3>
          <Link to={'/health'} style={{ display: 'inline-block', padding: '8px 16px', background: '#8b5cf6', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>Voir le suivi</Link>
        </div>
      </div>
      {id && (
        <>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginTop: 16 }}>
            <ClinicalListsPanel patientId={id} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginTop: 16 }}>
            <AttachmentsPanel patientId={id} canTogglePatientVisibility />
          </div>
        </>
      )}

      {inviteOpen && (
        <div
          onClick={() => !inviting && setInviteOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleInvite}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(520px, 92vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Inviter le patient au portail</h3>
              <button type="button" onClick={() => !inviting && setInviteOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {!inviteResult ? (
              <>
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>Nom du patient *</span>
                  <input
                    required
                    value={inviteForm.invited_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, invited_name: e.target.value })}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>Email *</span>
                  <input
                    type="email"
                    required
                    value={inviteForm.invited_email}
                    onChange={(e) => setInviteForm({ ...inviteForm, invited_email: e.target.value })}
                    style={inputStyle}
                    placeholder="patient@exemple.com"
                  />
                </label>
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: 500 }}>Message personnalisé (optionnel)</span>
                  <textarea
                    rows={3}
                    value={inviteForm.custom_message}
                    onChange={(e) => setInviteForm({ ...inviteForm, custom_message: e.target.value })}
                    style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                    placeholder="Bonjour Marie, voici votre lien d'acces au portail patient..."
                  />
                </label>

                {inviteError && (
                  <div style={{ marginTop: 8, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                    {inviteError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                  <button
                    type="button"
                    onClick={() => !inviting && setInviteOpen(false)}
                    disabled={inviting}
                    style={{ padding: '10px 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: inviting ? 'not-allowed' : 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    style={{ padding: '10px 18px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.7 : 1 }}
                  >
                    {inviting ? 'Generation…' : 'Generer le lien'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>
                  ✓ Lien d'invitation genere. Copiez-le et envoyez-le au patient par votre canal habituel (email, SMS, WhatsApp).
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    readOnly
                    value={inviteResult.accept_url}
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: copied ? '#10b981' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                  Lien valable 7 jours. Le patient devra créer un compte avec l'email <strong>{inviteForm.invited_email}</strong> et son dossier sera automatiquement lié.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setInviteOpen(false)}
                    style={{ padding: '10px 18px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
  boxSizing: 'border-box',
};
