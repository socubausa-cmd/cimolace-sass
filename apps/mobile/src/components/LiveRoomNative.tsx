import { Feather } from '@expo/vector-icons';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useDataChannel,
  useLocalParticipant,
  useTracks,
} from '@livekit/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Track } from 'livekit-client';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EleveLiveShell, { type ChatMessage } from '@/components/live-room/eleve-live-shell';
import { type SmartboardSlide } from '@/components/live-host/immersive-smartboard';
import { LIVE_DECK, fetchLiveDeck, slideAtIn } from '@/components/live-host/live-deck';
import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';
import { LIVEKIT_URL, endLive, fetchLiveToken, fetchSessionDeckId } from '@/lib/liri-api';

type Role = 'host' | 'student';

/**
 * Salle live native (LiveKit). Deux rôles :
 *  - host    → diffuse sa caméra + micro (le téléphone est l'émetteur).
 *  - student → spectateur (abonnement seul, aucun envoi).
 *
 * Navigué via /live-room?id=<sessionId>&role=host&title=… La session audio
 * native est démarrée avant la connexion et arrêtée à la sortie.
 */
export default function LiveRoomNative() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; role?: string; title?: string }>();
  const sessionId = typeof params.id === 'string' ? params.id : '';
  const role: Role = params.role === 'student' ? 'student' : 'host';
  const title = typeof params.title === 'string' && params.title ? params.title : 'Session live';

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void AudioSession.startAudioSession();
    (async () => {
      if (!sessionId) {
        setError('Session introuvable.');
        return;
      }
      const res = await fetchLiveToken(sessionId, role === 'host' ? 'host' : 'student');
      if (!mounted) return;
      if (!res?.token) {
        setError("Impossible d'obtenir l'accès au live.");
        return;
      }
      setToken(res.token);
    })();
    return () => {
      mounted = false;
      void AudioSession.stopAudioSession();
    };
  }, [sessionId, role]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/lives');
  }, [router]);

  if (error) {
    return (
      <View style={styles.fill}>
        <View style={styles.errMark}>
          <Feather name="alert-triangle" size={26} color={C.live} />
        </View>
        <Text style={styles.errTitle}>{error}</Text>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.fill}>
        <ActivityIndicator color={C.coral} />
        <Text style={styles.loadingTxt}>
          {role === 'host' ? 'Préparation de votre live…' : 'Connexion au live…'}
        </Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect
      audio={role === 'host'}
      video={role === 'host'}
      onError={(e) => setError(e.message)}
      onDisconnected={goBack}
    >
      <RoomStage role={role} sessionId={sessionId} title={title} onLeave={goBack} />
    </LiveKitRoom>
  );
}

function RoomStage({
  role,
  sessionId,
  title,
  onLeave,
}: {
  role: Role;
  sessionId: string;
  title: string;
  onLeave: () => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const [micOn, setMicOn] = useState(role === 'host');
  const [camOn, setCamOn] = useState(role === 'host');
  const [ending, setEnding] = useState(false);

  // Synchro slide : l'élève reçoit l'index publié par l'hôte (data channel « sb »).
  const [remoteSlide, setRemoteSlide] = useState(1);
  useDataChannel('sb', (msg) => {
    try {
      const d = JSON.parse(new TextDecoder().decode(msg.payload)) as { slide?: number };
      if (typeof d.slide === 'number') setRemoteSlide(d.slide);
    } catch {
      /* ignore */
    }
  });

  // Deck généré de la session (même source que l'hôte) ; [] → repli exemple.
  // deckId : param `?deck=` sinon la colonne liée de la session.
  const { deck: deckParam } = useLocalSearchParams<{ deck?: string }>();
  const [deck, setDeck] = useState<SmartboardSlide[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const id =
        (typeof deckParam === 'string' && deckParam) ||
        (sessionId ? await fetchSessionDeckId(sessionId) : null);
      if (!id) return;
      const d = await fetchLiveDeck(id);
      if (mounted) setDeck(d);
    })();
    return () => {
      mounted = false;
    };
  }, [deckParam, sessionId]);
  const liveDeck = deck.length ? deck : LIVE_DECK;

  // Modération reçue de l'hôte (canal `mod`) : micro forcé coupé, salle verrouillée.
  const [mod, setMod] = useState<{ muteAll?: boolean; locked?: boolean }>({});
  useDataChannel('mod', (msg) => {
    try {
      const d = JSON.parse(new TextDecoder().decode(msg.payload)) as { key?: string; value?: boolean };
      if (d.key === 'muteAll') setMod((m) => ({ ...m, muteAll: d.value }));
      else if (d.key === 'locked') setMod((m) => ({ ...m, locked: d.value }));
    } catch {
      /* ignore */
    }
  });

  // Chat du live : réception + envoi via data channel « chat » (bidirectionnel).
  const [chatMsgs, setChatMsgs] = useState<ChatMessage[]>([]);
  const { send: sendChat } = useDataChannel('chat', (msg) => {
    try {
      const d = JSON.parse(new TextDecoder().decode(msg.payload)) as { author?: string; text?: string };
      if (!d.text) return;
      const author = d.author || msg.from?.identity || 'Invité';
      setChatMsgs((prev) => [...prev, { id: `${prev.length}-${author}`, author, text: d.text! }]);
    } catch {
      /* ignore */
    }
  });
  const onSendChat = useCallback(
    (text: string) => {
      const author = localParticipant?.identity || 'Moi';
      setChatMsgs((prev) => [...prev, { id: `me-${prev.length}`, author, text, me: true }]);
      try {
        sendChat(new TextEncoder().encode(JSON.stringify({ author, text })), { reliable: true });
      } catch {
        /* ignore */
      }
    },
    [sendChat, localParticipant],
  );

  // Data channel « qa » : l'élève signale une main levée → file Q&R de l'hôte.
  const { send: sendQa } = useDataChannel('qa');
  const onRaiseHand = useCallback(
    (raised: boolean) => {
      if (!raised) return; // on publie seulement la levée (pas la baisse)
      const author = localParticipant?.name || localParticipant?.identity || 'Élève';
      try {
        sendQa(new TextEncoder().encode(JSON.stringify({ author, text: 'a levé la main ✋' })), { reliable: true });
      } catch {
        /* ignore */
      }
    },
    [sendQa, localParticipant],
  );

  // Host → sa propre caméra ; spectateur → la caméra du diffuseur (distant).
  const cameraRef =
    role === 'host'
      ? tracks.find((t) => t.participant.isLocal)
      : tracks.find((t) => !t.participant.isLocal) ?? tracks[0];
  const videoRef = cameraRef && isTrackReference(cameraRef) ? cameraRef : undefined;

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    await localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn, localParticipant]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    await localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }, [camOn, localParticipant]);

  const end = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    if (role === 'host') {
      try {
        await endLive(sessionId);
      } catch {
        /* on quitte quand même */
      }
    }
    onLeave();
  }, [ending, role, sessionId, onLeave]);

  // Élève → coque immersive (smartboard sans fond + caméra prof dans la zone),
  // parité avec la régie hôte. (Tous les hooks sont déclarés au-dessus.)
  if (role === 'student') {
    return (
      <EleveLiveShell
        title={title}
        slide={slideAtIn(liveDeck, remoteSlide) ?? liveDeck[0]}
        slideIndex={remoteSlide}
        slideTotal={liveDeck.length}
        micLocked={!!mod.muteAll}
        roomLocked={!!mod.locked}
        cameraNode={videoRef ? <VideoTrack trackRef={videoRef} style={styles.video} objectFit="cover" /> : undefined}
        chatMessages={chatMsgs}
        onSendChat={onSendChat}
        onToggleHand={onRaiseHand}
        onLeave={end}
      />
    );
  }

  return (
    <View style={styles.root}>
      {videoRef ? (
        <VideoTrack
          trackRef={videoRef}
          style={styles.video}
          objectFit="cover"
          mirror={role === 'host'}
        />
      ) : (
        <View style={[styles.video, styles.videoOff]}>
          <Feather name={role === 'host' ? 'video-off' : 'loader'} size={34} color={C.faint} />
          <Text style={styles.videoOffTxt}>
            {role === 'host'
              ? camOn
                ? 'Activation de la caméra…'
                : 'Caméra coupée'
              : 'En attente du diffuseur…'}
          </Text>
        </View>
      )}

      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeTxt}>EN DIRECT</Text>
        </View>
        <Text style={styles.topTitle} numberOfLines={1}>
          {title}
        </Text>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.controls} pointerEvents="box-none">
        {role === 'host' && (
          <>
            <CtrlButton
              icon={micOn ? 'mic' : 'mic-off'}
              active={micOn}
              label={micOn ? 'Micro' : 'Muet'}
              onPress={toggleMic}
            />
            <CtrlButton
              icon={camOn ? 'video' : 'video-off'}
              active={camOn}
              label={camOn ? 'Caméra' : 'Off'}
              onPress={toggleCam}
            />
          </>
        )}
        <Pressable
          style={({ pressed }) => [styles.endBtn, pressed && styles.pressed]}
          onPress={end}
          disabled={ending}
        >
          {ending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={role === 'host' ? 'phone-off' : 'x'} size={18} color="#fff" />
              <Text style={styles.endTxt}>{role === 'host' ? 'Terminer' : 'Quitter'}</Text>
            </>
          )}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function CtrlButton({
  icon,
  active,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.ctrl, !active && styles.ctrlOff, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Feather name={icon} size={20} color={active ? C.ink : C.live} />
      <Text style={[styles.ctrlLabel, !active && { color: C.live }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  fill: { flex: 1, backgroundColor: C.base, alignItems: 'center', justifyContent: 'center', padding: 36 },
  loadingTxt: { color: C.muted, fontSize: 14, marginTop: 14, fontFamily: F.sans },

  video: { ...StyleSheet.absoluteFillObject },
  videoOff: { backgroundColor: C.rail, alignItems: 'center', justifyContent: 'center', gap: 12 },
  videoOffTxt: { color: C.faint, fontSize: 14, fontFamily: F.sans },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  liveBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.live,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1, fontFamily: F.sans },
  topTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: F.sans,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 16,
  },
  ctrl: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(48,48,46,0.85)',
    borderRadius: 16,
    paddingVertical: 11,
    width: 76,
  },
  ctrlOff: { backgroundColor: C.liveTint, borderWidth: 1, borderColor: C.liveBorder },
  ctrlLabel: { color: C.ink, fontSize: 11.5, fontWeight: '600', fontFamily: F.sans },

  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.live,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 22,
    minWidth: 120,
  },
  endTxt: { color: '#fff', fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },

  pressed: { opacity: 0.7 },

  errMark: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: C.liveTint,
    borderWidth: 1,
    borderColor: C.liveBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errTitle: { color: C.ink, fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 16, fontFamily: F.sans },
  backBtn: { marginTop: 20, backgroundColor: C.panel, borderRadius: 13, paddingHorizontal: 22, paddingVertical: 11 },
  backTxt: { color: C.ink, fontSize: 14, fontWeight: '600', fontFamily: F.sans },
});
