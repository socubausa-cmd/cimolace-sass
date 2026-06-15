/**
 * Barre d'outils du tableau (Pen, Gomme, Rect, Cercle, Texte) + Undo / Clear.
 * 100% native — Pressable + Feather, charte coral.
 */
import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

export type Tool = 'pen' | 'eraser' | 'rect' | 'circle' | 'text';

type IconName = React.ComponentProps<typeof Feather>['name'];

const TOOLS: { key: Tool; icon: IconName; label: string }[] = [
  { key: 'pen', icon: 'edit-2', label: 'Stylo' },
  { key: 'eraser', icon: 'trash', label: 'Gomme' },
  { key: 'rect', icon: 'square', label: 'Carré' },
  { key: 'circle', icon: 'circle', label: 'Cercle' },
  { key: 'text', icon: 'type', label: 'Texte' },
];

interface Props {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  onUndo: () => void;
  canUndo: boolean;
  onClear: () => void;
}

export function Toolbar({ tool, onToolChange, onUndo, canUndo, onClear }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.bar}>
      <View style={styles.group}>
        {TOOLS.map((t) => {
          const active = t.key === tool;
          return (
            <Pressable
              key={t.key}
              onPress={() => onToolChange(t.key)}
              style={({ pressed }) => [
                styles.btn,
                active && styles.btnActive,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t.label}
            >
              <Feather name={t.icon} size={18} color={active ? '#fff' : C.muted} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.group}>
        <Pressable
          onPress={onUndo}
          disabled={!canUndo}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed, !canUndo && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Annuler"
        >
          <Feather name="corner-up-left" size={18} color={canUndo ? C.ink : C.faint} />
        </Pressable>
        <Pressable
          onPress={onClear}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Tout effacer"
        >
          <Feather name="x-circle" size={18} color={C.live} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.rail,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  group: { flexDirection: 'row', gap: 6 },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
  },
  btnActive: { backgroundColor: C.coral, borderColor: C.coral },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});

/** Sélecteur de couleur + épaisseur (réglages du stylo). */
const PALETTE = ['#f5f4ee', '#d97757', '#e2553f', '#6d8f60', '#5a8bd6', '#262624'];
const WIDTHS = [3, 6, 10];

export function PenSettings({
  color,
  width,
  onColor,
  onWidth,
}: {
  color: string;
  width: number;
  onColor: (c: string) => void;
  onWidth: (w: number) => void;
}) {
  const { colors: C } = useTheme();
  const ps = useMemo(() => makeStylesPs(C), [C]);
  return (
    <View style={ps.row}>
      <View style={ps.swatches}>
        {PALETTE.map((c) => (
          <Pressable
            key={c}
            onPress={() => onColor(c)}
            style={[ps.swatch, { backgroundColor: c }, color === c && ps.swatchActive]}
            accessibilityLabel={`Couleur ${c}`}
          />
        ))}
      </View>
      <View style={ps.widths}>
        {WIDTHS.map((w) => (
          <Pressable
            key={w}
            onPress={() => onWidth(w)}
            style={[ps.widthBtn, width === w && ps.widthBtnActive]}
            accessibilityLabel={`Épaisseur ${w}`}
          >
            <View style={[ps.dot, { width: w + 4, height: w + 4, borderRadius: (w + 4) / 2 }]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const makeStylesPs = (C: LiriPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.rail,
    borderTopWidth: 1,
    borderTopColor: C.lineSoft,
  },
  swatches: { flexDirection: 'row', gap: 8 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: C.ink },
  widths: { flexDirection: 'row', gap: 6 },
  widthBtn: {
    width: 34,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
  },
  widthBtnActive: { borderColor: C.coral },
  dot: { backgroundColor: C.ink },
  // label conservé pour cohérence visuelle si réutilisé
  label: { color: C.faint, fontSize: 11, fontFamily: F.sans },
});
