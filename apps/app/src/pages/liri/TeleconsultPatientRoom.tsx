// ─────────────────────────────────────────────────────────────────────────────
// Salle de téléconsultation PATIENT (native LIRI) — remplace meet.livekit.io.
//
// Le patient arrive ici depuis le portail patient (handoff SSO →
// /teleconsult/:sessionId?tenant=<slug>). On délivre le token via le CHEMIN
// MÉDICAL `/med/teleconsult/:id/token` (contrôle d'accès : le patient possède
// la session) — pas le token générique. La vidéo est rendue par LiveKit, et le
// cockpit clinique (mode patient) affiche EN DIRECT ce que le praticien partage
// (jumeau 3D / bilan / SOAP), synchronisé via le canal Realtime dédié.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { teleconsultApi } from '@/lib/api';
import MedTeleconsultCockpit from '@/features/medos-cockpit/MedTeleconsultCockpit';

export default function TeleconsultPatientRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const [conn, setConn] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // On attend l'auth (handoff SSO) avant d'appeler l'endpoint médical gardé.
    if (!sessionId || !user?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        const res: any = await teleconsultApi.issueToken(sessionId);
        if (!alive) return;
        const url = res?.url;
        const token = res?.token;
        if (!url || !token) {
          setError('Réponse de session invalide.');
          return;
        }
        setConn({ url, token });
        // Marque le patient comme entré (best-effort, non bloquant).
        teleconsultApi.join(sessionId).catch(() => {});
      } catch (e: any) {
        if (alive) setError(e?.message || 'Connexion à la téléconsultation impossible.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, user?.id]);

  if (error) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', color: '#fca5a5', maxWidth: 360 }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🩺</div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{error}</p>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            Vérifiez l'heure du rendez-vous, ou réessayez depuis votre espace patient.
          </p>
        </div>
      </Screen>
    );
  }

  if (!conn) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 14px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#b08d57', borderRadius: '50%', animation: 'lk-spin 0.9s linear infinite' }} />
          <p style={{ fontSize: 14 }}>{user?.id ? 'Connexion à la téléconsultation…' : 'Authentification…'}</p>
          <style>{'@keyframes lk-spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      </Screen>
    );
  }

  return (
    <div data-lk-theme="default" style={{ position: 'fixed', inset: 0, background: '#0b0b0c' }}>
      <LiveKitRoom
        serverUrl={conn.url}
        token={conn.token}
        connect
        audio
        video
        style={{ height: '100vh' }}
      >
        <VideoConference />
      </LiveKitRoom>
      {/* Cockpit clinique (mode patient) — affiche ce que le praticien partage. */}
      <MedTeleconsultCockpit sessionId={sessionId} mode="patient" />
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0b0b0c', padding: 24 }}>
      {children}
    </div>
  );
}
