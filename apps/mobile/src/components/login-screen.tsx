import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ember } from '@/components/ember';
import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export function LoginScreen() {
  const { signIn } = useAuth();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!email.trim() && !!password && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await signIn(email, password);
    if (res.error) {
      setError(res.error);
      setBusy(false);
    }
    // En cas de succès : AuthProvider met à jour la session → le gate bascule
    // vers les onglets et démonte cet écran (pas besoin de reset le busy).
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.brand}>
            <Ember style={styles.mark}><Feather name="zap" size={26} color="#fff" /></Ember>
            <Text style={styles.brandName}>LIRI</Text>
          </View>

          <Text style={styles.title}>Bon retour</Text>
          <Text style={styles.sub}>Connectez-vous à votre espace</Text>

          <View style={styles.field}>
            <Feather name="mail" size={17} color={C.faint} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
            />
          </View>

          <View style={styles.field}>
            <Feather name="lock" size={17} color={C.faint} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor={C.faint}
              secureTextEntry
              onSubmitEditing={submit}
              returnKeyType="go"
            />
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color={C.live} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <Pressable style={[styles.btn, !canSubmit && styles.btnOff]} onPress={submit} disabled={!canSubmit}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Se connecter</Text>}
          </Pressable>

          <Text style={styles.footer}>LIRI v2.0 · Cimolace</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },

  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 },
  mark: { width: 52, height: 52, borderRadius: 17, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', ...softShadow },
  brandName: { color: C.ink, fontSize: 30, fontWeight: '700', letterSpacing: 1, fontFamily: F.sans },

  title: { color: C.ink, fontSize: 28, fontWeight: '500', textAlign: 'center', fontFamily: F.serif },
  sub: { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 26, fontFamily: F.sans },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 15,
    paddingHorizontal: 15, height: 54,
  },
  input: { flex: 1, color: C.ink, fontSize: 15.5, height: '100%', fontFamily: F.sans },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2, marginBottom: 6, paddingHorizontal: 4 },
  errorTxt: { color: C.liveSoft, fontSize: 13, flex: 1, fontFamily: F.sans },

  btn: { height: 54, borderRadius: 15, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center', marginTop: 10, ...softShadow },
  btnOff: { opacity: 0.45 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: F.sans },

  footer: { color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 28, fontFamily: F.sans },
});
