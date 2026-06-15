/**
 * Rail horizontal des scènes (FlatList) : sélection, ajout, suppression, renommage.
 * Le renommage se fait inline via TextInput sur la scène active.
 */
import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LiriFonts as F, type LiriPalette } from '@/constants/liri-theme';
import { useTheme } from '@/lib/theme';

import type { SbKonvaScene } from './types';

interface Props {
  scenes: SbKonvaScene[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function SceneRail({ scenes, activeId, onSelect, onAdd, onDelete, onRename }: Props) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        data={scenes}
        keyExtractor={(s) => s.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const active = item.id === activeId;
          return (
            <Pressable
              onPress={() => onSelect(item.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <View style={styles.chipHead}>
                <Text style={[styles.chipNum, active && styles.chipNumActive]}>{index + 1}</Text>
                {active && scenes.length > 1 ? (
                  <Pressable
                    hitSlop={8}
                    onPress={() => onDelete(item.id)}
                    accessibilityLabel="Supprimer la scène"
                  >
                    <Feather name="trash-2" size={13} color={C.live} />
                  </Pressable>
                ) : null}
              </View>
              {active ? (
                <TextInput
                  value={item.name}
                  onChangeText={(t) => onRename(item.id, t)}
                  style={styles.input}
                  placeholder="Nom"
                  placeholderTextColor={C.faint}
                  maxLength={40}
                />
              ) : (
                <Text style={styles.chipName} numberOfLines={1}>
                  {item.name}
                </Text>
              )}
              <Text style={styles.chipMeta}>{item.objects.length} obj.</Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable onPress={onAdd} style={styles.addChip} accessibilityLabel="Ajouter une scène">
            <Feather name="plus" size={20} color={C.coral} />
            <Text style={styles.addTxt}>Scène</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const makeStyles = (C: LiriPalette) => StyleSheet.create({
  wrap: { backgroundColor: C.rail, borderTopWidth: 1, borderTopColor: C.line },
  list: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: {
    width: 120,
    height: 64,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
    justifyContent: 'space-between',
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipActive: { borderColor: C.coral, backgroundColor: C.coralTint },
  chipHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipNum: { color: C.faint, fontSize: 11, fontWeight: '700', fontFamily: F.sans },
  chipNumActive: { color: C.coral },
  chipName: { color: C.ink, fontSize: 13, fontFamily: F.sans },
  input: {
    color: C.ink,
    fontSize: 13,
    fontFamily: F.sans,
    padding: 0,
    margin: 0,
  },
  chipMeta: { color: C.faint, fontSize: 10, fontFamily: F.sans },
  addChip: {
    width: 64,
    height: 64,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.coral,
  },
  addTxt: { color: C.coral, fontSize: 11, fontWeight: '600', fontFamily: F.sans },
});
