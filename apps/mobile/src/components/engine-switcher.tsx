import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { type EngineDef, type EngineKey } from '@/lib/engines-nav';
import { useTheme } from '@/lib/theme';

/**
 * Sélecteur de MOTEUR — pendant natif du sélecteur d'en-tête du portail web.
 *
 * Sur mobile il n'y a pas de rail latéral : le moteur actif pilote la barre du
 * bas, et ce bouton d'en-tête sert à en changer. Une seule liste, pas de
 * sous-menu : chaque moteur mène directement à son premier écran.
 */
export function EngineSwitcher({
  engines, active, onSelect,
}: {
  engines: EngineDef[];
  active: EngineKey;
  onSelect: (key: EngineKey) => void;
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [open, setOpen] = useState(false);

  const current = engines.find((e) => e.key === active) ?? engines[0];
  // Un seul moteur souscrit : le sélecteur n'aurait rien à proposer.
  if (!current || engines.length < 2) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Moteur ${current.label}, changer`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Feather name={current.icon} size={13} color={C.coral} />
        <Text style={styles.chipTxt}>{current.label}</Text>
        <Feather name="chevron-down" size={13} color={C.faint} />
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <SafeAreaView edges={['top']}>
            {/* stopPropagation : un appui DANS la feuille ne doit pas la fermer */}
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>Moteurs</Text>
              {engines.map((e) => {
                const on = e.key === active;
                return (
                  <Pressable
                    key={e.key}
                    accessibilityRole="button"
                    onPress={() => { setOpen(false); onSelect(e.key); }}
                    style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
                  >
                    <View style={[styles.rowIcon, on && styles.rowIconOn]}>
                      <Feather name={e.icon} size={16} color={on ? '#fff' : C.muted} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={[styles.rowLabel, on && styles.rowLabelOn]}>{e.label}</Text>
                      <Text style={styles.rowSub}>{e.sub}</Text>
                    </View>
                    {on ? <Feather name="check" size={16} color={C.coral} /> : null}
                  </Pressable>
                );
              })}
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  flex1: { flex: 1 },
  pressed: { opacity: 0.7 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, height: 30, borderRadius: 9,
    backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line,
  },
  chipTxt: { color: C.ink, fontSize: 12.5, fontWeight: '600', fontFamily: F.sans },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)' },
  sheet: {
    marginHorizontal: 14, marginTop: 8, padding: 12, borderRadius: 18,
    backgroundColor: C.rail, borderWidth: 1, borderColor: C.line,
  },
  sheetTitle: {
    color: C.faint, fontSize: 11.5, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10, marginLeft: 4, fontFamily: F.sans,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  rowOn: { borderColor: C.coral, backgroundColor: C.coralTint },
  rowIcon: {
    width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.line,
  },
  rowIconOn: { backgroundColor: C.coral, borderColor: C.coral },
  rowLabel: { color: C.ink, fontSize: 15, fontWeight: '600', fontFamily: F.sans },
  rowLabelOn: { color: C.ink },
  rowSub: { color: C.faint, fontSize: 12, marginTop: 1, fontFamily: F.sans },
});
