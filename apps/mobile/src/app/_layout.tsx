import '@/global.css';

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, type ColorValue } from 'react-native';

import { LoginScreen } from '@/components/login-screen';
import { LiriColors, LiriFonts } from '@/constants/liri-theme';
import { AuthProvider, useAuth } from '@/lib/auth';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const tab = (name: FeatherName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size - 1} color={color} />;
  };

function AppTabs() {
  return (
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
  );
}

/** Gate d'authentification : splash → login → app. */
function Gate() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: LiriColors.base, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={LiriColors.coral} />
      </View>
    );
  }
  return session ? <AppTabs /> : <LoginScreen />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Gate />
    </AuthProvider>
  );
}
