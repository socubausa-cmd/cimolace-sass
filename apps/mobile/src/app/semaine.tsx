import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Feather>['name'];

/**
 * MA SEMAINE — la semaine en cours du parcours de l'élève, en natif.
 *
 * Chaîne de données (identique au web `StudentWeeklySchedulePage`) :
 *   profiles.metadata.school_path_id → school_paths → path_courses
 *   → course_modules → module_weeks (triées) → week_days (jour 1..5)
 *   → pedagogical_blocks
 *
 * ⚠️ C'est la structure LEGACY (`course_modules`, pas `modules`) : c'est elle
 * qui porte les parcours hebdomadaires, l'autre porte les formations. Les deux
 * cohabitent, il ne faut pas les confondre.
 */

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

/** Libellés et icônes des types pédagogiques rencontrés en base. */
const BLOCK_META: Record<string, { label: string; icon: IconName }> = {
  opening_live: { label: 'Live d’ouverture', icon: 'video' },
  closure_live: { label: 'Live de clôture', icon: 'video' },
  doctrinal_video: { label: 'Vidéo doctrinale', icon: 'film' },
  previsualisation_video: { label: 'Prévisualisation', icon: 'play-circle' },
  smartboard_session: { label: 'Tableau', icon: 'pen-tool' },
  summary_block: { label: 'Synthèse', icon: 'file-text' },
  mindmap_block: { label: 'Carte mentale', icon: 'share-2' },
  friction_block: { label: 'Friction', icon: 'zap' },
  recall_block: { label: 'Rappel', icon: 'repeat' },
  quiz_block: { label: 'Quiz', icon: 'check-square' },
  experiment_block: { label: 'Expérience', icon: 'compass' },
};
const meta = (type?: string) => BLOCK_META[String(type ?? '')] ?? { label: type ?? 'Bloc', icon: 'circle' as IconName };

type Block = { id: string; type?: string; title?: string; sort_order?: number };
type Day = { id: string; day_number?: number; title?: string; pedagogy_type?: string; pedagogical_blocks?: Block[] } | null;
type Week = { id: string; title?: string; sort_order?: number };

const lundiDe = (d: Date) => {
  const x = new Date(d);
  const delta = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - delta);
  x.setHours(0, 0, 0, 0);
  return x;
};
const semainesEntre = (a: Date, b: Date) => Math.floor((+b - +a) / (7 * 24 * 3600 * 1000));

export default function SemaineScreen() {
  const { session } = useAuth();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [loading, setLoading] = useState(true);
  const [sansParcours, setSansParcours] = useState(false);
  const [pathTitle, setPathTitle] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [index, setIndex] = useState(0);
  const [days, setDays] = useState<Day[]>([null, null, null, null, null]);
  /** Vrai quand le parcours n'a pas de date de début : la semaine « courante »
   *  ne peut alors pas être déduite, on ouvre sur la première. */
  const [sansDate, setSansDate] = useState(false);

  // 1) Parcours de l'élève → semaines triées.
  useEffect(() => {
    let alive = true;
    (async () => {
      const uid = session?.user?.id;
      if (!uid) { setLoading(false); setSansParcours(true); return; }

      const { data: profile } = await supabase.from('profiles').select('metadata').eq('id', uid).maybeSingle();
      const pathId = (profile as { metadata?: { school_path_id?: string } } | null)?.metadata?.school_path_id;
      if (!pathId) { if (alive) { setSansParcours(true); setLoading(false); } return; }

      const { data: path } = await supabase
        .from('school_paths').select('id, title, starts_on').eq('id', pathId).maybeSingle();
      const p = path as { title?: string; starts_on?: string } | null;
      if (!p) { if (alive) { setSansParcours(true); setLoading(false); } return; }

      const { data: pathCourses } = await supabase.from('path_courses').select('course_id').eq('path_id', pathId);
      const courseIds = (pathCourses ?? []).map((c: { course_id?: string }) => c.course_id).filter(Boolean);
      if (!courseIds.length) { if (alive) { setWeeks([]); setLoading(false); } return; }

      const { data: mods } = await supabase
        .from('course_modules').select('id').in('course_id', courseIds).order('order_index', { ascending: true });
      const moduleIds = (mods ?? []).map((m: { id?: string }) => m.id).filter(Boolean);
      if (!moduleIds.length) { if (alive) { setWeeks([]); setLoading(false); } return; }

      const { data: ws } = await supabase
        .from('module_weeks').select('id, title, sort_order').in('module_id', moduleIds)
        .order('sort_order', { ascending: true });
      const list = (ws ?? []) as Week[];

      // Semaine « courante » = nombre de semaines écoulées depuis le début du
      // parcours. Sans date de début, on ne peut rien déduire → première semaine.
      const base = p.starts_on ? lundiDe(new Date(p.starts_on)) : null;
      const naturel = base ? semainesEntre(base, lundiDe(new Date())) : 0;

      if (!alive) return;
      setPathTitle(p.title ?? null);
      setSansDate(!p.starts_on);
      setWeeks(list);
      setIndex(Math.max(0, Math.min(naturel, list.length - 1)));
      setLoading(false);
    })().catch(() => { if (alive) { setLoading(false); setSansParcours(true); } });
    return () => { alive = false; };
  }, [session]);

  // 2) Jours + blocs de la semaine affichée.
  const loadDays = useCallback(async (weekId?: string) => {
    if (!weekId) { setDays([null, null, null, null, null]); return; }
    const { data } = await supabase
      .from('week_days')
      .select('id, day_number, title, pedagogy_type, sort_order, pedagogical_blocks(*)')
      .eq('week_id', weekId)
      .order('day_number', { ascending: true });
    const grid: Day[] = [null, null, null, null, null];
    for (const d of (data ?? []) as NonNullable<Day>[]) {
      const n = Number(d.day_number ?? 0);
      if (n >= 1 && n <= 5) grid[n - 1] = d;
    }
    setDays(grid);
  }, []);

  const week = weeks[index] ?? null;
  useEffect(() => { void loadDays(week?.id); }, [week?.id, loadDays]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={C.coral} /></View>;
  }

  if (sansParcours) {
    return (
      <View style={styles.center}>
        <Feather name="calendar" size={26} color={C.faint} />
        <Text style={styles.emptyTitle}>Aucun parcours assigné</Text>
        <Text style={styles.emptyCopy}>
          Ta semaine s’affichera dès qu’un parcours te sera attribué par l’école.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Ma semaine</Text>
          {pathTitle ? <Text style={styles.sub} numberOfLines={2}>{pathTitle}</Text> : null}

          {/* Navigation de semaine */}
          <View style={styles.weekBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Semaine précédente"
              disabled={index <= 0}
              onPress={() => setIndex((i) => Math.max(0, i - 1))}
              style={({ pressed }) => [styles.navBtn, index <= 0 && styles.navOff, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Feather name="chevron-left" size={18} color={index <= 0 ? C.faint : C.coral} />
            </Pressable>
            <View style={styles.flex1}>
              <Text style={styles.weekTitle} numberOfLines={1}>
                {week?.title || `Semaine ${index + 1}`}
              </Text>
              <Text style={styles.weekMeta}>
                {weeks.length ? `${index + 1} sur ${weeks.length}` : 'aucune semaine'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Semaine suivante"
              disabled={index >= weeks.length - 1}
              onPress={() => setIndex((i) => Math.min(weeks.length - 1, i + 1))}
              style={({ pressed }) => [styles.navBtn, index >= weeks.length - 1 && styles.navOff, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Feather name="chevron-right" size={18} color={index >= weeks.length - 1 ? C.faint : C.coral} />
            </Pressable>
          </View>

          {sansDate ? (
            <View style={styles.notice}>
              <Feather name="info" size={14} color={C.coral} />
              <Text style={styles.noticeTxt}>
                Ce parcours n’a pas de date de début : impossible de savoir où tu en es.
                Tu peux naviguer d’une semaine à l’autre.
              </Text>
            </View>
          ) : null}

          {/* Les cinq jours */}
          {JOURS.map((nom, i) => {
            const d = days[i];
            const blocks = [...(d?.pedagogical_blocks ?? [])]
              .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
            return (
              <View key={nom} style={styles.dayCard}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayName}>{nom}</Text>
                  {d?.pedagogy_type ? (
                    <View style={styles.badge}>
                      <Feather name={meta(d.pedagogy_type).icon} size={11} color={C.coral} />
                      <Text style={styles.badgeTxt}>{meta(d.pedagogy_type).label}</Text>
                    </View>
                  ) : null}
                </View>
                {d?.title ? <Text style={styles.dayTitle}>{d.title}</Text> : null}

                {blocks.length ? blocks.map((b) => (
                  <View key={b.id} style={styles.block}>
                    <Feather name={meta(b.type).icon} size={14} color={C.muted} style={styles.blockIcon} />
                    <View style={styles.flex1}>
                      <Text style={styles.blockTitle} numberOfLines={2}>{b.title || meta(b.type).label}</Text>
                      <Text style={styles.blockType}>{meta(b.type).label}</Text>
                    </View>
                  </View>
                )) : (
                  <Text style={styles.dayEmpty}>
                    {d ? 'Aucune activité pour ce jour.' : 'Journée non programmée.'}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.base, paddingHorizontal: 36, gap: 10 },
  emptyTitle: { color: C.ink, fontSize: 16.5, fontWeight: '700', fontFamily: F.sans, textAlign: 'center' },
  emptyCopy: { color: C.muted, fontSize: 14, lineHeight: 20, fontFamily: F.sans, textAlign: 'center' },

  scroll: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 36 },
  h1: { color: C.ink, fontSize: 30, fontWeight: '500', fontFamily: F.serif },
  sub: { color: C.muted, fontSize: 13.5, marginTop: 3, fontFamily: F.sans },

  weekBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 12,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 15,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line,
  },
  navBtn: {
    width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.base, borderWidth: 1, borderColor: C.line,
  },
  navOff: { opacity: 0.45 },
  weekTitle: { color: C.ink, fontSize: 15, fontWeight: '600', textAlign: 'center', fontFamily: F.sans },
  weekMeta: { color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 1, fontFamily: F.sans },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13,
    backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line,
  },
  noticeTxt: { flex: 1, color: C.muted, fontSize: 12.5, lineHeight: 18, fontFamily: F.sans },

  dayCard: {
    borderRadius: 16, padding: 14, marginBottom: 10,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, ...softShadow,
  },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dayName: { color: C.ink, fontSize: 16, fontWeight: '600', fontFamily: F.serif },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: C.coralTint,
  },
  badgeTxt: { color: C.coral, fontSize: 11, fontWeight: '600', fontFamily: F.sans },
  dayTitle: { color: C.muted, fontSize: 13.5, marginTop: 6, lineHeight: 19, fontFamily: F.sans },
  dayEmpty: { color: C.faint, fontSize: 12.5, marginTop: 8, fontStyle: 'italic', fontFamily: F.sans },

  block: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line,
  },
  blockIcon: { marginTop: 2 },
  blockTitle: { color: C.ink, fontSize: 14, fontWeight: '500', lineHeight: 19, fontFamily: F.sans },
  blockType: { color: C.faint, fontSize: 11.5, marginTop: 2, fontFamily: F.sans },
});
