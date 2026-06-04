import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';
import { fetchLives, fetchStats, type Live, type Stats } from '@/lib/liri-api';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pad = (n: number) => String(n).padStart(2, '0');

const TENANT = 'Isna';
const euros = (cents?: number) =>
  `${Math.round((cents ?? 0) / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;

const QUICK: { label: string; icon: React.ComponentProps<typeof Feather>['name']; hero?: boolean; badge?: number; to: string }[] = [
  { label: 'Démarrer', icon: 'video', hero: true, to: '/lives' },
  { label: 'Rejoindre', icon: 'log-in', to: '/lives' },
  { label: 'Converser', icon: 'message-square', to: '/brain' },
  { label: 'Programmer', icon: 'calendar', to: '/lives' },
  { label: 'SmartBoard', icon: 'pen-tool', to: '/studio' },
  { label: 'Acheter', icon: 'shopping-bag', to: '/reglages' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours();
  const greet = h < 6 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  const timeStr = `${pad(h)}:${pad(now.getMinutes())}`;
  const dateLabel = useMemo(() => `${JOURS[now.getDay()]} ${now.getDate()} ${MOIS[now.getMonth()]}`, [now]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [lives, setLives] = useState<Live[]>([]);
  useEffect(() => {
    let active = true;
    fetchStats().then((s) => active && setStats(s));
    fetchLives().then((l) => active && setLives(l));
    return () => {
      active = false;
    };
  }, []);

  const liveNow = useMemo(() => lives.find((l) => l.started_at && !l.ended_at) ?? null, [lives]);
  const upcoming = useMemo(
    () =>
      lives
        .filter((l) => !l.started_at && l.scheduled_at && new Date(l.scheduled_at) > now)
        .sort((a, b) => +new Date(a.scheduled_at as string) - +new Date(b.scheduled_at as string))
        .slice(0, 4),
    [lives, now],
  );
  const whenLabel = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return d.toDateString() === now.toDateString()
      ? `aujourd'hui · ${t}`
      : `${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4)}. · ${t}`;
  };
  const tagLabel = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const tmr = new Date(now);
    tmr.setDate(now.getDate() + 1);
    return d.toDateString() === tmr.toDateString() ? 'Demain' : `${d.getDate()}/${pad(d.getMonth() + 1)}`;
  };
  const statCards: { v: string; l: string; coral?: boolean }[] = [
    { v: stats ? String(stats.totalLives) : '—', l: 'lives' },
    { v: stats ? String(stats.totalMembers) : '—', l: 'membres' },
    { v: stats ? String(stats.totalCourses) : '—', l: 'cours' },
    { v: stats ? euros(stats.totalRevenueCents) : '—', l: 'revenus', coral: true },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.row}>
            <View style={styles.logoMark}><Feather name="zap" size={15} color="#fff" /></View>
            <Text style={styles.logoText}>LIRI</Text>
          </View>
          <View style={styles.row}>
            <Pressable style={styles.iconBtn} hitSlop={8}>
              <Feather name="bell" size={18} color={C.muted} />
              <View style={styles.bellDot} />
            </Pressable>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>IS</Text></View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── GREETING ── */}
          <Text style={styles.dateLabel}>{dateLabel.toUpperCase()} · {timeStr}</Text>
          <Text style={styles.greet}>{greet}<Text style={styles.greetAccent}> sur LIRI</Text></Text>
          <Text style={styles.sub}>Que voulez-vous lancer aujourd&apos;hui&nbsp;?</Text>

          {/* ── COMMAND BAR → Brain ── */}
          <Pressable style={({ pressed }) => [styles.cmdBar, pressed && styles.pressed]} onPress={() => router.push('/brain')}>
            <View style={styles.cmdSpark}><Feather name="zap" size={17} color={C.coral} /></View>
            <Text style={styles.cmdText}>Demandez à LIRI ou lancez une action…</Text>
            <Feather name="mic" size={16} color={C.faint} style={{ marginRight: 6 }} />
            <View style={styles.cmdSend}><Feather name="arrow-up" size={17} color="#fff" /></View>
          </Pressable>

          {/* ── ACTIONS RAPIDES ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow} contentContainerStyle={styles.quickContent}>
            {QUICK.map((q) => (
              <Pressable key={q.label} style={styles.quickItem} onPress={() => router.push(q.to as never)}>
                <View style={[styles.quickIcon, q.hero ? styles.quickHero : styles.quickPanel]}>
                  <Feather name={q.icon} size={q.hero ? 26 : 24} color={q.hero ? '#fff' : C.coral} />
                  {q.badge ? <View style={styles.quickBadge}><Text style={styles.quickBadgeTxt}>{q.badge}</Text></View> : null}
                </View>
                <Text style={[styles.quickLabel, q.hero && { color: C.ink }]}>{q.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ── EN DIRECT ── */}
          {liveNow ? (
            <>
              <Text style={styles.section}>EN DIRECT</Text>
              <Pressable style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]} onPress={() => router.push('/lives')}>
                <View style={styles.liveDotWrap}>
                  <View style={styles.liveDotRing} />
                  <View style={styles.liveDot} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.liveTitle} numberOfLines={1}>{liveNow.title || 'Session live'}</Text>
                  <Text style={styles.liveMeta}>en cours maintenant</Text>
                </View>
                <View style={styles.liveJoin}><Text style={styles.liveJoinTxt}>Rejoindre</Text></View>
              </Pressable>
            </>
          ) : null}

          {/* ── À VENIR ── */}
          <Text style={styles.section}>À VENIR</Text>
          {upcoming.length > 0 ? (
            <View style={{ gap: 8 }}>
              {upcoming.map((l) => (
                <Pressable key={l.id} style={({ pressed }) => [styles.upCard, pressed && styles.pressed]} onPress={() => router.push('/lives')}>
                  <View style={styles.upIcon}><Feather name="clock" size={16} color={C.coral} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.upTitle} numberOfLines={1}>{l.title || 'Session live'}</Text>
                    <Text style={styles.upMeta}>{whenLabel(l.scheduled_at)} · {l.price_cents ? euros(l.price_cents) : 'gratuit'}</Text>
                  </View>
                  <View style={styles.upTag}><Text style={styles.upTagTxt}>{tagLabel(l.scheduled_at)}</Text></View>
                  <Feather name="chevron-right" size={18} color={C.faint} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}><Text style={styles.emptyTxt}>Aucun live programmé pour le moment.</Text></View>
          )}

          {/* ── CE MOIS ── */}
          <Text style={styles.section}>CE MOIS</Text>
          <View style={styles.statGrid}>
            {statCards.map((s) => (
              <View key={s.l} style={styles.statCard}>
                <Text style={[styles.statValue, s.coral && { color: C.coral }]}>{s.v}</Text>
                <Text style={styles.statLabel}>{s.l}</Text>
              </View>
            ))}
          </View>

          {/* ── BRAIN CTA ── */}
          <Pressable style={({ pressed }) => [styles.brainCta, pressed && styles.pressed]} onPress={() => router.push('/brain')}>
            <View style={styles.brainIcon}><Feather name="zap" size={17} color={C.coral} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brainTitle}>Demander à LIRI Brain</Text>
              <Text style={styles.brainSub}>cours, stats, base de connaissances…</Text>
            </View>
            <Feather name="chevron-right" size={18} color={C.faint} />
          </Pressable>

          <Text style={styles.footer}>Connecté · {TENANT} · LIRI v2.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.7 },

  // header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.rail,
  },
  logoMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: C.ink, fontSize: 18, fontWeight: '700', letterSpacing: 0.5, fontFamily: F.sans },
  iconBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: C.coral },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: F.sans },

  // scroll
  scroll: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 36 },

  // greeting
  dateLabel: { color: C.faint, fontSize: 11.5, fontWeight: '600', letterSpacing: 2, textAlign: 'center', fontFamily: F.sans },
  greet: { color: C.ink, fontSize: 33, lineHeight: 40, fontWeight: '500', textAlign: 'center', marginTop: 8, fontFamily: F.serif },
  greetAccent: { color: C.coral, fontFamily: F.serif },
  sub: { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 6, fontFamily: F.sans },

  // command bar
  cmdBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22,
    height: 56, borderRadius: 18, backgroundColor: C.panel,
    borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, ...softShadow,
  },
  cmdSpark: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  cmdText: { flex: 1, color: C.muted, fontSize: 14, fontFamily: F.sans },
  cmdSend: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },

  // quick actions
  quickRow: { marginTop: 26, marginHorizontal: -18 },
  quickContent: { paddingHorizontal: 18, gap: 18 },
  quickItem: { alignItems: 'center', gap: 9, width: 84 },
  quickIcon: { width: 78, height: 78, borderRadius: 24, alignItems: 'center', justifyContent: 'center', ...softShadow },
  quickHero: { backgroundColor: C.coral },
  quickPanel: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  quickLabel: { color: C.muted, fontSize: 12.5, fontWeight: '500', fontFamily: F.sans },
  quickBadge: { position: 'absolute', top: -4, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  quickBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: F.sans },

  // section heading
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginTop: 30, marginBottom: 11, fontFamily: F.sans },

  // live card
  liveCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18,
    backgroundColor: C.liveTint, borderWidth: 1, borderColor: C.liveBorder, ...softShadow,
  },
  liveDotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  liveDotRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: C.live, opacity: 0.3 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.live },
  liveTitle: { color: C.ink, fontSize: 14.5, fontWeight: '600', fontFamily: F.sans },
  liveMeta: { color: C.liveSoft, fontSize: 12, fontWeight: '600', marginTop: 2, fontFamily: F.sans },
  liveJoin: { backgroundColor: C.live, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 8 },
  liveJoinTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700', fontFamily: F.sans },

  // upcoming
  upCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 18,
    backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line,
  },
  upIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  upTitle: { color: C.ink, fontSize: 14, fontWeight: '600', fontFamily: F.sans },
  upMeta: { color: C.faint, fontSize: 12, marginTop: 2, fontFamily: F.sans },
  upTag: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  upTagTxt: { color: C.muted, fontSize: 10.5, fontWeight: '700', fontFamily: F.sans },

  // empty state
  emptyCard: { padding: 16, borderRadius: 18, backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line },
  emptyTxt: { color: C.faint, fontSize: 13, fontFamily: F.sans },

  // stats grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47.8%', flexGrow: 1, padding: 15, borderRadius: 18,
    backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line,
  },
  statValue: { color: C.ink, fontSize: 22, fontWeight: '500', fontFamily: F.serif },
  statLabel: { color: C.faint, fontSize: 11.5, marginTop: 3, fontFamily: F.sans },

  // brain CTA
  brainCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, marginTop: 18,
    backgroundColor: C.coralTint2, borderWidth: 1, borderColor: 'rgba(217,119,87,0.25)',
  },
  brainIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(217,119,87,0.16)', alignItems: 'center', justifyContent: 'center' },
  brainTitle: { color: C.ink, fontSize: 13.5, fontWeight: '600', fontFamily: F.sans },
  brainSub: { color: C.faint, fontSize: 11.5, marginTop: 2, fontFamily: F.sans },

  footer: { color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 26, fontFamily: F.sans },
});
