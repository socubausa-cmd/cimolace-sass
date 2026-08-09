import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';
import {
  fetchAdminAppointments, sendRescheduleLink, updateAppointment,
  type AdminAppointment,
} from '@/lib/liri-api';

const ON_CORAL = '#1c1a18'; // texte/icône lisible sur bouton corail (sombre ET crème)

type Tab = 'requested' | 'reported' | 'confirmed' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'requested', label: 'À confirmer' },
  { key: 'reported', label: 'Reportés' },
  { key: 'confirmed', label: 'Confirmés' },
  { key: 'all', label: 'Tous' },
];

const STATUS_LABEL: Record<string, string> = {
  requested: 'À confirmer', confirmed: 'Confirmé', rescheduled: 'Reporté',
  cancelled: 'Annulé', completed: 'Terminé', no_show: 'Absent', reschedule_declined: 'Report refusé',
};

/** Extrait un champ « Label : valeur » des notes de la demande. */
const field = (notes: string | null, label: string): string =>
  (String(notes ?? '').match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i'))?.[1] ?? '').trim();
const emailOf = (notes: string | null): string =>
  (String(notes ?? '').match(/E-?mail\s*:\s*([^\s]+@[^\s]+)/i)?.[1] ?? '').trim();
const waOf = (notes: string | null): string =>
  (String(notes ?? '').match(/WhatsApp\s*:\s*([+0-9 ]{6,})/i)?.[1] ?? '').trim();

const isReported = (a: AdminAppointment): boolean =>
  !!a.reschedule_state || a.status === 'rescheduled' || a.status === 'reschedule_declined';

export default function RdvAdminScreen() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [items, setItems] = useState<AdminAppointment[] | null>(null);
  const [tab, setTab] = useState<Tab>('requested');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchAdminAppointments();
    setItems(data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      requested: list.filter((a) => a.status === 'requested').length,
      reported: list.filter(isReported).length,
      confirmed: list.filter((a) => a.status === 'confirmed').length,
      all: list.length,
    };
  }, [items]);

  const visible = useMemo(() => {
    const list = items ?? [];
    if (tab === 'all') return list;
    if (tab === 'reported') return list.filter(isReported);
    return list.filter((a) => a.status === tab);
  }, [items, tab]);

  const act = async (a: AdminAppointment, kind: 'confirm' | 'reschedule' | 'cancel') => {
    setBusy(a.id); setNote(null);
    let ok = false;
    if (kind === 'confirm') ok = !!(await updateAppointment(a.id, { status: 'confirmed' }));
    else if (kind === 'cancel') ok = !!(await updateAppointment(a.id, { status: 'cancelled' }));
    else ok = !!(await sendRescheduleLink(a.id));
    setBusy(null);
    if (ok) {
      setNote(kind === 'confirm' ? 'Rendez-vous confirmé ✓' : kind === 'cancel' ? 'Rendez-vous annulé' : 'Lien de report envoyé au demandeur');
      await load();
    } else {
      setNote('Action impossible. Réessaie.');
    }
  };

  const confirmThen = (a: AdminAppointment, kind: 'reschedule' | 'cancel') => {
    const label = kind === 'cancel' ? 'Annuler ce rendez-vous ?' : 'Envoyer un lien de report au demandeur ?';
    Alert.alert(label, undefined, [
      { text: 'Retour', style: 'cancel' },
      { text: kind === 'cancel' ? 'Annuler le RDV' : 'Envoyer', style: kind === 'cancel' ? 'destructive' : 'default', onPress: () => void act(a, kind) },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.h1}>Rendez-vous</Text>
        <Text style={s.sub}>Confirme, reporte ou annule les demandes.</Text>
      </View>

      {/* Onglets */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabs}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[s.tab, on && s.tabOn]}>
              <Text style={[s.tabTxt, on && s.tabTxtOn]}>{t.label}</Text>
              <View style={[s.badge, on && s.badgeOn]}><Text style={[s.badgeTxt, on && s.badgeTxtOn]}>{counts[t.key]}</Text></View>
            </Pressable>
          );
        })}
      </ScrollView>

      {note && <View style={s.note}><Text style={s.noteTxt}>{note}</Text></View>}

      {items === null ? (
        <View style={s.center}><ActivityIndicator color={C.coral} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />}
        >
          {visible.length === 0 ? (
            <View style={s.empty}>
              <Feather name="calendar" size={28} color={C.faint} />
              <Text style={s.emptyTxt}>Aucune demande dans cet onglet.</Text>
            </View>
          ) : (
            visible.map((a) => {
              const subject = field(a.notes, 'Sujet') || 'Demande de rendez-vous';
              const email = emailOf(a.notes);
              const wa = waOf(a.notes);
              const desc = field(a.notes, 'Description');
              const when = a.booking_slots?.start_at
                ? new Date(a.booking_slots.start_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
                : 'Créneau non précisé';
              const loading = busy === a.id;
              return (
                <View key={a.id} style={s.item}>
                  <View style={s.itemTop}>
                    <Text style={s.itemTitle} numberOfLines={2}>{subject}</Text>
                    <View style={[s.pill, isReported(a) ? s.pillWarn : a.status === 'confirmed' ? s.pillOk : s.pillNeutral]}>
                      <Text style={s.pillTxt}>{STATUS_LABEL[a.status] ?? a.status}</Text>
                    </View>
                  </View>
                  <View style={s.metaRow}><Feather name="clock" size={13} color={C.faint} /><Text style={s.meta}>{when}</Text></View>
                  {!!email && <View style={s.metaRow}><Feather name="mail" size={13} color={C.faint} /><Text style={s.meta}>{email}</Text></View>}
                  {!!desc && desc !== '—' && <Text style={s.desc} numberOfLines={3}>{desc}</Text>}

                  {/* Contacts rapides */}
                  <View style={s.contactRow}>
                    {!!email && (
                      <Pressable style={s.ghost} onPress={() => void Linking.openURL(`mailto:${email}`)}>
                        <Feather name="mail" size={14} color={C.ink} /><Text style={s.ghostTxt}>Écrire</Text>
                      </Pressable>
                    )}
                    {!!wa && (
                      <Pressable style={s.ghost} onPress={() => void Linking.openURL(`https://wa.me/${wa.replace(/\D/g, '')}`)}>
                        <Feather name="message-circle" size={14} color={C.ink} /><Text style={s.ghostTxt}>WhatsApp</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Actions */}
                  {loading ? (
                    <View style={s.actLoading}><ActivityIndicator color={C.coral} size="small" /></View>
                  ) : (
                    <View style={s.actions}>
                      {a.status !== 'confirmed' && (
                        <Pressable style={[s.btn, s.btnPrimary]} onPress={() => void act(a, 'confirm')}>
                          <Feather name="check" size={15} color={ON_CORAL} /><Text style={s.btnPrimaryTxt}>Confirmer</Text>
                        </Pressable>
                      )}
                      <Pressable style={[s.btn, s.btnGhost]} onPress={() => confirmThen(a, 'reschedule')}>
                        <Feather name="rotate-ccw" size={14} color={C.ink} /><Text style={s.btnGhostTxt}>Reporter</Text>
                      </Pressable>
                      {a.status !== 'cancelled' && (
                        <Pressable style={[s.btn, s.btnGhost]} onPress={() => confirmThen(a, 'cancel')}>
                          <Feather name="x" size={14} color={C.live} /><Text style={[s.btnGhostTxt, { color: C.live }]}>Annuler</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.base },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  h1: { color: C.ink, fontSize: 26, fontWeight: '700', letterSpacing: -0.3, fontFamily: F.serif },
  sub: { color: C.muted, fontSize: 13.5, marginTop: 2, fontFamily: F.sans },
  tabsWrap: { flexGrow: 0 },
  tabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line },
  tabOn: { backgroundColor: C.coral, borderColor: C.coral },
  tabTxt: { color: C.muted, fontSize: 13, fontWeight: '600', fontFamily: F.sans },
  tabTxtOn: { color: ON_CORAL },
  badge: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: C.coralTint2, alignItems: 'center' },
  badgeOn: { backgroundColor: 'rgba(0,0,0,.18)' },
  badgeTxt: { color: C.muted, fontSize: 11, fontWeight: '700', fontFamily: F.sans },
  badgeTxtOn: { color: ON_CORAL },
  note: { marginHorizontal: 16, marginBottom: 4, backgroundColor: C.coralTint, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: C.coral },
  noteTxt: { color: C.coral, fontSize: 13, fontWeight: '600', fontFamily: F.sans },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  emptyTxt: { color: C.faint, fontSize: 14, fontFamily: F.sans },
  item: { backgroundColor: C.panelTint, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 12 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  itemTitle: { flex: 1, color: C.ink, fontSize: 15.5, fontWeight: '700', lineHeight: 20, fontFamily: F.sans },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillTxt: { fontSize: 10.5, fontWeight: '700', color: C.ink, fontFamily: F.sans },
  pillOk: { backgroundColor: 'rgba(108,192,138,.18)' },
  pillWarn: { backgroundColor: 'rgba(224,164,78,.18)' },
  pillNeutral: { backgroundColor: C.coralTint },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  meta: { color: C.muted, fontSize: 12.5, fontFamily: F.sans },
  desc: { color: C.muted, fontSize: 13, marginTop: 8, lineHeight: 18, fontFamily: F.sans },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line },
  ghostTxt: { color: C.ink, fontSize: 12.5, fontWeight: '600', fontFamily: F.sans },
  actLoading: { paddingVertical: 12, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  btnPrimary: { backgroundColor: C.coral },
  btnPrimaryTxt: { color: ON_CORAL, fontSize: 13.5, fontWeight: '700', fontFamily: F.sans },
  btnGhost: { backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line },
  btnGhostTxt: { color: C.ink, fontSize: 13.5, fontWeight: '600', fontFamily: F.sans },
});
