import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import GridBackground from '@/components/live-host/grid-background';
import ImmersiveSmartboard, { type SmartboardSlide } from '@/components/live-host/immersive-smartboard';
import { LIVE_DECK, slideAtIn } from '@/components/live-host/live-deck';

/**
 * HostShell — portage natif du MODÈLE OFFICIEL `LiveHostMobileShell`
 * (cf. docs/LIVE_HOST_MODELE_OFFICIEL.md du repo).
 *
 * PHASE 2 — coque interactive :
 *   plein écran noir · TopBar · scène centrale · tiroir GAUCHE (drag + tap) ·
 *   rail DROITE (chaque FAB ouvre un panneau) · drawer bas TikTok (drag-up) ·
 *   nav slides · barre du bas. Données mock.
 *
 * Phase 4 : branchement LiveKit + API /lives/:id/* (via live-host-screen.tsx).
 */

const P = {
  bg: '#0A0A0F',
  panel: 'rgba(255,255,255,0.05)',
  panelSolid: '#15151E',
  line: 'rgba(255,255,255,0.10)',
  violet: '#8B5CF6',
  violetSoft: '#A78BFA',
  live: '#EF4444',
  ink: '#FFFFFF',
  muted: '#9CA3AF',
  emerald: '#34D399',
};

const W = Dimensions.get('window').width;
const LEFT_W = Math.min(340, W * 0.84);
const RIGHT_W = Math.min(360, W * 0.86);
const BOTTOM_H = Math.min(460, Dimensions.get('window').height * 0.6);

type RightPanel = 'joykit' | 'scenes' | 'invite';

const RAIL: { key: string; label: string; mci: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; panel?: RightPanel }[] = [
  { key: 'joykit', label: 'JoyKit', mci: 'gamepad-variant-outline', tint: P.violetSoft, panel: 'joykit' },
  { key: 'scenes', label: 'Scènes', mci: 'drama-masks', tint: P.violetSoft, panel: 'scenes' },
  { key: 'focus', label: 'Focus', mci: 'lightbulb-on-outline', tint: '#FCD34D' },
  { key: 'invite', label: 'Inviter', mci: 'link-variant', tint: '#60A5FA', panel: 'invite' },
];

/** Un membre de la salle (réel = LiveKit participant, ou mock en preview). */
export type LiveMember = { name: string; role?: string; tint: string; speaking?: boolean };

/** Message de chat reçu/envoyé (data channel « chat »). */
export type HostChatMessage = { id: string; author: string; text: string; me?: boolean };
/** Question posée par un participant (data channel « qa »). */
export type LiveQuestion = { id: string; author: string; text: string; resolved?: boolean };
/** Tuile vidéo distante (invité) pour la scène galerie (multicam). */
export type RemoteTile = { id: string; name: string; role?: string; node?: React.ReactNode; speaking?: boolean };

const MEMBERS: LiveMember[] = [
  { name: 'Manikongo', role: 'PROF', tint: '#7C3AED' },
  { name: 'Aïcha', tint: '#EC4899' },
  { name: 'Jean', tint: '#22C55E' },
  { name: 'Léa', tint: '#F59E0B' },
];

/** Palette stable pour colorer un avatar à partir d'un nom/identité. */
const AVATAR_TINTS = ['#7C3AED', '#EC4899', '#22C55E', '#F59E0B', '#60A5FA', '#14B8A6', '#F472B6', '#A78BFA'];
export function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}
/** Onglets du tiroir GAUCHE — chaque onglet a son propre contenu affiché. */
type LeftTab = 'membres' | 'controle' | 'signaux' | 'parametres';
const LEFT_TABS: { key: LeftTab; emoji: string; label: string }[] = [
  { key: 'membres', emoji: '👥', label: 'Membres' },
  { key: 'controle', emoji: '🎛️', label: 'Contrôle' },
  { key: 'signaux', emoji: '🔔', label: 'Signaux' },
  { key: 'parametres', emoji: '⚙️', label: 'Paramètres' },
];
/** Interrupteurs de modération (état local + signal optionnel). */
type ControlKey = 'muteAll' | 'guestCams' | 'locked' | 'waiting';
const CONTROLES: { key: ControlKey; emoji: string; label: string; on: string; off: string; def: boolean }[] = [
  { key: 'muteAll', emoji: '🔇', label: 'Couper tous les micros', on: 'Micros coupés', off: 'Micros autorisés', def: false },
  { key: 'guestCams', emoji: '🎥', label: 'Caméras invités', on: 'Autorisées', off: 'Bloquées', def: true },
  { key: 'locked', emoji: '🔒', label: 'Verrouiller la salle', on: 'Verrouillée', off: 'Ouverte', def: false },
  { key: 'waiting', emoji: '⏳', label: "Salle d'attente", on: 'Activée', off: 'Désactivée', def: false },
];
const CONTROL_DEFAULTS: Record<ControlKey, boolean> = { muteAll: false, guestCams: true, locked: false, waiting: false };
const SIGNAUX = [
  { emoji: '✋', label: 'Aïcha a levé la main', hint: 'il y a 12 s' },
  { emoji: '❓', label: 'Question de Jean', hint: 'En attente de réponse' },
  { emoji: '⭐', label: 'Léa a réagi', hint: 'il y a 1 min' },
];
/** Chat d'exemple (preview) — remplacé par le data channel « chat » en live. */
const MOCK_CHAT: HostChatMessage[] = [
  { id: 'm1', author: 'Aïcha', text: 'Bonjour prof 👋' },
  { id: 'm2', author: 'Jean', text: 'On entend bien 👍' },
  { id: 'm3', author: 'Léa', text: 'La slide est super claire' },
];
const PARAMETRES = [
  { emoji: '🎚️', label: 'Qualité vidéo', hint: 'Auto (HD)' },
  { emoji: '🌐', label: 'Langue de la session', hint: 'Français' },
  { emoji: '⏺️', label: 'Enregistrement auto', hint: 'Activé' },
  { emoji: '💬', label: 'Sous-titres live', hint: 'Désactivés' },
];
type Scene = 'self' | 'smartboard' | 'gallery' | 'fullscreen' | 'focus';
const SCENES: { emoji: string; label: string; scene: Scene }[] = [
  { emoji: '📊', label: 'Smartboard', scene: 'smartboard' },
  { emoji: '🎥', label: 'Plein écran', scene: 'fullscreen' },
  { emoji: '👥', label: 'Galerie', scene: 'gallery' },
  { emoji: '🧑‍🏫', label: 'Focus prof', scene: 'focus' },
];
const RIGHT_TITLES: Record<RightPanel, string> = { joykit: 'JoyKit', scenes: 'Scènes', invite: 'Inviter' };

// Deck de slides partagé hôte↔élève (cf. live-deck.ts), produit par le
// constructeur (Architect / Masterclass). La synchro temps réel transmet l'index.

export type HostShellProps = {
  /** Nombre de participants (TopBar). */
  participantCount?: number;
  /** État micro/caméra (contrôlés). Si absents → état local (preview). */
  micOn?: boolean;
  camOn?: boolean;
  recording?: boolean;
  onToggleMic?: () => void;
  onToggleCam?: () => void;
  onToggleRec?: () => void;
  /** Fin du live (bouton Arrêter / Rec stop). */
  onEnd?: () => void;
  /** Noeud vidéo (ex. <VideoTrack> LiveKit) rendu dans la scène quand la caméra est active. */
  hostVideo?: React.ReactNode;
  /** Diffusion temps réel : appelé quand l'hôte change de slide (index 1-based) → data channel. */
  onSlideChange?: (index: number) => void;
  /** Membres réels de la salle (LiveKit). Absent → mock (preview). */
  members?: LiveMember[];
  /** Deck de slides de la session (généré). Absent → deck d'exemple LIVE_DECK. */
  deck?: SmartboardSlide[];
  /** Modération : appelé quand l'hôte bascule un contrôle (→ signal data channel). */
  onModerate?: (key: string, value: boolean) => void;
  /** Chat temps réel (data channel « chat »). Absent → mock (preview). */
  chatMessages?: HostChatMessage[];
  /** Envoi d'un message de chat (publie sur « chat »). */
  onSendChat?: (text: string) => void;
  /** Questions temps réel des participants (data channel « qa »). */
  questions?: LiveQuestion[];
  /** Marque une question comme traitée. */
  onResolveQuestion?: (id: string) => void;
  /** Tuiles vidéo distantes (invités) pour la scène Galerie (multicam). */
  remoteTiles?: RemoteTile[];
};

export default function HostShell(props: HostShellProps = {}) {
  const { participantCount = 0, onEnd } = props;
  // Membres réels (LiveKit) si fournis, sinon mock de preview.
  const members = props.members && props.members.length ? props.members : MEMBERS;
  // Deck généré (session) si fourni, sinon deck d'exemple.
  const deck = props.deck && props.deck.length ? props.deck : LIVE_DECK;
  const [slide, setSlide] = useState(1);
  const total = deck.length; // nombre réel de slides du deck (hôte ↔ élève)
  const [recLocal, setRecLocal] = useState(false);
  const rec = props.recording ?? recLocal;
  const toggleRec = props.onToggleRec ?? (() => setRecLocal((v) => !v));
  const [micLocal, setMicLocal] = useState(false);
  const [camLocal, setCamLocal] = useState(false);
  const micOn = props.micOn ?? micLocal;
  const camOn = props.camOn ?? camLocal;
  const toggleMic = props.onToggleMic ?? (() => setMicLocal((v) => !v));
  const toggleCam = props.onToggleCam ?? (() => setCamLocal((v) => !v));
  const [focus, setFocus] = useState(false);
  const [scene, setScene] = useState<Scene>('self');
  const [presenting, setPresenting] = useState(false); // plein écran : masque la régie

  // Contrôles de modération (état local + signal optionnel onModerate).
  const [controls, setControls] = useState<Record<ControlKey, boolean>>(CONTROL_DEFAULTS);
  const toggleControl = useCallback(
    (key: ControlKey) => {
      setControls((c) => {
        const next = !c[key];
        props.onModerate?.(key, next);
        return { ...c, [key]: next };
      });
    },
    [props],
  );

  // open flags (pour pointerEvents) + shared values (pour anim)
  const [leftOpen, setLeftOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('membres');
  const [rightPanel, setRightPanel] = useState<RightPanel | null>(null);
  const [bottomOpen, setBottomOpen] = useState(false);

  // ── Drawer bas : chat temps réel + file Q&R ──
  const [sheetTab, setSheetTab] = useState<'chat' | 'questions'>('chat');
  const [chatDraft, setChatDraft] = useState('');
  const chatScrollRef = useRef<ScrollView>(null);
  const chat = props.chatMessages ?? MOCK_CHAT;
  const questions = props.questions ?? [];
  const remoteTiles = props.remoteTiles ?? [];
  const pendingQuestions = questions.filter((q) => !q.resolved).length;

  const sendChat = useCallback(() => {
    const text = chatDraft.trim();
    if (!text) return;
    setChatDraft('');
    props.onSendChat?.(text);
    requestAnimationFrame(() => chatScrollRef.current?.scrollToEnd({ animated: true }));
  }, [chatDraft, props]);

  const leftV = useSharedValue(0);
  const rightV = useSharedValue(0);
  const bottomV = useSharedValue(0);

  const openLeft = useCallback(() => { setLeftOpen(true); leftV.value = withTiming(1, { duration: 220 }); }, [leftV]);
  const closeLeft = useCallback(() => { leftV.value = withTiming(0, { duration: 200 }, (f) => { if (f) runOnJS(setLeftOpen)(false); }); }, [leftV]);
  const openRight = useCallback((p: RightPanel) => { setRightPanel(p); rightV.value = withTiming(1, { duration: 220 }); }, [rightV]);
  const closeRight = useCallback(() => { rightV.value = withTiming(0, { duration: 200 }, (f) => { if (f) runOnJS(setRightPanel)(null); }); }, [rightV]);
  const openBottom = useCallback(() => { setBottomOpen(true); bottomV.value = withTiming(1, { duration: 240 }); }, [bottomV]);
  const closeBottom = useCallback(() => { bottomV.value = withTiming(0, { duration: 200 }, (f) => { if (f) runOnJS(setBottomOpen)(false); }); }, [bottomV]);

  // ── Animated styles ──
  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(leftV.value, [0, 1], [-LEFT_W, 0]) }] }));
  const leftBackdrop = useAnimatedStyle(() => ({ opacity: leftV.value * 0.55 }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(rightV.value, [0, 1], [RIGHT_W, 0]) }] }));
  const rightBackdrop = useAnimatedStyle(() => ({ opacity: rightV.value * 0.55 }));
  const bottomStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(bottomV.value, [0, 1], [BOTTOM_H + 40, 0]) }] }));
  const bottomBackdrop = useAnimatedStyle(() => ({ opacity: bottomV.value * 0.55 }));

  // ── Gestures (drag) ──
  const edgeOpenLeft = Gesture.Pan()
    .activeOffsetX(12)
    .onEnd((e) => { if (e.translationX > 50) runOnJS(openLeft)(); });
  const dragCloseLeft = Gesture.Pan()
    .activeOffsetX(-12)
    .onEnd((e) => { if (e.translationX < -50) runOnJS(closeLeft)(); });
  const dragUpBottom = Gesture.Pan()
    .activeOffsetY(-12)
    .onEnd((e) => { if (e.translationY < -40) runOnJS(openBottom)(); });
  const dragDownBottom = Gesture.Pan()
    .activeOffsetY(12)
    .onEnd((e) => { if (e.translationY > 50) runOnJS(closeBottom)(); });

  // Change de slide ET publie l'index (data channel via onSlideChange) → l'élève suit.
  const goSlide = (v: number) => {
    const c = Math.max(1, Math.min(total, v));
    setSlide(c);
    props.onSlideChange?.(c);
  };
  const prev = () => goSlide(slide - 1);
  const next = () => goSlide(slide + 1);

  return (
    <GestureHandlerRootView style={s.root}>
      {/* Fond TABLEAU à carreaux (quadrillage) — surface immersive du live, pas du noir plat. */}
      <GridBackground />
      <SafeAreaView edges={['top']} style={s.safe}>
        {/* ── TopBar (masquée en plein écran) ── */}
        {!presenting && (
          <View style={s.topBar}>
            <View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveTxt}>EN DIRECT</Text></View>
            <Text style={s.timer}>00:00</Text>
            <View style={s.pill}><Feather name="users" size={12} color={P.muted} /><Text style={s.pillTxt}>{participantCount}</Text></View>
            <View style={s.flex1} />
            <Pressable style={s.stopBtn} onPress={onEnd}><Feather name="square" size={11} color={P.live} /><Text style={s.stopTxt}>Arrêter</Text></Pressable>
          </View>
        )}

        {/* ── Scène centrale — bascule selon la scène choisie ── */}
        <View style={s.stage}>
          {scene === 'smartboard' ? (
            <ImmersiveSmartboard slide={slideAtIn(deck, slide) ?? deck[0]} cameraNode={camOn ? props.hostVideo : undefined} cameraDraggable />
          ) : scene === 'gallery' ? (
            <GalleryScene hostVideo={camOn ? props.hostVideo : undefined} members={members} remoteTiles={remoteTiles} />
          ) : scene === 'focus' ? (
            <FocusScene hostVideo={camOn ? props.hostVideo : undefined} members={members} />
          ) : props.hostVideo && camOn ? (
            <View style={s.stageVideo}>{props.hostVideo}</View>
          ) : (
            <View style={s.stageCenter}>
              <View style={s.selfAvatar}><Text style={s.selfAvatarTxt}>P</Text></View>
              <Text style={s.camOff}>{camOn ? 'CONNEXION…' : 'CAMÉRA DÉSACTIVÉE'}</Text>
              <Text style={s.previewTxt}>{scene === 'self' ? 'preview' : SCENES.find((x) => x.scene === scene)?.label}</Text>
            </View>
          )}
          {scene === 'self' && (
            <View style={s.captionPill}>
              <View style={s.captionDots}><View style={[s.cDot, { backgroundColor: P.violet }]} /><View style={s.cDot} /><View style={s.cDot} /><View style={s.cDot} /></View>
              <Text style={s.captionTxt}>Regardez ces deux mains</Text>
            </View>
          )}
          {/* PiP hôte — seulement en self / plein écran (ailleurs le flux est déjà visible). */}
          {(scene === 'self' || scene === 'fullscreen') && (
            <View style={s.miniSelf}>
              <View style={s.miniAvatar}><Text style={s.miniAvatarTxt}>P</Text></View>
              <Text style={s.miniName}>preview</Text>
            </View>
          )}
        </View>

        {/* Bouton plein écran (présentation pure) — toujours visible */}
        <Pressable style={s.fsBtn} onPress={() => setPresenting((v) => !v)} hitSlop={8}>
          <Feather name={presenting ? 'minimize-2' : 'maximize-2'} size={18} color={P.ink} />
        </Pressable>

        {/* ── Poignée tiroir GAUCHE (masquée en plein écran) ── */}
        {!presenting && (
          <GestureDetector gesture={edgeOpenLeft}>
            <Pressable style={s.leftHandle} onPress={openLeft} hitSlop={12}><View style={s.leftHandleBar} /></Pressable>
          </GestureDetector>
        )}

        {/* ── Régie (rail + grabber + barre) — masquée en plein écran ── */}
        {!presenting && (
        <>
        <View style={s.rail} pointerEvents="box-none">
          {RAIL.map((f) => {
            const active = f.key === 'focus' && focus;
            return (
              <Pressable key={f.key} style={({ pressed }) => [s.fab, pressed && s.pressed]} onPress={() => (f.panel ? openRight(f.panel) : setFocus((v) => !v))}>
                <View style={[s.fabCircle, active && s.fabActive]}><MaterialCommunityIcons name={f.mci} size={22} color={active ? P.ink : f.tint} /></View>
                <Text style={s.fabLabel}>{f.label}</Text>
              </Pressable>
            );
          })}
          <Pressable style={({ pressed }) => [s.fab, pressed && s.pressed]} onPress={toggleRec}>
            <View style={[s.fabCircle, s.recCircle, rec && s.recActive]}>{rec ? <View style={s.recSquare} /> : <View style={s.recDot} />}</View>
            <Text style={s.fabLabel}>{rec ? 'Stop' : 'Rec'}</Text>
          </Pressable>
        </View>

        {/* ── Grabber drawer bas (tap + drag-up) ── */}
        <GestureDetector gesture={dragUpBottom}>
          <Pressable style={s.bottomDrawerHandle} onPress={openBottom} hitSlop={14}><View style={s.grabber} /></Pressable>
        </GestureDetector>

        {/* ── BottomBar ── */}
        <SafeAreaView edges={['bottom']} style={s.bottomBar}>
          <Pressable style={s.barBtn} onPress={toggleMic}><Feather name={micOn ? 'mic' : 'mic-off'} size={20} color={micOn ? P.ink : P.live} /></Pressable>
          <Pressable style={s.barBtn} onPress={toggleCam}><Feather name={camOn ? 'video' : 'video-off'} size={20} color={camOn ? P.ink : P.muted} /></Pressable>
          <Pressable style={s.barBtnGhost} onPress={prev}><Feather name="chevron-left" size={20} color={slide > 1 ? P.ink : P.muted} /></Pressable>
          <View style={s.barSlide}><Text style={s.barSlideTxt}>{slide} / {total}</Text></View>
          <Pressable style={s.barBtnGhost} onPress={next}><Feather name="chevron-right" size={20} color={slide < total ? P.ink : P.muted} /></Pressable>
          <Pressable style={s.barRec} onPress={toggleRec}>
            <View style={[s.barRecRing, rec && s.recActive]}>{rec ? <View style={s.recSquare} /> : <View style={s.barRecDot} />}</View>
          </Pressable>
        </SafeAreaView>
        </>
        )}
      </SafeAreaView>

      {/* ── Tiroir GAUCHE ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents={leftOpen ? 'auto' : 'none'}>
        <AnimatedPressable style={[s.backdrop, leftBackdrop]} onPress={closeLeft} />
        <GestureDetector gesture={dragCloseLeft}>
          <Animated.View style={[s.leftDrawer, leftStyle]}>
            <SafeAreaView edges={['top', 'bottom']} style={s.flex1}>
              <View style={s.drawerHead}><Text style={s.drawerTitle}>Salle</Text><Pressable onPress={closeLeft} hitSlop={10}><Feather name="x" size={20} color={P.muted} /></Pressable></View>
              {/* Onglets : Membres · Contrôle · Signaux · Paramètres */}
              <View style={s.sectionRow}>
                {LEFT_TABS.map((t) => {
                  const active = t.key === leftTab;
                  return (
                    <Pressable key={t.key} onPress={() => setLeftTab(t.key)} style={[s.sectionChip, active && s.sectionChipActive]}>
                      <Text style={s.sectionEmoji}>{t.emoji}</Text>
                      <Text style={[s.sectionLabel, active && s.sectionLabelActive]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.drawerScroll}>
                {leftTab === 'membres' && (
                  <>
                    <Text style={s.online}>{members.length} membre{members.length > 1 ? 's' : ''} en ligne</Text>
                    {members.map((m) => (
                      <View key={m.name} style={s.memberRow}>
                        <View style={[s.memberAvatar, { backgroundColor: m.tint }]}>
                          <Text style={s.memberAvatarTxt}>{m.name[0]?.toUpperCase()}</Text>
                          <View style={[s.memberOnline, m.speaking && s.memberSpeaking]} />
                        </View>
                        <Text style={s.memberName} numberOfLines={1}>{m.name}</Text>
                        {m.role ? <Text style={s.memberRole}>{m.role}</Text> : null}
                      </View>
                    ))}
                    <ToolCard emoji="💡" label="Mode spotlight" hint="Met en valeur un participant" />
                    <ToolCard emoji="❓" label="Q&R NeuronQ" hint="Activer les questions" />
                    <ToolCard emoji="✋" label="Levées de main" hint="Aucune main levée" />
                  </>
                )}
                {leftTab === 'controle' && (
                  <>
                    <Text style={s.online}>Contrôle de la salle</Text>
                    {CONTROLES.map((c) => (
                      <ControlToggle
                        key={c.key}
                        emoji={c.emoji}
                        label={c.label}
                        hint={controls[c.key] ? c.on : c.off}
                        on={controls[c.key]}
                        onPress={() => toggleControl(c.key)}
                      />
                    ))}
                  </>
                )}
                {leftTab === 'signaux' && (
                  <>
                    <Text style={s.online}>{SIGNAUX.length} signaux récents</Text>
                    {SIGNAUX.map((c) => <ToolCard key={c.label} emoji={c.emoji} label={c.label} hint={c.hint} />)}
                  </>
                )}
                {leftTab === 'parametres' && (
                  <>
                    <Text style={s.online}>Paramètres de la session</Text>
                    {PARAMETRES.map((c) => <ToolCard key={c.label} emoji={c.emoji} label={c.label} hint={c.hint} />)}
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* ── Panneau DROITE (FAB) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents={rightPanel ? 'auto' : 'none'}>
        <AnimatedPressable style={[s.backdrop, rightBackdrop]} onPress={closeRight} />
        <Animated.View style={[s.rightDrawer, rightStyle]}>
          <SafeAreaView edges={['top', 'bottom']} style={s.flex1}>
            <View style={s.drawerHead}><Text style={s.drawerTitle}>{rightPanel ? RIGHT_TITLES[rightPanel] : ''}</Text><Pressable onPress={closeRight} hitSlop={10}><Feather name="x" size={20} color={P.muted} /></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.drawerScroll}>
              {rightPanel === 'scenes' && (
                <View style={s.scenesGrid}>{SCENES.map((sc) => {
                  const active = scene === sc.scene;
                  return (
                    <Pressable key={sc.label} style={({ pressed }) => [s.sceneCard, active && s.sceneCardActive, pressed && s.pressed]} onPress={() => { setScene(sc.scene); closeRight(); }}>
                      <Text style={s.sceneEmoji}>{sc.emoji}</Text>
                      <Text style={s.sceneLabel}>{sc.label}</Text>
                      {active ? <Text style={s.sceneActiveTag}>● EN COURS</Text> : null}
                    </Pressable>
                  );
                })}</View>
              )}
              {rightPanel === 'invite' && (
                <>
                  <ToolCard emoji="🔗" label="Copier le lien" hint="liri.live/abc-123" />
                  <ToolCard emoji="📱" label="QR code" hint="Scanner pour rejoindre" />
                  <ToolCard emoji="✉️" label="Inviter par email" hint="Envoyer une invitation" />
                </>
              )}
              {rightPanel === 'joykit' && (
                <>
                  <ToolCard emoji="🎲" label="Quiz" hint="Lancer un quiz live" />
                  <ToolCard emoji="📊" label="Sondage" hint="Poser une question" />
                  <ToolCard emoji="🏆" label="Classement" hint="Scores en direct" />
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>

      {/* ── Drawer bas (TikTok) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents={bottomOpen ? 'auto' : 'none'}>
        <AnimatedPressable style={[s.backdrop, bottomBackdrop]} onPress={closeBottom} />
        <GestureDetector gesture={dragDownBottom}>
          <Animated.View style={[s.bottomSheet, bottomStyle]}>
            <View style={s.sheetGrab} />
            <View style={s.sheetTabs}>
              <Pressable onPress={() => setSheetTab('chat')}>
                <Text style={sheetTab === 'chat' ? s.sheetTabActive : s.sheetTab}>Chat en direct</Text>
              </Pressable>
              <Pressable onPress={() => setSheetTab('questions')} style={s.sheetTabWrap}>
                <Text style={sheetTab === 'questions' ? s.sheetTabActive : s.sheetTab}>Questions</Text>
                {pendingQuestions > 0 && <View style={s.qBadge}><Text style={s.qBadgeTxt}>{pendingQuestions}</Text></View>}
              </Pressable>
            </View>

            {sheetTab === 'chat' ? (
              <>
                <ScrollView ref={chatScrollRef} style={s.flex1} contentContainerStyle={s.sheetScroll}>
                  {chat.length === 0 ? (
                    <Text style={s.sheetEmpty}>Aucun message pour le moment.</Text>
                  ) : (
                    chat.map((m) => <ChatLine key={m.id} who={m.author} txt={m.text} tint={m.me ? P.violet : tintFor(m.author)} />)
                  )}
                </ScrollView>
                <View style={s.sheetInput}>
                  <TextInput
                    style={s.sheetInputField}
                    value={chatDraft}
                    onChangeText={setChatDraft}
                    onSubmitEditing={sendChat}
                    returnKeyType="send"
                    placeholder="Écrire un message…"
                    placeholderTextColor={P.muted}
                  />
                  <Pressable onPress={sendChat} hitSlop={8}><Feather name="send" size={18} color={P.violetSoft} /></Pressable>
                </View>
              </>
            ) : (
              <ScrollView style={s.flex1} contentContainerStyle={s.sheetScroll}>
                {questions.length === 0 ? (
                  <Text style={s.sheetEmpty}>Aucune question. Les participants peuvent lever la main ✋</Text>
                ) : (
                  questions.map((q) => (
                    <View key={q.id} style={[s.qRow, q.resolved && s.qRowDone]}>
                      <View style={[s.chatAvatar, { backgroundColor: tintFor(q.author) }]}><Text style={s.chatAvatarTxt}>{q.author[0]}</Text></View>
                      <View style={s.flex1}>
                        <Text style={s.chatWho}>{q.author}</Text>
                        <Text style={[s.chatTxt, q.resolved && s.qTextDone]}>{q.text}</Text>
                      </View>
                      <Pressable onPress={() => props.onResolveQuestion?.(q.id)} hitSlop={8} style={[s.qDoneBtn, q.resolved && s.qDoneBtnOn]}>
                        <Feather name="check" size={15} color={q.resolved ? '#fff' : P.emerald} />
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Scène GALERIE : tuiles des participants en grille — multicam (vidéo invités). */
function GalleryScene({
  hostVideo,
  members,
  remoteTiles = [],
}: {
  hostVideo?: React.ReactNode;
  members: LiveMember[];
  remoteTiles?: RemoteTile[];
}) {
  // Tuile hôte + tuiles distantes réelles (vidéo) si disponibles, sinon membres (avatars).
  type Tile = { key: string; name: string; tint: string; role?: string; host?: boolean; node?: React.ReactNode };
  const tiles: Tile[] = [
    { key: 'host', name: 'Vous', tint: P.violet, host: true, node: hostVideo },
    ...(remoteTiles.length
      ? remoteTiles.map((t) => ({ key: t.id, name: t.name, tint: tintFor(t.name), role: t.role, node: t.node }))
      : members.map((m) => ({ key: m.name, name: m.name, tint: m.tint, role: m.role }))),
  ];
  return (
    <View style={s.gallery}>
      {tiles.map((t) => (
        <View key={t.key} style={s.galTile}>
          {t.node ? (
            <View style={StyleSheet.absoluteFill}>{t.node}</View>
          ) : (
            <View style={[s.galAvatar, { backgroundColor: t.tint }]}>
              <Text style={s.galAvatarTxt}>{t.name[0]}</Text>
            </View>
          )}
          <View style={s.galFooter}>
            <Feather name="mic" size={11} color="#fff" />
            <Text style={s.galName} numberOfLines={1}>{t.name}</Text>
            {t.role ? <Text style={s.galRole}>{t.role}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Scène FOCUS : le présentateur (prof) en grand, centré. */
function FocusScene({ hostVideo, members }: { hostVideo?: React.ReactNode; members: LiveMember[] }) {
  const prof = members.find((m) => m.role === 'PROF') ?? members[0] ?? { name: 'Hôte', tint: P.violet };
  return (
    <View style={s.focusWrap}>
      <View style={s.focusTile}>
        {hostVideo ? (
          <View style={StyleSheet.absoluteFill}>{hostVideo}</View>
        ) : (
          <View style={[s.focusAvatar, { backgroundColor: prof.tint }]}>
            <Text style={s.focusAvatarTxt}>{prof.name[0]}</Text>
          </View>
        )}
      </View>
      {/* Étiquette sous la tuile — largeur pleine, jamais tronquée. */}
      <View style={s.focusBadge}>
        <View style={s.focusDot} />
        <Text style={s.focusName}>{prof.name}</Text>
        <Text style={s.focusRole}>PROF</Text>
      </View>
    </View>
  );
}

function ToolCard({ emoji, label, hint }: { emoji: string; label: string; hint: string }) {
  return (
    <View style={s.toolCard}>
      <Text style={s.toolEmoji}>{emoji}</Text>
      <View style={s.flex1}><Text style={s.toolLabel}>{label}</Text><Text style={s.toolHint}>{hint}</Text></View>
    </View>
  );
}

/** Ligne de modération avec interrupteur (switch) on/off. */
function ControlToggle({ emoji, label, hint, on, onPress }: { emoji: string; label: string; hint: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.toolCard, pressed && s.pressed]} onPress={onPress}>
      <Text style={s.toolEmoji}>{emoji}</Text>
      <View style={s.flex1}><Text style={s.toolLabel}>{label}</Text><Text style={[s.toolHint, on && s.toolHintOn]}>{hint}</Text></View>
      <View style={[s.switch, on && s.switchOn]}>
        <View style={[s.knob, on && s.knobOn]} />
      </View>
    </Pressable>
  );
}
function ChatLine({ who, txt, tint }: { who: string; txt: string; tint: string }) {
  return (
    <View style={s.chatLine}>
      <View style={[s.chatAvatar, { backgroundColor: tint }]}><Text style={s.chatAvatarTxt}>{who[0]}</Text></View>
      <View style={s.flex1}><Text style={s.chatWho}>{who}</Text><Text style={s.chatTxt}>{txt}</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  safe: { flex: 1 },
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },
  fsBtn: { position: 'absolute', bottom: 170, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center', zIndex: 20 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.live, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  timer: { color: P.ink, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.panel, borderRadius: 13, paddingHorizontal: 9, paddingVertical: 5 },
  pillTxt: { color: P.muted, fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  stopTxt: { color: P.live, fontSize: 13, fontWeight: '700' },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  selfAvatar: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(139,92,246,0.12)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)', alignItems: 'center', justifyContent: 'center' },
  selfAvatarTxt: { color: P.violetSoft, fontSize: 60, fontWeight: '800' },
  camOff: { color: P.muted, fontSize: 14, fontWeight: '700', letterSpacing: 0.5, marginTop: 22 },
  previewTxt: { color: P.ink, fontSize: 22, fontWeight: '700', marginTop: 6 },
  captionPill: { position: 'absolute', left: 18, bottom: 96, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  captionDots: { flexDirection: 'row', gap: 4 },
  cDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  captionTxt: { color: P.violetSoft, fontSize: 14, fontWeight: '700' },
  miniSelf: { position: 'absolute', left: 18, bottom: 28, flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: P.violet, alignItems: 'center', justifyContent: 'center' },
  miniAvatarTxt: { color: P.violetSoft, fontSize: 16, fontWeight: '800' },
  miniName: { color: P.ink, fontSize: 16, fontWeight: '700' },

  leftHandle: { position: 'absolute', left: 0, top: '44%', width: 30, height: 72, alignItems: 'flex-start', justifyContent: 'center' },
  leftHandleBar: { width: 5, height: 48, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },

  rail: { position: 'absolute', right: 10, top: '28%', alignItems: 'center', gap: 14 },
  fab: { alignItems: 'center', gap: 4, width: 64 },
  fabCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center' },
  fabActive: { backgroundColor: 'rgba(139,92,246,0.3)', borderColor: P.violet },
  fabLabel: { color: P.muted, fontSize: 11, fontWeight: '600' },
  recCircle: { borderColor: 'rgba(239,68,68,0.45)' },
  recActive: { backgroundColor: P.live, borderColor: P.live },
  recDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: P.live },
  recSquare: { width: 13, height: 13, borderRadius: 3, backgroundColor: '#fff' },

  bottomDrawerHandle: { position: 'absolute', left: 0, right: 0, bottom: 88, alignItems: 'center', paddingVertical: 8 },
  grabber: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },

  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  barBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center' },
  barBtnGhost: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  barSlide: { minWidth: 64, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  barSlideTxt: { color: P.ink, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  barRec: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)' },
  barRecRing: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: P.live, alignItems: 'center', justifyContent: 'center' },
  barRecDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: P.live },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  drawerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: P.line },
  drawerTitle: { color: P.ink, fontSize: 18, fontWeight: '800' },
  drawerScroll: { padding: 16, gap: 10 },

  leftDrawer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: LEFT_W, backgroundColor: P.panelSolid, borderRightWidth: 1, borderRightColor: P.line },
  rightDrawer: { position: 'absolute', right: 0, top: 0, bottom: 0, width: RIGHT_W, backgroundColor: P.panelSolid, borderLeftWidth: 1, borderLeftColor: P.line },

  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.panel, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: 'transparent' },
  sectionChipActive: { backgroundColor: 'rgba(139,92,246,0.18)', borderColor: P.violet },
  sectionEmoji: { fontSize: 14 },
  sectionLabel: { color: P.muted, fontSize: 12.5, fontWeight: '600' },
  sectionLabelActive: { color: P.ink },
  online: { color: P.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, marginBottom: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  memberAvatarTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  memberOnline: { position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: P.emerald, borderWidth: 2, borderColor: P.panelSolid },
  memberSpeaking: { backgroundColor: P.violetSoft, borderColor: P.violet },
  memberName: { color: P.ink, fontSize: 14.5, fontWeight: '600', flex: 1 },
  memberRole: { color: P.violetSoft, fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  toolCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: P.panel, borderRadius: 14, padding: 13, marginTop: 8 },
  toolEmoji: { fontSize: 20 },
  toolLabel: { color: P.ink, fontSize: 14, fontWeight: '700' },
  toolHint: { color: P.muted, fontSize: 12, marginTop: 2 },
  toolHintOn: { color: P.violetSoft },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: P.violet },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-start' },
  knobOn: { alignSelf: 'flex-end' },

  scenesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sceneCard: { width: '47%', aspectRatio: 1.4, backgroundColor: P.panel, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: P.line },
  sceneEmoji: { fontSize: 26 },
  sceneLabel: { color: P.ink, fontSize: 13, fontWeight: '700' },

  bottomSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: BOTTOM_H, backgroundColor: P.panelSolid, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: P.line, paddingTop: 8 },
  sheetGrab: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 8 },
  sheetTabs: { flexDirection: 'row', gap: 18, paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: P.line, alignItems: 'center' },
  sheetTabWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetTabActive: { color: P.ink, fontSize: 15, fontWeight: '800' },
  sheetTab: { color: P.muted, fontSize: 15, fontWeight: '600' },
  qBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: P.live, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  qBadgeTxt: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  sheetScroll: { padding: 16, gap: 4 },
  sheetEmpty: { color: P.muted, fontSize: 13.5, textAlign: 'center', paddingVertical: 22 },
  sheetInputField: { flex: 1, color: P.ink, fontSize: 14, paddingVertical: 0 },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.panel, borderRadius: 14, padding: 12, marginBottom: 8 },
  qRowDone: { opacity: 0.55 },
  qTextDone: { textDecorationLine: 'line-through', color: P.muted },
  qDoneBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(52,211,153,0.5)', alignItems: 'center', justifyContent: 'center' },
  qDoneBtnOn: { backgroundColor: P.emerald, borderColor: P.emerald },
  chatLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 },
  chatAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chatAvatarTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  chatWho: { color: P.violetSoft, fontSize: 12.5, fontWeight: '700' },
  chatTxt: { color: P.ink, fontSize: 14, marginTop: 1 },
  sheetInput: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, backgroundColor: P.panel, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: P.line },
  sheetInputTxt: { color: P.muted, fontSize: 14, flex: 1 },

  stageCenter: { alignItems: 'center', justifyContent: 'center' },
  stageVideo: { ...StyleSheet.absoluteFillObject },

  // Scène GALERIE
  gallery: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14, alignContent: 'flex-start' },
  galTile: { width: '47.5%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center' },
  galAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  galAvatarTxt: { color: '#fff', fontSize: 26, fontWeight: '800' },
  galFooter: { position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  galName: { color: '#fff', fontSize: 12.5, fontWeight: '600', flex: 1 },
  galRole: { color: '#fff', fontSize: 9, fontWeight: '800', backgroundColor: P.violet, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },

  // Scène FOCUS
  focusWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, gap: 14 },
  focusTile: { width: '76%', aspectRatio: 3 / 4, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)', alignItems: 'center', justifyContent: 'center' },
  focusAvatar: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  focusAvatarTxt: { color: '#fff', fontSize: 48, fontWeight: '800' },
  focusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  focusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P.live },
  focusName: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  focusRole: { color: '#fff', fontSize: 9, fontWeight: '800', backgroundColor: P.violet, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sceneCardActive: { borderColor: P.violet, backgroundColor: 'rgba(139,92,246,0.18)' },
  sceneActiveTag: { color: P.violetSoft, fontSize: 9, fontWeight: '800', marginTop: 4, letterSpacing: 0.4 },
  // Smartboard immersif : rendu délégué à ImmersiveSmartboard (cf. immersive-smartboard.tsx).
});
