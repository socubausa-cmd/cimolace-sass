import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { LiriColors as C } from '@/constants/liri-theme';

/**
 * Dégradé "ember" coral→clay (135°) — la signature chaleureuse du portail web
 * (linear-gradient(135deg,#d97757,#c2683f)). Remplace un fond coral plein pour
 * donner de la profondeur aux éléments héro (boutons, avatars, marques).
 * Le `style` fournit la taille / le rayon / le centrage ; le dégradé remplit.
 */
export function Ember({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <LinearGradient
      colors={[C.coral, C.clay]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
