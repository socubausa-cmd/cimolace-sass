import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

/**
 * Smartboard live IMMERSIF (gabarit natif mobile) — cf.
 * docs/SMARTBOARD_LIVE_IMMERSIF.md.
 *
 * Aucun fond opaque : les blocs se fondent dans la scène live sombre. Une zone
 * caméra (`cameraZone`) reçoit le flux vidéo du présentateur (LiveKit) ou un
 * placeholder. C'est le template produit par le constructeur (Architect /
 * Masterclass) et rendu identiquement côté hôte et élève.
 */
export type SmartboardBlockType = 'key-idea' | 'formula' | 'retain' | 'paragraph' | 'list';

export interface SmartboardBlock {
  type: SmartboardBlockType;
  text?: string;
  items?: string[];
  label?: string;
}

export interface SmartboardSlide {
  chapter?: string;
  title: string;
  blocks: SmartboardBlock[];
  cameraZone?: 'top-right' | 'bottom-right' | 'none';
}

export type CameraSize = 'sm' | 'md' | 'lg';

const V = '#A78BFA';
const V_BORDER = 'rgba(139,92,246,0.45)';
const V_FILL = 'rgba(139,92,246,0.10)';
const GREEN = '#34D399';
const GREEN_BORDER = 'rgba(52,211,153,0.40)';

function CameraZone({
  node,
  corner,
  draggable,
  size = 'md',
}: {
  node?: React.ReactNode;
  corner: 'top-right' | 'bottom-right';
  draggable?: boolean;
  size?: CameraSize;
}) {
  // Déplaçable (hôte) : translate accumulé via pan. Inerte côté élève.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }] }));
  const pan = Gesture.Pan().onChange((e) => {
    tx.value += e.changeX;
    ty.value += e.changeY;
  });

  const sizeStyle = size === 'lg' ? s.camLg : size === 'sm' ? s.camSm : null;
  const cornerStyle = corner === 'top-right' ? s.camTop : s.camBottom;

  const inner = (
    <>
      {node ? (
        <View style={s.camFill}>{node}</View>
      ) : (
        <View style={[s.camFill, s.camPlaceholder]}>
          <Feather name="video" size={20} color="rgba(255,255,255,0.5)" />
          <Text style={s.camTxt}>Flux vidéo prof</Text>
        </View>
      )}
      <View style={s.camBadge}>
        <View style={s.camDot} />
        <Text style={s.camBadgeTxt}>LIVE</Text>
      </View>
      {draggable ? (
        <View style={s.camGrip}>
          <Feather name="move" size={12} color="rgba(255,255,255,0.7)" />
        </View>
      ) : null}
    </>
  );

  if (draggable) {
    return (
      <GestureDetector gesture={pan}>
        <Animated.View style={[s.camZone, cornerStyle, sizeStyle, aStyle]}>{inner}</Animated.View>
      </GestureDetector>
    );
  }
  return <View style={[s.camZone, cornerStyle, sizeStyle]}>{inner}</View>;
}

function Block({ b }: { b: SmartboardBlock }) {
  switch (b.type) {
    case 'key-idea':
      return (
        <View style={s.keyIdea}>
          <View style={s.keyBulb}><Feather name="zap" size={15} color="#fff" /></View>
          <View style={s.flex1}>
            {b.label ? <Text style={s.keyLabel}>{b.label}</Text> : <Text style={s.keyLabel}>IDÉE CLÉ</Text>}
            <Text style={s.keyTxt}>{b.text}</Text>
          </View>
        </View>
      );
    case 'formula':
      return (
        <View style={s.formulaWrap}>
          {b.label ? <Text style={s.formulaLabel}>{b.label}</Text> : null}
          <View style={s.formulaBox}><Text style={s.formulaTxt}>{b.text}</Text></View>
        </View>
      );
    case 'retain':
      return (
        <View style={s.retain}>
          <Text style={s.retainLabel}>À RETENIR</Text>
          {(b.items ?? []).map((it, i) => (
            <View key={i} style={s.retainItem}>
              <View style={s.retainCheck}><Feather name="check" size={11} color="#fff" /></View>
              <Text style={s.retainTxt}>{it}</Text>
            </View>
          ))}
        </View>
      );
    case 'list':
      return (
        <View style={s.list}>
          {(b.items ?? []).map((it, i) => (
            <View key={i} style={s.listItem}>
              <View style={s.listDot} />
              <Text style={s.listTxt}>{it}</Text>
            </View>
          ))}
        </View>
      );
    case 'paragraph':
    default:
      return <Text style={s.paragraph}>{b.text}</Text>;
  }
}

/**
 * Fond TABLEAU à carreaux (pas du noir plat) : navy sombre + quadrillage blanc
 * très translucide tous les 44px, via react-native-svg <Pattern>. Aligné sur le
 * compositeur web SmartBoardCompositor. Le contenu transparent se pose dessus.
 */
function SmartboardGrid() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        {/* Lignes mineures (carreaux 44px) */}
        <Pattern id="sb-grid" width={44} height={44} patternUnits="userSpaceOnUse">
          <Path d="M 44 0 L 0 0 0 44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        </Pattern>
        {/* Lignes majeures (tous les 5 carreaux) — léger ton violet « tableau » */}
        <Pattern id="sb-grid-major" width={220} height={220} patternUnits="userSpaceOnUse">
          <Path d="M 220 0 L 0 0 0 220" fill="none" stroke="rgba(139,92,246,0.12)" strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="#0a0b0f" />
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#sb-grid)" />
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#sb-grid-major)" />
    </Svg>
  );
}

export default function ImmersiveSmartboard({
  slide,
  cameraNode,
  cameraDraggable,
  cameraSize,
}: {
  slide: SmartboardSlide;
  cameraNode?: React.ReactNode;
  /** Permet à l'hôte de déplacer la vignette caméra (pan). Inerte côté élève. */
  cameraDraggable?: boolean;
  cameraSize?: CameraSize;
}) {
  const zone = slide.cameraZone ?? 'top-right';
  const showCam = zone !== 'none';
  return (
    <View style={s.root}>
      {/* Fond tableau (couvre toute la scène, derrière le contenu) */}
      <SmartboardGrid />

      {showCam ? (
        <CameraZone
          node={cameraNode}
          corner={zone === 'bottom-right' ? 'bottom-right' : 'top-right'}
          draggable={cameraDraggable}
          size={cameraSize}
        />
      ) : null}

      <View style={s.content}>
        <View style={[s.head, showCam && zone === 'top-right' && s.headClear]}>
          {slide.chapter ? <View style={s.chapter}><Text style={s.chapterTxt}>{slide.chapter}</Text></View> : null}
          <Text style={s.title}>{slide.title}</Text>
          <View style={s.rule} />
        </View>

        <View style={s.blocks}>
          {slide.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Conteneur : fond tableau (grid) en couche absolue + contenu transparent
  // par-dessus. alignSelf stretch → plein largeur même si le parent centre.
  root: { flex: 1, alignSelf: 'stretch', width: '100%', overflow: 'hidden', backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },
  flex1: { flex: 1, minWidth: 0 },

  // Zone caméra
  camZone: { position: 'absolute', width: 150, height: 116, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  camTop: { top: 16, right: 16 },
  camBottom: { bottom: 16, right: 16 },
  camFill: { ...StyleSheet.absoluteFillObject },
  camPlaceholder: { backgroundColor: '#0D0D16', alignItems: 'center', justifyContent: 'center', gap: 6 },
  camTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  camBadge: { position: 'absolute', left: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  camDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' },
  camBadgeTxt: { color: '#fff', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5 },
  camSm: { width: 116, height: 88 },
  camLg: { width: 196, height: 148 },
  camGrip: { position: 'absolute', right: 6, bottom: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },

  head: {},
  headClear: { paddingRight: 168 }, // laisse la place à la vignette caméra
  chapter: { alignSelf: 'flex-start', backgroundColor: 'rgba(139,92,246,0.9)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  chapterTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', lineHeight: 34 },
  rule: { width: 56, height: 4, borderRadius: 2, backgroundColor: '#7C3AED', marginTop: 12 },

  // paddingRight : dégage le rail de FAB du régie (à droite) — pas de chevauchement.
  blocks: { marginTop: 22, gap: 16, paddingRight: 64 },

  // key-idea — translucide léger (fondu)
  keyIdea: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  keyBulb: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },
  keyLabel: { color: V, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 3 },
  keyTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 15.5, lineHeight: 22 },

  // formula — bordure seule (pas de carte pleine)
  formulaWrap: { gap: 8 },
  formulaLabel: { color: V, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  formulaBox: { borderWidth: 1, borderColor: V_BORDER, backgroundColor: V_FILL, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  formulaTxt: { color: '#C4B5FD', fontSize: 22, fontWeight: '800' },

  // retain — bordure verte translucide
  retain: { borderWidth: 1, borderColor: GREEN_BORDER, backgroundColor: 'rgba(52,211,153,0.05)', borderRadius: 14, padding: 14, gap: 9 },
  retainLabel: { color: GREEN, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  retainItem: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  retainCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  retainTxt: { color: 'rgba(255,255,255,0.92)', fontSize: 14.5, lineHeight: 20, flex: 1 },

  list: { gap: 8 },
  listItem: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  listDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: V, marginTop: 8 },
  listTxt: { color: 'rgba(255,255,255,0.88)', fontSize: 14.5, lineHeight: 21, flex: 1 },

  paragraph: { color: 'rgba(255,255,255,0.85)', fontSize: 15.5, lineHeight: 23 },
});
