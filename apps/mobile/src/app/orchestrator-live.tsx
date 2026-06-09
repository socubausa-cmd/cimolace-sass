import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';
import { fetchSmartboardDecks, linkSessionDeck, quickStartLive, type SmartboardDeckSummary } from '@/lib/liri-api';

/**
 * Orchestrateur live (natif) — pilotage des sources d'une session : choisir la
 * source à l'antenne (caméra, smartboard, slides, invités), puis ouvrir la
 * régie. La synchro multi-source temps réel reste branchée côté régie LiveKit.
 */
type IconName = React.ComponentProps<typeof Feather>['name'];
const SOURCES: { id: string; label: string; icon: IconName }[] = [
  { id: 'cam', label: 'Caméra hôte', icon: 'video' },
  { id: 'board', label: 'Smartboard', icon: 'edit-3' },
  { id: 'slides', label: 'Slides', icon: 'layout' },
  { id: 'guests', label: 'Invités', icon: 'users' },
  { id: 'screen', label: 'Partage écran', icon: 'monitor' },
];

export default function OrchestratorLiveScreen() {
  const router = useRouter();
  const [live, setLive] = useState('cam');
  const [starting, setStarting] = useState(false);

  // Decks smartboard générés (Architect / Masterclass) à diffuser.
  const [decks, setDecks] = useState<SmartboardDeckSummary[]>([]);
  const [deckId, setDeckId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    void fetchSmartboardDecks().then((d) => mounted && setDecks(d));
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Démarre une VRAIE session (create + start), puis ouvre la régie avec son id
   * (et le deck choisi → `?deck=`) → la régie se connecte à LiveKit, diffuse la
   * caméra de l'hôte dans la zone caméra et affiche le déroulé du deck. Repli en
   * mode preview si l'API échoue (non connecté / hors-ligne).
   */
  const openRegie = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const session = await quickStartLive('Live LIRI');
      // Persiste le deck sur la session → l'élève le retrouve (parité hôte/élève).
      if (session?.id && deckId) await linkSessionDeck(session.id, deckId);
      const params: Record<string, string> = {};
      if (session?.id) params.id = session.id;
      if (deckId) params.deck = deckId;
      router.push({ pathname: '/live-host', params });
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.h1}>Orchestrateur live</Text>
          <Text style={s.h1sub}>Choisis la source à l&apos;antenne, puis ouvre la régie.</Text>

          <Text style={s.section}>À L&apos;ANTENNE</Text>
          <View style={s.onAir}>
            <View style={s.onAirDot} />
            <Text style={s.onAirTxt}>{SOURCES.find((x) => x.id === live)?.label}</Text>
          </View>

          <Text style={s.section}>SOURCES</Text>
          {SOURCES.map((src) => {
            const on = src.id === live;
            return (
              <Pressable key={src.id} style={[s.src, on && s.srcOn]} onPress={() => setLive(src.id)}>
                <View style={[s.srcIcon, on && s.srcIconOn]}><Feather name={src.icon} size={18} color={on ? '#fff' : C.coral} /></View>
                <Text style={s.srcLabel}>{src.label}</Text>
                {on ? <View style={s.liveTag}><Text style={s.liveTagTxt}>LIVE</Text></View> : <Feather name="play" size={16} color={C.faint} />}
              </Pressable>
            );
          })}

          {/* Déroulé smartboard à diffuser (decks générés). */}
          <Text style={s.section}>DÉROULÉ SMARTBOARD</Text>
          <Pressable
            style={[s.deck, !deckId && s.deckOn]}
            onPress={() => setDeckId(null)}
          >
            <View style={[s.deckIcon, !deckId && s.deckIconOn]}><Feather name="layout" size={16} color={!deckId ? '#fff' : C.coral} /></View>
            <View style={s.flex1}>
              <Text style={s.deckTitle}>Deck d&apos;exemple</Text>
              <Text style={s.deckSub}>Contenu de démonstration</Text>
            </View>
            {!deckId ? <Feather name="check-circle" size={18} color={C.coral} /> : null}
          </Pressable>
          {decks.map((d) => {
            const on = d.id === deckId;
            return (
              <Pressable key={d.id} style={[s.deck, on && s.deckOn]} onPress={() => setDeckId(d.id)}>
                <View style={[s.deckIcon, on && s.deckIconOn]}><Feather name="book-open" size={16} color={on ? '#fff' : C.coral} /></View>
                <View style={s.flex1}>
                  <Text style={s.deckTitle} numberOfLines={1}>{d.title || 'Deck sans titre'}</Text>
                  <Text style={s.deckSub}>{d.status === 'done' ? 'Prêt' : d.status || 'Brouillon'}</Text>
                </View>
                {on ? <Feather name="check-circle" size={18} color={C.coral} /> : null}
              </Pressable>
            );
          })}

          <Pressable
            style={({ pressed }) => [s.cta, (pressed || starting) && { opacity: 0.85 }]}
            onPress={openRegie}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Feather name="radio" size={18} color="#fff" />
            )}
            <Text style={s.ctaTxt}>{starting ? 'Démarrage…' : 'Ouvrir la régie'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  scroll: { padding: 18, paddingBottom: 36 },
  h1: { color: C.ink, fontSize: 26, fontWeight: '700', fontFamily: F.serif },
  h1sub: { color: C.faint, fontSize: 13, marginTop: 4, marginBottom: 16, fontFamily: F.sans },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginTop: 14, marginBottom: 8, fontFamily: F.sans },
  onAir: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: C.liveBorder, backgroundColor: C.liveTint, padding: 14 },
  onAirDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.live },
  onAirTxt: { color: C.ink, fontSize: 16, fontWeight: '700', fontFamily: F.sans },
  src: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panelTint, marginBottom: 9 },
  srcOn: { borderColor: C.coral },
  srcIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  srcIconOn: { backgroundColor: C.coral },
  srcLabel: { color: C.ink, fontSize: 14.5, fontWeight: '600', flex: 1, fontFamily: F.sans },
  flex1: { flex: 1 },
  deck: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panelTint, marginBottom: 9 },
  deckOn: { borderColor: C.coral, backgroundColor: C.coralTint2 },
  deckIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  deckIconOn: { backgroundColor: C.coral },
  deckTitle: { color: C.ink, fontSize: 14.5, fontWeight: '600', fontFamily: F.sans },
  deckSub: { color: C.faint, fontSize: 12, marginTop: 2, fontFamily: F.sans },
  liveTag: { backgroundColor: C.live, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  liveTagTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.coral, borderRadius: 16, paddingVertical: 15, marginTop: 14 },
  ctaTxt: { color: '#fff', fontSize: 15.5, fontWeight: '700', fontFamily: F.sans },
});
