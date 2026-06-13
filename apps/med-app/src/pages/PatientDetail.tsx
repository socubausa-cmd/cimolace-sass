import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Activity, UserPlus, X, Copy, Check, Download, Trash2, Pencil } from 'lucide-react';
import { AttachmentsPanel } from '../components/AttachmentsPanel';
import { ClinicalListsPanel } from '../components/ClinicalListsPanel';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

export function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', date_of_birth: '', gender: '', blood_type: '', email: '', phone: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
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

  function openEdit() {
    setEditForm({
      first_name: patient?.first_name || '',
      last_name: patient?.last_name || '',
      date_of_birth: patient?.date_of_birth?.slice(0, 10) || '',
      gender: patient?.gender || '',
      blood_type: patient?.blood_type || '',
      email: patient?.email || '',
      phone: patient?.phone || '',
    });
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(API + '/med/patients/' + id, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: editForm.first_name.trim() || null,
          last_name: editForm.last_name.trim() || null,
          date_of_birth: editForm.date_of_birth || null,
          gender: editForm.gender || null,
          blood_type: editForm.blood_type || null,
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || `Erreur ${res.status}`);
      }
      const body = await res.json();
      setPatient(body.data || body);
      setEditOpen(false);
    } catch (err: any) {
      setEditError(err?.message || 'Échec');
    } finally {
      setSavingEdit(false);
    }
  }

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
      setInviteError(err?.message || 'Échec');
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

  async function handleExport() {
    if (!id) return;
    if (
      !confirm(
        "Générer un export RGPD complet du dossier patient ?\n\n" +
          "Sections incluses :\n" +
          "• Identité, consentements et journal d'audit\n" +
          "• Consultations, ordonnances, programmes, RDV, formulaires\n" +
          "• Pièces jointes (métadonnées)\n" +
          "• Données Bio Digital Twin : biomarqueurs, scores d'organes,\n" +
          "  roue de transformation, événements santé, alertes, hypothèses,\n" +
          "  runs et analyses IA (anonymisés côté prompt), métadonnées des\n" +
          "  bilans avec liens signés 24h pour les PDF/images.\n\n" +
          "L'export sera disponible dans 'Audit & RGPD' une fois prêt.",
      )
    )
      return;
    try {
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(API + '/med/gdpr/exports', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patient_id: id, format: 'json', scope: 'full' }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.message || `Erreur ${res.status}`);
        return;
      }
      alert('✓ Export demande. Disponible dans Audit & RGPD une fois prêt.');
    } catch (err: any) {
      alert(err?.message || 'Échec');
    }
  }

  async function handleAnonymize() {
    if (!id) return;
    const reason = prompt(
      "Anonymiser ce patient (droit a l'oubli) ?\n\nIndiquez la base legale (obligatoire) :",
    );
    if (!reason || !reason.trim()) return;
    try {
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(API + '/med/gdpr/anonymizations', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: id,
          legal_basis: reason.trim(),
          method: 'pseudonymization',
          scope: 'full',
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.message || `Erreur ${res.status}`);
        return;
      }
      alert('✓ Demande d\'anonymisation enregistree.');
    } catch (err: any) {
      alert(err?.message || 'Échec');
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link
              to={'/twin/' + id}
              title="Ouvrir le jumeau numérique (Bio Digital Twin)"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'linear-gradient(135deg, var(--brand-primary), #7c3aed)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
            >
              <Activity size={14} /> Jumeau numérique
            </Link>
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
                ✓ Compte actif
              </span>
            )}
            <button
              onClick={openEdit}
              title="Modifier le dossier"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              <Pencil size={14} /> Modifier
            </button>
            <button
              onClick={handleExport}
              title="Exporter le dossier (RGPD Art. 20)"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              <Download size={14} /> Export
            </button>
            <button
              onClick={handleAnonymize}
              title="Droit a l'oubli (RGPD Art. 17)"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              <Trash2 size={14} /> Anonymiser
            </button>
          </div>
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
              <Link to={'/notes/' + n.id} style={{ fontWeight: 500, color: 'var(--brand-primary)' }}>Note du {new Date(n.created_at).toLocaleDateString('fr')}</Link>
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

      {editOpen && (
        <div
          onClick={() => !savingEdit && setEditOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleEdit}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(560px, 92vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Modifier le dossier</h3>
              <button type="button" onClick={() => !savingEdit && setEditOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                <span style={editLabel}>Prenom</span>
                <input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} style={inputStyle} />
              </label>
              <label>
                <span style={editLabel}>Nom</span>
                <input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} style={inputStyle} />
              </label>
              <label>
                <span style={editLabel}>Date de naissance</span>
                <input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} style={inputStyle} />
              </label>
              <label>
                <span style={editLabel}>Genre</span>
                <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  <option value="female">Femme</option>
                  <option value="male">Homme</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label>
                <span style={editLabel}>Groupe sanguin</span>
                <select value={editForm.blood_type} onChange={(e) => setEditForm({ ...editForm, blood_type: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </label>
              <label>
                <span style={editLabel}>Téléphone</span>
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={inputStyle} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <span style={editLabel}>Email</span>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} style={inputStyle} />
              </label>
            </div>

            {editError && <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{editError}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" onClick={() => !savingEdit && setEditOpen(false)} disabled={savingEdit} style={{ padding: '10px 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: savingEdit ? 'not-allowed' : 'pointer' }}>
                Annuler
              </button>
              <button type="submit" disabled={savingEdit} style={{ padding: '10px 18px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: savingEdit ? 'not-allowed' : 'pointer', opacity: savingEdit ? 0.7 : 1 }}>
                {savingEdit ? 'Sauvegarde…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
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
                    {inviting ? 'Génération…' : 'Générer le lien'}
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
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: copied ? '#10b981' : 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
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

const editLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#475569',
  marginBottom: 4,
  fontWeight: 500,
};
