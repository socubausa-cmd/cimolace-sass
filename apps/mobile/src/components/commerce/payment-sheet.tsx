import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';
import {
  MOBILE_MONEY_PROVIDERS,
  createMobileMoneyDeposit,
  pollDepositStatus,
  type MobileMoneyProvider,
  type OfferingKind,
} from '@/lib/liri-api';

/**
 * Feuille de paiement Mobile Money (PawaPay) NATIVE — parité avec le checkout web.
 * L'utilisateur choisit son opérateur, saisit son numéro, lance le dépôt, puis
 * valide la transaction sur son téléphone (USSD/app). On interroge le statut
 * jusqu'à COMPLETED/FAILED.
 */
export interface PaymentItem {
  label: string;
  kind: OfferingKind;
  amountCents?: number;
  planSlug?: string;
  /** Affichage indicatif (ex: '9 900 FCFA'). */
  priceLabel?: string;
}

type Phase = 'form' | 'sending' | 'pending' | 'done' | 'error';

export default function PaymentSheet({
  visible,
  item,
  onClose,
}: {
  visible: boolean;
  item: PaymentItem | null;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<MobileMoneyProvider>(MOBILE_MONEY_PROVIDERS[0]);
  const [phone, setPhone] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [status, setStatus] = useState<string>('');
  const [err, setErr] = useState<string>('');

  // Pays uniques (pour le sélecteur), opérateurs filtrés par pays choisi.
  const countries = useMemo(() => {
    const seen = new Set<string>();
    return MOBILE_MONEY_PROVIDERS.filter((p) => (seen.has(p.country) ? false : seen.add(p.country)));
  }, []);
  const operators = useMemo(
    () => MOBILE_MONEY_PROVIDERS.filter((p) => p.country === provider.country),
    [provider.country],
  );

  const reset = () => {
    setPhase('form');
    setStatus('');
    setErr('');
  };

  const close = () => {
    reset();
    setPhone('');
    onClose();
  };

  const pay = async () => {
    if (!item) return;
    const digits = phone.replace(/\s/g, '');
    if (!/^\+?[1-9]\d{6,14}$/.test(digits)) {
      setErr('Numéro invalide (format international, ex: ' + provider.dialCode + '6XXXXXXXX).');
      return;
    }
    setErr('');
    setPhase('sending');
    const e164 = digits.startsWith('+') ? digits : `${provider.dialCode}${digits.replace(/^0+/, '')}`;
    const dep = await createMobileMoneyDeposit({
      kind: item.kind,
      phoneNumber: e164,
      provider: provider.code,
      country: provider.country,
      planSlug: item.planSlug,
      amountCents: item.amountCents,
    });
    if (!dep?.depositId) {
      setPhase('error');
      setErr("Le paiement n'a pas pu être initié. Vérifie ta connexion et réessaie.");
      return;
    }
    setPhase('pending');
    setStatus(dep.status || 'PENDING');
    const final = await pollDepositStatus(dep.depositId, {
      onTick: (s) => setStatus(s.status),
    });
    if (final?.isCompleted || /COMPLETED/i.test(final?.status ?? '')) {
      setPhase('done');
    } else {
      setPhase('error');
      setErr(
        final?.status && /FAILED|REJECTED|CANCELLED/i.test(final.status)
          ? 'Paiement refusé ou annulé.'
          : "Paiement non confirmé à temps. Si tu as validé sur ton téléphone, l'accès s'activera sous peu.",
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={s.backdrop}>
        <Pressable style={s.backdropTap} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={s.sheet}>
            <View style={s.grip} />
            <View style={s.head}>
              <Feather name="smartphone" size={18} color={C.coral} />
              <Text style={s.title}>Paiement Mobile Money</Text>
              <Pressable onPress={close} hitSlop={10}><Feather name="x" size={20} color={C.muted} /></Pressable>
            </View>

            {item && (
              <View style={s.item}>
                <Text style={s.itemLabel}>{item.label}</Text>
                {!!item.priceLabel && <Text style={s.itemPrice}>{item.priceLabel}</Text>}
              </View>
            )}

            {phase === 'form' && (
              <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
                <Text style={s.section}>PAYS</Text>
                <View style={s.chips}>
                  {countries.map((c) => {
                    const on = c.country === provider.country;
                    return (
                      <Pressable
                        key={c.country}
                        style={[s.chip, on && s.chipOn]}
                        onPress={() => setProvider(MOBILE_MONEY_PROVIDERS.find((p) => p.country === c.country)!)}
                      >
                        <Text style={[s.chipTxt, on && s.chipTxtOn]}>{c.countryLabel}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={s.section}>OPÉRATEUR</Text>
                <View style={s.ops}>
                  {operators.map((op) => {
                    const on = op.code === provider.code;
                    return (
                      <Pressable key={op.code} style={[s.op, on && s.opOn]} onPress={() => setProvider(op)}>
                        <View style={[s.opDot, { backgroundColor: op.color }]} />
                        <Text style={[s.opLabel, on && s.opLabelOn]}>{op.label}</Text>
                        {on && <Feather name="check-circle" size={16} color={C.coral} />}
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={s.section}>NUMÉRO MOBILE MONEY</Text>
                <View style={s.phoneRow}>
                  <View style={s.dial}><Text style={s.dialTxt}>{provider.dialCode}</Text></View>
                  <TextInput
                    style={s.phone}
                    placeholder="6 XX XX XX XX"
                    placeholderTextColor={C.faint}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
                {!!err && <Text style={s.err}>{err}</Text>}

                <Pressable style={({ pressed }) => [s.payBtn, pressed && s.pressed]} onPress={pay}>
                  <Feather name="lock" size={16} color="#fff" />
                  <Text style={s.payTxt}>Payer {item?.priceLabel ?? ''}</Text>
                </Pressable>
                <Text style={s.secure}>Sécurisé par PawaPay · {provider.currency}</Text>
              </ScrollView>
            )}

            {(phase === 'sending' || phase === 'pending') && (
              <View style={s.state}>
                <ActivityIndicator color={C.coral} size="large" />
                <Text style={s.stateTitle}>
                  {phase === 'sending' ? 'Initialisation du paiement…' : 'Validation en cours'}
                </Text>
                <Text style={s.stateNote}>
                  {phase === 'sending'
                    ? 'Connexion à l’opérateur…'
                    : `Confirme la demande sur ton téléphone (${provider.label}). Statut : ${status}`}
                </Text>
              </View>
            )}

            {phase === 'done' && (
              <View style={s.state}>
                <View style={[s.badge, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
                  <Feather name="check" size={30} color="#34D399" />
                </View>
                <Text style={s.stateTitle}>Paiement confirmé 🎉</Text>
                <Text style={s.stateNote}>Ton accès est activé. Merci !</Text>
                <Pressable style={({ pressed }) => [s.payBtn, pressed && s.pressed]} onPress={close}>
                  <Text style={s.payTxt}>Terminer</Text>
                </Pressable>
              </View>
            )}

            {phase === 'error' && (
              <View style={s.state}>
                <View style={[s.badge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Feather name="alert-triangle" size={28} color={C.live} />
                </View>
                <Text style={s.stateTitle}>Paiement non confirmé</Text>
                <Text style={s.stateNote}>{err}</Text>
                <Pressable style={({ pressed }) => [s.retry, pressed && s.pressed]} onPress={reset}>
                  <Text style={s.retryTxt}>Réessayer</Text>
                </Pressable>
              </View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: { backgroundColor: C.base, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 8, maxHeight: '90%' },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  title: { flex: 1, color: C.ink, fontSize: 17, fontWeight: '800', fontFamily: F.serif },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.panelTint, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, marginTop: 6 },
  itemLabel: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.sans, flex: 1 },
  itemPrice: { color: C.coral, fontSize: 16, fontWeight: '800', fontFamily: F.sans },
  body: { marginTop: 6 },
  bodyContent: { paddingBottom: 18 },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 16, marginBottom: 8, fontFamily: F.sans },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panelTint, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn: { borderColor: C.coral, backgroundColor: C.coralTint },
  chipTxt: { color: C.muted, fontSize: 13, fontWeight: '600', fontFamily: F.sans },
  chipTxtOn: { color: C.coral },
  ops: { gap: 8 },
  op: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.panelTint, padding: 13 },
  opOn: { borderColor: C.coral },
  opDot: { width: 12, height: 12, borderRadius: 6 },
  opLabel: { color: C.ink, fontSize: 14.5, fontWeight: '600', flex: 1, fontFamily: F.sans },
  opLabelOn: { fontWeight: '800' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dial: { backgroundColor: C.panelTint, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, paddingVertical: 13 },
  dialTxt: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  phone: { flex: 1, backgroundColor: C.panelTint, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 13, color: C.ink, fontSize: 16, fontFamily: F.sans },
  err: { color: C.live, fontSize: 12.5, marginTop: 8, fontFamily: F.sans },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.coral, borderRadius: 15, paddingVertical: 15, marginTop: 18 },
  payTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800', fontFamily: F.sans },
  secure: { color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 10, fontFamily: F.sans },
  pressed: { opacity: 0.8 },
  state: { alignItems: 'center', gap: 10, paddingVertical: 34, paddingHorizontal: 10 },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: C.ink, fontSize: 18, fontWeight: '800', fontFamily: F.serif, marginTop: 4, textAlign: 'center' },
  stateNote: { color: C.muted, fontSize: 13.5, textAlign: 'center', lineHeight: 20, fontFamily: F.sans, paddingHorizontal: 12 },
  retry: { backgroundColor: C.panel, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  retryTxt: { color: C.ink, fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },
});
