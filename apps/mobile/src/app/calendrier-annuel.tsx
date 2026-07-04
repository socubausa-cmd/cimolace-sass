import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

type CalendarItem = {
  id: string;
  start: string;
  end?: string | null;
  title: string;
  subtitle?: string | null;
  holiday?: boolean;
};

const C = { bg: '#0B0B0F', card: '#16161E', ink: '#FFF', muted: '#92929B', line: 'rgba(255,255,255,.09)', coral: '#E08A5F' };

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

export default function CalendrierAnnuelScreen() {
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const [weeks, events] = await Promise.all([
      supabase
        .from('annual_program_weeks')
        .select('id,week_start,week_end,title,module_title,theme,is_holiday,school_year_calendars!inner(status)')
        .eq('school_year_calendars.status', 'published')
        .gte('week_start', from)
        .lte('week_start', to)
        .order('week_start'),
      supabase
        .from('school_calendar')
        .select('id,title,start_date,end_date,description')
        .gte('start_date', from)
        .lte('start_date', to)
        .order('start_date'),
    ]);
    const rows: CalendarItem[] = [
      ...(weeks.data ?? []).map((row) => ({
        id: `week-${row.id}`,
        start: row.week_start,
        end: row.week_end,
        title: row.title || row.module_title || row.theme || 'Programme pédagogique',
        subtitle: row.module_title || row.theme,
        holiday: Boolean(row.is_holiday),
      })),
      ...(events.data ?? []).map((row) => ({
        id: `event-${row.id}`,
        start: row.start_date,
        end: row.end_date,
        title: row.title,
        subtitle: row.description,
      })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    setItems(rows);
    setError(weeks.error?.message ?? events.error?.message ?? null);
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const result = new Map<string, CalendarItem[]>();
    for (const item of items ?? []) {
      const key = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(`${item.start.slice(0, 10)}T12:00:00`));
      result.set(key, [...(result.get(key) ?? []), item]);
    }
    return [...result.entries()];
  }, [items]);

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <View><Text style={s.kicker}>LIRI · ÉCOLE</Text><Text style={s.title}>Calendrier annuel</Text></View>
          <View style={s.yearPicker}>
            <Pressable accessibilityLabel="Année précédente" onPress={() => setYear((v) => v - 1)}><Feather name="chevron-left" size={20} color={C.ink} /></Pressable>
            <Text style={s.year}>{year}</Text>
            <Pressable accessibilityLabel="Année suivante" onPress={() => setYear((v) => v + 1)}><Feather name="chevron-right" size={20} color={C.ink} /></Pressable>
          </View>
        </View>
        {items === null ? <View style={s.center}><ActivityIndicator color={C.coral} /></View> :
          error ? <View style={s.center}><Text selectable style={s.error}>{error}</Text><Pressable style={s.button} onPress={() => void load()}><Text style={s.buttonText}>Réessayer</Text></Pressable></View> :
          groups.length === 0 ? <View style={s.center}><Feather name="calendar" size={34} color={C.muted} /><Text style={s.empty}>Aucun programme publié pour {year}.</Text></View> :
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scroll}>
            {groups.map(([month, monthItems]) => <View key={month} style={s.group}>
              <Text style={s.month}>{month}</Text>
              {monthItems.map((item) => <View key={item.id} style={s.row}>
                <View style={[s.dateBox, item.holiday && s.holiday]}><Text style={s.date}>{formatDate(item.start)}</Text></View>
                <View style={s.rowBody}><Text selectable style={s.rowTitle}>{item.title}</Text>
                  <Text selectable style={s.rowSub}>{item.holiday ? 'Vacances · ' : ''}{item.subtitle || (item.end && item.end !== item.start ? `Jusqu’au ${formatDate(item.end)}` : 'Évènement scolaire')}</Text>
                </View>
              </View>)}
            </View>)}
          </ScrollView>}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, safe: { flex: 1 },
  header: { paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { color: C.ink, fontSize: 25, fontWeight: '800' },
  yearPicker: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 8 },
  year: { color: C.ink, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  error: { color: '#FB7185', textAlign: 'center' }, empty: { color: C.muted, textAlign: 'center' }, button: { backgroundColor: C.coral, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }, buttonText: { color: '#21140E', fontWeight: '800' },
  scroll: { paddingHorizontal: 18, paddingBottom: 40, gap: 20 }, group: { gap: 8 }, month: { color: C.coral, fontSize: 13, fontWeight: '800', textTransform: 'capitalize', letterSpacing: .5 },
  row: { flexDirection: 'row', gap: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 16, padding: 12 },
  dateBox: { width: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(224,138,95,.12)', borderRadius: 11 }, holiday: { backgroundColor: 'rgba(52,211,153,.13)' },
  date: { color: C.ink, fontWeight: '800', fontSize: 12 }, rowBody: { flex: 1, gap: 3 }, rowTitle: { color: C.ink, fontWeight: '700', fontSize: 14 }, rowSub: { color: C.muted, fontSize: 12, lineHeight: 17 },
});
