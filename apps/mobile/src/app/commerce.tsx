import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PaymentSheet, { type PaymentItem } from '@/components/commerce/payment-sheet';
import { LiriFonts as F, softShadow, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

/**
 * Commerce (natif) — Forfaits + Boutique. Paiement NATIF Mobile Money (PawaPay)
 * via PaymentSheet (opérateur + numéro + validation sur téléphone + polling).
 * Le checkout carte/web reste accessible en repli (Linking).
 */
const WEB = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');

const toCents = (price: string) => parseInt(price.replace(/[^\d]/g, ''), 10) || 0;

type Tab = 'forfaits' | 'boutique';

const FORFAITS = [
  { id: 'mensuel', label: 'Mensuel', price: '9 900', period: '/ mois', perks: ['Accès tous les lives', 'Replays illimités', 'Neuron IA'], featured: false },
  { id: 'trimestre', label: 'Trimestriel', price: '26 900', period: '/ trim.', perks: ['Tout le mensuel', '-10% vs mensuel', 'Support prioritaire'], featured: true },
  { id: 'annee', label: 'Annuel', price: '94 900', period: '/ an', perks: ['Tout le trimestriel', '-20% vs mensuel', 'Certificats inclus'], featured: false },
];

const BOUTIQUE = [
  { id: 'pack-sacre', label: 'Pack Sacré', desc: 'Ouvrages fondateurs (PDF)', price: '14 900', emoji: '📜' },
  { id: 'fiches', label: 'Fiches de révision', desc: '21 sciences · format imprimable', price: '6 900', emoji: '🗂️' },
  { id: 'audio', label: 'Pack audio', desc: 'Cours en audio (hors-ligne)', price: '9 900', emoji: '🎧' },
];

export default function CommerceScreen() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [tab, setTab] = useState<Tab>('forfaits');
  const [payItem, setPayItem] = useState<PaymentItem | null>(null);

  const buyForfait = (f: (typeof FORFAITS)[number]) =>
    setPayItem({
      label: `Forfait ${f.label}`,
      kind: 'subscription',
      planSlug: `isna-forfait-${f.id}`,
      amountCents: toCents(f.price),
      priceLabel: `${f.price} FCFA`,
    });

  const buyBoutique = (b: (typeof BOUTIQUE)[number]) =>
    setPayItem({
      label: b.label,
      kind: 'donation',
      amountCents: toCents(b.price),
      priceLabel: `${b.price} FCFA`,
    });

  const openWebCheckout = (kind: string, id: string) => {
    if (!WEB) return;
    const url = `${WEB}/m/eleve/${kind === 'forfait' ? 'forfaits' : 'boutique'}?ref=${id}`;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <Text style={s.h1}>Boutique &amp; forfaits</Text>
          <Text style={s.h1sub}>Abonne-toi ou achète des ressources</Text>
        </View>

        <View style={s.tabs}>
          <Pressable style={[s.tab, tab === 'forfaits' && s.tabOn]} onPress={() => setTab('forfaits')}>
            <Text style={[s.tabTxt, tab === 'forfaits' && s.tabTxtOn]}>Forfaits</Text>
          </Pressable>
          <Pressable style={[s.tab, tab === 'boutique' && s.tabOn]} onPress={() => setTab('boutique')}>
            <Text style={[s.tabTxt, tab === 'boutique' && s.tabTxtOn]}>Boutique</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'forfaits'
            ? FORFAITS.map((f) => (
                <View key={f.id} style={[s.card, f.featured && s.cardFeatured]}>
                  {f.featured ? <View style={s.popular}><Text style={s.popularTxt}>POPULAIRE</Text></View> : null}
                  <Text style={s.planLabel}>{f.label}</Text>
                  <View style={s.priceRow}>
                    <Text style={s.price}>{f.price}</Text>
                    <Text style={s.currency}>FCFA</Text>
                    <Text style={s.period}>{f.period}</Text>
                  </View>
                  <View style={s.perks}>
                    {f.perks.map((p) => (
                      <View key={p} style={s.perk}>
                        <Feather name="check" size={15} color={C.coral} />
                        <Text style={s.perkTxt}>{p}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable style={({ pressed }) => [s.cta, f.featured && s.ctaFeatured, pressed && s.pressed]} onPress={() => buyForfait(f)}>
                    <Feather name="smartphone" size={15} color={f.featured ? '#fff' : C.coral} />
                    <Text style={[s.ctaTxt, f.featured && s.ctaTxtFeatured]}>Payer · Mobile Money</Text>
                  </Pressable>
                  {WEB ? (
                    <Pressable onPress={() => openWebCheckout('forfait', f.id)} hitSlop={6}>
                      <Text style={s.cardLink}>ou payer par carte</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            : BOUTIQUE.map((b) => (
                <Pressable key={b.id} style={({ pressed }) => [s.shopRow, pressed && s.pressed]} onPress={() => buyBoutique(b)}>
                  <View style={s.shopEmoji}><Text style={{ fontSize: 24 }}>{b.emoji}</Text></View>
                  <View style={s.shopMid}>
                    <Text style={s.shopLabel}>{b.label}</Text>
                    <Text style={s.shopDesc}>{b.desc}</Text>
                  </View>
                  <View style={s.shopBuy}>
                    <Text style={s.shopPrice}>{b.price}</Text>
                    <Text style={s.shopFcfa}>FCFA</Text>
                  </View>
                </Pressable>
              ))}
          <Text style={s.footer}>Paiement sécurisé · Mobile money &amp; carte</Text>
        </ScrollView>
      </SafeAreaView>

      <PaymentSheet visible={!!payItem} item={payItem} onClose={() => setPayItem(null)} />
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  pressed: { opacity: 0.7 },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  h1: { color: C.ink, fontSize: 26, fontWeight: '700', fontFamily: F.serif },
  h1sub: { color: C.faint, fontSize: 13, marginTop: 2, fontFamily: F.sans },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingVertical: 10, backgroundColor: C.panelTint },
  tabOn: { backgroundColor: C.coralTint, borderColor: C.coral },
  tabTxt: { color: C.muted, fontSize: 14, fontWeight: '700', fontFamily: F.sans },
  tabTxtOn: { color: C.coral },
  scroll: { paddingHorizontal: 18, paddingBottom: 36, paddingTop: 8 },

  card: { borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.panelTint, padding: 18, marginBottom: 12 },
  cardFeatured: { borderColor: C.coral, ...softShadow },
  popular: { alignSelf: 'flex-start', backgroundColor: C.coral, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  popularTxt: { color: '#fff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  planLabel: { color: C.ink, fontSize: 17, fontWeight: '800', fontFamily: F.sans },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 8 },
  price: { color: C.ink, fontSize: 30, fontWeight: '800', fontFamily: F.sans },
  currency: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 5 },
  period: { color: C.faint, fontSize: 13, marginBottom: 5 },
  perks: { gap: 8, marginTop: 14, marginBottom: 16 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkTxt: { color: C.muted, fontSize: 13.5, fontFamily: F.sans },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: C.coral, paddingVertical: 12 },
  ctaFeatured: { backgroundColor: C.coral },
  ctaTxt: { color: C.coral, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  ctaTxtFeatured: { color: '#fff' },
  cardLink: { color: C.faint, fontSize: 12.5, textAlign: 'center', marginTop: 8, textDecorationLine: 'underline', fontFamily: F.sans },

  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panelTint, padding: 14, marginBottom: 10 },
  shopEmoji: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  shopMid: { flex: 1, minWidth: 0 },
  shopLabel: { color: C.ink, fontSize: 15, fontWeight: '700', fontFamily: F.sans },
  shopDesc: { color: C.faint, fontSize: 12.5, marginTop: 2, fontFamily: F.sans },
  shopBuy: { alignItems: 'flex-end' },
  shopPrice: { color: C.coral, fontSize: 16, fontWeight: '800', fontFamily: F.sans },
  shopFcfa: { color: C.faint, fontSize: 10, fontWeight: '600' },
  footer: { color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: 16, fontFamily: F.sans },
});
