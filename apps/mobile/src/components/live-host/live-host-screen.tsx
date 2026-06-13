import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from '@livekit/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Track } from 'livekit-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import HostShell, {
  tintFor,
  type HostChatMessage,
  type LiveMember,
  type LiveQuestion,
  type RemoteTile,
} from '@/components/live-host/host-shell';
import { fetchLiveDeck } from '@/components/live-host/live-deck';
import { type SmartboardSlide } from '@/components/live-host/immersive-smartboard';
import { LiriColors as C } from '@/constants/liri-theme';
import { LIVEKIT_URL, endLive, fetchLiveToken, fetchSessionDeckId, startRecording, stopRecording } from '@/lib/liri-api';

/**
 * Route /live-host (natif) — RÉGIE LIVE de l'hôte.
 *
 * Branche le vrai flux LiveKit (caméra/micro de l'hôte + participants) dans la
 * coque officielle `HostShell` (modèle `LiveHostMobileShell`, cf.
 * docs/LIVE_HOST_MODELE_OFFICIEL.md). Navigué via /live-host?id=<sessionId>.
 * Sans `id`, affiche la coque en mode preview (mock).
 */
export default function LiveHostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; deck?: string }>();
  const sessionId = typeof params.id === 'string' ? params.id : '';
  const deckId = typeof params.deck === 'string' ? params.deck : '';
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Deck généré de la session (Architect / Masterclass) ; [] → repli exemple.
  // Source du deckId : param d'URL `?deck=` sinon la session (colonne liée).
  const [deck, setDeck] = useState<SmartboardSlide[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = deckId || (sessionId ? await fetchSessionDeckId(sessionId) : null);
      if (!id) return;
      const d = await fetchLiveDeck(id);
      if (mounted) setDeck(d);
    })();
    return () => {
      mounted = false;
    };
  }, [deckId, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;
    void AudioSession.startAudioSession();
    (async () => {
      const res = await fetchLiveToken(sessionId, 'host');
      if (!mounted) return;
      if (!res?.token) {
        setErr("Impossible d'obtenir l'accès à la régie.");
        return;
      }
      setToken(res.token);
    })();
    return () => {
      mounted = false;
      void AudioSession.stopAudioSession();
    };
  }, [sessionId]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/lives');
  }, [router]);

  // Pas de session → coque en mode preview (mock, sans LiveKit).
  if (!sessionId) return <HostShell onEnd={goBack} deck={deck} />;

  if (err) {
    return (
      <View style={st.center}>
        <Text style={st.err}>{err}</Text>
      </View>
    );
  }
  if (!token) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={C.coral} />
        <Text style={st.load}>Préparation de la régie…</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect
      audio
      video
      onDisconnected={goBack}
      onError={(e) => setErr(e.message)}
    >
      <HostRegie sessionId={sessionId} deck={deck} onLeave={goBack} />
    </LiveKitRoom>
  );
}

function HostRegie({ sessionId, deck, onLeave }: { sessionId: string; deck: SmartboardSlide[]; onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const camRef = tracks.find((t) => t.participant.isLocal);
  const videoRef = camRef && isTrackReference(camRef) ? camRef : undefined;

  // Enregistrement réel (LiveKit Egress côté serveur, via l'API /lives/:id/recording/*).
  const [rec, setRec] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const toggleRec = useCallback(async () => {
    if (recBusy) return;
    setRecBusy(true);
    const next = !rec;
    setRec(next); // optimiste
    try {
      const res = next ? await startRecording(sessionId) : await stopRecording(sessionId);
      // L'API fait foi : si l'egress n'est pas configuré, on revient à l'état réel.
      if (next && res && res.recording_active === false) setRec(false);
    } catch {
      setRec(!next); // rollback
    } finally {
      setRecBusy(false);
    }
  }, [rec, recBusy, sessionId]);

  const toggleMic = useCallback(async () => {
    const n = !micOn;
    await localParticipant.setMicrophoneEnabled(n);
    setMicOn(n);
  }, [micOn, localParticipant]);
  const toggleCam = useCallback(async () => {
    const n = !camOn;
    await localParticipant.setCameraEnabled(n);
    setCamOn(n);
  }, [camOn, localParticipant]);
  const end = useCallback(async () => {
    try {
      await endLive(sessionId);
    } catch {
      /* on quitte quand même */
    }
    onLeave();
  }, [sessionId, onLeave]);

  // Data channel « sb » : l'hôte publie l'index de slide → les élèves suivent.
  const { send } = useDataChannel('sb');
  const publishSlide = useCallback(
    (idx: number) => {
      try {
        send(new TextEncoder().encode(JSON.stringify({ slide: idx })), { reliable: true });
      } catch {
        /* ignore */
      }
    },
    [send],
  );

  // Data channel « mod » : l'hôte diffuse les bascules de modération.
  const { send: sendMod } = useDataChannel('mod');
  const publishMod = useCallback(
    (key: string, value: boolean) => {
      try {
        sendMod(new TextEncoder().encode(JSON.stringify({ key, value })), { reliable: true });
      } catch {
        /* ignore */
      }
    },
    [sendMod],
  );

  // Data channel « chat » : réception des messages des participants + envoi hôte.
  const [chat, setChat] = useState<HostChatMessage[]>([]);
  const { send: sendChat } = useDataChannel('chat', (msg) => {
    try {
      const d = JSON.parse(new TextDecoder().decode(msg.payload)) as { author?: string; text?: string };
      if (!d.text) return;
      const author = d.author || msg.from?.identity || 'Invité';
      setChat((prev) => [...prev, { id: `${prev.length}-${author}`, author, text: d.text! }]);
    } catch {
      /* ignore */
    }
  });
  const onSendChat = useCallback(
    (text: string) => {
      const author = localParticipant?.name || localParticipant?.identity || 'Prof';
      setChat((prev) => [...prev, { id: `me-${prev.length}`, author, text, me: true }]);
      try {
        sendChat(new TextEncoder().encode(JSON.stringify({ author, text })), { reliable: true });
      } catch {
        /* ignore */
      }
    },
    [sendChat, localParticipant],
  );

  // Data channel « qa » : file des questions / mains levées des participants.
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  useDataChannel('qa', (msg) => {
    try {
      const d = JSON.parse(new TextDecoder().decode(msg.payload)) as { author?: string; text?: string };
      if (!d.text) return;
      const author = d.author || msg.from?.identity || 'Invité';
      setQuestions((prev) => [...prev, { id: `${prev.length}-${author}-${Date.now()}`, author, text: d.text! }]);
    } catch {
      /* ignore */
    }
  });
  const onResolveQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, resolved: true } : q)));
  }, []);

  // Tuiles vidéo distantes (invités qui publient leur caméra) → scène Galerie (multicam).
  const remoteTiles = useMemo<RemoteTile[]>(
    () =>
      tracks
        .filter((t) => !t.participant.isLocal && isTrackReference(t))
        .map((t) => ({
          id: t.participant.identity || t.participant.sid,
          name: t.participant.name || t.participant.identity || 'Invité',
          node: <VideoTrack trackRef={t} style={st.fill} objectFit="cover" />,
          speaking: t.participant.isSpeaking,
        })),
    [tracks],
  );

  // Participants LiveKit → membres affichés (onglet Membres + Galerie + Focus).
  const members = useMemo<LiveMember[]>(
    () =>
      participants.map((p) => {
        let role: string | undefined;
        try {
          const meta = p.metadata ? (JSON.parse(p.metadata) as { role?: string }) : null;
          if (meta?.role && /host|prof|teacher|enseign/i.test(meta.role)) role = 'PROF';
        } catch {
          /* metadata non-JSON → ignore */
        }
        const name = p.name || p.identity || 'Invité';
        return { name, role, tint: tintFor(p.identity || name), speaking: p.isSpeaking };
      }),
    [participants],
  );

  const hostVideo = videoRef ? (
    <VideoTrack trackRef={videoRef} style={st.fill} objectFit="cover" mirror />
  ) : null;

  return (
    <HostShell
      participantCount={participants.length}
      members={members}
      deck={deck}
      micOn={micOn}
      camOn={camOn}
      recording={rec}
      onToggleRec={toggleRec}
      onToggleMic={toggleMic}
      onToggleCam={toggleCam}
      onEnd={end}
      hostVideo={hostVideo}
      onSlideChange={publishSlide}
      onModerate={publishMod}
      chatMessages={chat}
      onSendChat={onSendChat}
      questions={questions}
      onResolveQuestion={onResolveQuestion}
      remoteTiles={remoteTiles}
    />
  );
}

const st = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', padding: 36, gap: 14 },
  err: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  load: { color: '#9CA3AF', fontSize: 14 },
  fill: { ...StyleSheet.absoluteFillObject },
});
