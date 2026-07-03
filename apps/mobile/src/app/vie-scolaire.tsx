import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { myUserId } from '@/lib/liri-api';
import { supabase } from '@/lib/supabase';

/**
 * Vie scolaire (natif) — hub à onglets : Notes · Absences · Évaluations ·
 * Documents · Agenda. Les requêtes reprennent les contrats utilisés par le web
 * afin qu'un même enregistrement soit visible sur les deux plateformes.
 */
// Palette alignée sur la charte chaude du portail (fond #262624, accent coral
// #d97757) — plus de violet/navy hors-thème (directive « tout chaud », zéro fuite).
const EV = { bg: '#262624', card: '#2e2b28', muted: '#a8a29a', accent: '#d97757', line: 'rgba(245,244,238,0.08)', ink: '#FFFFFF' };

type TabKey = 'notes' | 'absences' | 'evaluations' | 'documents' | 'agenda';
type IconName = React.ComponentProps<typeof Feather>['name'];

const TABS: { key: TabKey; label: string; icon: IconName; color: string; empty: string }[] = [
  { key: 'notes', label: 'Notes', icon: 'bar-chart-2', color: '#d97757', empty: 'Aucune note pour le moment.' },
  { key: 'absences', label: 'Absences', icon: 'user-x', color: '#d46a5f', empty: 'Aucune absence enregistrée.' },
  { key: 'evaluations', label: 'Évaluations', icon: 'check-square', color: '#c98b6a', empty: 'Aucune évaluation pour le moment.' },
  { key: 'documents', label: 'Documents', icon: 'folder', color: '#d99a6a', empty: 'Aucun document disponible.' },
  { key: 'agenda', label: 'Agenda', icon: 'calendar', color: '#e0926a', empty: 'Aucun évènement à venir.' },
];

type Row = Record<string, unknown>;
type FetchResult = { rows: Row[]; error: string | null };

async function fetchTab(tab: TabKey): Promise<FetchResult> {
  try {
    const uid = await myUserId();
    if (!uid) return { rows: [], error: 'Connectez-vous pour consulter vos données scolaires.' };

    if (tab === 'notes' || tab === 'evaluations') {
      const { data, error } = await supabase
        .from('student_evaluations')
        .select('id,title,score,max_score,evaluated_at,formation_id,comment')
        .eq('student_id', uid)
        .order('evaluated_at', { ascending: false })
        .limit(200);
      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          date: row.evaluated_at,
          value: `${row.score ?? 0}/${row.max_score ?? 20}`,
        })),
        error: error?.message ?? null,
      };
    }

    if (tab === 'absences') {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id,status,attendance_date,note')
        .eq('student_id', uid)
        .in('status', ['absent', 'late', 'excused'])
        .order('attendance_date', { ascending: false })
        .limit(200);
      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          title: row.status === 'late' ? 'Retard' : row.status === 'excused' ? 'Absence justifiée' : 'Absence',
          date: row.attendance_date,
        })),
        error: error?.message ?? null,
      };
    }

    if (tab === 'documents') {
      const [certificates, reports] = await Promise.all([
        supabase
          .from('certificates')
          .select('id,title,file_url,issued_at')
          .eq('student_id', uid)
          .order('issued_at', { ascending: false }),
        supabase
          .from('student_live_reports')
          .select('id,report_text,created_at')
          .eq('student_id', uid)
          .order('created_at', { ascending: false }),
      ]);
      return {
        rows: [
          ...(certificates.data ?? []).map((row) => ({ ...row, date: row.issued_at })),
          ...(reports.data ?? []).map((row) => ({
            ...row,
            title: 'Rapport de session',
            description: row.report_text,
            date: row.created_at,
          })),
        ],
        error: certificates.error?.message ?? reports.error?.message ?? null,
      };
    }

    const fromIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const [events, calendar, weeks] = await Promise.all([
      supabase
        .from('school_events')
        .select('id,title,start_at,end_at,location,description,target_role')
        .in('target_role', ['all', 'student'])
        .gte('start_at', fromIso)
        .order('start_at', { ascending: true })
        .limit(100),
      supabase
        .from('school_calendar')
        .select('id,title,start_date,end_date,description')
        .gte('end_date', fromIso.slice(0, 10))
        .order('start_date', { ascending: true })
        .limit(200),
      supabase
        .from('annual_program_weeks')
        .select('id,week_start,week_end,title,module_title,theme,is_holiday,school_year_calendars!inner(status)')
        .eq('school_year_calendars.status', 'published')
        .gte('week_start', fromIso.slice(0, 10))
        .order('week_start', { ascending: true })
        .limit(60),
    ]);
    return {
      rows: [
        ...(events.data ?? []).map((row) => ({ ...row, date: row.start_at })),
        ...(calendar.data ?? []).map((row) => ({ ...row, date: row.start_date })),
        ...(weeks.data ?? []).map((row) => ({
          ...row,
          title: row.title || row.module_title || row.theme || 'Programme pédagogique',
          date: row.week_start,
        })),
      ].sort((a, b) => +new Date(String(a.date)) - +new Date(String(b.date))),
      error: events.error?.message ?? calendar.error?.message ?? weeks.error?.message ?? null,
    };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Chargement impossible.' };
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const active = useMemo(() => TABS.find((t) => t.key === tab)!, [tab]);

  const load = useCallback(async () => {
    setRows(null);
    setErrorMessage(null);
    const result = await fetchTab(active.key);
    setRows(result.rows);
    setErrorMessage(result.error);
  }, [active.key]);
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
        ) : errorMessage ? (
          <View style={s.fill}>
            <View style={[s.emptyMark, { backgroundColor: '#d46a5f22' }]}><Feather name="alert-triangle" size={26} color="#d46a5f" /></View>
            <Text style={s.emptyTitle}>Données indisponibles</Text>
            <Text style={s.emptySub}>{errorMessage}</Text>
            <Pressable style={s.retry} onPress={() => void load()}><Text style={s.retryTxt}>Réessayer</Text></Pressable>
          </View>
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
  retry: { marginTop: 16, borderRadius: 12, backgroundColor: EV.accent, paddingHorizontal: 18, paddingVertical: 10 },
  retryTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
