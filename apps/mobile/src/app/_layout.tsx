import '@/global.css';

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, type ColorValue } from 'react-native';

import { LoginScreen } from '@/components/login-screen';
import { LiriFonts } from '@/constants/liri-theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { EngineProvider, useEngine } from '@/lib/engine-context';
import { setupLiveKit } from '@/lib/livekit-setup';
import { PreferencesProvider } from '@/lib/preferences';
import { TenantProvider } from '@/lib/tenant';
import { ThemeProvider, useTheme } from '@/lib/theme';

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

/**
 * Toutes les routes de l'app. Celles du moteur ACTIF prennent un titre et une
 * icône dans la barre du bas ; les autres passent en `href: null`.
 * ⚠️ Une route absente de cette liste est ajoutée d'office à la barre par Expo
 * Router, sans titre ni icône — un test de contrat le vérifie.
 */
const HIDDEN = [
  // ⚠️ L'ORDRE fait l'ordre de la barre du bas. Accueil d'abord (il ouvre chaque
  // moteur), puis les items dans l'ordre où les moteurs les listent.
  'index',
  'lives', 'forum', 'bibliotheque', 'brain',
  'semaine', 'formations', 'videotheque', 'vie-scolaire', 'ma-classe',
  'commerce',
  'studio', 'masterscript', 'neuro-recall',
  // Le reste n'apparaît jamais dans la barre, mais doit être déclaré.
  'integrations', 'reglages', 'creer-formation', 'creer-masterclass',
  'creer-arena', 'creer-discussion', 'engines', 'notifications', 'profil',
  'messages', 'nouveau-message', 'forum/[topicId]', 'calendrier-annuel',
  'rendez-vous', 'rdv', 'waiting-room', 'export', 'orchestrator-live',
];
/** Coques immersives : hors barre ET barre masquée à l'affichage. */
const IMMERSIVE = [
  'formation/[courseId]', 'live-room', 'precepteur/[masterclassId]',
  'live-host', 'arena/[sessionId]', 'smartboard',
];

function AppTabs() {
  const { colors } = useTheme();
  const { items } = useEngine();

  // Route → options d'onglet, recalculées à chaque changement de moteur.
  const shown = new Map(items.map((it) => [it.route, it]));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.coral,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.rail,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600', fontFamily: LiriFonts.sans },
        sceneStyle: { backgroundColor: colors.base },
      }}
    >
      {HIDDEN.map((name) => {
        const it = shown.get(name);
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={it ? { title: it.label, tabBarIcon: tab(it.icon) } : { href: null }}
          />
        );
      })}
      {IMMERSIVE.map((name) => <Tabs.Screen key={name} name={name} options={fullScreen} />)}
    </Tabs>
  );
}

/** Gate d'authentification : splash → login → app. */
function Gate() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.base, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.coral} />
      </View>
    );
  }
  // [PREVIEW-APP] Aperçu sans login UNIQUEMENT en dev (__DEV__). En build de
  // production (grand public), l'auth est obligatoire → LoginScreen.
  if (__DEV__ && !session) return <AppTabs />;
  return session ? <AppTabs /> : <LoginScreen />;
}

function ThemedStatusBar() {
  const { isLight } = useTheme();
  return <StatusBar style={isLight ? 'dark' : 'light'} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <AuthProvider>
          {/* TenantProvider sous AuthProvider : il lit tenant_services, protégé
              par RLS, donc il lui faut la session. EngineProvider en dépend. */}
          <TenantProvider>
            <EngineProvider>
              <ThemedStatusBar />
              <Gate />
            </EngineProvider>
          </TenantProvider>
        </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
