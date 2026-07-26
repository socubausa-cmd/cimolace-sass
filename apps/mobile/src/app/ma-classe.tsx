import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type ClassInfo = { id: string; tenant_id: string; name: string; academic_year: string | null; teacher_id: string | null; school_paths?: { title?: string; name?: string } | null };
type Member = { id: string; student_id: string; joined_at: string; name: string };

export default function MaClasseScreen() {
  const { session } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [info, setInfo] = useState<ClassInfo | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) { setInfo(null); return; }
    setInfo(undefined); setError(null);
    const membership = await supabase.from('school_class_members').select('school_class_id').eq('student_id', uid).maybeSingle();
    if (membership.error) { setError(membership.error.message); setInfo(null); return; }
    if (!membership.data) { setInfo(null); return; }
    const classResult = await supabase.from('school_classes')
      .select('id,tenant_id,name,academic_year,teacher_id,school_paths(title,name)')
      .eq('id', membership.data.school_class_id).single();
    if (classResult.error || !classResult.data) { setError(classResult.error?.message || 'Classe introuvable.'); setInfo(null); return; }
    const classInfo = classResult.data as ClassInfo;
    setInfo(classInfo);
    const memberResult = await supabase.from('school_class_members').select('id,student_id,joined_at')
      .eq('school_class_id', classInfo.id).order('joined_at');
    if (memberResult.error) { setError(memberResult.error.message); return; }
    const ids = (memberResult.data ?? []).map((row) => row.student_id);
    const profiles = ids.length ? await supabase.from('profiles').select('id,name,full_name').in('id', ids) : { data: [], error: null };
    const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || p.name || 'Élève']));
    setMembers((memberResult.data ?? []).map((row) => ({ ...row, name: names.get(row.student_id) || (row.student_id === uid ? 'Moi' : 'Élève') })));
  }, [session?.user.id]);
  useEffect(() => { void load(); }, [load]);

  const path = info?.school_paths && (Array.isArray(info.school_paths) ? info.school_paths[0] : info.school_paths);
  return <View style={s.root}><SafeAreaView edges={['top']} style={s.safe}>
    {info === undefined ? <View style={s.center}><ActivityIndicator color={C.coral} /></View> :
      !info ? <View style={s.center}><View style={s.emptyIcon}><Feather name="users" size={28} color={C.coral} /></View><Text style={s.emptyTitle}>Ma classe</Text><Text selectable style={s.emptyText}>{error || 'Tu n’es pas encore affecté à une classe. Le secrétariat peut t’ajouter à ta promotion.'}</Text></View> :
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scroll}>
        <View><Text style={s.kicker}>LIRI · ÉCOLE</Text><Text style={s.title}>Ma classe</Text></View>
        <View style={s.hero}><View style={s.heroTop}><View><Text selectable style={s.className}>{info.name}</Text><Text selectable style={s.meta}>{info.academic_year || 'Année scolaire en cours'}</Text></View><Feather name="book-open" size={28} color={C.coral} /></View>
          <Text selectable style={s.path}>{path?.title || path?.name || 'Parcours scolaire'}</Text>
          <View style={s.counter}><Feather name="users" size={14} color={C.ink} /><Text style={s.counterText}>{members.length} élève{members.length === 1 ? '' : 's'}</Text></View>
        </View>
        {error ? <Text selectable style={s.error}>{error}</Text> : null}
        <Text style={s.section}>Les membres</Text>
        {members.map((member) => <View key={member.id} style={s.member}>
          <View style={s.avatar}><Text style={s.initials}>{member.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</Text></View>
          <View style={s.memberBody}><Text selectable style={s.memberName}>{member.name}</Text><Text style={s.memberSub}>{member.student_id === session?.user.id ? 'Mon profil' : 'Élève de la promotion'}</Text></View>
          {member.student_id === session?.user.id ? <Feather name="check-circle" size={18} color={C.coral} /> : null}
        </View>)}
      </ScrollView>}
  </SafeAreaView></View>;
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base }, safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  scroll: { padding: 18, paddingBottom: 44, gap: 13 }, kicker: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 }, title: { color: C.ink, fontSize: 27, fontWeight: '800', fontFamily: F.sans },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.coralTint }, emptyTitle: { color: C.ink, fontSize: 19, fontWeight: '800', fontFamily: F.sans }, emptyText: { color: C.muted, textAlign: 'center', lineHeight: 19 },
  hero: { borderWidth: 1, borderColor: C.coral + '4d', backgroundColor: C.panelTint, borderRadius: 20, padding: 17, gap: 10 }, heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  className: { color: C.ink, fontSize: 21, fontWeight: '800', fontFamily: F.sans }, meta: { color: C.muted, fontSize: 12.5, marginTop: 3 }, path: { color: C.coral, fontSize: 13, fontWeight: '700' },
  counter: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, backgroundColor: C.panel, paddingHorizontal: 10, paddingVertical: 6 }, counterText: { color: C.ink, fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  error: { color: C.live, fontSize: 12 }, section: { color: C.ink, fontSize: 17, fontWeight: '800', fontFamily: F.sans },
  member: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 15, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.coralTint }, initials: { color: C.coral, fontWeight: '800', fontSize: 12 },
  memberBody: { flex: 1, gap: 2 }, memberName: { color: C.ink, fontSize: 14, fontWeight: '700' }, memberSub: { color: C.muted, fontSize: 11.5 },
});
