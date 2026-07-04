import { useState, useEffect, useCallback, useRef } from 'react';
import { Paperclip, Upload, Trash2, Download, Eye, EyeOff, FileText, Image as ImageIcon, File as FileIcon } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type Attachment = {
  id: string;
  patient_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  category?: string;
  description?: string | null;
  storage_path: string;
  storage_bucket?: string;
  visible_to_patient?: boolean;
  taken_at?: string | null;
  created_at: string;
  uploaded_role?: string;
};

const CATEGORY_OPTIONS = [
  { value: 'lab_result', label: 'Resultat labo' },
  { value: 'imaging', label: 'Imagerie' },
  { value: 'prescription_pdf', label: 'Ordonnance PDF' },
  { value: 'consent_pdf', label: 'Consentement' },
  { value: 'identity_doc', label: 'Piece d\'identite' },
  { value: 'insurance', label: 'Assurance' },
  { value: 'meal_photo', label: 'Photo repas' },
  { value: 'self_exam', label: 'Auto-examen' },
  { value: 'other', label: 'Autre' },
];

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('supabase_token');
  return {
    Authorization: 'Bearer ' + (t || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return FileIcon;
}

/**
 * Generic attachments panel used by both the doctor (PatientDetail) and
 * the patient (MyRecords). Handles list + upload (signed URL flow) +
 * download + soft-delete. The doctor can also toggle visible_to_patient.
 */
export function AttachmentsPanel({
  patientId,
  canTogglePatientVisibility = false,
}: {
  patientId: string;
  canTogglePatientVisibility?: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API}/med/attachments/patient/${patientId}`, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.data || d || []);
    } catch {
      /* ignore */
    }
  }, [patientId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 500 MB)');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // 1. Get signed upload URL
      const urlRes = await fetch(`${API}/med/attachments/upload-url`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'medos' }),
      });
      if (!urlRes.ok) {
        const b = await urlRes.json().catch(() => ({}));
        throw new Error(b?.message || 'Echec upload-url');
      }
      const { upload_url, storage_path, bucket } = await urlRes.json();

      // 2. PUT file directly to Supabase Storage
      const putRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload echoue (${putRes.status})`);
      }

      // 3. Register metadata
      const regRes = await fetch(`${API}/med/attachments`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_type: 'patient',
          owner_id: patientId,
          patient_id: patientId,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type || 'application/octet-stream',
          storage_path,
          storage_bucket: bucket,
          category,
          description: description.trim() || undefined,
          visible_to_patient: !canTogglePatientVisibility, // patient self-uploads default visible
        }),
      });
      if (!regRes.ok) {
        const b = await regRes.json().catch(() => ({}));
        throw new Error(b?.message || 'Echec enregistrement');
      }

      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchItems();
    } catch (err: any) {
      setError(err?.message || 'Echec');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(att: Attachment) {
    try {
      const res = await fetch(`${API}/med/attachments/${att.id}/download-url`, { headers: authHeaders() });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.message || 'Echec download');
        return;
      }
      const { download_url } = await res.json();
      if (download_url) window.open(download_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.message || 'Echec');
    }
  }

  async function handleDelete(att: Attachment) {
    if (!confirm(`Supprimer ${att.file_name} ?`)) return;
    try {
      const res = await fetch(`${API}/med/attachments/${att.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) return;
      await fetchItems();
    } catch {
      /* ignore */
    }
  }

  async function toggleVisibility(att: Attachment) {
    try {
      const res = await fetch(`${API}/med/attachments/${att.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible_to_patient: !att.visible_to_patient }),
      });
      if (!res.ok) return;
      await fetchItems();
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Paperclip size={18} /> Pieces jointes
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={inputStyle}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: uploading ? '#94a3b8' : '#3b82f6', color: '#fff',
            borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: uploading ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Upload size={14} /> {uploading ? 'Upload…' : 'Importer'}
          <input
            ref={fileInputRef}
            type="file"
            disabled={uploading}
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {error && (
        <div style={{ padding: 8, background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20, background: '#f8fafc', borderRadius: 8 }}>
          Aucun document. Importez votre premier fichier ci-dessus.
        </p>
      ) : (
        <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
          {items.map((att) => {
            const Icon = iconFor(att.mime_type);
            return (
              <li
                key={att.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 4 }}
              >
                <Icon size={18} color="#475569" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.file_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {CATEGORY_OPTIONS.find((c) => c.value === att.category)?.label || att.category || 'Autre'} ·{' '}
                    {formatBytes(att.file_size_bytes)} ·{' '}
                    {new Date(att.created_at).toLocaleDateString('fr')}
                    {att.uploaded_role && ` · par ${att.uploaded_role}`}
                  </div>
                  {att.description && <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontStyle: 'italic' }}>{att.description}</div>}
                </div>
                {canTogglePatientVisibility && (
                  <button
                    onClick={() => toggleVisibility(att)}
                    title={att.visible_to_patient ? 'Masquer au patient' : 'Rendre visible au patient'}
                    style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, padding: 4, cursor: 'pointer', color: att.visible_to_patient ? 'var(--brand-accent)' : '#94a3b8' }}
                  >
                    {att.visible_to_patient ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
                <button
                  onClick={() => handleDownload(att)}
                  title="Telecharger"
                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, padding: 4, cursor: 'pointer', color: '#3b82f6' }}
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => handleDelete(att)}
                  title="Supprimer"
                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, padding: 4, cursor: 'pointer', color: '#dc2626' }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0',
  borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box',
};
