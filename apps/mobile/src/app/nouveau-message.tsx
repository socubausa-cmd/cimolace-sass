import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { getCommunityMembers, sendDirectMessage, type CommunityMember } from '@/lib/community-api';
import { useTheme } from '@/lib/theme';

const memberName = (member: CommunityMember) => member.full_name || member.email?.split('@')[0] || 'Membre';

export default function NewMessageScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => styles(C), [C]);
  const [members, setMembers] = useState<CommunityMember[] | null>(null);
  const [selected, setSelected] = useState<CommunityMember | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCommunityMembers().then(setMembers).catch((e) => setError(e instanceof Error ? e.message : 'Annuaire indisponible.'));
  }, []);
  const filtered = (members ?? []).filter((member) =>
    `${memberName(member)} ${member.email ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const send = async () => {
    if (!selected || !message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendDirectMessage(selected.user_id, message.trim());
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message non envoyé.');
      setSending(false);
    }
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}><Feather name="chevron-left" size={25} color={C.ink} /></Pressable>
          <Text style={s.title}>Nouveau message</Text>
        </View>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.search}>
            <Feather name="search" size={16} color={C.faint} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un destinataire" placeholderTextColor={C.faint} style={s.searchInput} />
          </View>
          {members === null && !error ? <ActivityIndicator color={C.coral} style={s.loader} /> : (
            <ScrollView style={s.flex} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
              {filtered.map((member) => {
                const active = selected?.user_id === member.user_id;
                return (
                  <Pressable key={member.user_id} onPress={() => setSelected(member)} style={[s.member, active && s.memberActive]}>
                    <View style={s.avatar}><Text style={s.avatarText}>{memberName(member).slice(0, 2).toUpperCase()}</Text></View>
                    <View style={s.memberBody}>
                      <Text style={s.name}>{memberName(member)}</Text>
                      <Text style={s.email}>{member.email || member.role || 'Membre'}</Text>
                    </View>
                    {active ? <Feather name="check-circle" size={20} color={C.coral} /> : null}
                  </Pressable>
                );
              })}
              {members && filtered.length === 0 ? <Text style={s.empty}>Aucun membre trouvé.</Text> : null}
            </ScrollView>
          )}
          <View style={s.composer}>
            {selected ? <Text style={s.to}>À : {memberName(selected)}</Text> : <Text style={s.to}>Choisis un destinataire</Text>}
            <TextInput value={message} onChangeText={setMessage} placeholder="Ton message…" placeholderTextColor={C.faint} style={s.message} multiline />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable onPress={send} disabled={!selected || !message.trim() || sending} style={[s.button, (!selected || !message.trim() || sending) && s.disabled]}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Envoyer</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base }, safe: { flex: 1 }, flex: { flex: 1 },
  header: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  title: { color: C.ink, fontFamily: F.serif, fontWeight: '600', fontSize: 21 },
  search: { margin: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: C.panel, paddingHorizontal: 13, borderWidth: 1, borderColor: C.line },
  searchInput: { flex: 1, height: 44, color: C.ink, fontFamily: F.sans }, loader: { marginTop: 36 },
  list: { paddingHorizontal: 12, paddingBottom: 16 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: 'transparent' },
  memberActive: { backgroundColor: C.coralTint, borderColor: C.coral },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.coral, fontWeight: '800', fontSize: 13 }, memberBody: { flex: 1 },
  name: { color: C.ink, fontFamily: F.sans, fontWeight: '700', fontSize: 14 },
  email: { color: C.faint, fontFamily: F.sans, fontSize: 12, marginTop: 2 }, empty: { color: C.faint, textAlign: 'center', marginTop: 30 },
  composer: { padding: 14, borderTopWidth: 1, borderTopColor: C.line },
  to: { color: C.muted, fontFamily: F.sans, fontWeight: '600', fontSize: 13, marginBottom: 8 },
  message: { minHeight: 70, maxHeight: 130, textAlignVertical: 'top', borderRadius: 14, backgroundColor: C.panel, color: C.ink, padding: 12, fontFamily: F.sans },
  error: { color: C.liveSoft, fontSize: 12, marginTop: 7 },
  button: { height: 48, borderRadius: 15, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontFamily: F.sans, fontWeight: '800' }, disabled: { opacity: 0.4 },
});
