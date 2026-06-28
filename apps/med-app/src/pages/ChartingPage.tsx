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
import { Mic, Upload, FileText, RefreshCw, CheckCircle, XCircle, Loader2, Copy, ClipboardPlus, Pill, Sparkles, AlertTriangle, Plus, Trash2, Square } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4002';
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 120; // 5 minutes max

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'transcribing' | 'generating' | 'completed' | 'failed';

interface ChartingJob {
  jobId: string;
  status: JobStatus;
  noteId?: string;
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

// ─── Suggestion d'ordonnance (copilote IA) ──────────────────────────────────

// Ligne éditable affichée au praticien. Les champs alignés sur l'API de
// création (drug_name…is_substitutable) sont postés tels quels ; confidence /
// reasoning servent UNIQUEMENT à la relecture et ne sont pas envoyés.
interface SuggestedItem {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: string | null;
  route?: string | null;
  notes?: string | null;
  is_substitutable?: boolean;
  confidence: number;
  reasoning: string;
}

interface PrescriptionSuggestion {
  items: SuggestedItem[];
  patient_instructions?: string | null;
  warnings?: string | null;
  model_used?: string;
  tokens_used?: number;
}

// Mappe la ligne brute du job backend (réponse wrappée { data: {...} }, champs
// snake_case soap_*) vers le modèle UI ChartingJob (camelCase, soapNote agrégé).
function mapJob(d: any): ChartingJob {
  const hasSoap = !!(d?.soap_subjective || d?.soap_objective || d?.soap_assessment || d?.soap_plan);
  return {
    jobId: d?.id,
    status: d?.status,
    noteId: d?.note_id ?? undefined,
    transcript: d?.raw_transcript ?? undefined,
    soapNote: hasSoap
      ? {
          subjective: d?.soap_subjective ?? '',
          objective: d?.soap_objective ?? '',
          assessment: d?.soap_assessment ?? '',
          plan: d?.soap_plan ?? '',
          raw: d?.soap_free_text ?? undefined,
        }
      : undefined,
    error: d?.error_message ?? undefined,
    createdAt: d?.created_at,
  };
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function ChartingPage() {
  const navigate = useNavigate();

  // Form state
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState('');
  const [mode, setMode]           = useState<'audio' | 'text' | 'live'>('audio');

  // ── Dictée en direct (beta) — streaming Deepgram via token éphémère ────────
  // Le navigateur ouvre LUI-MÊME le WebSocket Deepgram ; la clé serveur n'est
  // jamais exposée (le backend mint un token court via POST /med/charting/realtime-token).
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'listening' | 'stopping'>('idle');
  const [liveError, setLiveError]   = useState<string | null>(null);
  const [liveFinal, setLiveFinal]   = useState('');   // transcript final accumulé
  const [liveInterim, setLiveInterim] = useState(''); // segment en cours (gris/italique)

  const wsRef        = useRef<WebSocket | null>(null);
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const liveFinalRef = useRef('');           // miroir synchrone de liveFinal
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Job state
  const [jobId, setJobId]         = useState<string | null>(null);
  const [job, setJob]             = useState<ChartingJob | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  // Suggestion d'ordonnance (copilote IA)
  const [suggestion, setSuggestion]       = useState<PrescriptionSuggestion | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError]   = useState<string | null>(null);
  const [rxCreated, setRxCreated]         = useState<{ id: string } | null>(null);
  const [rxCreating, setRxCreating]       = useState(false);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // Charger la liste des patients
  useEffect(() => {
    const token = localStorage.getItem('supabase_token') ?? '';
    const slug  = localStorage.getItem('tenant_slug') ?? '';
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
        const token = localStorage.getItem('supabase_token') ?? '';
        const slug  = localStorage.getItem('tenant_slug') ?? '';
        const res = await fetch(`${API_BASE}/med/charting/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
        });
        const raw = await res.json();
        const job = mapJob(raw?.data ?? raw);
        setJob(job);
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(pollRef.current!);
          setLoading(false);
          if (job.status === 'failed') setError(job.error ?? 'Erreur inconnue');
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
    // Dictée en direct (beta) : l'analyse part du transcript accumulé (raw_transcript),
    // exactement comme le mode texte. Refuser si la dictée est encore en cours.
    if (mode === 'live') {
      if (liveStatus !== 'idle') { setError('Arrêtez d’abord la dictée en direct avant de lancer l’analyse.'); return; }
      if (!manualText.trim())    { setError('Aucune transcription — démarrez la dictée puis arrêtez-la, ou complétez le texte.'); return; }
    }

    setError(null);
    setLoading(true);
    setJob(null);
    setJobId(null);
    pollCount.current = 0;

    try {
      const token = localStorage.getItem('supabase_token') ?? '';
      const slug  = localStorage.getItem('tenant_slug') ?? '';
      let body: FormData | string;
      let headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Slug': slug,
      };

      // Transcription audio (Deepgram) non activée pour l'instant : le backend
      // génère la note SOAP à partir d'un TEXTE (Mistral/DeepSeek). On gate l'audio
      // proprement au lieu d'échouer en 400.
      if (mode === 'audio') {
        setError("Transcription audio bientôt disponible — utilisez « Texte manuel » pour coller ou dicter la consultation.");
        setLoading(false);
        return;
      }

      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ patient_id: patientId, raw_transcript: manualText });

      const res = await fetch(`${API_BASE}/med/charting/start`, {
        method: 'POST',
        headers,
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? err?.message ?? `Erreur ${res.status}`);
      }

      const raw = await res.json();
      const newJobId = raw?.data?.id ?? raw?.jobId;
      if (!newJobId) throw new Error('Réponse inattendue du serveur (jobId manquant).');
      setJobId(newJobId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue');
      setLoading(false);
    }
  }

  // ── Dictée en direct (beta) ────────────────────────────────────────────────

  // Récupère un token éphémère Deepgram auprès de notre API (la clé serveur
  // reste serveur). Lève une erreur lisible si indisponible.
  async function fetchRealtimeToken(): Promise<string> {
    const token = localStorage.getItem('supabase_token') ?? '';
    const slug  = localStorage.getItem('tenant_slug') ?? '';
    const res = await fetch(`${API_BASE}/med/charting/realtime-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message ?? err?.message
        ?? (res.status === 503
          ? 'Dictée en direct non configurée sur ce serveur.'
          : `Token temps réel indisponible (${res.status}).`);
      throw new Error(msg);
    }
    const raw = await res.json();
    const dgToken = raw?.data?.token ?? raw?.token;
    if (!dgToken) throw new Error('Réponse inattendue (token manquant).');
    return dgToken as string;
  }

  // Ferme proprement micro + WebSocket + timers (idempotent).
  function teardownLive() {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch { /* noop */ }
    recorderRef.current = null;
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Demande à Deepgram de finaliser puis fermer.
        try { wsRef.current.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* noop */ }
      }
      wsRef.current?.close();
    } catch { /* noop */ }
    wsRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  async function startLiveDictation() {
    if (liveStatus !== 'idle') return;
    setLiveError(null);
    setLiveInterim('');
    setLiveStatus('connecting');

    // 1) Micro
    if (!navigator.mediaDevices?.getUserMedia) {
      setLiveStatus('idle');
      setLiveError('Micro non disponible — utilisez un navigateur récent en HTTPS (ou localhost).');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setLiveStatus('idle');
      setLiveError("Micro inaccessible — autorisez l'accès au microphone dans le navigateur.");
      return;
    }

    // 2) Token éphémère
    let dgToken: string;
    try {
      dgToken = await fetchRealtimeToken();
    } catch (e) {
      teardownLive();
      setLiveStatus('idle');
      setLiveError(e instanceof Error ? e.message : 'Token temps réel indisponible.');
      return;
    }

    // 3) WebSocket Deepgram (le NAVIGATEUR se connecte directement).
    //    Auth navigateur = sous-protocole ['token', <token>] (les en-têtes
    //    Authorization custom sont interdits sur WebSocket côté navigateur).
    const params = new URLSearchParams({
      model: 'nova-2',
      language: 'fr',
      interim_results: 'true',
      smart_format: 'true',
      punctuate: 'true',
    });
    let ws: WebSocket;
    try {
      ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, ['token', dgToken]);
    } catch {
      teardownLive();
      setLiveStatus('idle');
      setLiveError('Connexion au service de dictée impossible.');
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      // Choisir un mimeType supporté pour MediaRecorder.
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      const mimeType = candidates.find(t =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t),
      );
      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch {
        teardownLive();
        setLiveStatus('idle');
        setLiveError("Enregistrement audio non supporté par ce navigateur.");
        return;
      }
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(ev.data); // Deepgram accepte les chunks binaires bruts.
        }
      };
      recorder.start(250); // émet un chunk toutes les 250 ms
      // KeepAlive Deepgram (évite la fermeture après ~10s de silence).
      keepAliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'KeepAlive' })); } catch { /* noop */ }
        }
      }, 8000);
      setLiveStatus('listening');
    };

    ws.onmessage = (ev: MessageEvent) => {
      let msg: any;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
      if (!msg || msg.type !== 'Results') return;
      const alt = msg.channel?.alternatives?.[0];
      const text: string = alt?.transcript ?? '';
      if (!text) return;
      if (msg.is_final) {
        const next = (liveFinalRef.current + ' ' + text).trim();
        liveFinalRef.current = next;
        setLiveFinal(next);
        setLiveInterim('');
      } else {
        setLiveInterim(text);
      }
    };

    ws.onerror = () => {
      setLiveError('Connexion temps réel interrompue. Le texte déjà transcrit est conservé.');
    };

    ws.onclose = () => {
      if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
      // Coupure (volontaire ou non) : revenir à l'état repos. Si l'arrêt est
      // volontaire, stopLiveDictation() a déjà versé le transcript dans le champ.
      setLiveStatus('idle');
    };
  }

  // Arrêt volontaire : ferme tout et verse le transcript final dans le champ texte.
  function stopLiveDictation() {
    setLiveStatus('stopping');
    teardownLive();
    const finalText = (liveFinalRef.current + (liveInterim ? ' ' + liveInterim : '')).trim();
    if (finalText) {
      // Verse dans le champ raw_transcript existant (append si déjà du texte).
      setManualText(prev => (prev?.trim() ? `${prev.trim()}\n${finalText}` : finalText));
    }
    setLiveInterim('');
    setLiveStatus('idle');
  }

  // Nettoyage si on quitte la page en pleine dictée.
  useEffect(() => {
    return () => { teardownLive(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Copilote ordonnance : demander une suggestion IA ──────────────────────
  async function requestSuggestion() {
    if (!jobId) return;
    setSuggestError(null);
    setSuggestLoading(true);
    setRxCreated(null);
    try {
      const token = localStorage.getItem('supabase_token') ?? '';
      const slug  = localStorage.getItem('tenant_slug') ?? '';
      const res = await fetch(`${API_BASE}/med/charting/${jobId}/suggest-prescription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': slug,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? err?.message ?? `Erreur ${res.status}`);
      }
      const raw = await res.json();
      const data = (raw?.data ?? raw) as PrescriptionSuggestion;
      setSuggestion({
        items: Array.isArray(data?.items) ? data.items : [],
        patient_instructions: data?.patient_instructions ?? '',
        warnings: data?.warnings ?? null,
        model_used: data?.model_used,
        tokens_used: data?.tokens_used,
      });
    } catch (e: unknown) {
      setSuggestError(e instanceof Error ? e.message : 'Erreur inattendue');
    } finally {
      setSuggestLoading(false);
    }
  }

  // Édition en place d'un champ d'une ligne suggérée.
  function updateItem(index: number, patch: Partial<SuggestedItem>) {
    setSuggestion(prev => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      return { ...prev, items };
    });
  }

  function removeItem(index: number) {
    setSuggestion(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  }

  function addBlankItem() {
    setSuggestion(prev => {
      const blank: SuggestedItem = {
        drug_name: '', dosage: '', frequency: '', duration: '',
        quantity: '', route: '', notes: '', is_substitutable: true,
        confidence: 0, reasoning: 'Ligne ajoutée manuellement par le praticien.',
      };
      if (!prev) {
        return { items: [blank], patient_instructions: '', warnings: null };
      }
      return { ...prev, items: [...prev.items, blank] };
    });
  }

  // ── Créer l'ordonnance en BROUILLON (jamais signée) ───────────────────────
  async function createDraftPrescription() {
    if (!patientId) { setSuggestError('Patient manquant.'); return; }
    if (!suggestion || suggestion.items.length === 0) {
      setSuggestError('Aucune ligne à enregistrer.');
      return;
    }
    // Garde-fou : chaque ligne doit au moins porter un médicament et une posologie.
    const incomplete = suggestion.items.find(it => !it.drug_name.trim() || !it.dosage.trim() || !it.frequency.trim() || !it.duration.trim());
    if (incomplete) {
      setSuggestError('Chaque ligne doit comporter au minimum : médicament, dosage, fréquence et durée.');
      return;
    }

    setSuggestError(null);
    setRxCreating(true);
    try {
      const token = localStorage.getItem('supabase_token') ?? '';
      const slug  = localStorage.getItem('tenant_slug') ?? '';
      // On n'envoie QUE les champs d'ordonnance (pas confidence / reasoning).
      const items = suggestion.items.map(it => ({
        drug_name: it.drug_name.trim(),
        dosage: it.dosage.trim(),
        frequency: it.frequency.trim(),
        duration: it.duration.trim(),
        quantity: it.quantity?.trim() || undefined,
        route: it.route?.trim() || undefined,
        notes: it.notes?.trim() || undefined,
        is_substitutable: it.is_substitutable ?? true,
      }));
      const res = await fetch(`${API_BASE}/med/prescriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': slug,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: patientId,
          consultation_note_id: job?.noteId ?? undefined,
          patient_instructions: suggestion.patient_instructions?.trim() || undefined,
          items,
          // statut draft par défaut côté API — JAMAIS de signature ici.
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? err?.message ?? `Erreur ${res.status}`);
      }
      const raw = await res.json();
      const created = (raw?.data ?? raw) as { id: string };
      setRxCreated({ id: created.id });
    } catch (e: unknown) {
      setSuggestError(e instanceof Error ? e.message : 'Erreur inattendue');
    } finally {
      setRxCreating(false);
    }
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
          Génération automatique de note SOAP par IA (Mistral / DeepSeek)
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {(['audio', 'text', 'live'] as const).map(m => (
            <button
              key={m}
              onClick={() => {
                // Ne pas changer de mode pendant une dictée active.
                if (liveStatus !== 'idle' && m !== 'live') return;
                setMode(m);
              }}
              disabled={liveStatus !== 'idle' && m !== 'live'}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: (liveStatus !== 'idle' && m !== 'live') ? 'not-allowed' : 'pointer',
                background: mode === m ? 'var(--brand-primary)' : 'var(--zw-bg-subtle)',
                color: mode === m ? '#fff' : 'var(--zw-text-soft)',
                border: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: (liveStatus !== 'idle' && m !== 'live') ? 0.5 : 1,
              }}
            >
              {m === 'audio'
                ? <><Upload size={14} /> Fichier audio</>
                : m === 'text'
                ? <><FileText size={14} /> Texte manuel</>
                : <>
                    <Mic size={14} /> Dictée en direct
                    <span style={{
                      background: mode === m ? 'rgba(255,255,255,0.22)' : '#fef3c7',
                      color: mode === m ? '#fff' : '#b45309',
                      borderRadius: 5, padding: '1px 6px', fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5,
                    }}>BETA</span>
                  </>}
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
        ) : mode === 'text' ? (
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
        ) : (
          /* ── Dictée en direct (beta) ─────────────────────────────────── */
          <div>
            {/* Disclaimer beta */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 14 }}>
              <AlertTriangle size={17} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                <strong>Fonctionnalité bêta.</strong> La dictée est transcrite en direct par un service tiers (Deepgram).
                Le texte obtenu est un brouillon à relire ; il n'est versé dans le champ qu'à l'arrêt, puis vous lancez l'analyse SOAP comme d'habitude.
              </p>
            </div>

            <label style={labelStyle}>Dictée en direct</label>

            {/* Barre de contrôle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              {liveStatus === 'idle' ? (
                <button
                  onClick={startLiveDictation}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    border: 'none', cursor: 'pointer', background: 'var(--brand-primary)', color: '#fff',
                  }}
                >
                  <Mic size={16} /> Démarrer la dictée
                </button>
              ) : (
                <button
                  onClick={stopLiveDictation}
                  disabled={liveStatus === 'stopping'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    border: 'none', cursor: liveStatus === 'stopping' ? 'not-allowed' : 'pointer',
                    background: '#dc2626', color: '#fff',
                  }}
                >
                  <Square size={15} /> Arrêter la dictée
                </button>
              )}

              {/* Indicateur d'état */}
              {liveStatus === 'connecting' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--zw-text-muted)' }}>
                  <Loader2 size={15} className="spin" /> Connexion…
                </span>
              )}
              {liveStatus === 'listening' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }} />
                  À l'écoute…
                </span>
              )}
            </div>

            {/* Transcript en direct (final + interim) */}
            <div style={{
              minHeight: 120, padding: '12px 14px', fontSize: 14, lineHeight: 1.7,
              border: '1px solid var(--zw-border)', borderRadius: 8, background: 'var(--zw-bg)',
              color: 'var(--zw-text)', whiteSpace: 'pre-wrap',
            }}>
              {liveFinal || liveInterim ? (
                <>
                  {liveFinal}
                  {liveInterim && (
                    <span style={{ color: 'var(--zw-text-faint)', fontStyle: 'italic' }}>
                      {liveFinal ? ' ' : ''}{liveInterim}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--zw-text-faint)', fontStyle: 'italic' }}>
                  {liveStatus === 'listening'
                    ? 'Parlez — le texte s’affiche ici en temps réel…'
                    : 'Cliquez « Démarrer la dictée » et parlez. À l’arrêt, le texte est placé dans le champ de transcription.'}
                </span>
              )}
            </div>

            {liveError && (
              <div role="alert" style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, lineHeight: 1.5 }}>
                <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{liveError}</span>
              </div>
            )}

            {/* Transcription accumulée (éditable) — versée à l'arrêt */}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Transcription (éditable avant analyse)</label>
              <textarea
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                placeholder="Le texte dicté apparaîtra ici à l'arrêt. Vous pouvez le corriger avant de lancer l'analyse."
                rows={6}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 14,
                  border: '1px solid var(--zw-border)', borderRadius: 8, resize: 'vertical',
                  fontFamily: 'inherit', color: 'var(--zw-text)',
                }}
              />
            </div>
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

              {/* DISCLAIMER — brouillon IA, non-diagnostic, visible, non dismissable */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16 }}>
                <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                  <strong>Brouillon généré par IA — à relire, corriger, valider et signer par le praticien.</strong>{' '}
                  Ne constitue pas un diagnostic. Les sections Analyse et Plan sont des propositions à confirmer
                  par votre jugement clinique avant insertion au dossier.
                </p>
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
                    {/* Repère « brouillon » sur les sections interprétatives (Analyse / Plan). */}
                    {(section === 'assessment' || section === 'plan') && (
                      <span style={{
                        background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
                        borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                      }}>
                        Brouillon — à valider
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--zw-text)', lineHeight: 1.7, paddingLeft: 8, borderLeft: `3px solid ${soapColors[section]}`, margin: 0 }}>
                    {job.soapNote![section] || <em style={{ color: 'var(--zw-text-faint)' }}>Non renseigné</em>}
                  </p>
                </div>
              ))}

              {/* ── Copilote ordonnance (IA) ───────────────────────────── */}
              {job.status === 'completed' && (
                <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px dashed var(--zw-border-strong)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h3 style={{ ...sectionTitle, margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Pill size={16} color="var(--brand-primary)" /> Ordonnance suggérée
                      <span style={{
                        background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
                        borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                      }}>
                        Brouillon — à valider
                      </span>
                    </h3>
                    {!suggestion && (
                      <button
                        onClick={requestSuggestion}
                        disabled={suggestLoading}
                        aria-busy={suggestLoading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          border: 'none', cursor: suggestLoading ? 'not-allowed' : 'pointer',
                          background: suggestLoading ? 'var(--zw-text-faint)' : 'var(--brand-primary)', color: '#fff',
                        }}
                      >
                        {suggestLoading
                          ? <><Loader2 size={15} className="spin" /> Analyse pharmacologique…</>
                          : <><Sparkles size={15} /> Suggérer une ordonnance (IA)</>}
                      </button>
                    )}
                  </div>

                  {suggestError && (
                    <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, lineHeight: 1.5 }}>
                      <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{suggestError}</span>
                    </div>
                  )}

                  {suggestion && (
                    <div style={{ marginTop: 16 }}>
                      {/* DISCLAIMER — visible, non dismissable */}
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16 }}>
                        <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ margin: 0, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                          <strong>Brouillon généré par IA — à relire, corriger, valider et signer par le praticien.</strong>{' '}
                          Ne constitue pas un diagnostic. Aucune ordonnance n'est créée ni signée
                          automatiquement. Contrôlez chaque ligne (molécule, posologie, durée), les allergies,
                          contre-indications et interactions avant de créer le brouillon. Vous restez seul
                          responsable de la prescription.
                        </p>
                      </div>

                      {/* Mise en garde IA globale */}
                      {suggestion.warnings && (
                        <p style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', borderLeft: '3px solid #f59e0b', padding: '8px 12px', borderRadius: 6, margin: '0 0 16px', lineHeight: 1.6 }}>
                          ⚠️ {suggestion.warnings}
                        </p>
                      )}

                      {/* Lignes éditables */}
                      {suggestion.items.length === 0 ? (
                        <p style={{ fontSize: 13.5, color: 'var(--zw-text-muted)', fontStyle: 'italic', margin: '0 0 16px' }}>
                          L'IA ne suggère aucun médicament pour ce tableau clinique (prise en charge non médicamenteuse possible). Vous pouvez ajouter une ligne manuellement.
                        </p>
                      ) : (
                        suggestion.items.map((it, i) => (
                          <div key={i} style={{ border: '1px solid var(--zw-border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--zw-bg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                              <span style={{ ...confidencePill(it.confidence) }}>
                                Confiance {Math.round((it.confidence ?? 0) * 100)}%
                              </span>
                              <button
                                onClick={() => removeItem(i)}
                                title="Retirer cette ligne"
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                              >
                                <Trash2 size={13} /> Retirer
                              </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <Field label="Médicament" value={it.drug_name} onChange={v => updateItem(i, { drug_name: v })} span2 />
                              <Field label="Dosage" value={it.dosage} onChange={v => updateItem(i, { dosage: v })} />
                              <Field label="Fréquence" value={it.frequency} onChange={v => updateItem(i, { frequency: v })} />
                              <Field label="Durée" value={it.duration} onChange={v => updateItem(i, { duration: v })} />
                              <Field label="Voie" value={it.route ?? ''} onChange={v => updateItem(i, { route: v })} />
                              <Field label="Quantité" value={it.quantity ?? ''} onChange={v => updateItem(i, { quantity: v })} />
                              <Field label="Notes" value={it.notes ?? ''} onChange={v => updateItem(i, { notes: v })} span2 />
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--zw-text-soft)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={it.is_substitutable ?? true}
                                onChange={e => updateItem(i, { is_substitutable: e.target.checked })}
                              />
                              Substitution générique autorisée
                            </label>

                            {it.reasoning && (
                              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--zw-text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>
                                Rationnel IA : {it.reasoning}
                              </p>
                            )}
                          </div>
                        ))
                      )}

                      <button
                        onClick={addBlankItem}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--zw-bg-subtle)', color: 'var(--zw-text-soft)', border: '1px dashed var(--zw-border-strong)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}
                      >
                        <Plus size={14} /> Ajouter une ligne
                      </button>

                      {/* Conseils patient (éditable) */}
                      <div style={{ marginBottom: 18 }}>
                        <label style={labelStyle}>Conseils au patient (optionnel)</label>
                        <textarea
                          value={suggestion.patient_instructions ?? ''}
                          onChange={e => setSuggestion(prev => prev ? { ...prev, patient_instructions: e.target.value } : prev)}
                          rows={2}
                          placeholder="Hydratation, repos, quand reconsulter…"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 13.5, border: '1px solid var(--zw-border)', borderRadius: 8, resize: 'vertical', fontFamily: 'inherit', color: 'var(--zw-text)' }}
                        />
                      </div>

                      {/* Action : créer le brouillon */}
                      {rxCreated ? (
                        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                          <CheckCircle size={18} color="#16a34a" aria-hidden="true" />
                          <span style={{ fontSize: 13.5, color: '#15803d', fontWeight: 600 }}>
                            Ordonnance créée en brouillon.
                          </span>
                          <button
                            onClick={() => navigate(`/prescriptions/${rxCreated.id}`)}
                            style={{ marginLeft: 'auto', padding: '7px 14px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Ouvrir l'ordonnance
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={createDraftPrescription}
                          disabled={rxCreating}
                          aria-busy={rxCreating}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '12px 26px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                            border: 'none', cursor: rxCreating ? 'not-allowed' : 'pointer',
                            background: rxCreating ? 'var(--zw-text-faint)' : 'var(--brand-primary)', color: '#fff',
                          }}
                        >
                          {rxCreating
                            ? <><Loader2 size={16} className="spin" /> Création…</>
                            : <><Pill size={16} /> Créer l'ordonnance (brouillon)</>}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1.2s linear infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

// ─── Styles helpers ───────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--zw-text-soft)', marginBottom: 6,
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

// Pastille de confiance colorée (vert ≥0.75, ambre ≥0.6, rouge sinon).
function confidencePill(confidence: number): React.CSSProperties {
  const c = confidence ?? 0;
  const palette = c >= 0.75
    ? { bg: '#dcfce7', fg: '#15803d' }
    : c >= 0.6
    ? { bg: '#fef3c7', fg: '#b45309' }
    : { bg: '#fee2e2', fg: '#b91c1c' };
  return {
    background: palette.bg, color: palette.fg,
    borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 700,
  };
}

// Champ éditable d'une ligne d'ordonnance suggérée.
function Field({
  label, value, onChange, span2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  span2?: boolean;
}) {
  return (
    <div style={{ gridColumn: span2 ? '1 / -1' : 'auto' }}>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--zw-text-soft)', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: 13.5,
          border: '1px solid var(--zw-border)', borderRadius: 7, background: '#fff', color: 'var(--zw-text)',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
