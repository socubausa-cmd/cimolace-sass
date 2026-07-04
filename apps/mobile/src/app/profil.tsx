import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';

import { useAuth } from '@/lib/auth';
import { useStudentProgress } from '@/features/eleve/useStudentProgress';

// Palette « élève » officielle (cf. eleveMobileScreensShared.js)
const EV = {
  bg: '#0B0B0F',
  card: '#16161E',
  muted: '#8E8E93',
  accent: '#7B61FF',
  lavender: '#C4B5FD',
  line: 'rgba(255,255,255,0.08)',
  ink: '#FFFFFF',
  v1: '#7C3AED',
  v2: '#6D28D9',
};

type IconName = React.ComponentProps<typeof Feather>['name'];

const MENU: { to: string; title: string; sub: string; icon: IconName; color: string; badge?: string }[] = [
  { to: '/reglages', title: 'Informations personnelles', sub: 'Gère ton profil et tes informations', icon: 'user', color: '#A78BFA' },
  { to: '/engines', title: 'Mes statistiques', sub: 'Découvre ton évolution', icon: 'bar-chart-2', color: '#34D399' },
  { to: '/bibliotheque', title: 'Téléchargements', sub: 'Cours, fiches et ressources', icon: 'download', color: '#FBBF24' },
  { to: '/formations', title: 'Mes formations', sub: 'Modules, leçons et progression', icon: 'book-open', color: '#38BDF8' },
  { to: '/ma-classe', title: 'Ma classe', sub: 'Promotion et camarades', icon: 'users', color: '#34D399' },
  { to: '/calendrier-annuel', title: 'Calendrier annuel', sub: 'Programme et périodes scolaires', icon: 'calendar', color: '#FBBF24' },
  { to: '/rendez-vous', title: 'Rendez-vous', sub: 'Contacter le secrétariat', icon: 'clock', color: '#FB7185' },
  { to: '/commerce', title: 'Forfaits', sub: 'Abonnement par cycle', icon: 'layers', color: '#E879F9' },
  { to: '/neuro-recall', title: 'Neuron (mémoire IA)', sub: 'Ton assistant intelligent', icon: 'cpu', color: '#A78BFA', badge: 'NOUVEAU' },
];

function ProgressRing({ pct }: { pct: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <View style={st.ringWrap}>
      <Svg viewBox="0 0 100 100" width={86} height={86} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="pf" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={EV.v1} />
            <Stop offset="1" stopColor={EV.v2} />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={7} fill="none" />
        <Circle cx="50" cy="50" r={r} stroke="url(#pf)" strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={`${dash} ${c - dash}`} />
      </Svg>
      <View style={st.ringCenter}><Text style={st.ringPct}>{Math.round(pct)}%</Text></View>
    </View>
  );
}

function Hexagon({ grad, children }: { grad: [string, string]; children: React.ReactNode }) {
  return (
    <View style={st.hexWrap}>
      <Svg width={48} height={48} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`hex-${grad[0]}-${grad[1]}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={grad[0]} />
            <Stop offset="1" stopColor={grad[1]} />
          </LinearGradient>
        </Defs>
        <Polygon points="30,0 70,0 100,50 70,100 30,100 0,50" fill={`url(#hex-${grad[0]}-${grad[1]})`} />
      </Svg>
      <View style={st.hexCenter}>{children}</View>
    </View>
  );
}

type Achievement = { id: string; title: string; sub: string; xp: string; grad: [string, string]; tone: string; top: React.ReactNode };

function computeAchievements(p: { streak: number; completedLessons: number; totalTimeMinutes: number; xp: number }): Achievement[] {
  const out: Achievement[] = [];
  if (p.streak >= 7) out.push({ id: 'streak7', title: 'Semaine de feu 🔥', sub: `${p.streak} jours d'affilée`, xp: '15 XP', grad: ['#7C3AED', '#D946EF'], tone: '#A78BFA', top: <Text style={st.hexTxt}>{p.streak}</Text> });
  else if (p.streak >= 3) out.push({ id: 'streak3', title: 'En route 🚀', sub: `${p.streak} jours d'affilée`, xp: '5 XP', grad: ['#8B5CF6', '#6366F1'], tone: '#A78BFA', top: <Text style={st.hexTxt}>{p.streak}</Text> });
  if (p.completedLessons >= 10) out.push({ id: 'c10', title: 'Apprenti assidu', sub: `${p.completedLessons} cours terminés`, xp: '20 XP', grad: ['#10B981', '#0D9488'], tone: '#34D399', top: <Feather name="book-open" size={16} color="#fff" /> });
  else if (p.completedLessons >= 1) out.push({ id: 'c1', title: 'Premier cours ✅', sub: `${p.completedLessons} cours terminé${p.completedLessons > 1 ? 's' : ''}`, xp: '10 XP', grad: ['#10B981', '#06B6D4'], tone: '#34D399', top: <Feather name="book-open" size={16} color="#fff" /> });
  if (p.totalTimeMinutes >= 60) out.push({ id: 't60', title: 'Focus master', sub: `${Math.round(p.totalTimeMinutes / 60)}h de contenu`, xp: '15 XP', grad: ['#0EA5E9', '#6366F1'], tone: '#38BDF8', top: <Feather name="target" size={16} color="#fff" /> });
  if (p.xp >= 100) out.push({ id: 'xp100', title: 'Cent XP', sub: `${p.xp} XP cumulés`, xp: '25 XP', grad: ['#F59E0B', '#EA580C'], tone: '#FBBF24', top: <Feather name="star" size={16} color="#fff" /> });
  return out;
}

export default function ProfilScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const user = session?.user;
  const progress = useStudentProgress(user?.id);

  const fullName = (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'Élève';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const school = (user?.user_metadata?.school as string) || 'ISNA / PRORASCIENCE';
  const classLabel = (user?.user_metadata?.class as string) || 'Élève LIRI';
  const initials = useMemo(
    () => String(fullName).split(/\s+/).map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'É',
    [fullName],
  );

  const has = progress.hasRealData;
  const statSuivis = has ? progress.distinctCourses : 0;
  const statDone = has ? progress.completedLessons : 0;
  const statStreak = has ? progress.streak : 0;
  const statXp = has ? progress.xp : 0;
  const level = has ? progress.level : 1;
  const nextXp = has ? progress.nextLevelXp : 100;
  const chDone = has ? progress.completedLessons : 0;
  const chTotal = has ? (progress.completedLessons + progress.inProgressLessons) || 1 : 1;
  const globalPct = has && chTotal > 0 ? Math.min(100, Math.round((chDone / chTotal) * 100)) : 0;
  const achievements = useMemo(
    () => computeAchievements({ streak: statStreak, completedLessons: statDone, totalTimeMinutes: progress.totalTimeMinutes || 0, xp: statXp }),
    [statStreak, statDone, progress.totalTimeMinutes, statXp],
  );

  const onMenu = (to: string) => router.push(to as never);
  const logout = async () => {
    try { await signOut(); } finally { router.replace('/'); }
  };

  return (
    <View style={st.root}>
      <SafeAreaView edges={['top']} style={st.safe}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={st.header}>
            <View>
              <Text style={st.kicker}>LIRI</Text>
              <Text style={st.h1}>Profil</Text>
              <Text style={st.h1sub}>Ton espace personnel</Text>
            </View>
            <View style={st.headerBtns}>
              <Pressable style={st.iconBtn} onPress={() => router.push('/notifications')}><Feather name="bell" size={18} color="#fff" /></Pressable>
              <Pressable style={st.iconBtn} onPress={() => router.push('/reglages')}><Feather name="settings" size={18} color="#fff" /></Pressable>
            </View>
          </View>

          {/* Hero */}
          <View style={st.hero}>
            <View style={st.heroLeft}>
              <View style={st.avatarRing}>
                <View style={st.avatar}>
                  {avatarUrl ? <Image source={{ uri: avatarUrl }} style={st.avatarImg} /> : <Text style={st.avatarTxt}>{initials}</Text>}
                </View>
              </View>
              <View style={st.heroInfo}>
                <Text style={st.name} numberOfLines={1}>{fullName}</Text>
                <View style={st.roleBadge}><Feather name="award" size={11} color={EV.lavender} /><Text style={st.roleTxt}>Élève</Text></View>
                <View style={st.schoolRow}><Feather name="home" size={12} color="#fff" /><Text style={st.school} numberOfLines={1}>{school}</Text></View>
                <Text style={st.class}>{classLabel}</Text>
              </View>
            </View>
            <View style={st.levelBox}>
              <Text style={st.levelLabel}>Niveau</Text>
              <Text style={st.levelN}>{level}</Text>
              <Text style={st.levelNext}>Prochain</Text>
              <Text style={st.levelXp}>{nextXp} XP</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={st.statsRow}>
            <Stat icon="book-open" label="Cours suivis" value={statSuivis} color="#7C3AED" />
            <Stat icon="check-circle" label="Terminés" value={statDone} color="#22C55E" />
            <Stat icon="zap" label="Jours" value={statStreak} color="#F97316" />
            <Stat icon="award" label="Points XP" value={statXp} color="#3B82F6" />
          </View>

          {/* Progrès global */}
          <Text style={st.section}>TON PROGRÈS GLOBAL</Text>
          <View style={st.progressCard}>
            <ProgressRing pct={globalPct} />
            <View style={st.progressMid}>
              <Text style={st.progressTitle}>Très bon travail ! 🚀</Text>
              <Text style={st.progressSub}>Tu es sur la bonne voie.</Text>
              <Text style={st.progressChapters}>{chDone} / {chTotal} chapitres</Text>
            </View>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.25)" />
          </View>

          {/* Réalisations */}
          <Text style={st.section}>RÉALISATIONS RÉCENTES</Text>
          {achievements.length === 0 ? (
            <View style={st.emptyAch}>
              <Feather name="award" size={22} color="rgba(167,139,250,0.4)" />
              <Text style={st.emptyAchTxt}>Termine ton premier cours pour débloquer des réalisations.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.achRow}>
              {achievements.map((a) => (
                <View key={a.id} style={st.achCard}>
                  <Hexagon grad={a.grad}>{a.top}</Hexagon>
                  <Text style={st.achTitle} numberOfLines={2}>{a.title}</Text>
                  <Text style={st.achSub} numberOfLines={1}>{a.sub}</Text>
                  <Text style={[st.achXp, { color: a.tone }]}>{a.xp}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Menu */}
          <View style={st.menu}>
            {MENU.map((m, i) => (
              <Pressable key={m.title} style={({ pressed }) => [st.menuRow, i > 0 && st.menuDivider, pressed && st.pressed]} onPress={() => onMenu(m.to)}>
                <Feather name={m.icon} size={24} color={m.color} />
                <View style={st.menuMid}>
                  <View style={st.menuTitleRow}>
                    <Text style={st.menuTitle}>{m.title}</Text>
                    {m.badge ? <View style={st.menuBadge}><Text style={st.menuBadgeTxt}>{m.badge}</Text></View> : null}
                  </View>
                  <Text style={st.menuSub}>{m.sub}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9ca3af" />
              </Pressable>
            ))}
          </View>

          <Pressable style={({ pressed }) => [st.logout, pressed && st.pressed]} onPress={logout}>
            <Feather name="log-out" size={16} color="#FB7185" />
            <Text style={st.logoutTxt}>Se déconnecter</Text>
          </Pressable>
          <Text style={st.footer}>LIRI · Profil élève</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon, label, value, color }: { icon: IconName; label: string; value: number; color: string }) {
  return (
    <View style={st.statPill}>
      <View style={st.statIcon}><Feather name={icon} size={16} color={color} /></View>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: EV.bg },
  safe: { flex: 1 },
  pressed: { opacity: 0.7 },
  scroll: { padding: 16, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  kicker: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  h1: { color: EV.ink, fontSize: 24, fontWeight: '800', marginTop: 2 },
  h1sub: { color: EV.muted, fontSize: 13, marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: EV.line, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },

  hero: { flexDirection: 'row', gap: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(165,180,252,0.18)', backgroundColor: 'rgba(20,20,34,0.6)', padding: 14, marginBottom: 16 },
  heroLeft: { flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  avatarRing: { width: 84, height: 84, borderRadius: 42, padding: 2.5, backgroundColor: EV.accent },
  avatar: { flex: 1, borderRadius: 40, backgroundColor: '#0B0B15', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 24, fontWeight: '800' },
  heroInfo: { flex: 1, minWidth: 0, paddingTop: 2 },
  name: { color: EV.ink, fontSize: 17, fontWeight: '800' },
  roleBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)', backgroundColor: '#1a0f2e', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  roleTxt: { color: '#EDE9FE', fontSize: 9.5, fontWeight: '700' },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  school: { color: '#fff', fontSize: 12, fontWeight: '500', flex: 1 },
  class: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  levelBox: { width: '30%', maxWidth: 110, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)', backgroundColor: '#12101a', paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  levelLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '500' },
  levelN: { color: EV.ink, fontSize: 34, fontWeight: '800', lineHeight: 38 },
  levelNext: { color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '500', marginTop: 4 },
  levelXp: { color: '#fff', fontSize: 11, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  statPill: { flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(165,180,252,0.14)', backgroundColor: 'rgba(20,24,32,0.7)', paddingVertical: 12, paddingHorizontal: 4 },
  statIcon: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { color: EV.ink, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 8.5, fontWeight: '600', textTransform: 'uppercase', marginTop: 3, textAlign: 'center' },

  section: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 10 },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(165,180,252,0.18)', backgroundColor: 'rgba(22,24,40,0.7)', padding: 14, marginBottom: 18 },
  ringWrap: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringPct: { color: EV.ink, fontSize: 20, fontWeight: '800' },
  progressMid: { flex: 1, minWidth: 0 },
  progressTitle: { color: EV.ink, fontSize: 14, fontWeight: '700' },
  progressSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  progressChapters: { color: '#A78BFA', fontSize: 11.5, fontWeight: '600', marginTop: 6 },

  emptyAch: { alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', paddingVertical: 20, paddingHorizontal: 16, marginBottom: 18 },
  emptyAchTxt: { color: EV.muted, fontSize: 12.5, textAlign: 'center' },
  achRow: { gap: 10, paddingBottom: 4, marginBottom: 14 },
  achCard: { width: 150, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(165,180,252,0.14)', backgroundColor: 'rgba(22,24,34,0.8)', padding: 12 },
  hexWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  hexCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hexTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  achTitle: { color: EV.ink, fontSize: 12.5, fontWeight: '700', lineHeight: 16 },
  achSub: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 },
  achXp: { fontSize: 10.5, fontWeight: '800', marginTop: 8 },

  menu: { marginTop: 4, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(165,180,252,0.16)', backgroundColor: 'rgba(18,20,32,0.8)', overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  menuDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  menuMid: { flex: 1, minWidth: 0 },
  menuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuTitle: { color: EV.ink, fontSize: 15, fontWeight: '600' },
  menuBadge: { backgroundColor: '#2563EB', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  menuBadgeTxt: { color: '#fff', fontSize: 7, fontWeight: '800', letterSpacing: 0.5 },
  menuSub: { color: EV.muted, fontSize: 12, marginTop: 2 },

  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.06)', paddingVertical: 14 },
  logoutTxt: { color: 'rgba(253,164,175,0.9)', fontSize: 14, fontWeight: '500' },
  footer: { color: 'rgba(255,255,255,0.3)', fontSize: 11.5, textAlign: 'center', marginTop: 20 },
});
