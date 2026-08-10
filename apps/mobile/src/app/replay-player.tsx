import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';
import { fetchReplayFileUrl } from '@/lib/liri-api';

/**
 * Lecteur de replay d'une session live. Reçoit `?id=<sessionId>&title=…`,
 * récupère l'URL R2 présignée via GET /lives/:id/replay/file, puis lit la vidéo
 * (expo-video). États : chargement · erreur (enregistrement en finalisation ou
 * accès refusé) · lecture.
 */
export default function ReplayPlayerScreen() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    if (!id) { setState('error'); return; }
    setState('loading'); setUrl(null);
    fetchReplayFileUrl(String(id))
      .then((u) => { if (!alive) return; if (u) setUrl(u); else setState('error'); })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/lives'));

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={back} hitSlop={12} style={s.backBtn}>
            <Feather name="chevron-left" size={22} color={C.ink} />
            <Text style={s.backTxt}>Retour</Text>
          </Pressable>
        </View>
        <Text style={s.title} numberOfLines={2}>{title || 'Replay de la session'}</Text>

        {url ? (
          <ReplayVideo url={url} s={s} />
        ) : state === 'loading' ? (
          <View style={s.center}>
            <ActivityIndicator color={C.coral} />
            <Text style={s.hint}>Préparation du replay…</Text>
          </View>
        ) : (
          <View style={s.center}>
            <View style={s.errIcon}><Feather name="film" size={26} color={C.faint} /></View>
            <Text style={s.errTitle}>Replay indisponible</Text>
            <Text style={s.hint}>
              L&apos;enregistrement est peut-être encore en finalisation, ou tu n&apos;y as pas accès. Réessaie dans quelques minutes.
            </Text>
            <Pressable style={s.retry} onPress={() => { setState('loading'); setUrl(null); fetchReplayFileUrl(String(id)).then((u) => u ? setUrl(u) : setState('error')).catch(() => setState('error')); }}>
              <Text style={s.retryTxt}>Réessayer</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

/** Monté UNIQUEMENT quand l'URL est prête → useVideoPlayer reçoit la source finale. */
function ReplayVideo({ url, s }: { url: string; s: ReturnType<typeof makeStyles> }) {
  const player = useVideoPlayer(url, (p) => { p.timeUpdateEventInterval = 0.5; p.play(); });
  return <VideoView style={s.video} player={player} allowsFullscreen allowsPictureInPicture contentFit="contain" />;
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  header: { paddingHorizontal: 12, paddingTop: 6 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 },
  backTxt: { color: C.muted, fontSize: 15, fontWeight: '600', fontFamily: F.sans },
  title: { color: C.ink, fontSize: 19, fontWeight: '700', fontFamily: F.serif, paddingHorizontal: 18, paddingBottom: 12 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  hint: { color: C.muted, fontSize: 13.5, textAlign: 'center', lineHeight: 19, fontFamily: F.sans },
  errIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  errTitle: { color: C.ink, fontSize: 18, fontWeight: '700', fontFamily: F.sans },
  retry: { marginTop: 4, backgroundColor: C.coral, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  retryTxt: { color: '#1c1a18', fontSize: 14, fontWeight: '700', fontFamily: F.sans },
});
