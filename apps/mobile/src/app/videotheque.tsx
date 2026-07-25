import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { fetchVideotheque, type VideothequeItem } from '../lib/liri-api';
import { useTheme } from '../lib/theme';
import type { LiriPalette } from '../constants/liri-theme';

/**
 * VIDÉOTHÈQUE — les séances enregistrées, en natif.
 *
 * Lecture in-app (expo-video) + TRANSCRIPTION SYNCHRONISÉE : la ligne en cours se
 * surligne et défile, et un appui dessus déplace la vidéo à cet instant — le même
 * usage que sur le web, adapté au tactile.
 */

const fmtDur = (sec?: number) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};
const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

function Player({ item, onClose }: { item: VideothequeItem; onClose: () => void }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const player = useVideoPlayer(item.playback_url ?? '', (p) => { p.timeUpdateEventInterval = 0.5; });
  // `useEvent` sans état initial : le payload complet d'expo-video n'est pas
  // reconstructible à la main (champs live/buffer). Avant le 1er événement → 0.
  const timeEvent = useEvent(player, 'timeUpdate');
  const currentTime = timeEvent?.currentTime ?? 0;
  const listRef = useRef<FlatList<{ t: number; text: string }>>(null);
  const cues = useMemo(
    () => (Array.isArray(item.transcript_cues) ? item.transcript_cues : []),
    [item.transcript_cues],
  );

  // Index de la ligne en cours (recherche dichotomique : les cues sont ordonnés).
  const active = useMemo(() => {
    if (!cues.length) return -1;
    let lo = 0, hi = cues.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].t <= currentTime + 0.25) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }, [cues, currentTime]);

  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    try { listRef.current.scrollToIndex({ index: active, viewPosition: 0.4, animated: true }); } catch { /* hors écran */ }
  }, [active]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.playerRoot} edges={['top', 'bottom']}>
        <View style={styles.playerHeader}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backTxt}>‹ Vidéothèque</Text>
          </Pressable>
        </View>
        <Text style={styles.playerTitle} numberOfLines={2}>{item.title ?? 'Séance enregistrée'}</Text>

        <VideoView style={styles.video} player={player} allowsFullscreen allowsPictureInPicture contentFit="contain" />

        {cues.length ? (
          <>
            <Text style={styles.transcriptLabel}>Transcription — appuie sur une ligne pour y aller</Text>
            <FlatList
              ref={listRef}
              data={cues}
              style={styles.transcript}
              keyExtractor={(_, i) => String(i)}
              initialNumToRender={20}
              onScrollToIndexFailed={() => { /* la ligne n'est pas encore mesurée */ }}
              renderItem={({ item: cue, index }) => (
                <Pressable onPress={() => { player.currentTime = cue.t; }} style={[styles.cue, index === active && styles.cueActive]}>
                  <Text style={[styles.cueTime, index === active && styles.cueTimeActive]}>{fmtTime(cue.t)}</Text>
                  <Text style={[styles.cueText, index === active && styles.cueTextActive]}>{cue.text}</Text>
                </Pressable>
              )}
            />
          </>
        ) : item.transcript_text ? (
          <ScrollView style={styles.transcript}>
            <Text style={styles.cueText}>{item.transcript_text}</Text>
          </ScrollView>
        ) : (
          <Text style={styles.empty}>Transcription bientôt disponible.</Text>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export default function VideothequeScreen() {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  // `?v=<id>` (depuis la Bibliothèque) → on ouvre directement CETTE séance.
  const { v: wanted } = useLocalSearchParams<{ v?: string }>();
  const [items, setItems] = useState<VideothequeItem[] | null>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState<VideothequeItem | null>(null);
  const opened = useRef(false);

  const load = useCallback(async () => {
    setItems(await fetchVideotheque());
  }, []);
  useEffect(() => { load(); }, [load]);

  // Une seule fois : sinon refermer le lecteur le rouvrirait aussitôt.
  useEffect(() => {
    if (opened.current || !wanted || !items) return;
    const hit = items.find((i) => i.id === wanted);
    if (hit) { opened.current = true; setActive(hit); }
  }, [wanted, items]);

  const filtered = useMemo(() => {
    const list = items ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((v) => (v.title ?? '').toLowerCase().includes(term) || (v.description ?? '').toLowerCase().includes(term));
  }, [items, q]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.h1}>Vidéothèque</Text>
      <Text style={styles.sub}>Revois les séances enregistrées, quand tu veux.</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Rechercher une séance…"
        placeholderTextColor={C.faint}
        style={styles.search}
      />

      {items === null ? (
        <ActivityIndicator color={C.coral} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aucun enregistrement publié pour le moment.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setActive(item)}>
              <View style={styles.thumbWrap}>
                {item.thumbnail_url
                  ? <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
                  : <View style={[styles.thumb, styles.thumbEmpty]} />}
                <View style={styles.playBadge}><Text style={styles.playIcon}>▶</Text></View>
                {item.duration_sec ? <Text style={styles.dur}>{fmtDur(item.duration_sec)}</Text> : null}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title ?? 'Séance'}</Text>
              {item.category ? <Text style={styles.cardCat} numberOfLines={1}>{item.category}</Text> : null}
            </Pressable>
          )}
        />
      )}

      {active ? <Player item={active} onClose={() => setActive(null)} /> : null}
    </SafeAreaView>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base, paddingHorizontal: 18 },
  h1: { color: C.ink, fontSize: 26, fontWeight: '700', marginTop: 8 },
  sub: { color: C.muted, fontSize: 13.5, marginTop: 4 },
  search: {
    marginTop: 14, backgroundColor: C.panel, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, color: C.ink, fontSize: 14, borderWidth: 1, borderColor: C.line,
  },
  list: { paddingVertical: 16, gap: 16 },
  card: { backgroundColor: C.panel, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  thumbWrap: { position: 'relative', aspectRatio: 16 / 9, backgroundColor: '#000' },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { backgroundColor: C.rail },
  playBadge: {
    position: 'absolute', top: '50%', left: '50%', marginLeft: -26, marginTop: -26,
    width: 52, height: 52, borderRadius: 26, backgroundColor: C.coral,
    alignItems: 'center', justifyContent: 'center', opacity: 0.92,
  },
  playIcon: { color: '#fff', fontSize: 20, marginLeft: 3 },
  dur: {
    position: 'absolute', right: 8, bottom: 8, color: C.ink, fontSize: 11.5, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,.66)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  cardTitle: { color: C.ink, fontSize: 15.5, fontWeight: '600', paddingHorizontal: 14, paddingTop: 12 },
  cardCat: { color: C.faint, fontSize: 12.5, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 3 },
  empty: { color: C.faint, fontSize: 13.5, textAlign: 'center', marginTop: 40 },

  playerRoot: { flex: 1, backgroundColor: C.base },
  playerHeader: { paddingHorizontal: 16, paddingTop: 6 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 },
  backTxt: { color: C.muted, fontSize: 15, fontWeight: '600' },
  playerTitle: { color: C.ink, fontSize: 18, fontWeight: '700', paddingHorizontal: 16, paddingBottom: 10 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  transcriptLabel: { color: C.faint, fontSize: 11.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  transcript: { flex: 1, paddingHorizontal: 10 },
  cue: { flexDirection: 'row', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10 },
  cueActive: { backgroundColor: C.coralTint },
  cueTime: { color: C.faint, fontSize: 11.5, fontVariant: ['tabular-nums'], minWidth: 42, paddingTop: 2 },
  cueTimeActive: { color: C.coral, fontWeight: '700' },
  cueText: { color: C.muted, fontSize: 14.5, lineHeight: 21, flex: 1 },
  cueTextActive: { color: C.ink },
});
