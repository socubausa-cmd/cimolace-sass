/**
 * Écran natif SmartBoard (Skia réel). Tableau blanc pédagogique :
 *  - Outils : stylo (tracé libre), gomme, rect, cercle, texte.
 *  - Undo (pile d'actions immuables), Clear.
 *  - Rail de scènes avec CRUD (ajouter / supprimer / renommer).
 *  - Sauvegarde → upsert `liri_course_workspaces` (payload SbKonvaProject),
 *    avec repli local AsyncStorage hors connexion.
 *
 * Chargé via la route /smartboard (peut recevoir ?id=<workspaceId>&title=…).
 */
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

import { BoardCanvas, type DrawPoint } from './BoardCanvas';
import {
  fetchWorkspaceById,
  loadLocalDraft,
  saveLocalDraft,
  saveWorkspace,
} from './data';
import {
  createEmptyProject,
  createEmptyScene,
  mkCircle,
  mkRect,
  mkStroke,
  mkText,
} from './model';
import { SceneRail } from './SceneRail';
import { PenSettings, Toolbar, type Tool } from './Toolbar';
import type { SbKonvaObjectBase, SbKonvaProject } from './types';

const HISTORY_LIMIT = 60;

export default function SmartboardScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const params = useLocalSearchParams<{ id?: string; title?: string }>();
  const initialId = typeof params.id === 'string' && params.id ? params.id : null;

  // ── État document ───────────────────────────────────────────────────────────
  const [project, setProject] = useState<SbKonvaProject>(createEmptyProject);
  const [history, setHistory] = useState<SbKonvaProject[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(initialId);
  const [title, setTitle] = useState<string>(
    typeof params.title === 'string' && params.title ? params.title : 'Tableau sans titre',
  );
  const [loading, setLoading] = useState<boolean>(!!initialId);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Outils ──────────────────────────────────────────────────────────────────
  const [tool, setTool] = useState<Tool>('pen');
  const [penColor, setPenColor] = useState('#f5f4ee');
  const [penWidth, setPenWidth] = useState(6);

  // ── Tracé / forme en cours ────────────────────────────────────────────────────
  const [livePoints, setLivePoints] = useState<DrawPoint[] | null>(null);
  const [liveShape, setLiveShape] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startRef = useRef<DrawPoint | null>(null);

  // ── Modal texte ───────────────────────────────────────────────────────────────
  const [textModal, setTextModal] = useState<{ at: DrawPoint } | null>(null);
  const [textValue, setTextValue] = useState('');

  // Chargement initial : cloud puis repli local.
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (initialId) {
        const { workspace, error } = await fetchWorkspaceById(initialId);
        if (!alive) return;
        if (workspace) {
          setProject(workspace.project);
          setTitle(workspace.title);
          setLoading(false);
          return;
        }
        // Repli local si cloud KO (offline / non connecté)
        const local = await loadLocalDraft(initialId);
        if (!alive) return;
        if (local) {
          setProject(local.project);
          setTitle(local.title);
          setNotice('Brouillon local (hors ligne).');
        } else if (error) {
          setNotice(error);
        }
        setLoading(false);
      } else {
        const local = await loadLocalDraft(null);
        if (!alive) return;
        if (local) {
          setProject(local.project);
          setTitle(local.title);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialId]);

  // Auto-effacement des notices.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const activeScene =
    project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];

  /** Empile l'état courant avant mutation (pour undo). */
  const pushHistory = useCallback((current: SbKonvaProject) => {
    setHistory((h) => [...h, current].slice(-HISTORY_LIMIT));
  }, []);

  /** Mute la scène active de façon immuable + enregistre l'historique. */
  const mutateActiveScene = useCallback(
    (fn: (objs: SbKonvaObjectBase[]) => SbKonvaObjectBase[]) => {
      setProject((prev) => {
        pushHistory(prev);
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === prev.activeSceneId ? { ...s, objects: fn(s.objects) } : s,
          ),
        };
      });
    },
    [pushHistory],
  );

  // ── Gestes de dessin ──────────────────────────────────────────────────────────
  const onDrawStart = useCallback(
    (p: DrawPoint) => {
      startRef.current = p;
      if (tool === 'pen' || tool === 'eraser') {
        setLivePoints([p]);
      } else if (tool === 'rect' || tool === 'circle') {
        setLiveShape({ x: p.x, y: p.y, w: 0, h: 0 });
      }
    },
    [tool],
  );

  const onDrawMove = useCallback(
    (p: DrawPoint) => {
      if (tool === 'pen' || tool === 'eraser') {
        setLivePoints((pts) => (pts ? [...pts, p] : [p]));
      } else if ((tool === 'rect' || tool === 'circle') && startRef.current) {
        const s = startRef.current;
        setLiveShape({
          x: Math.min(s.x, p.x),
          y: Math.min(s.y, p.y),
          w: Math.abs(p.x - s.x),
          h: Math.abs(p.y - s.y),
        });
      }
    },
    [tool],
  );

  const onDrawEnd = useCallback(() => {
    if ((tool === 'pen' || tool === 'eraser') && livePoints && livePoints.length > 1) {
      const color = tool === 'eraser'
        ? (project.canvas.background !== 'transparent' ? project.canvas.background : C.panel)
        : penColor;
      const width = tool === 'eraser' ? penWidth * 2.4 : penWidth;
      const stroke = mkStroke(livePoints, { color, width });
      mutateActiveScene((objs) => [...objs, stroke]);
    } else if ((tool === 'rect' || tool === 'circle') && liveShape && (liveShape.w > 4 || liveShape.h > 4)) {
      const obj =
        tool === 'rect'
          ? mkRect(liveShape.x, liveShape.y, liveShape.w, liveShape.h, { stroke: penColor, strokeWidth: penWidth })
          : mkCircle(liveShape.x, liveShape.y, liveShape.w, liveShape.h, { stroke: penColor, strokeWidth: penWidth });
      mutateActiveScene((objs) => [...objs, obj]);
    }
    setLivePoints(null);
    setLiveShape(null);
    startRef.current = null;
  }, [tool, livePoints, liveShape, penColor, penWidth, project.canvas.background, mutateActiveScene, C.panel]);

  const onTap = useCallback((p: DrawPoint) => {
    setTextValue('');
    setTextModal({ at: p });
  }, []);

  const confirmText = useCallback(() => {
    const value = textValue.trim();
    if (value && textModal) {
      const obj = mkText(textModal.at.x, textModal.at.y, value, { color: penColor, fontSize: 26 });
      mutateActiveScene((objs) => [...objs, obj]);
    }
    setTextModal(null);
    setTextValue('');
  }, [textValue, textModal, penColor, mutateActiveScene]);

  // ── Undo / Clear ──────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setProject(prev);
      return h.slice(0, -1);
    });
  }, []);

  const clearScene = useCallback(() => {
    mutateActiveScene(() => []);
  }, [mutateActiveScene]);

  // ── CRUD scènes ─────────────────────────────────────────────────────────────
  const addScene = useCallback(() => {
    setProject((prev) => {
      pushHistory(prev);
      const scene = createEmptyScene(`Scène ${prev.scenes.length + 1}`);
      return { ...prev, scenes: [...prev.scenes, scene], activeSceneId: scene.id };
    });
  }, [pushHistory]);

  const deleteScene = useCallback(
    (id: string) => {
      setProject((prev) => {
        if (prev.scenes.length <= 1) return prev;
        pushHistory(prev);
        const idx = prev.scenes.findIndex((s) => s.id === id);
        const scenes = prev.scenes.filter((s) => s.id !== id);
        const activeSceneId =
          prev.activeSceneId === id ? scenes[Math.max(0, idx - 1)].id : prev.activeSceneId;
        return { ...prev, scenes, activeSceneId };
      });
    },
    [pushHistory],
  );

  const renameScene = useCallback((id: string, name: string) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === id ? { ...s, name } : s)),
    }));
  }, []);

  const selectScene = useCallback((id: string) => {
    setProject((prev) => ({ ...prev, activeSceneId: id }));
  }, []);

  // ── Sauvegarde ────────────────────────────────────────────────────────────────
  const onSave = useCallback(async () => {
    setSaving(true);
    // Repli local systématique (même hors ligne, le travail est conservé).
    await saveLocalDraft(workspaceId, { title, project }).catch(() => undefined);
    const res = await saveWorkspace({ id: workspaceId, title, project });
    setSaving(false);
    if (res.error) {
      setNotice(res.offline ? `${res.error} (enregistré localement)` : res.error);
    } else {
      if (res.id && res.id !== workspaceId) setWorkspaceId(res.id);
      setNotice('Enregistré sur le cloud.');
    }
  }, [workspaceId, title, project]);

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.loadingWrap}>
          <ActivityIndicator color={C.coral} />
          <Text style={styles.loadingTxt}>Chargement du tableau…</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
            <Feather name="chevron-left" size={24} color={C.ink} />
          </Pressable>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.titleInput}
            placeholder="Titre du tableau"
            placeholderTextColor={C.faint}
            maxLength={120}
          />
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="save" size={15} color="#fff" />
                <Text style={styles.saveTxt}>Enregistrer</Text>
              </>
            )}
          </Pressable>
        </View>

        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTxt}>{notice}</Text>
          </View>
        ) : null}

        {/* Canevas Skia */}
        <View style={styles.canvasArea}>
          <BoardCanvas
            objects={activeScene.objects}
            background={project.canvas.background}
            tool={tool}
            penColor={penColor}
            penWidth={penWidth}
            livePoints={livePoints}
            liveShape={liveShape}
            onDrawStart={onDrawStart}
            onDrawMove={onDrawMove}
            onDrawEnd={onDrawEnd}
            onTap={onTap}
          />
        </View>

        {/* Réglages stylo (couleur + épaisseur) */}
        <PenSettings color={penColor} width={penWidth} onColor={setPenColor} onWidth={setPenWidth} />

        {/* Barre d'outils */}
        <Toolbar
          tool={tool}
          onToolChange={setTool}
          onUndo={undo}
          canUndo={history.length > 0}
          onClear={clearScene}
        />

        {/* Rail de scènes */}
        <SceneRail
          scenes={project.scenes}
          activeId={project.activeSceneId}
          onSelect={selectScene}
          onAdd={addScene}
          onDelete={deleteScene}
          onRename={renameScene}
        />
      </SafeAreaView>

      {/* Modal saisie texte */}
      <Modal visible={!!textModal} transparent animationType="fade" onRequestClose={() => setTextModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTextModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Ajouter du texte</Text>
            <TextInput
              value={textValue}
              onChangeText={setTextValue}
              autoFocus
              multiline
              style={styles.modalInput}
              placeholder="Saisis ton texte…"
              placeholderTextColor={C.faint}
            />
            <View style={styles.modalRow}>
              <Pressable onPress={() => setTextModal(null)} style={[styles.modalBtn, styles.modalBtnGhost]}>
                <Text style={styles.modalBtnGhostTxt}>Annuler</Text>
              </Pressable>
              <Pressable onPress={confirmText} style={[styles.modalBtn, styles.modalBtnPrimary]}>
                <Text style={styles.modalBtnTxt}>Ajouter</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </GestureHandlerRootView>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { color: C.muted, fontSize: 14, fontFamily: F.sans },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titleInput: {
    flex: 1,
    color: C.ink,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: F.serif,
    paddingVertical: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.coral,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 96,
    justifyContent: 'center',
  },
  saveTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700', fontFamily: F.sans },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
  notice: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: C.coralTint,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  noticeTxt: { color: C.coral, fontSize: 12.5, fontFamily: F.sans },
  canvasArea: { flex: 1, margin: 12, borderRadius: 16, overflow: 'hidden' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: C.panel,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  modalTitle: { color: C.ink, fontSize: 16, fontWeight: '700', fontFamily: F.serif },
  modalInput: {
    minHeight: 64,
    color: C.ink,
    fontSize: 15,
    fontFamily: F.sans,
    backgroundColor: C.base,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: C.line,
  },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { borderRadius: 11, paddingHorizontal: 18, paddingVertical: 10 },
  modalBtnGhost: { backgroundColor: C.panel2 },
  modalBtnGhostTxt: { color: C.muted, fontSize: 14, fontWeight: '600', fontFamily: F.sans },
  modalBtnPrimary: { backgroundColor: C.coral },
  modalBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: F.sans },
});
