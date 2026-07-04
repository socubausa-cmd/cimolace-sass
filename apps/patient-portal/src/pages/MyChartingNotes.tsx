import { useState, useEffect, useCallback } from 'react';
import {
  Brain, ChevronDown, ChevronUp, CheckCircle2, Clock,
  Tag, AlertCircle, FileText, RefreshCw,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Icd10Code {
  code: string;
  description: string;
  is_primary?: boolean;
}

interface ConsultNote {
  id: string;
  subjective:  string | null;
  objective:   string | null;
  assessment:  string | null;
  plan:        string | null;
  free_text:   string | null;
  ai_summary:  string | null;
  icd10_codes: Icd10Code[] | null;
  is_signed:   boolean;
  signed_at:   string | null;
  created_at:  string;
  patient_read_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders() {
  return {
    Authorization: 'Bearer ' + (localStorage.getItem('supabase_token') || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
    'Content-Type': 'application/json',
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SoapSection({ label, content, color }: { label: string; content: string | null; color: string }) {
  if (!content) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 12,
        background: color, color: '#fff', fontSize: 11, fontWeight: 700,
        letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase',
      }}>{label}</span>
      <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{content}</p>
    </div>
  );
}

function Icd10Badge({ code, description, isPrimary }: { code: string; description: string; isPrimary?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 8, fontSize: 12,
      background: isPrimary ? '#eff6ff' : '#fafaf8',
      border: `1px solid ${isPrimary ? '#93c5fd' : '#ece7e1'}`,
      color: isPrimary ? '#1d4ed8' : '#475569', marginRight: 6, marginBottom: 4,
    }}>
      <Tag size={11} />
      <strong>{code}</strong> — {description}
      {isPrimary && <span style={{ fontSize: 10, background: '#dbeafe', borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>principal</span>}
    </span>
  );
}

function NoteCard({ note, onRead }: { note: ConsultNote; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(!note.patient_read_at);
  const isUnread = !note.patient_read_at;
  const hasSoap = note.subjective || note.objective || note.assessment || note.plan;
  const icd10 = Array.isArray(note.icd10_codes) ? note.icd10_codes : [];

  const handleExpand = () => {
    if (!expanded && isUnread) onRead(note.id);
    setExpanded(v => !v);
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 14, marginBottom: 14,
      border: `2px solid ${isUnread ? 'var(--brand-primary)' : '#ece7e1'}`,
      boxShadow: isUnread ? '0 4px 20px rgba(13,148,136,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
      overflow: 'hidden', transition: 'box-shadow 0.2s',
    }}>
      {/* Header */}
      <button
        onClick={handleExpand}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 20px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Status icon */}
        {note.is_signed
          ? <CheckCircle2 size={20} color="var(--brand-accent)" style={{ flexShrink: 0 }} />
          : <Clock size={20} color="#f59e0b" style={{ flexShrink: 0 }} />}

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#1e1e1e' }}>
            Consultation du {formatDate(note.created_at)}
          </div>
          <div style={{ fontSize: 12, color: '#8a8580', marginTop: 2 }}>
            {note.is_signed
              ? `Signée le ${new Date(note.signed_at!).toLocaleDateString('fr-FR')}`
              : 'En attente de signature'}
            {note.ai_summary && <span style={{ marginLeft: 8, color: 'var(--brand-primary)' }}>· Note IA disponible</span>}
          </div>
        </div>

        {/* Unread badge */}
        {isUnread && (
          <span style={{
            background: 'var(--brand-primary)', color: '#fff', fontSize: 11, fontWeight: 700,
            padding: '2px 8px', borderRadius: 10, marginRight: 8,
          }}>NOUVEAU</span>
        )}

        {expanded ? <ChevronUp size={18} color="#b0aaa2" /> : <ChevronDown size={18} color="#b0aaa2" />}
      </button>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f4f0ea' }}>

          {/* AI Summary */}
          {note.ai_summary && (
            <div style={{
              background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)',
              border: '1px solid #99f6e4', borderRadius: 10, padding: 14, margin: '14px 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Brain size={15} color="var(--brand-primary)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Résumé généré par IA
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#134e4a', lineHeight: 1.6 }}>{note.ai_summary}</p>
            </div>
          )}

          {/* SOAP sections */}
          {hasSoap && (
            <div style={{ marginTop: 14 }}>
              <SoapSection label="Subjectif"  content={note.subjective}  color="#6366f1" />
              <SoapSection label="Objectif"   content={note.objective}   color="#0891b2" />
              <SoapSection label="Évaluation" content={note.assessment}  color="#d97706" />
              <SoapSection label="Plan"       content={note.plan}        color="var(--brand-accent)" />
            </div>
          )}

          {/* Free text fallback */}
          {!hasSoap && note.free_text && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 }}>{note.free_text}</p>
            </div>
          )}

          {/* ICD-10 codes */}
          {icd10.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#8a8580', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Codes diagnostics (CIM-10)
              </p>
              <div>
                {icd10.map((c) => (
                  <Icd10Badge key={c.code} code={c.code} description={c.description} isPrimary={c.is_primary} />
                ))}
              </div>
            </div>
          )}

          {/* Read timestamp */}
          {note.patient_read_at && (
            <p style={{ fontSize: 11, color: '#b0aaa2', marginTop: 14, marginBottom: 0 }}>
              Consulté le {new Date(note.patient_read_at).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyChartingNotes() {
  const [notes, setNotes]     = useState<ConsultNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/med/me/notes`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setNotes(body.data ?? body ?? []);
    } catch (e: any) {
      setError("Impossible de charger vos notes. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const markRead = useCallback(async (noteId: string) => {
    try {
      await fetch(`${API}/med/me/notes/${noteId}/read`, {
        method: 'POST',
        headers: authHeaders(),
      });
      // Optimistic update
      setNotes(prev => prev.map(n =>
        n.id === noteId ? { ...n, patient_read_at: new Date().toISOString() } : n
      ));
    } catch { /* silently ignore */ }
  }, []);

  const unreadCount = notes.filter(n => !n.patient_read_at).length;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={24} color="var(--brand-primary)" />
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1e1e1e' }}>
              Notes de consultation
            </h2>
            {unreadCount > 0 && (
              <p style={{ fontSize: 13, color: 'var(--brand-primary)', margin: '2px 0 0', fontWeight: 500 }}>
                {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''} note{unreadCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={fetchNotes}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8,
            color: 'var(--brand-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex', gap: 10, padding: '12px 16px', marginBottom: 20,
        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
      }}>
        <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
          Ces notes sont des résumés partagés par votre praticien. Elles incluent une synthèse
          générée par intelligence artificielle et sont à titre informatif uniquement.
          Consultez votre médecin pour tout doute ou question médicale.
        </p>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#b0aaa2' }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Chargement de vos notes…</p>
        </div>
      )}

      {error && !loading && (
        <div style={{
          display: 'flex', gap: 10, padding: 16, background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: 10,
        }}>
          <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, color: '#991b1b', fontSize: 14 }}>{error}</p>
        </div>
      )}

      {!loading && !error && notes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <FileText size={40} color="#d8d2ca" style={{ marginBottom: 14 }} />
          <p style={{ color: '#8a8580', fontSize: 15, margin: 0 }}>
            Aucune note partagée par votre praticien pour le moment.
          </p>
          <p style={{ color: '#b0aaa2', fontSize: 13, marginTop: 6 }}>
            Les notes apparaîtront ici après vos consultations.
          </p>
        </div>
      )}

      {/* Note list */}
      {!loading && notes.map(note => (
        <NoteCard key={note.id} note={note} onRead={markRead} />
      ))}

      {/* CSS animation for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
