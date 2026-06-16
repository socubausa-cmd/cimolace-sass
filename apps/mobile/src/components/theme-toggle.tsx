import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { LiriFonts } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

/** Bascule de teinte crème ⇄ sombre — contrôle segmenté (à poser dans Réglages / Profil). */
export function ThemeToggle() {
  const { mode, colors, setMode } = useTheme();
  const opts = [
    { key: 'light' as const, label: 'Crème', icon: 'sun' as const },
    { key: 'dark' as const, label: 'Sombre', icon: 'moon' as const },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 6,
        backgroundColor: colors.panel2,
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      {opts.map((o) => {
        const active = mode === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => setMode(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              paddingVertical: 10,
              borderRadius: 11,
              backgroundColor: active ? colors.panel : 'transparent',
              borderWidth: 1,
              borderColor: active ? colors.line : 'transparent',
            }}
          >
            <Feather name={o.icon} size={15} color={active ? colors.coral : colors.faint} />
            <Text
              style={{
                fontFamily: LiriFonts.sans,
                fontWeight: active ? '700' : '500',
                fontSize: 13.5,
                color: active ? colors.ink : colors.muted,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
