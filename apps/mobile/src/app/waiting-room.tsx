import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Salle d'attente (natif) — écran pré-live : briefing, check matériel, chrono
 * avant l'ouverture par le formateur. Navigué via
 * /waiting-room?id=<sessionId>&title=… ; « Rejoindre » → /live-room (élève).
 */
const EV = { bg: '#0B0B0F', card: '#16161E', muted: '#8E8E93', accent: '#7B61FF', line: 'rgba(255,255,255,0.08)', ink: '#FFFFFF', live: '#E2553F' };

const CHECKS = [
  { icon: 'wifi' as const, label: 'Connexion stable', hint: 'Wi-Fi ou 4G recommandé' },
  { icon: 'headphones' as const, label: 'Casque / écouteurs', hint: 'Meilleure qualité audio' },
  { icon: 'mic' as const, label: 'Micro autorisé', hint: 'Pour poser des questions' },
  { icon: 'video' as const, label: 'Caméra (optionnel)', hint: 'Si le formateur le demande' },
];

export default function WaitingRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; title?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const title = typeof params.title === 'string' && params.title ? params.title : 'Session live';
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  const join = () => {
    if (id) router.replace({ pathname: '/live-room', params: { id, role: 'student', title } });
    else router.replace('/lives');
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top', 'bottom']} style={s.safe}>
        <View style={s.top}>
          <View style={s.pulse}><View style={s.pulseRing} /><Feather name="radio" size={30} color={EV.accent} /></View>
          <Text style={s.kicker}>SALLE D’ATTENTE</Text>
          <Text style={s.title} numberOfLines={2}>{title}</Text>
          <Text style={s.sub}>Le formateur va bientôt démarrer la session.</Text>
          <View style={s.timer}><Feather name="clock" size={14} color={EV.muted} /><Text style={s.timerTxt}>En attente · {mm}:{ss}</Text></View>
        </View>

        <View style={s.checks}>
          <Text style={s.checksTitle}>Avant de rejoindre</Text>
          {CHECKS.map((c) => (
            <View key={c.label} style={s.check}>
              <View style={s.checkIcon}><Feather name={c.icon} size={17} color={EV.accent} /></View>
              <View style={s.checkMid}>
                <Text style={s.checkLabel}>{c.label}</Text>
                <Text style={s.checkHint}>{c.hint}</Text>
              </View>
              <Feather name="check-circle" size={18} color="#34D399" />
            </View>
          ))}
        </View>

        <Pressable style={({ pressed }) => [s.joinBtn, pressed && { opacity: 0.85 }]} onPress={join}>
          <Feather name="log-in" size={18} color="#fff" />
          <Text style={s.joinTxt}>Rejoindre maintenant</Text>
        </Pressable>
        <Pressable style={s.leave} onPress={() => (router.canGoBack() ? router.back() : router.replace('/lives'))}>
          <Text style={s.leaveTxt}>Quitter la salle d’attente</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: EV.bg },
  safe: { flex: 1, padding: 24, justifyContent: 'center' },
  top: { alignItems: 'center' },
  pulse: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(123,97,255,0.12)', borderWidth: 1, borderColor: 'rgba(123,97,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: 'rgba(123,97,255,0.25)' },
  kicker: { color: EV.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginTop: 18 },
  title: { color: EV.ink, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  sub: { color: EV.muted, fontSize: 14, textAlign: 'center', marginTop: 8 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  timerTxt: { color: EV.muted, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  checks: { marginTop: 32, borderRadius: 20, borderWidth: 1, borderColor: EV.line, backgroundColor: EV.card, padding: 16 },
  checksTitle: { color: EV.ink, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, marginBottom: 12, textTransform: 'uppercase' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  checkIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(123,97,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  checkMid: { flex: 1, minWidth: 0 },
  checkLabel: { color: EV.ink, fontSize: 14.5, fontWeight: '600' },
  checkHint: { color: EV.muted, fontSize: 12, marginTop: 2 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: EV.accent, borderRadius: 16, paddingVertical: 16, marginTop: 28 },
  joinTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  leave: { alignItems: 'center', paddingVertical: 14 },
  leaveTxt: { color: EV.muted, fontSize: 13.5, fontWeight: '600' },
});
