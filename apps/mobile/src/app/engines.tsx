import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';
import {
  CATEGORY_LABEL,
  ENGINES,
  STATUS_META,
  parityStats,
  type EngineCategory,
} from '@/lib/engines';

/**
 * Hub ORCHESTRATEUR — vue unique de tous les moteurs LIRI et de leur parité
 * native (source : src/lib/engines.ts). Permet de naviguer vers chaque moteur
 * déjà porté et de suivre ce qui reste à faire.
 */
export default function EnginesHub() {
  const router = useRouter();
  const stats = parityStats();
  const pct = Math.round(((stats.done + stats.partial * 0.5) / stats.total) * 100);

  const byCategory = useMemo(() => {
    const cats = Array.from(new Set(ENGINES.map((e) => e.category))) as EngineCategory[];
    return cats.map((cat) => ({ cat, items: ENGINES.filter((e) => e.category === cat) }));
  }, []);

  const open = (route?: string, label?: string) => {
    if (route) router.push(route as never);
    else Alert.alert('Bientôt', `${label} : moteur en cours de portage natif.`);
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <Text style={s.h1}>Moteurs LIRI</Text>
          <Text style={s.h1sub}>Parité native · {pct}%</Text>
        </View>

        <View style={s.statsRow}>
          <Stat n={stats.done} label="Natif" color={STATUS_META.done.color} />
          <Stat n={stats.partial} label="Partiel" color={STATUS_META.partial.color} />
          <Stat n={stats.todo} label="À faire" color={STATUS_META.todo.color} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {byCategory.map(({ cat, items }) => (
            <View key={cat}>
              <Text style={s.section}>{CATEGORY_LABEL[cat].toUpperCase()}</Text>
              {items.map((e) => {
                const meta = STATUS_META[e.status];
                return (
                  <Pressable
                    key={e.key}
                    style={({ pressed }) => [s.row, pressed && s.pressed]}
                    onPress={() => open(e.route, e.label)}
                  >
                    <View style={s.iconBox}><Feather name={e.icon} size={18} color={C.coral} /></View>
                    <View style={s.rowMid}>
                      <Text style={s.rowTitle} numberOfLines={1}>{e.label}</Text>
                      {e.gap ? <Text style={s.rowGap} numberOfLines={1}>{e.gap}</Text> : null}
                    </View>
                    <View style={[s.chip, { borderColor: meta.color }]}>
                      <View style={[s.chipDot, { backgroundColor: meta.color }]} />
                      <Text style={[s.chipTxt, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {e.route ? <Feather name="chevron-right" size={16} color={C.faint} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Text style={s.footer}>Orchestrateur de portage · src/lib/engines.ts</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statN, { color }]}>{n}</Text>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  pressed: { opacity: 0.7 },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  h1: { color: C.ink, fontSize: 28, fontWeight: '700', fontFamily: F.serif },
  h1sub: { color: C.faint, fontSize: 13, marginTop: 2, fontFamily: F.sans },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 8 },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: C.panelTint, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 12 },
  statN: { fontSize: 22, fontWeight: '800', fontFamily: F.sans },
  statL: { color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2, fontFamily: F.sans },
  scroll: { paddingHorizontal: 18, paddingBottom: 36 },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginTop: 20, marginBottom: 9, fontFamily: F.sans },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line, marginBottom: 8 },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1, minWidth: 0 },
  rowTitle: { color: C.ink, fontSize: 14.5, fontWeight: '600', fontFamily: F.sans },
  rowGap: { color: C.faint, fontSize: 11.5, marginTop: 2, fontFamily: F.sans },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipTxt: { fontSize: 10.5, fontWeight: '700', fontFamily: F.sans },
  footer: { color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 24, fontFamily: F.sans },
});
