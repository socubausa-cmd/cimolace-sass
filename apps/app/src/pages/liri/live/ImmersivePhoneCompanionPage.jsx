/**
 * Page publique — scan QR depuis le live immersif.
 * Rejoint la room LiveKit en tant que companion_* : caméra ou partage d'écran.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Room,
  ConnectionState,
  Track,
  createLocalVideoTrack,
} from 'livekit-client';
import { exchangeImmersiveCompanionToken } from '@/services/livekitApi';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';
import { Smartphone, MonitorUp, Camera, AlertCircle, Loader2 } from 'lucide-react';

async function stopCompanionPublishing(localParticipant) {
  if (!localParticipant) return;
  await localParticipant.setScreenShareEnabled(false).catch(() => {});
  const tracks = [];
  localParticipant.trackPublications.forEach((pub) => {
    if (pub.source === Track.Source.Camera && pub.track) tracks.push(pub.track);
  });
  for (const t of tracks) {
    await localParticipant.unpublishTrack(t).catch(() => {});
  }
}

export default function ImmersivePhoneCompanionPage() {
  const [searchParams] = useSearchParams();
  const opaque = searchParams.get('t') || '';

  const [phase, setPhase] = useState('init');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeMode, setActiveMode] = useState(null);
  const roomRef = useRef(null);

  const connect = useCallback(async () => {
    if (!opaque) {
      setErrorMsg('Lien incomplet : paramètre t manquant.');
      setPhase('error');
      return;
    }
    setPhase('connecting');
    setErrorMsg('');
    try {
      const data = await exchangeImmersiveCompanionToken(opaque);
      const room = new Room(getStableLiveKitRoomOptions({ adaptiveStream: true, dynacast: true }));
      roomRef.current = room;
      await room.connect(data.livekitUrl, data.token, stableLiveKitConnectOptions);
      setPhase('ready');
    } catch (e) {
      setErrorMsg(e?.message || 'Connexion impossible.');
      setPhase('error');
      roomRef.current = null;
    }
  }, [opaque]);

  useEffect(() => {
    void connect();
    return () => {
      const r = roomRef.current;
      roomRef.current = null;
      if (r && r.state === ConnectionState.Connected) {
        try { r.disconnect(true); } catch { /* ignore */ }
      }
    };
  }, [connect]);

  const startCamera = async (facingMode) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    try {
      await stopCompanionPublishing(room.localParticipant);
      const vt = await createLocalVideoTrack({ facingMode });
      await room.localParticipant.publishTrack(vt, {
        source: Track.Source.Camera,
        name: 'companion-camera',
      });
      setActiveMode('camera');
    } catch (e) {
      setErrorMsg(e?.message || 'Caméra refusée.');
    }
  };

  const startScreen = async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    try {
      await stopCompanionPublishing(room.localParticipant);
      await room.localParticipant.setScreenShareEnabled(true);
      setActiveMode('screen');
      const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const track = pub?.track?.mediaStreamTrack;
      if (track) {
        track.onended = () => {
          setActiveMode(null);
        };
      }
    } catch (e) {
      setErrorMsg(e?.message || 'Partage d\'écran indisponible sur cet appareil.');
    }
  };

  const stopAll = async () => {
    const room = roomRef.current;
    if (!room) return;
    await stopCompanionPublishing(room.localParticipant);
    setActiveMode(null);
  };

  return (
    <div className="min-h-screen bg-[#050b14] text-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-[var(--school-accent)]" />
          </div>
          <div>
            <h1 className="text-base font-bold">Appareil pour le live</h1>
            <p className="text-[10px] text-white/45">Caméra secondaire ou écran — visible dans Cam 2 sur l'ordinateur.</p>
          </div>
        </div>

        {phase === 'connecting' || phase === 'init' ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="w-10 h-10 text-[var(--school-accent)] animate-spin" />
            <p className="text-sm text-white/50">Connexion à la salle…</p>
          </div>
        ) : null}

        {phase === 'error' ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">Erreur</p>
              <p className="text-xs text-red-200/90 mt-1">{errorMsg}</p>
              <button
                type="button"
                onClick={() => void connect()}
                className="mt-3 text-xs text-[var(--school-accent)] underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'ready' ? (
          <div className="space-y-3">
            <p className="text-xs text-white/50 text-center mb-4">
              Choisissez ce que vous envoyez. Sur le PC, ouvrez la scène <strong className="text-[var(--school-accent)]">Cam 2</strong> puis sélectionnez <strong>Téléphone (QR)</strong>.
            </p>
            <button
              type="button"
              onClick={() => void startCamera('user')}
              className="w-full h-11 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-sm text-[#f5dd8a] flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Caméra avant (selfie)
            </button>
            <button
              type="button"
              onClick={() => void startCamera('environment')}
              className="w-full h-11 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] text-sm text-[#f0e6bc] flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Caméra arrière
            </button>
            <button
              type="button"
              onClick={() => void startScreen()}
              className="w-full h-11 rounded-xl bg-white/10 border border-white/15 text-sm flex items-center justify-center gap-2"
            >
              <MonitorUp className="w-4 h-4" />
              Partager l'écran du téléphone
            </button>
            {activeMode ? (
              <button
                type="button"
                onClick={() => void stopAll()}
                className="w-full h-10 rounded-xl border border-white/20 text-xs text-white/70"
              >
                Arrêter l'envoi
              </button>
            ) : null}
            {activeMode ? (
              <p className="text-[10px] text-emerald-400/80 text-center pt-2">
                ● Flux actif — laissez cette page ouverte pendant le live.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
