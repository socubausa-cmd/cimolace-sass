import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';
import { fetchLives, quickStartLive, type Live } from '@/lib/liri-api';

const pad = (n: number) => String(n).padStart(2, '0');
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const euros = (cents?: number) =>
  cents ? `${Math.round(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €` : 'Gratuit';

function whenLabel(iso: string | undefined, now: Date): string {
  if (!iso) return '';
  const d = new Date(iso);
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const tmr = new Date(now);
  tmr.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return `Aujourd'hui · ${t}`;
  if (d.toDateString() === tmr.toDateString()) return `Demain · ${t}`;
  return `${d.getDate()} ${MOIS[d.getMonth()]} · ${t}`;
}

export default function LivesScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [lives, setLives] = useState<Live[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now] = useState(() => new Date());

  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    setLives(await fetchLives());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Crée + passe en direct, puis ouvre la salle de diffusion (host).
  const launchLive = useCallback(async () => {
    if (launching) return;
    setLaunching(true);
    const live = await quickStartLive();
    setLaunching(false);
    if (live?.id) {
      router.push({ pathname: '/live-room', params: { id: live.id, role: 'host', title: live.title ?? 'Mon live' } });
    } else {
      Alert.alert('Live', "Impossible de démarrer le live. Vérifiez votre connexion et réessayez.");
    }
  }, [launching, router]);

  // Un live « Arena · … » est un débat structuré → salle de débat dédiée.
  const isArena = (l: Live) => /^arena\b/i.test((l.title ?? '').trim());

  // Rejoint un live en cours : arène → /arena/[id], sinon salle spectateur.
  const joinLive = useCallback(
    (live: Live) => {
      if (isArena(live)) {
        router.push({ pathname: '/arena/[sessionId]', params: { sessionId: live.id } });
        return;
      }
      router.push({ pathname: '/live-room', params: { id: live.id, role: 'student', title: live.title ?? 'Session live' } });
    },
    [router],
  );

  const liveNow = useMemo(() => (lives ?? []).filter((l) => l.started_at && !l.ended_at), [lives]);
  const upcoming = useMemo(
    () =>
      (lives ?? [])
        .filter((l) => !l.started_at && l.scheduled_at && new Date(l.scheduled_at) > now)
        .sort((a, b) => +new Date(a.scheduled_at as string) - +new Date(b.scheduled_at as string)),
    [lives, now],
  );
  const replays = useMemo(
    () =>
      (lives ?? [])
        .filter((l) => l.ended_at)
        .sort((a, b) => +new Date(b.ended_at as string) - +new Date(a.ended_at as string))
        .slice(0, 8),
    [lives],
  );

  const loading = lives === null;
  const isEmpty = !loading && (lives ?? []).length === 0;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Lives</Text>
            <Text style={styles.h1sub}>Sessions en direct & replays</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
            onPress={launchLive}
            disabled={launching}
          >
            {launching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="video" size={16} color="#fff" />
                <Text style={styles.newBtnTxt}>Démarrer</Text>
              </>
            )}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.fill}><ActivityIndicator color={C.coral} /></View>
        ) : isEmpty ? (
          <View style={styles.fill}>
            <View style={styles.emptyMark}><Feather name="video" size={28} color={C.coral} /></View>
            <Text style={styles.emptyTitle}>Aucun live pour le moment</Text>
            <Text style={styles.emptySub}>Les sessions programmées apparaîtront ici.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />}
          >
            {liveNow.length > 0 && (
              <>
                <Text style={styles.section}>EN DIRECT</Text>
                {liveNow.map((l) => (
                  <Pressable key={l.id} style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]} onPress={() => joinLive(l)}>
                    <View style={styles.liveDotWrap}><View style={styles.liveDotRing} /><View style={styles.liveDot} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{l.title || 'Session live'}</Text>
                      <View style={styles.liveMetaRow}>
                        {isArena(l) && <View style={styles.arenaTag}><Feather name="flag" size={9} color="#fff" /><Text style={styles.arenaTagTxt}>DÉBAT</Text></View>}
                        <Text style={styles.liveMeta}>en cours maintenant</Text>
                      </View>
                    </View>
                    <View style={styles.joinBtn}><Text style={styles.joinTxt}>{isArena(l) ? 'Entrer' : 'Rejoindre'}</Text></View>
                  </Pressable>
                ))}
              </>
            )}

            {upcoming.length > 0 && (
              <>
                <Text style={styles.section}>À VENIR</Text>
                {upcoming.map((l) => (
                  <Pressable key={l.id} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                    <View style={styles.iconBox}><Feather name="clock" size={17} color={C.coral} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{l.title || 'Session live'}</Text>
                      <Text style={styles.cardMeta}>{whenLabel(l.scheduled_at, now)} · {euros(l.price_cents)}</Text>
                    </View>
                    <Feather name="bell" size={17} color={C.faint} />
                  </Pressable>
                ))}
              </>
            )}

            {replays.length > 0 && (
              <>
                <Text style={styles.section}>REPLAYS</Text>
                {replays.map((l) => (
                  <Pressable key={l.id} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                    <View style={styles.iconBox}><Feather name="play" size={16} color={C.coral} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{l.title || 'Session live'}</Text>
                      <Text style={styles.cardMeta}>Replay disponible</Text>
                    </View>
                    <View style={styles.watchBtn}><Text style={styles.watchTxt}>Voir</Text></View>
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 60 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14 },
  h1: { color: C.ink, fontSize: 30, fontWeight: '500', fontFamily: F.serif },
  h1sub: { color: C.faint, fontSize: 12.5, marginTop: 2, fontFamily: F.sans },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.coral, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 9, ...softShadow },
  newBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: F.sans },

  scroll: { paddingHorizontal: 18, paddingBottom: 36 },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginTop: 22, marginBottom: 11, fontFamily: F.sans },

  card: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 18, backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line, marginBottom: 9 },
  liveCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 18, backgroundColor: C.liveTint, borderWidth: 1, borderColor: C.liveBorder, marginBottom: 9, ...softShadow },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: C.ink, fontSize: 14.5, fontWeight: '600', fontFamily: F.sans },
  cardMeta: { color: C.faint, fontSize: 12.5, marginTop: 2, fontFamily: F.sans },

  liveDotWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  liveDotRing: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: C.live, opacity: 0.25 },
  liveDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.live },
  liveMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveMeta: { color: C.liveSoft, fontSize: 12.5, fontWeight: '600', fontFamily: F.sans },
  arenaTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.coral, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  arenaTagTxt: { color: '#fff', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5, fontFamily: F.sans },
  joinBtn: { backgroundColor: C.live, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9 },
  joinTxt: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: F.sans },
  watchBtn: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 8 },
  watchTxt: { color: C.coral, fontSize: 13, fontWeight: '600', fontFamily: F.sans },

  emptyMark: { width: 64, height: 64, borderRadius: 22, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', ...softShadow },
  emptyTitle: { color: C.ink, fontSize: 19, fontWeight: '600', marginTop: 18, fontFamily: F.sans },
  emptySub: { color: C.muted, fontSize: 13.5, textAlign: 'center', marginTop: 6, fontFamily: F.sans },
});
