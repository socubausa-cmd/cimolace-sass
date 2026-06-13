import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F, softShadow } from '@/constants/liri-theme';
import { fetchApiKeys, type ApiKey } from '@/lib/liri-api';

interface KeyRow {
  value: string;
  meta: string;
  live: boolean;
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function createdLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `créée ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** Mappe une clé API → ligne d'affichage. */
function apiKeyToRow(k: ApiKey): KeyRow {
  const env = (k.environment || '').toLowerCase();
  const live = env === 'live' || env === 'production';
  const masked = k.masked || `${k.prefix ?? 'lk'}_${live ? 'live' : 'test'}_••••••${(k.key_id ?? k.id).slice(-4)}`;
  return { value: masked, meta: live ? createdLabel(k.created_at) : 'test', live };
}

const SDK = `<div id="live"></div>
<script src="https://app.prorascience.org/liri-sdk.js"></script>
<script>
  const liri = LiriSDK.init({ tenant: 'isna' });
  liri.viewer('#live', { session: 'SESSION_ID' });
</script>`;

export default function IntegrationsScreen() {
  const [apiKeys, setApiKeys] = useState<ApiKey[] | null>(null);
  useEffect(() => {
    void fetchApiKeys().then(setApiKeys);
  }, []);
  const loading = apiKeys === null;
  const keys = useMemo<KeyRow[]>(() => (apiKeys ? apiKeys.map(apiKeyToRow) : []), [apiKeys]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.h1}>Intégrations</Text>
          <Text style={styles.h1sub}>SDK · clés API · webhooks · domaines</Text>
        </View>

        <ScrollView style={styles.flex1} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Clés API */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Clés API</Text>
            <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <Text style={styles.ctaTxt}>Générer une clé</Text>
            </Pressable>
          </View>
          <View style={styles.panel}>
            {!loading && keys.length === 0 ? (
              <View style={styles.keyEmpty}>
                <Text style={styles.keyEmptyTxt}>Aucune clé API. Génères-en une pour intégrer LIRI.</Text>
              </View>
            ) : null}
            {keys.map((k, i) => (
              <View key={k.value} style={[styles.keyRow, i > 0 && styles.divider]}>
                <Feather name="key" size={16} color={k.live ? C.coral : C.faint} />
                <Text style={styles.keyCode} numberOfLines={1}>{k.value}</Text>
                <Text style={styles.keyMeta}>{k.meta}</Text>
                <Pressable hitSlop={8}><Text style={styles.keyAction}>Copier</Text></Pressable>
              </View>
            ))}
          </View>

          {/* Webhooks */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Webhooks</Text>
            <Pressable style={({ pressed }) => [styles.ctaGhost, pressed && styles.pressed]}>
              <Text style={styles.ctaGhostTxt}>Ajouter</Text>
            </Pressable>
          </View>
          <View style={styles.panel}>
            <View style={styles.hookRow}>
              <View style={styles.dot} />
              <Text style={styles.hookUrl} numberOfLines={1}>https://isna.app/webhooks/liri</Text>
            </View>
            <View style={styles.hookTags}>
              <View style={styles.tag}><Text style={styles.tagTxt}>session:ended</Text></View>
              <View style={styles.tag}><Text style={styles.tagTxt}>recording.ready</Text></View>
            </View>
          </View>

          {/* SDK */}
          <Text style={[styles.sectionTitle, { marginTop: 22, marginBottom: 8 }]}>SDK — intégrer LIRI</Text>
          <View style={styles.codeBox}>
            <Text style={styles.code}>{SDK}</Text>
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

  header: { paddingHorizontal: 18, paddingTop: 14 },
  h1: { color: C.ink, fontSize: 30, fontWeight: '500', fontFamily: F.serif },
  h1sub: { color: C.muted, fontSize: 13.5, marginTop: 4, fontFamily: F.sans },

  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 36 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 8 },
  sectionTitle: { color: C.faint, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', fontFamily: F.sans },

  cta: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.coral },
  ctaTxt: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: F.sans },
  ctaGhost: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  ctaGhostTxt: { color: C.coral, fontSize: 12, fontWeight: '700', fontFamily: F.sans },

  panel: { borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, padding: 4, ...softShadow },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 13 },
  divider: { borderTopWidth: 1, borderTopColor: C.line },
  keyCode: { flex: 1, color: C.muted, fontSize: 12.5, fontFamily: 'monospace' },
  keyMeta: { color: C.faint, fontSize: 11, fontFamily: F.sans },
  keyEmpty: { paddingHorizontal: 14, paddingVertical: 16 },
  keyEmptyTxt: { color: C.faint, fontSize: 12.5, fontFamily: F.sans, lineHeight: 18 },
  keyAction: { color: C.coral, fontSize: 12, fontWeight: '600', fontFamily: F.sans },

  hookRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 13 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  hookUrl: { flex: 1, color: C.muted, fontSize: 12.5, fontFamily: 'monospace' },
  hookTags: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 11 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.05)' },
  tagTxt: { color: C.faint, fontSize: 10.5, fontFamily: F.sans },

  codeBox: { borderRadius: 18, backgroundColor: '#1c1b1a', borderWidth: 1, borderColor: C.line, padding: 16 },
  code: { color: C.muted, fontSize: 11.5, lineHeight: 18, fontFamily: 'monospace' },
});
