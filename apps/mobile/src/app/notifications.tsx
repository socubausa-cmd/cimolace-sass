import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiriColors as C, LiriFonts as F } from '@/constants/liri-theme';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/liri-api';

type IconName = React.ComponentProps<typeof Feather>['name'];

function iconFor(type?: string | null): { name: IconName; color: string } {
  switch (type) {
    case 'live':
    case 'session':
      return { name: 'radio', color: '#F87171' };
    case 'course':
    case 'formation':
      return { name: 'book-open', color: '#A78BFA' };
    case 'announcement':
      return { name: 'volume-2', color: '#60A5FA' };
    case 'event':
    case 'calendar':
      return { name: 'calendar', color: '#34D399' };
    default:
      return { name: 'bell', color: C.coral };
  }
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setItems(await fetchNotifications());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onTap = async (n: AppNotification) => {
    if (!n.is_read) {
      setItems((prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      await markNotificationRead(n.id);
    }
    if (n.action_url && /^https?:\/\//.test(n.action_url) === false) {
      router.push(n.action_url as never);
    }
  };

  const markAll = async () => {
    setItems((prev) => (prev ?? []).map((x) => ({ ...x, is_read: true })));
    await markAllNotificationsRead();
  };

  const loading = items === null;
  const list = items ?? [];
  const unread = list.filter((n) => !n.is_read).length;

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        <View style={s.header}>
          <View>
            <Text style={s.h1}>Notifications</Text>
            <Text style={s.h1sub}>{unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est à jour'}</Text>
          </View>
          {unread > 0 ? (
            <Pressable style={({ pressed }) => [s.markAll, pressed && s.pressed]} onPress={markAll}>
              <Feather name="check" size={14} color={C.coral} />
              <Text style={s.markAllTxt}>Tout lire</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={s.fill}><ActivityIndicator color={C.coral} /></View>
        ) : list.length === 0 ? (
          <View style={s.fill}>
            <View style={s.emptyMark}><Feather name="bell" size={26} color={C.coral} /></View>
            <Text style={s.emptyTitle}>Aucune notification</Text>
            <Text style={s.emptySub}>Tes alertes (lives, cours, annonces) apparaîtront ici.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.coral} />}
          >
            {list.map((n) => {
              const ic = iconFor(n.type);
              return (
                <Pressable
                  key={n.id}
                  style={({ pressed }) => [s.card, !n.is_read && s.cardUnread, pressed && s.pressed]}
                  onPress={() => onTap(n)}
                >
                  {!n.is_read ? <View style={s.unreadDot} /> : null}
                  <View style={[s.iconBox, { backgroundColor: ic.color + '22' }]}>
                    <Feather name={ic.name} size={17} color={ic.color} />
                  </View>
                  <View style={s.mid}>
                    <Text style={[s.title, n.is_read && s.titleRead]} numberOfLines={2}>{n.title || 'Notification'}</Text>
                    {n.message ? <Text style={s.msg} numberOfLines={2}>{n.message}</Text> : null}
                    <Text style={s.time}>{timeAgo(n.created_at)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  safe: { flex: 1 },
  pressed: { opacity: 0.7 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 60 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 },
  h1: { color: C.ink, fontSize: 28, fontWeight: '700', fontFamily: F.serif },
  h1sub: { color: C.faint, fontSize: 13, marginTop: 2, fontFamily: F.sans },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.coralTint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  markAllTxt: { color: C.coral, fontSize: 12.5, fontWeight: '700', fontFamily: F.sans },

  scroll: { paddingHorizontal: 18, paddingBottom: 36 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, backgroundColor: C.panelTint, borderWidth: 1, borderColor: C.line, marginBottom: 9 },
  cardUnread: { borderColor: C.coralTint2, backgroundColor: C.coralTint2 },
  unreadDot: { position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0, paddingRight: 8 },
  title: { color: C.ink, fontSize: 14.5, fontWeight: '700', fontFamily: F.sans },
  titleRead: { color: C.muted, fontWeight: '600' },
  msg: { color: C.faint, fontSize: 13, marginTop: 3, lineHeight: 18, fontFamily: F.sans },
  time: { color: C.faint, fontSize: 11.5, marginTop: 6, fontFamily: F.sans },

  emptyMark: { width: 60, height: 60, borderRadius: 20, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: C.ink, fontSize: 18, fontWeight: '600', marginTop: 16, fontFamily: F.sans },
  emptySub: { color: C.muted, fontSize: 13.5, textAlign: 'center', marginTop: 6, fontFamily: F.sans },
});
