// Replay d'une TÉLÉCONSULTATION — durable, accessible au PRATICIEN et au
// PATIENT (backend GET /med/teleconsult/:id/recording : @Roles owner/
// practitioner/clinic_admin/patient, patient-propriétaire vérifié). Le proche
// invité n'a pas de compte tenant → 403 (secret médical préservé).
//
// Contexte tenant : l'interceptor api lit authStore.getTenantSlug(), qui retombe
// sur ?tenant= de l'URL → le lien de replay porte ?tenant=<slug> et le header
// X-Tenant-Slug part même à froid (nouvel onglet). L'URL de lecture est une URL
// R2 PRÉSIGNÉE fraîche (TTL 1 h) : sur expiration (erreur <video>), on la re-signe.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Stethoscope, Download, RefreshCw, ArrowLeft } from 'lucide-react';
import { teleconsultApi, type TeleconsultRecordingState } from '@/lib/api';

const BG = '#141312';
const GOLD = '#d4a36a';

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} min ${String(s).padStart(2, '0')}`;
}

export default function TeleconsultReplayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [state, setState] = useState<TeleconsultRecordingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await teleconsultApi.getRecording(sessionId);
      setState(r);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Replay indisponible.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  // Auto-poll pendant la FINALISATION : une séance vient de s'arrêter, l'egress
  // finalise le MP4 (quelques secondes) → has_replay bascule à true. On sonde
  // toutes les 6 s tant qu'un enregistrement existe sans replay prêt.
  const finalizing = !!state && !state.has_replay && (state.recording || !!state.started_at);
  useEffect(() => {
    if (!finalizing) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return undefined;
    }
    pollRef.current = window.setInterval(() => { void load(); }, 6000);
    return () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; } };
  }, [finalizing, load]);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: BG, display: 'grid', placeItems: 'center', padding: 20, overflow: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 860 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={goBack} title="Retour" aria-label="Retour" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <Stethoscope size={22} color={GOLD} aria-hidden="true" />
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>Enregistrement de la consultation</h1>
            <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>
              Replay confidentiel — accessible au praticien et au patient de cette séance.
            </p>
          </div>
        </div>

        {loading ? (
          <Card><p style={muted}>Chargement…</p></Card>
        ) : error ? (
          <Card>
            <p style={{ ...muted, color: '#fca5a5' }}>{error}</p>
            <RetryButton onClick={() => { setLoading(true); void load(); }} />
          </Card>
        ) : state?.has_replay && state.playback_url ? (
          <>
            <div style={{ borderRadius: 14, overflow: 'hidden', background: '#000', border: '1px solid rgba(212,163,106,0.35)', boxShadow: '0 18px 50px rgba(0,0,0,0.5)' }}>
              <video
                key={state.playback_url}
                src={state.playback_url}
                controls
                playsInline
                style={{ display: 'block', width: '100%', maxHeight: '70vh', background: '#000' }}
                onError={() => { /* URL présignée expirée (TTL 1 h) → on re-signe. */ void load(); }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={muted}>
                {state.duration_seconds ? `Durée ${fmtDuration(state.duration_seconds)} · ` : ''}
                Lecture sécurisée (lien temporaire).
              </span>
              <a
                href={state.playback_url}
                download
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 9, border: `1px solid ${GOLD}`, background: 'rgba(212,163,106,0.14)', color: GOLD, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
              >
                <Download size={15} aria-hidden="true" /> Télécharger la vidéo
              </a>
            </div>
          </>
        ) : finalizing ? (
          <Card>
            <p style={muted}>
              {state?.recording
                ? 'La séance est en cours d’enregistrement. Le replay sera disponible dès qu’elle sera terminée.'
                : 'Préparation du replay en cours (finalisation de la vidéo)… Cette page se met à jour automatiquement.'}
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 6, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
              <RefreshCw size={14} aria-hidden="true" style={{ animation: 'spin 1.4s linear infinite' }} />
              Actualisation automatique…
              <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            </div>
          </Card>
        ) : (
          <Card>
            <p style={muted}>Aucun enregistrement n’est disponible pour cette consultation.</p>
            <RetryButton onClick={() => { setLoading(true); void load(); }} />
          </Card>
        )}
      </div>
    </div>
  );
}

const muted: React.CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.7)' };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '22px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', textAlign: 'center' }}>
      {children}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
      <RefreshCw size={14} aria-hidden="true" /> Réessayer
    </button>
  );
}
