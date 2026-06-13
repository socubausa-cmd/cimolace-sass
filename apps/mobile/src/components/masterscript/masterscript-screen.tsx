import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C } from '@/constants/liri-theme';

import { MasterscriptList } from './masterscript-list';
import { MasterscriptReader } from './masterscript-reader';

/**
 * Moteur « Lecteur Masterclass » (masterscript) — 100% natif, zéro module natif
 * (fonctionne en Expo Go). Aiguille selon ?projectId :
 *   - absent → liste des masterclass (FlatList)
 *   - présent → lecture du projet (accordéon chapitres + progression locale)
 */
export default function MasterscriptScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const id = Array.isArray(projectId) ? projectId[0] : projectId;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {id ? <MasterscriptReader projectId={id} /> : <MasterscriptList />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.base },
});
