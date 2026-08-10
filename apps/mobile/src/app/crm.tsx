import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';
import {
  createCrmContact, fetchCrmActivities, fetchCrmContacts, fetchCrmSummary,
  type CrmActivity, type CrmContact,
} from '@/lib/liri-api';

const ON_CORAL = '#1c1a18'; // texte lisible sur pastille corail (sombre ET crème)

type Tab = 'contacts' | 'activity';
const nameOf = (c: CrmContact) => (c.full_name || c.name || c.email || 'Contact').trim();
const initials = (str: string) => str.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '•';
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v)) || 0;

const ACTIVITY_LABEL: Record<string, string> = {
  contact_created: 'Nouveau contact', cagnotte_donation: 'Don reçu',
  deal_won: 'Vente gagnée', deal_lost: 'Vente perdue', appointment: 'Rendez-vous',
  message_sent: 'Message envoyé', note: 'Note',
};

export default function CrmScreen() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [tab, setTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<CrmContact[] | null>(null);
  const [activities, setActivities] = useState<CrmActivity[] | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  const load = useCallback(async (search?: string) => {
    const [c, a, sum] = await Promise.all([
      fetchCrmContacts(search), fetchCrmActivities(), fetchCrmSummary(),
    ]);
    setContacts(c); setActivities(a); setSummary(sum);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Recherche debouncée (400 ms).
  useEffect(() => {
    const t = setTimeout(() => { void fetchCrmContacts(query).then(setContacts); }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(query); setRefreshing(false);
  }, [load, query]);

  const submitNew = useCallback(async () => {
    const { firstName, lastName, email, phone } = form;
    if (!firstName.trim() && !lastName.trim() && !email.trim()) {
      Alert.alert('Contact', 'Indique au moins un nom ou un e-mail.');
      return;
    }
    setSaving(true);
    const created = await createCrmContact({
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    setSaving(false);
    if (created) {
      setShowNew(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '' });
      setTab('contacts');
      await load();
    } else {
      Alert.alert('Contact', "Création impossible. Vérifie ta connexion et réessaie.");
    }
  }, [form, load]);

  const stats = useMemo(() => {
    const sm = summary ?? {};
    return [
      { label: 'Contacts', value: num(sm.contacts ?? sm.contacts_count ?? (contacts?.length ?? 0)) },
      { label: 'Sociétés', value: num(sm.companies ?? sm.companies_count) },
      { label: 'Deals', value: num(sm.deals ?? sm.deals_count ?? sm.open_deals) },
    ];
  }, [summary, contacts]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>CRM</Text>
          <Text style={s.sub}>{"Tes contacts et l'activité de l'écosystème."}</Text>
        </View>
        <Pressable style={s.newBtn} onPress={() => setShowNew(true)}>
          <Feather name="user-plus" size={15} color={ON_CORAL} />
          <Text style={s.newBtnTxt}>Nouveau</Text>
        </Pressable>
      </View>

      {/* Chiffres-clés */}
      <View style={s.statsRow}>
        {stats.map((st) => (
          <View key={st.label} style={s.stat}>
            <Text style={s.statVal}>{st.value}</Text>
            <Text style={s.statLbl}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Onglets */}
      <View style={s.tabs}>
        {(['contacts', 'activity'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtOn]}>{t === 'contacts' ? 'Contacts' : 'Activité'}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'contacts' && (
        <View style={s.searchWrap}>
          <Feather name="search" size={15} color={C.faint} />
          <TextInput
            value={query} onChangeText={setQuery} placeholder="Rechercher un contact…"
            placeholderTextColor={C.faint} style={s.search} autoCapitalize="none" autoCorrect={false}
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />}
      >
        {tab === 'contacts' ? (
          contacts === null ? (
            <View style={s.center}><ActivityIndicator color={C.coral} /></View>
          ) : contacts.length === 0 ? (
            <Empty icon="users" text="Aucun contact." s={s} C={C} />
          ) : (
            contacts.map((c) => {
              const nm = nameOf(c);
              return (
                <View key={c.id} style={s.item}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{initials(nm)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{nm}</Text>
                    {!!c.company_name && <Text style={s.meta} numberOfLines={1}>{c.company_name}</Text>}
                    {!!c.email && <Text style={s.meta} numberOfLines={1}>{c.email}</Text>}
                    {!!c.source && <View style={s.srcPill}><Text style={s.srcTxt}>{c.source}</Text></View>}
                  </View>
                  <View style={s.contactActs}>
                    {!!c.email && (
                      <Pressable style={s.round} onPress={() => void Linking.openURL(`mailto:${c.email}`)}>
                        <Feather name="mail" size={15} color={C.ink} />
                      </Pressable>
                    )}
                    {!!c.phone && (
                      <Pressable style={s.round} onPress={() => void Linking.openURL(`tel:${c.phone}`)}>
                        <Feather name="phone" size={15} color={C.ink} />
                      </Pressable>
                    )}
                    {!!c.phone && (
                      <Pressable style={s.round} onPress={() => void Linking.openURL(`https://wa.me/${String(c.phone).replace(/\D/g, '')}`)}>
                        <Feather name="message-circle" size={15} color={C.ink} />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )
        ) : activities === null ? (
          <View style={s.center}><ActivityIndicator color={C.coral} /></View>
        ) : activities.length === 0 ? (
          <Empty icon="activity" text="Aucune activité récente." s={s} C={C} />
        ) : (
          activities.map((a) => (
            <View key={a.id} style={s.actItem}>
              <View style={s.actDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.actTitle}>{a.title || ACTIVITY_LABEL[a.type ?? ''] || a.type || 'Activité'}</Text>
                {!!a.description && <Text style={s.meta} numberOfLines={2}>{a.description}</Text>}
                {!!a.created_at && (
                  <Text style={s.actDate}>{new Date(a.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Création d'un contact — POST /crm/contacts */}
      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
          <Pressable style={s.modalBackdrop} onPress={() => setShowNew(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Nouveau contact</Text>
              <Pressable onPress={() => setShowNew(false)} hitSlop={10}><Feather name="x" size={20} color={C.muted} /></Pressable>
            </View>
            <View style={s.row2}>
              <TextInput style={[s.field, { flex: 1 }]} placeholder="Prénom" placeholderTextColor={C.faint}
                value={form.firstName} onChangeText={(v) => setForm((p) => ({ ...p, firstName: v }))} />
              <TextInput style={[s.field, { flex: 1 }]} placeholder="Nom" placeholderTextColor={C.faint}
                value={form.lastName} onChangeText={(v) => setForm((p) => ({ ...p, lastName: v }))} />
            </View>
            <TextInput style={s.field} placeholder="E-mail" placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} />
            <TextInput style={s.field} placeholder="Téléphone" placeholderTextColor={C.faint} keyboardType="phone-pad"
              value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} />
            <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={() => void submitNew()}>
              {saving ? <ActivityIndicator color={ON_CORAL} /> : <Text style={s.saveTxt}>Créer le contact</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Empty({ icon, text, s, C }: { icon: React.ComponentProps<typeof Feather>['name']; text: string; s: ReturnType<typeof makeStyles>; C: LiriPalette }) {
  return (
    <View style={s.empty}>
      <Feather name={icon} size={28} color={C.faint} />
      <Text style={s.emptyTxt}>{text}</Text>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.base },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.coral, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 2 },
  newBtnTxt: { color: ON_CORAL, fontSize: 13, fontWeight: '700', fontFamily: F.sans },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34, gap: 12, borderWidth: 1, borderColor: C.line },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { color: C.ink, fontSize: 18, fontWeight: '700', fontFamily: F.serif },
  row2: { flexDirection: 'row', gap: 10 },
  field: { backgroundColor: C.base, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, color: C.ink, fontSize: 14.5, fontFamily: F.sans },
  saveBtn: { backgroundColor: C.coral, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveTxt: { color: ON_CORAL, fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },
  h1: { color: C.ink, fontSize: 26, fontWeight: '700', letterSpacing: -0.3, fontFamily: F.serif },
  sub: { color: C.muted, fontSize: 13.5, marginTop: 2, fontFamily: F.sans },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  stat: { flex: 1, backgroundColor: C.panelTint, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 13, alignItems: 'center' },
  statVal: { color: C.ink, fontSize: 22, fontWeight: '700', fontFamily: F.sans },
  statLbl: { color: C.muted, fontSize: 11.5, marginTop: 2, fontFamily: F.sans },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line },
  tabOn: { backgroundColor: C.coral, borderColor: C.coral },
  tabTxt: { color: C.muted, fontSize: 13, fontWeight: '600', fontFamily: F.sans },
  tabTxtOn: { color: ON_CORAL },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: C.panelTint, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  search: { flex: 1, color: C.ink, fontSize: 14.5, padding: 0, fontFamily: F.sans },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  list: { paddingHorizontal: 16, paddingTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  emptyTxt: { color: C.faint, fontSize: 14, fontFamily: F.sans },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panelTint, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.coral, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  name: { color: C.ink, fontSize: 15, fontWeight: '600', fontFamily: F.sans },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 1, fontFamily: F.sans },
  srcPill: { alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: C.coralTint2 },
  srcTxt: { color: C.muted, fontSize: 10.5, fontWeight: '600', fontFamily: F.sans },
  contactActs: { flexDirection: 'row', gap: 7 },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line },
  actItem: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  actDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral, marginTop: 6 },
  actTitle: { color: C.ink, fontSize: 14.5, fontWeight: '600', fontFamily: F.sans },
  actDate: { color: C.faint, fontSize: 11.5, marginTop: 3, fontFamily: F.sans },
});
