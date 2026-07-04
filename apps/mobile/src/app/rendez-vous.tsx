import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Appointment = { id: string; status: string; notes: string | null; created_at: string; booking_slots?: { start_at?: string; end_at?: string; title?: string } | null };
const C = { bg: '#262624', card: 'rgba(255,255,255,.045)', ink: '#F5F1E9', muted: 'rgba(245,241,233,.62)', line: 'rgba(255,255,255,.09)', coral: '#E08A5F' };
const statusLabel: Record<string, string> = { requested: 'Demandé', confirmed: 'Confirmé', scheduled: 'Planifié', rescheduled: 'Replanifié', completed: 'Terminé', cancelled: 'Annulé', no_show: 'Absent' };

export default function RendezVousScreen() {
  const { session, email } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) { setAppointments([]); return; }
    const { data, error } = await supabase.from('appointments')
      .select('id,status,notes,created_at,booking_slots(start_at,end_at,title)')
      .eq('student_id', session.user.id).order('created_at', { ascending: false }).limit(30);
    setAppointments((data as Appointment[] | null) ?? []);
    if (error) setMessage(error.message);
  }, [session?.user.id]);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (subject.trim().length < 3) { setMessage('Indique un sujet d’au moins 3 caractères.'); return; }
    if (!email) { setMessage('Ton compte doit avoir une adresse e-mail.'); return; }
    setSending(true); setMessage(null);
    const { data, error } = await supabase.functions.invoke('liri-appointment-request', {
      body: { subject: subject.trim(), description: details.trim(), email, whatsapp: whatsapp.trim() },
    });
    setSending(false);
    if (error || !data?.ok) { setMessage(error?.message || data?.error || 'Envoi impossible.'); return; }
    setSubject(''); setDetails(''); setWhatsapp(''); setMessage('Demande transmise au secrétariat.');
    await load();
  };

  return <View style={s.root}><SafeAreaView edges={['top']} style={s.safe}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
      <View><Text style={s.kicker}>LIRI · ÉCOLE</Text><Text style={s.title}>Rendez-vous</Text><Text style={s.lead}>Demande un entretien au secrétariat, puis suis son statut ici.</Text></View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Nouvelle demande</Text>
        <TextInput value={subject} onChangeText={setSubject} placeholder="Sujet de l’entretien" placeholderTextColor={C.muted} style={s.input} />
        <TextInput value={details} onChangeText={setDetails} placeholder="Détails (facultatif)" placeholderTextColor={C.muted} multiline style={[s.input, s.multiline]} />
        <TextInput value={whatsapp} onChangeText={setWhatsapp} placeholder="WhatsApp (facultatif)" placeholderTextColor={C.muted} keyboardType="phone-pad" style={s.input} />
        <Pressable disabled={sending} style={[s.cta, sending && { opacity: .6 }]} onPress={() => void submit()}>
          {sending ? <ActivityIndicator color="#21140E" /> : <><Feather name="send" size={15} color="#21140E" /><Text style={s.ctaText}>Transmettre</Text></>}
        </Pressable>
        {message ? <Text selectable style={s.message}>{message}</Text> : null}
      </View>
      <Text style={s.section}>Mes demandes</Text>
      {appointments === null ? <ActivityIndicator color={C.coral} /> : appointments.length === 0 ? <Text style={s.empty}>Aucune demande pour le moment.</Text> :
        appointments.map((item) => {
          const slot = Array.isArray(item.booking_slots) ? item.booking_slots[0] : item.booking_slots;
          return <View key={item.id} style={s.appt}>
            <View style={s.apptIcon}><Feather name="calendar" size={17} color={C.coral} /></View>
            <View style={s.apptBody}><Text selectable style={s.apptTitle}>{slot?.title || item.notes || 'Demande de rendez-vous'}</Text>
              <Text selectable style={s.apptSub}>{slot?.start_at ? new Date(slot.start_at).toLocaleString('fr-FR') : `Envoyée le ${new Date(item.created_at).toLocaleDateString('fr-FR')}`}</Text>
            </View>
            <Text style={s.status}>{statusLabel[item.status] || item.status}</Text>
          </View>;
        })}
    </ScrollView>
  </SafeAreaView></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, safe: { flex: 1 }, scroll: { padding: 18, paddingBottom: 44, gap: 16 },
  kicker: { color: C.coral, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 }, title: { color: C.ink, fontSize: 27, fontWeight: '800' }, lead: { color: C.muted, fontSize: 13, marginTop: 5, lineHeight: 19 },
  card: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 18, padding: 14, gap: 10 }, cardTitle: { color: C.ink, fontSize: 16, fontWeight: '800' },
  input: { color: C.ink, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: 'rgba(0,0,0,.12)', paddingHorizontal: 13, paddingVertical: 11, fontSize: 14 }, multiline: { minHeight: 76, textAlignVertical: 'top' },
  cta: { minHeight: 44, borderRadius: 12, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, ctaText: { color: '#21140E', fontWeight: '800' }, message: { color: C.coral, fontSize: 12.5 },
  section: { color: C.ink, fontSize: 17, fontWeight: '800' }, empty: { color: C.muted, textAlign: 'center', paddingVertical: 22 },
  appt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 15 },
  apptIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(224,138,95,.13)', alignItems: 'center', justifyContent: 'center' }, apptBody: { flex: 1, gap: 3 },
  apptTitle: { color: C.ink, fontSize: 13.5, fontWeight: '700' }, apptSub: { color: C.muted, fontSize: 11.5 }, status: { color: C.coral, fontSize: 11, fontWeight: '800' },
});
