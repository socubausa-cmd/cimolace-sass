import '@/global.css';

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, type ColorValue } from 'react-native';

import { LoginScreen } from '@/components/login-screen';
import { LiriColors, LiriFonts } from '@/constants/liri-theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { setupLiveKit } from '@/lib/livekit-setup';

// WebRTC globals nécessaires au SDK LiveKit natif — appelé une seule fois.
// Sur web/Expo Go : no-op (voir livekit-setup.web.ts).
setupLiveKit();

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const tab = (name: FeatherName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size - 1} color={color} />;
  };

/**
 * Options d'une route PLEIN ÉCRAN : retirée de la barre d'onglets (`href: null`)
 * ET barre masquée quand la route est affichée (`tabBarStyle.display: 'none'`),
 * pour que les coques immersives (régie live, arena, smartboard…) occupent
 * tout l'écran sans chevauchement de la tab bar.
 */
const fullScreen = { href: null, tabBarStyle: { display: 'none' as const } };

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
      {/* Onglets principaux — alignés sur le rail du portail web */}
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: tab('home') }} />
      <Tabs.Screen name="lives" options={{ title: 'Lives', tabBarIcon: tab('video') }} />
      <Tabs.Screen name="forum" options={{ title: 'Forum', tabBarIcon: tab('message-square') }} />
      <Tabs.Screen name="studio" options={{ title: 'Studio', tabBarIcon: tab('edit-3') }} />
      <Tabs.Screen name="bibliotheque" options={{ title: 'Biblio.', tabBarIcon: tab('book-open') }} />
      <Tabs.Screen name="brain" options={{ title: 'Brain', tabBarIcon: tab('zap') }} />
      {/* Secondaires — accessibles via liens, masqués de la barre (comme le web) */}
      <Tabs.Screen name="integrations" options={{ href: null }} />
      <Tabs.Screen name="reglages" options={{ href: null }} />
      <Tabs.Screen name="live-room" options={fullScreen} />
      <Tabs.Screen name="creer-formation" options={{ href: null }} />
      <Tabs.Screen name="creer-masterclass" options={{ href: null }} />
      <Tabs.Screen name="creer-arena" options={{ href: null }} />
      <Tabs.Screen name="creer-discussion" options={{ href: null }} />
      {/* Moteurs natifs immersifs — plein écran : masqués de la barre ET barre cachée à l'affichage */}
      <Tabs.Screen name="live-host" options={fullScreen} />
      <Tabs.Screen name="arena/[sessionId]" options={fullScreen} />
      <Tabs.Screen name="smartboard" options={fullScreen} />
      <Tabs.Screen name="neuro-recall" options={{ href: null }} />
      <Tabs.Screen name="masterscript" options={{ href: null }} />
      <Tabs.Screen name="engines" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profil" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="vie-scolaire" options={{ href: null }} />
      <Tabs.Screen name="commerce" options={{ href: null }} />
      <Tabs.Screen name="waiting-room" options={{ href: null }} />
      <Tabs.Screen name="export" options={{ href: null }} />
      <Tabs.Screen name="orchestrator-live" options={{ href: null }} />
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
  // [PREVIEW-APP] Aperçu sans login UNIQUEMENT en dev (__DEV__). En build de
  // production (grand public), l'auth est obligatoire → LoginScreen.
  if (__DEV__ && !session) return <AppTabs />;
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
