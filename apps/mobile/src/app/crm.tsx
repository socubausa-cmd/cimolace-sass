import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchCrmActivities, fetchCrmContacts, fetchCrmSummary,
  type CrmActivity, type CrmContact,
} from '@/lib/liri-api';

const C = {
  bg: '#262624', card: 'rgba(255,255,255,.045)', cardOn: 'rgba(224,138,95,.12)',
  ink: '#F5F1E9', muted: 'rgba(245,241,233,.62)', faint: 'rgba(245,241,233,.40)',
  line: 'rgba(255,255,255,.09)', coral: '#E08A5F',
};

type Tab = 'contacts' | 'activity';
const nameOf = (c: CrmContact) => (c.full_name || c.name || c.email || 'Contact').trim();
const initials = (s: string) => s.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '•';
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v)) || 0;

const ACTIVITY_LABEL: Record<string, string> = {
  contact_created: 'Nouveau contact', cagnotte_donation: 'Don reçu',
  deal_won: 'Vente gagnée', deal_lost: 'Vente perdue', appointment: 'Rendez-vous',
  message_sent: 'Message envoyé', note: 'Note',
};

export default function CrmScreen() {
  const [tab, setTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<CrmContact[] | null>(null);
  const [activities, setActivities] = useState<CrmActivity[] | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (search?: string) => {
    const [c, a, s] = await Promise.all([
      fetchCrmContacts(search), fetchCrmActivities(), fetchCrmSummary(),
    ]);
    setContacts(c); setActivities(a); setSummary(s);
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

  const stats = useMemo(() => {
    const s = summary ?? {};
    return [
      { label: 'Contacts', value: num(s.contacts ?? s.contacts_count ?? (contacts?.length ?? 0)) },
      { label: 'Sociétés', value: num(s.companies ?? s.companies_count) },
      { label: 'Deals', value: num(s.deals ?? s.deals_count ?? s.open_deals) },
    ];
  }, [summary, contacts]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.h1}>CRM</Text>
        <Text style={s.sub}>{"Tes contacts et l'activité de l'écosystème."}</Text>
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
            <Empty icon="users" text="Aucun contact." />
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
          <Empty icon="activity" text="Aucune activité récente." />
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
    </SafeAreaView>
  );
}

function Empty({ icon, text }: { icon: React.ComponentProps<typeof Feather>['name']; text: string }) {
  return (
    <View style={s.empty}>
      <Feather name={icon} size={28} color={C.faint} />
      <Text style={s.emptyTxt}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  h1: { color: C.ink, fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  sub: { color: C.muted, fontSize: 13.5, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 13, alignItems: 'center' },
  statVal: { color: C.ink, fontSize: 22, fontWeight: '700' },
  statLbl: { color: C.muted, fontSize: 11.5, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  tabOn: { backgroundColor: C.coral, borderColor: C.coral },
  tabTxt: { color: C.muted, fontSize: 13, fontWeight: '600' },
  tabTxtOn: { color: '#1c1a18' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  search: { flex: 1, color: C.ink, fontSize: 14.5, padding: 0 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  list: { paddingHorizontal: 16, paddingTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  emptyTxt: { color: C.faint, fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(224,138,95,.18)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.coral, fontSize: 15, fontWeight: '700' },
  name: { color: C.ink, fontSize: 15, fontWeight: '600' },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 1 },
  srcPill: { alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(245,241,233,.08)' },
  srcTxt: { color: C.muted, fontSize: 10.5, fontWeight: '600' },
  contactActs: { flexDirection: 'row', gap: 7 },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: C.line },
  actItem: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  actDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral, marginTop: 6 },
  actTitle: { color: C.ink, fontSize: 14.5, fontWeight: '600' },
  actDate: { color: C.faint, fontSize: 11.5, marginTop: 3 },
});
