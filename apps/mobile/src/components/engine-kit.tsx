import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

// ── EngineHeader ────────────────────────────────────────────────────────────

interface EngineHeaderProps {
  /** Titre affiché au centre de l'en-tête. */
  title: string;
  /** Callback déclenché par le bouton retour (chevron-left). */
  onBack: () => void;
}

/**
 * En-tête partagé pour tous les moteurs ISNA.
 * Bouton retour Feather chevron-left à gauche, titre serif centré.
 */
export function EngineHeader({ title, onBack }: EngineHeaderProps) {
  const { colors: C } = useTheme();
  const hdr = useMemo(() => makeHdr(C), [C]);
  return (
    <View style={hdr.row}>
      <Pressable
        style={({ pressed }) => [hdr.back, pressed && hdr.pressed]}
        onPress={onBack}
        hitSlop={10}
        accessibilityLabel="Retour"
        accessibilityRole="button"
      >
        <Feather name="chevron-left" size={22} color={C.ink} />
      </Pressable>
      <Text style={hdr.title} numberOfLines={1}>
        {title}
      </Text>
      {/* espaceur symétrique pour centrer le titre */}
      <View style={hdr.spacer} />
    </View>
  );
}

const makeHdr = (C: LiriPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.rail,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 8,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel,
  },
  pressed: { opacity: 0.6 },
  title: {
    flex: 1,
    color: C.ink,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: F.serif,
    textAlign: 'center',
  },
  spacer: { width: 36 },
});

// ── EngineCard ───────────────────────────────────────────────────────────────

interface EngineCardProps {
  children: React.ReactNode;
  /** Style supplémentaire appliqué à la carte. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Carte de contenu sur fond panel, ombre douce, bord fin.
 * Utilisée pour encapsuler les blocs de données dans les moteurs.
 */
export function EngineCard({ children, style }: EngineCardProps) {
  const { colors: C } = useTheme();
  const card = useMemo(() => makeCard(C), [C]);
  return <View style={[card.root, softShadow, style]}>{children}</View>;
}

const makeCard = (C: LiriPalette) => StyleSheet.create({
  root: {
    backgroundColor: C.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
  },
});

// ── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  /** Nom d'icône Feather. */
  icon: React.ComponentProps<typeof Feather>['name'];
  /** Titre principal (serif, ink). */
  title: string;
  /** Sous-titre explicatif (sans, muted). */
  subtitle?: string;
}

/**
 * État vide honnête — affiché quand une liste est vide ou inaccessible.
 * Ne présente jamais de fausses données.
 */
export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const { colors: C } = useTheme();
  const empty = useMemo(() => makeEmpty(C), [C]);
  return (
    <View style={empty.root}>
      <View style={empty.iconBox}>
        <Feather name={icon} size={26} color={C.coral} />
      </View>
      <Text style={empty.title}>{title}</Text>
      {subtitle ? <Text style={empty.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const makeEmpty = (C: LiriPalette) => StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.coralTint,
    marginBottom: 4,
  },
  title: {
    color: C.ink,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: F.serif,
    textAlign: 'center',
  },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: F.sans,
    textAlign: 'center',
  },
});

// ── PrimaryButton ────────────────────────────────────────────────────────────

interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  /** Libellé du bouton. */
  label: string;
  /** Style supplémentaire sur le Pressable externe. */
  style?: StyleProp<ViewStyle>;
  /** Variante désactivée (opacité réduite, non pressable). */
  disabled?: boolean;
}

/**
 * Bouton principal charte coral ISNA.
 * À utiliser pour toutes les CTA primaires dans les moteurs.
 */
export function PrimaryButton({ label, style, disabled, ...rest }: PrimaryButtonProps) {
  const { colors: C } = useTheme();
  const btn = useMemo(() => makeBtn(C), [C]);
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        btn.root,
        pressed && btn.pressed,
        disabled && btn.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={btn.label}>{label}</Text>
    </Pressable>
  );
}

const makeBtn = (C: LiriPalette) => StyleSheet.create({
  root: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: F.sans,
    letterSpacing: 0.2,
  },
});
