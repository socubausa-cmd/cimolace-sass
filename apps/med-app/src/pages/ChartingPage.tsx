/**
 * ChartingPage — Interface de transcription et génération de notes SOAP par IA
 *
 * Flux :
 *   1. Sélectionner un patient
 *   2. Uploader un fichier audio (mp3, wav, webm, m4a) ou coller une transcription
 *   3. Lancer POST /med/charting/start → jobId
 *   4. Polling GET /med/charting/jobs/:jobId jusqu'à status = completed | failed
 *   5. Afficher la note SOAP générée avec actions (copier, insérer dans dossier)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Upload, FileText, RefreshCw, CheckCircle, XCircle, Loader2, Copy, ClipboardPlus } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4002';
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 120; // 5 minutes max

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'transcribing' | 'generating' | 'completed' | 'failed';

interface ChartingJob {
  jobId: string;
  status: JobStatus;
  transcript?: string;
  soapNote?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    raw?: string;
  };
  error?: string;
  createdAt?: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function ChartingPage() {
  const navigate = useNavigate();

  // Form state
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState('');
  const [mode, setMode]           = useState<'audio' | 'text'>('audio');

  // Job state
  const [jobId, setJobId]         = useState<string | null>(null);
  const [job, setJob]             = useState<ChartingJob | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // Charger la liste des patients
  useEffect(() => {
    const token = localStorage.getItem('med_token') ?? '';
    const slug  = localStorage.getItem('med_tenant') ?? '';
    fetch(`${API_BASE}/med/patients`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
    })
      .then(r => r.json())
      .then(d => setPatients(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setPatients([]));
  }, []);

  // Polling sur le job
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        clearInterval(pollRef.current!);
        setError('Délai dépassé — veuillez réessayer.');
        setLoading(false);
        return;
      }
      try {
        const token = localStorage.getItem('med_token') ?? '';
        const slug  = localStorage.getItem('med_tenant') ?? '';
        const res = await fetch(`${API_BASE}/med/charting/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
        });
        const data: ChartingJob = await res.json();
        setJob(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollRef.current!);
          setLoading(false);
          if (data.status === 'failed') setError(data.error ?? 'Erreur inconnue');
        }
      } catch (e) {
        // continue polling on transient errors
      }
    }, POLL_INTERVAL_MS);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  async function startCharting() {
    if (!patientId) { setError('Veuillez sélectionner un patient.'); return; }
    if (mode === 'audio' && !audioFile) { setError('Veuillez sélectionner un fichier audio.'); return; }
    if (mode === 'text'  && !manualText.trim()) { setError('Veuillez saisir une transcription.'); return; }

    setError(null);
    setLoading(true);
    setJob(null);
    setJobId(null);
    pollCount.current = 0;

    try {
      const token = localStorage.getItem('med_token') ?? '';
      const slug  = localStorage.getItem('med_tenant') ?? '';
      let body: FormData | string;
      let headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': slug,
      };

      if (mode === 'audio' && audioFile) {
        const fd = new FormData();
        fd.append('patientId', patientId);
        fd.append('audio', audioFile);
        body = fd;
      } else {
        body = JSON.stringify({ patientId, transcript: manualText });
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(`${API_BASE}/med/charting/start`, {
        method: 'POST',
        headers,
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? `Erreur ${res.status}`);
      }

      const { jobId: newJobId } = await res.json();
      setJobId(newJobId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue');
      setLoading(false);
    }
  }

  function copyNote() {
    if (!job?.soapNote) return;
    const text = [
      `[S] ${job.soapNote.subjective}`,
      `[O] ${job.soapNote.objective}`,
      `[A] ${job.soapNote.assessment}`,
      `[P] ${job.soapNote.plan}`,
    ].join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function insertIntoPatientFile() {
    if (!patientId || !job?.soapNote) return;
    navigate(`/patients/${patientId}/notes/new`, {
      state: { prefillSoap: job.soapNote },
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const statusColors: Record<JobStatus, string> = {
    pending:      'var(--zw-text-muted)',
    transcribing: '#f59e0b',
    generating:   '#3b82f6',
    completed:    '#22c55e',
    failed:       '#ef4444',
  };

  const statusLabels: Record<JobStatus, string> = {
    pending:      'En attente',
    transcribing: 'Transcription en cours…',
    generating:   'Génération de la note SOAP…',
    completed:    'Terminé',
    failed:       'Échec',
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--zw-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mic size={26} color="var(--brand-primary)" /> Consultation IA — Note SOAP
        </h1>
        <p style={{ color: 'var(--zw-text-muted)', marginTop: 6, fontSize: 14 }}>
          Transcription audio + génération automatique de note SOAP via Deepgram &amp; Claude
        </p>
      </div>

      {/* Form */}
      <div style={{ background: '#fff', border: '1px solid var(--zw-border)', borderRadius: 12, padding: 28, marginBottom: 24 }}>

        {/* Patient */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Patient</label>
          <select
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            style={selectStyle}
          >
            <option value="">— Sélectionner un patient —</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.last_name} {p.first_name}
              </option>
            ))}
          </select>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['audio', 'text'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: mode === m ? 'var(--brand-primary)' : 'var(--zw-bg-subtle)',
                color: mode === m ? '#fff' : 'var(--zw-text-soft)',
                border: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {m === 'audio' ? <><Upload size={14} /> Fichier audio</> : <><FileText size={14} /> Texte manuel</>}
            </button>
          ))}
        </div>

        {/* Input */}
        {mode === 'audio' ? (
          <div>
            <label style={labelStyle}>Fichier audio (mp3, wav, webm, m4a — max 50 Mo)</label>
            <div
              onClick={() => fileInput.current?.click()}
              style={{
                border: '2px dashed var(--zw-border-strong)', borderRadius: 10, padding: '28px 20px',
                textAlign: 'center', cursor: 'pointer', background: audioFile ? '#f0fdf4' : 'var(--zw-bg)',
                transition: 'border-color 0.2s',
              }}
            >
              {audioFile ? (
                <p style={{ color: '#16a34a', fontWeight: 600 }}>✓ {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} Mo)</p>
              ) : (
                <>
                  <Upload size={28} color="var(--zw-text-faint)" style={{ margin: '0 auto 8px' }} />
                  <p style={{ color: 'var(--zw-text-muted)', fontSize: 14 }}>Cliquer pour choisir un fichier audio</p>
                </>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg"
              style={{ display: 'none' }}
              onChange={e => setAudioFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div>
            <label style={labelStyle}>Transcription manuelle</label>
            <textarea
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder="Collez ou saisissez ici la transcription de la consultation…"
              rows={8}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 14,
                border: '1px solid var(--zw-border)', borderRadius: 8, resize: 'vertical',
                fontFamily: 'inherit', color: 'var(--zw-text)',
              }}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={startCharting}
          disabled={loading}
          style={{
            marginTop: 24, padding: '12px 28px', background: loading ? 'var(--zw-text-faint)' : 'var(--brand-primary)',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {loading ? <><Loader2 size={16} className="spin" /> Traitement en cours…</> : <><Mic size={16} /> Lancer l'analyse IA</>}
        </button>
      </div>

      {/* Job status */}
      {job && (
        <div style={{ background: '#fff', border: '1px solid var(--zw-border)', borderRadius: 12, padding: 28 }}>

          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            {job.status === 'completed'
              ? <CheckCircle size={20} color="#22c55e" />
              : job.status === 'failed'
              ? <XCircle size={20} color="#ef4444" />
              : <RefreshCw size={20} color={statusColors[job.status]} className="spin" />
            }
            <span style={{ fontWeight: 600, color: statusColors[job.status] }}>
              {statusLabels[job.status]}
            </span>
          </div>

          {/* Transcript */}
          {job.transcript && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={sectionTitle}>Transcription</h3>
              <p style={{ fontSize: 14, color: '#374151', background: 'var(--zw-bg)', padding: '12px 16px', borderRadius: 8, lineHeight: 1.7 }}>
                {job.transcript}
              </p>
            </div>
          )}

          {/* SOAP Note */}
          {job.soapNote && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={sectionTitle}>Note SOAP</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyNote} style={actionBtn('var(--zw-bg-subtle)', 'var(--zw-text-soft)')}>
                    <Copy size={14} /> {copied ? 'Copié !' : 'Copier'}
                  </button>
                  <button onClick={insertIntoPatientFile} style={actionBtn('var(--brand-primary-soft)', 'var(--brand-primary)')}>
                    <ClipboardPlus size={14} /> Insérer dans le dossier
                  </button>
                </div>
              </div>

              {(['subjective', 'objective', 'assessment', 'plan'] as const).map(section => (
                <div key={section} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      background: soapColors[section], color: '#fff',
                      borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
                    }}>
                      {soapLabels[section]}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--zw-text)', lineHeight: 1.7, paddingLeft: 8, borderLeft: `3px solid ${soapColors[section]}`, margin: 0 }}>
                    {job.soapNote![section] || <em style={{ color: 'var(--zw-text-faint)' }}>Non renseigné</em>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1.2s linear infinite; }
      `}</style>
    </div>
  );
}

// ─── Styles helpers ───────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid var(--zw-border)', borderRadius: 8, background: '#fff', color: 'var(--zw-text)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: 'var(--zw-text)', margin: '0 0 12px',
};

const soapColors: Record<string, string> = {
  subjective: 'var(--brand-primary)',
  objective:  '#0ea5e9',
  assessment: '#f59e0b',
  plan:       '#22c55e',
};

const soapLabels: Record<string, string> = {
  subjective: 'S — Subjectif',
  objective:  'O — Objectif',
  assessment: 'A — Analyse',
  plan:       'P — Plan',
};

function actionBtn(bg: string, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', background: bg, color, border: 'none',
    borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  };
}
