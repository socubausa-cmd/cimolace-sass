import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

/**
 * Export Center (natif) — sélection du format + lancement. L'UI de sélection est
 * native ; la génération (SCORM/PDF/vidéo) reste pilotée côté serveur
 * (`/liri/export`). Pipeline complet = étape suivante.
 */
type IconName = React.ComponentProps<typeof Feather>['name'];
const FORMATS: { id: string; label: string; desc: string; icon: IconName }[] = [
  { id: 'pdf', label: 'PDF', desc: 'Support imprimable', icon: 'file-text' },
  { id: 'scorm', label: 'SCORM', desc: 'LMS (Moodle, etc.)', icon: 'package' },
  { id: 'video', label: 'Vidéo', desc: 'MP4 du live / cours', icon: 'film' },
  { id: 'epub', label: 'ePub', desc: 'Liseuse', icon: 'book' },
  { id: 'html', label: 'HTML', desc: 'Site autonome', icon: 'code' },
];

export default function ExportScreen() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [sel, setSel] = useState('pdf');
  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.h1}>Export Center</Text>
          <Text style={s.h1sub}>Exporte tes cours et lives dans 5 formats.</Text>
          {FORMATS.map((f) => {
            const on = f.id === sel;
            return (
              <Pressable key={f.id} style={[s.card, on && s.cardOn]} onPress={() => setSel(f.id)}>
                <View style={[s.icon, on && s.iconOn]}><Feather name={f.icon} size={18} color={on ? '#fff' : C.coral} /></View>
                <View style={s.mid}><Text style={s.label}>{f.label}</Text><Text style={s.desc}>{f.desc}</Text></View>
                <Feather name={on ? 'check-circle' : 'circle'} size={20} color={on ? C.coral : C.faint} />
              </Pressable>
            );
          })}
          <Pressable style={[s.cta, s.ctaDisabled]} disabled accessibilityState={{ disabled: true }}>
            <Feather name="clock" size={18} color="#fff" />
            <Text style={s.ctaTxt}>Pipeline {sel.toUpperCase()} à connecter</Text>
          </Pressable>
          <Text style={s.notice}>Aucun export n’est simulé : ce bouton sera activé lorsque le service serveur sera disponible.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  scroll: { padding: 18, paddingBottom: 36 },
  h1: { color: C.ink, fontSize: 26, fontWeight: '700', fontFamily: F.serif },
  h1sub: { color: C.faint, fontSize: 13, marginTop: 4, marginBottom: 18, fontFamily: F.sans },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panelTint, marginBottom: 10 },
  cardOn: { borderColor: C.coral, backgroundColor: C.coralTint },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: C.coral },
  mid: { flex: 1, minWidth: 0 },
  label: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  desc: { color: C.faint, fontSize: 12.5, marginTop: 2, fontFamily: F.sans },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.coral, borderRadius: 16, paddingVertical: 15, marginTop: 12 },
  ctaDisabled: { opacity: 0.55 },
  ctaTxt: { color: '#fff', fontSize: 15.5, fontWeight: '700', fontFamily: F.sans },
  notice: { color: C.faint, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10, fontFamily: F.sans },
});
