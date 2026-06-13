import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';

type IconName = React.ComponentProps<typeof Feather>['name'];
interface Tool {
  icon: IconName;
  title: string;
  sub: string;
  to?: string;
  soon?: boolean;
}

/** Studio — porté du portail web (vue Studio) : les 9 outils de création. */
const TOOLS: Tool[] = [
  { icon: 'book-open', title: 'Créer une formation', sub: 'Titre, description, catégorie', to: '/creer-formation' },
  { icon: 'zap', title: 'Masterclass IA', sub: 'Génère une masterclass depuis un texte', to: '/creer-masterclass' },
  { icon: 'flag', title: 'Arena — Débat', sub: 'Lance un débat structuré en direct', to: '/creer-arena' },
  { icon: 'film', title: 'Live Immersif', sub: 'Démarre une session live', to: '/lives' },
  { icon: 'pen-tool', title: 'SmartBoard', sub: 'Tableau interactif, croquis & formules IA', to: '/smartboard' },
  { icon: 'layers', title: 'Neuro Recall', sub: 'Révision espacée — cartes mémoire IA', to: '/neuro-recall' },
  { icon: 'file-text', title: 'MasterScript', sub: 'Lecteur de masterclass chapitré', to: '/masterscript' },
  { icon: 'image', title: 'Studio Image', sub: 'Génération visuelle & couvertures IA', soon: true },
  { icon: 'upload', title: 'Import IA', sub: 'PDF, vidéo, doc → contenu structuré', soon: true },
  { icon: 'download', title: 'Export Center', sub: '5 formats — PDF, SCORM, vidéo…', soon: true },
];

export default function StudioScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView style={styles.flex1} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Studio</Text>
          <Text style={styles.h1sub}>Préparez et créez vos contenus — propulsé par l&apos;IA.</Text>

          {/* Hero — démarrer un live */}
          <Pressable style={({ pressed }) => [styles.hero, pressed && styles.pressed]} onPress={() => router.push('/lives')}>
            <View style={styles.heroIcon}><Feather name="video" size={24} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Démarrer un live</Text>
              <Text style={styles.heroSub}>Lancez une session en direct avec vos élèves</Text>
            </View>
            <Feather name="arrow-up-right" size={20} color="#fff" />
          </Pressable>

          {/* Grille d'outils */}
          <View style={styles.grid}>
            {TOOLS.map((t) => (
              <Pressable
                key={t.title}
                style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
                onPress={() => t.to && router.push(t.to as never)}
              >
                <View style={styles.toolIcon}><Feather name={t.icon} size={20} color={C.coral} /></View>
                <Text style={styles.toolTitle}>{t.title}</Text>
                <Text style={styles.toolSub}>{t.sub}</Text>
                {t.soon ? (
                  <View style={styles.soon}><Text style={styles.soonTxt}>Bientôt</Text></View>
                ) : (
                  <View style={styles.go}><Feather name="arrow-right" size={14} color={C.coral} /></View>
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 36 },

  h1: { color: C.ink, fontSize: 30, fontWeight: '500', fontFamily: F.serif },
  h1sub: { color: C.muted, fontSize: 13.5, lineHeight: 20, marginTop: 6, marginBottom: 20, fontFamily: F.sans },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, backgroundColor: C.coral, marginBottom: 18, ...softShadow },
  heroIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '700', fontFamily: F.sans },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, marginTop: 3, fontFamily: F.sans },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  tool: { width: '47.7%', flexGrow: 1, minHeight: 142, padding: 15, borderRadius: 20, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, ...softShadow },
  toolIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  toolTitle: { color: C.ink, fontSize: 15, fontWeight: '600', fontFamily: F.sans },
  toolSub: { color: C.faint, fontSize: 12, lineHeight: 16, marginTop: 3, fontFamily: F.sans },
  soon: { alignSelf: 'flex-start', marginTop: 11, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.line },
  soonTxt: { color: C.faint, fontSize: 10.5, fontWeight: '700', fontFamily: F.sans },
  go: { marginTop: 11, width: 26, height: 26, borderRadius: 9, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
});
