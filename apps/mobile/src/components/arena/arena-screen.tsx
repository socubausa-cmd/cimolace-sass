import { Feather } from '@expo/vector-icons';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useTracks,
} from '@livekit/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Track } from 'livekit-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';
import { LIVEKIT_URL } from '@/lib/liri-api';

import {
  castVote,
  currentRoundNumber,
  currentUserId,
  fetchArenaSnapshot,
  fetchNeuronqQuestions,
  fetchViewerToken,
  isVotingOpen,
  submitNeuronqQuestion,
  subscribeDebate,
  subscribeNeuronq,
  type ArenaSnapshot,
  type NeuronqQuestionRow,
  type VoteChoice,
} from './data';
import { NeuronqPanel } from './neuronq-panel';
import { TeamBanner } from './team-banner';
import { TurnTimer } from './turn-timer';
import { VoteBar } from './vote-bar';

const EMPTY_SNAPSHOT: ArenaSnapshot = {
  session: null,
  debate: null,
  rounds: [],
  teamA: [],
  teamB: [],
  scoreA: 0,
  scoreB: 0,
};

/**
 * Salle de Débat Arena — vue INVITÉE (rôle viewer / spectateur).
 *
 * Branche LiveKit en abonnement seul (aucun envoi caméra/micro), affiche le
 * bandeau des deux équipes + scores, le chrono de tour, la barre de vote
 * (quand le round est en phase « voting ») et la file NeuronQ. Toutes les
 * données proviennent de Supabase (mêmes tables que le portail web) et se
 * synchronisent en temps réel. Pas de panneau modérateur ni de scoring IA.
 */
export default function ArenaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : '';

  const [token, setToken] = useState<string | null>(null);

  // Session audio LiveKit + token spectateur. L'absence de token n'est pas
  // bloquante : l'arène reste consultable (données Supabase), seule la vidéo
  // bascule sur un placeholder honnête.
  useEffect(() => {
    let mounted = true;
    void AudioSession.startAudioSession();
    (async () => {
      if (!sessionId) return;
      const res = await fetchViewerToken(sessionId);
      if (!mounted) return;
      if (res?.token) setToken(res.token);
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

  // La salle vidéo nécessite un token ; le débat (données) peut s'afficher même
  // si la vidéo échoue. On rend donc toujours le contenu, et on enveloppe la
  // vidéo dans LiveKitRoom seulement quand un token est disponible.
  const content = (
    <ArenaContent sessionId={sessionId} hasVideo={!!token} onBack={goBack} />
  );

  if (token) {
    return (
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={token}
        connect
        audio={false}
        video={false}
        onError={() => setToken(null)}
      >
        {content}
      </LiveKitRoom>
    );
  }

  // Pas encore de token : on montre quand même le débat (données) + un état
  // vidéo honnête. tokenError n'est pas bloquant — l'arène reste consultable.
  return content;
}

/** Vidéo distante (premier flux caméra publié dans la room). */
function RemoteStage() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const tracks = useTracks([Track.Source.Camera]);
  const remote = tracks.find((t) => !t.participant.isLocal) ?? tracks[0];
  const ref = remote && isTrackReference(remote) ? remote : undefined;

  if (!ref) {
    return (
      <View style={[styles.stage, styles.stageOff]}>
        <Feather name="radio" size={26} color={C.faint} />
        <Text style={styles.stageOffTxt}>En attente du flux de l&apos;arène…</Text>
      </View>
    );
  }
  return <VideoTrack trackRef={ref} style={styles.stage} objectFit="cover" />;
}

/** Placeholder vidéo quand aucun token (LiveKit non disponible). */
function StagePlaceholder() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[styles.stage, styles.stageOff]}>
      <Feather name="video-off" size={24} color={C.faint} />
      <Text style={styles.stageOffTxt}>Flux vidéo indisponible</Text>
    </View>
  );
}

function ArenaContent({
  sessionId,
  hasVideo,
  onBack,
}: {
  sessionId: string;
  hasVideo: boolean;
  onBack: () => void;
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [snapshot, setSnapshot] = useState<ArenaSnapshot>(EMPTY_SNAPSHOT);
  const [questions, setQuestions] = useState<NeuronqQuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Record<number, VoteChoice>>({});

  const debateId = snapshot.session?.debate_id ?? '';

  // Re-fetch léger du snapshot (utilisé par le realtime).
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const snap = await fetchArenaSnapshot(sessionId);
    setSnapshot(snap);
  }, [sessionId]);

  // Chargement initial.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [snap, qs, id] = await Promise.all([
        fetchArenaSnapshot(sessionId),
        fetchNeuronqQuestions(sessionId),
        currentUserId(),
      ]);
      if (!mounted) return;
      setSnapshot(snap);
      setQuestions(qs);
      setUid(id);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  // Realtime débat / rounds → re-fetch consolidé.
  useEffect(() => {
    if (!debateId) return;
    const off = subscribeDebate(debateId, {
      onDebate: () => void refresh(),
      onRound: () => void refresh(),
    });
    return off;
  }, [debateId, refresh]);

  // Realtime NeuronQ → insert/update local sans re-fetch complet.
  useEffect(() => {
    if (!sessionId) return;
    const off = subscribeNeuronq(sessionId, {
      onInsert: (row) =>
        setQuestions((prev) => (prev.some((q) => q.id === row.id) ? prev : [...prev, row])),
      onUpdate: (row) =>
        setQuestions((prev) => prev.map((q) => (q.id === row.id ? { ...q, ...row } : q))),
    });
    return off;
  }, [sessionId]);

  const round = currentRoundNumber(snapshot.debate);
  const voting = isVotingOpen(snapshot);
  const neuronqEnabled = snapshot.debate ? snapshot.debate.neuronq_enabled !== false : true;
  const title =
    snapshot.debate?.title?.trim() || snapshot.session?.title?.trim() || 'Salle de Débat';

  const onVote = useCallback(
    async (choice: VoteChoice): Promise<boolean> => {
      const ok = await castVote(sessionId, round, choice);
      if (ok) setMyVotes((prev) => ({ ...prev, [round]: choice }));
      return ok;
    },
    [sessionId, round],
  );

  const onAsk = useCallback(
    (text: string) => submitNeuronqQuestion(sessionId, text),
    [sessionId],
  );

  const liveLabel = useMemo(() => {
    const st = snapshot.session?.status ?? snapshot.debate?.status ?? '';
    return st === 'live' ? 'EN DIRECT' : st ? st.toUpperCase() : 'ARENA';
  }, [snapshot.session?.status, snapshot.debate?.status]);

  // ── États de chargement / vide honnêtes ────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.coral} />
        <Text style={styles.centerTxt}>Connexion à l&apos;arène…</Text>
      </View>
    );
  }

  if (!snapshot.session) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <View style={styles.emptyMark}>
          <Feather name="slash" size={24} color={C.faint} />
        </View>
        <Text style={styles.emptyTitle}>Arène introuvable</Text>
        <Text style={styles.emptyNote}>
          Cette session n&apos;existe pas ou nécessite d&apos;être connecté pour y accéder.
        </Text>
        <Pressable style={styles.backBtnSolid} onPress={onBack}>
          <Text style={styles.backSolidTxt}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const noDebate = !snapshot.debate;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête */}
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
              <Feather name="chevron-left" size={22} color={C.ink} />
            </Pressable>
            <View style={styles.headerMid}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeTxt}>{liveLabel}</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <View style={styles.back} />
          </View>
        </SafeAreaView>

        {/* Scène vidéo */}
        {hasVideo ? <RemoteStage /> : <StagePlaceholder />}

        <View style={styles.body}>
          {noDebate ? (
            <View style={styles.infoCard}>
              <Feather name="info" size={16} color={C.coral} />
              <Text style={styles.infoTxt}>
                Cette session n&apos;est pas (encore) structurée en débat. Le bandeau
                d&apos;équipes apparaîtra dès qu&apos;un débat sera associé.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.roundRow}>
                <Text style={styles.roundLabel}>
                  Round {round}
                  <Text style={styles.roundTotal}>
                    {' '}
                    / {Math.max(1, Number(snapshot.debate?.round_count) || 1)}
                  </Text>
                </Text>
                <TurnTimer deadline={snapshot.debate?.arena_turn_deadline ?? null} />
              </View>

              <TeamBanner
                teamA={snapshot.teamA}
                teamB={snapshot.teamB}
                scoreA={snapshot.scoreA}
                scoreB={snapshot.scoreB}
                activeSide={snapshot.debate?.arena_active_side ?? null}
              />

              {voting && (
                <VoteBar round={round} myVote={myVotes[round] ?? null} onVote={onVote} />
              )}
            </>
          )}

          {neuronqEnabled && (
            <NeuronqPanel questions={questions} canAsk={!!uid} onSubmit={onAsk} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  scroll: { paddingBottom: 32 },

  center: {
    flex: 1,
    backgroundColor: C.base,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  centerTxt: { color: C.muted, fontSize: 14, fontFamily: F.sans },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, alignItems: 'center', gap: 4 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.live,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, fontFamily: F.sans },
  headerTitle: { color: C.ink, fontSize: 16, fontWeight: '700', fontFamily: F.serif },

  stage: {
    height: 200,
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  stageOff: {
    backgroundColor: C.rail,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  stageOffTxt: { color: C.faint, fontSize: 13, fontFamily: F.sans },

  body: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },

  roundRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundLabel: { color: C.ink, fontSize: 16, fontWeight: '800', fontFamily: F.serif },
  roundTotal: { color: C.faint, fontSize: 14, fontWeight: '600' },

  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    ...softShadow,
  },
  infoTxt: { flex: 1, color: C.muted, fontSize: 13.5, lineHeight: 20, fontFamily: F.sans },

  emptyMark: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: '700', fontFamily: F.serif },
  emptyNote: { color: C.muted, fontSize: 13.5, lineHeight: 20, textAlign: 'center', fontFamily: F.sans },
  backBtnSolid: {
    marginTop: 6,
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backSolidTxt: { color: '#fff', fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },
});
