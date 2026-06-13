import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { myUserId } from '@/lib/liri-api';
import { supabase } from '@/lib/supabase';

/**
 * Vie scolaire (natif) — hub à onglets : Notes · Absences · Évaluations ·
 * Documents · Agenda. Lecture défensive Supabase (la table peut être absente →
 * état vide, comme les maquettes web). Thème élève violet.
 */
const EV = { bg: '#0B0B0F', card: '#16161E', muted: '#8E8E93', accent: '#7B61FF', line: 'rgba(255,255,255,0.08)', ink: '#FFFFFF' };

type TabKey = 'notes' | 'absences' | 'evaluations' | 'documents' | 'agenda';
type IconName = React.ComponentProps<typeof Feather>['name'];

const TABS: { key: TabKey; label: string; icon: IconName; table: string; color: string; empty: string }[] = [
  { key: 'notes', label: 'Notes', icon: 'bar-chart-2', table: 'grades', color: '#A78BFA', empty: 'Aucune note pour le moment.' },
  { key: 'absences', label: 'Absences', icon: 'user-x', table: 'attendance', color: '#FB7185', empty: 'Aucune absence enregistrée.' },
  { key: 'evaluations', label: 'Évaluations', icon: 'check-square', table: 'evaluations', color: '#34D399', empty: 'Aucune évaluation pour le moment.' },
  { key: 'documents', label: 'Documents', icon: 'folder', table: 'documents', color: '#FBBF24', empty: 'Aucun document disponible.' },
  { key: 'agenda', label: 'Agenda', icon: 'calendar', table: 'agenda_events', color: '#38BDF8', empty: 'Aucun évènement à venir.' },
];

type Row = Record<string, unknown>;

async function fetchTable(table: string): Promise<Row[]> {
  try {
    const uid = await myUserId();
    let q = supabase.from(table).select('*').limit(100);
    if (uid) q = q.eq('user_id', uid);
    const { data, error } = await q;
    if (error || !data) return [];
    return data as Row[];
  } catch {
    return [];
  }
}

const str = (r: Row, keys: string[], fallback = ''): string => {
  for (const k of keys) {
    const v = r[k];
    if (v != null && v !== '') return String(v);
  }
  return fallback;
};

export default function VieScolaireScreen() {
  const [tab, setTab] = useState<TabKey>('notes');
  const [rows, setRows] = useState<Row[] | null>(null);

  const active = useMemo(() => TABS.find((t) => t.key === tab)!, [tab]);

  const load = useCallback(async () => {
    setRows(null);
    setRows(await fetchTable(active.table));
  }, [active.table]);
  useEffect(() => {
    void load();
  }, [load]);

  const list = rows ?? [];

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <Text style={s.kicker}>LIRI · ÉCOLE</Text>
          <Text style={s.h1}>Vie scolaire</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabs}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable key={t.key} style={[s.tab, on && { backgroundColor: t.color + '22', borderColor: t.color }]} onPress={() => setTab(t.key)}>
                <Feather name={t.icon} size={14} color={on ? t.color : EV.muted} />
                <Text style={[s.tabTxt, on && { color: EV.ink }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {rows === null ? (
          <View style={s.fill}><ActivityIndicator color={EV.accent} /></View>
        ) : list.length === 0 ? (
          <View style={s.fill}>
            <View style={[s.emptyMark, { backgroundColor: active.color + '22' }]}><Feather name={active.icon} size={26} color={active.color} /></View>
            <Text style={s.emptyTitle}>{active.label}</Text>
            <Text style={s.emptySub}>{active.empty}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {list.map((r, i) => (
              <View key={(r.id as string) ?? i} style={s.row}>
                <View style={[s.rowIcon, { backgroundColor: active.color + '22' }]}><Feather name={active.icon} size={16} color={active.color} /></View>
                <View style={s.rowMid}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {str(r, ['title', 'subject', 'matiere', 'label', 'name', 'course_id'], active.label)}
                  </Text>
                  <Text style={s.rowSub} numberOfLines={2}>
                    {str(r, ['comment', 'description', 'note', 'status', 'value', 'date', 'created_at'])}
                  </Text>
                </View>
                {str(r, ['grade', 'score', 'value', 'mark']) ? (
                  <Text style={[s.rowVal, { color: active.color }]}>{str(r, ['grade', 'score', 'value', 'mark'])}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: EV.bg },
  safe: { flex: 1 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 80 },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  kicker: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  h1: { color: EV.ink, fontSize: 26, fontWeight: '800', marginTop: 2 },
  tabsWrap: { maxHeight: 56, flexGrow: 0 },
  tabs: { gap: 8, paddingHorizontal: 18, paddingVertical: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: EV.line, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  tabTxt: { color: EV.muted, fontSize: 13, fontWeight: '600' },
  scroll: { paddingHorizontal: 18, paddingBottom: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: EV.line, backgroundColor: EV.card, marginBottom: 9 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1, minWidth: 0 },
  rowTitle: { color: EV.ink, fontSize: 14.5, fontWeight: '700' },
  rowSub: { color: EV.muted, fontSize: 12.5, marginTop: 2 },
  rowVal: { fontSize: 18, fontWeight: '800' },
  emptyMark: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: EV.ink, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { color: EV.muted, fontSize: 13.5, textAlign: 'center', marginTop: 6 },
});
