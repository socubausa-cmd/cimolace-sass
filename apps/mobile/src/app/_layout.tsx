import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ColorValue } from 'react-native';

import { LiriColors, LiriFonts } from '@/constants/liri-theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const tab = (name: FeatherName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size - 1} color={color} />;
  };

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: LiriColors.coral,
          tabBarInactiveTintColor: LiriColors.faint,
          tabBarStyle: {
            backgroundColor: LiriColors.rail,
            borderTopColor: LiriColors.line,
            borderTopWidth: 1,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600', fontFamily: LiriFonts.sans },
          sceneStyle: { backgroundColor: LiriColors.base },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: tab('home') }} />
        <Tabs.Screen name="lives" options={{ title: 'Lives', tabBarIcon: tab('video') }} />
        <Tabs.Screen name="brain" options={{ title: 'Brain', tabBarIcon: tab('zap') }} />
        <Tabs.Screen name="studio" options={{ title: 'Studio', tabBarIcon: tab('edit-3') }} />
        <Tabs.Screen name="reglages" options={{ title: 'Réglages', tabBarIcon: tab('sliders') }} />
      </Tabs>
    </>
  );
}
