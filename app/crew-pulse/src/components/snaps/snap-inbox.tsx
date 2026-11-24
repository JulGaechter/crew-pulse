import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, FlatList, PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CrewAvatar } from '@/components/crews/crew-avatar';
import { Icon } from '@/components/ui/icon';
import { C, F } from '@/constants/crew-theme';
import { timeAgo, type ReceivedSnap, type SentSnap, type SnapOverview, type StoryGroup } from '@/services/snaps';

type Props = {
  overview: SnapOverview;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
  onOpenFrom: (senderId: string) => void;
  onOpenStory: (group: StoryGroup) => void;
  /** Zeile ohne neue Snaps antippen -> Kamera, Antwort an diese Person */
  onReply: (to: { id: string; name: string }) => void;
};

/** Eine Zeile pro Person (bzw. pro Gruppe bei Snaps an mehrere): nur der neueste Stand */
type Conversation = {
  key: string;
  name: string;
  /** gesetzt, wenn es genau eine Person ist (dann kann man antworten) */
  personId: string | null;
  unopened: number;
  latestAt: string;
  latest: { dir: 'in'; snap: ReceivedSnap } | { dir: 'out'; snap: SentSnap };
};

export function SnapInbox({ overview, refreshing, onRefresh, onClose, onOpenFrom, onOpenStory, onReply }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const slide = useRef(new Animated.Value(-height)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);

  // Zurück zur Kamera: nach oben hinausgleiten
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => {
    Animated.timing(slide, { toValue: -height, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      () => onCloseRef.current(),
    );
  }, [height, slide]);

  // Nach oben wischen = zurück zur Kamera (sobald die Liste ganz unten ist, sonst wird gescrollt)
  const atEnd = useRef(true);
  const closeRef = useRef(close);
  closeRef.current = close;
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          atEnd.current && g.dy < -12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderMove: (_, g) => slide.setValue(Math.min(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -70 || g.vy < -0.6) closeRef.current();
          else Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [slide],
  );

  // Alles pro Person zusammenfassen – wie bei Snapchat eine Zeile mit dem neuesten Stand
  const convs = new Map<string, Conversation>();
  const touch = (key: string, name: string, personId: string | null, at: string, latest: Conversation['latest']) => {
    const cur = convs.get(key);
    if (!cur) convs.set(key, { key, name, personId, unopened: 0, latestAt: at, latest });
    else if (at > cur.latestAt) Object.assign(cur, { latestAt: at, latest });
    return convs.get(key)!;
  };
  for (const r of overview.received) {
    const c = touch(r.from.id, r.from.name, r.from.id, r.createdAt, { dir: 'in', snap: r });
    if (!r.opened) c.unopened += 1;
  }
  for (const sn of overview.sent) {
    const ids = sn.recipientIds ?? [];
    const single = ids.length === 1;
    const key = single ? ids[0] : ids.length ? `group:${[...ids].sort().join(',')}` : `sent:${sn.id}`;
    touch(key, sn.names.join(', '), single ? ids[0] : null, sn.createdAt, { dir: 'out', snap: sn });
  }
  const items = [...convs.values()].sort((a, b) =>
    a.unopened > 0 !== b.unopened > 0 ? (a.unopened > 0 ? -1 : 1) : b.latestAt.localeCompare(a.latestAt),
  );

  const renderItem = ({ item }: { item: Conversation }) => {
    const isNew = item.unopened > 0;
    let status: string;
    let marker: ReactNode;
    let warn = false;
    if (isNew) {
      status = item.unopened === 1 ? 'Neuer Snap' : `${item.unopened} neue Snaps`;
      marker = <View style={[styles.square, styles.squareNew]} />;
    } else if (item.latest.dir === 'in') {
      status = item.latest.snap.screenshot ? 'Empfangen · Screenshot' : 'Empfangen';
      marker = <View style={[styles.square, styles.squareOpened]} />;
    } else {
      const sn = item.latest.snap;
      const allOpened = sn.opened >= sn.total;
      warn = sn.screenshots > 0;
      status =
        (warn ? 'Screenshot · ' : '') +
        (sn.total === 1 ? (allOpened ? 'Geöffnet' : 'Zugestellt') : `${sn.opened}/${sn.total} geöffnet`);
      marker = <View style={[styles.arrow, allOpened ? styles.arrowOpened : styles.arrowSent]} />;
    }
    const canReply = !isNew && !!item.personId;
    const onPress = isNew
      ? () => onOpenFrom(item.key)
      : canReply
        ? () => onReply({ id: item.personId!, name: item.name })
        : undefined;

    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.raised }]}
        accessibilityRole="button">
        {item.personId ? (
          <CrewAvatar name={item.name} size={46} round />
        ) : (
          <View style={styles.sentIcon}>
            <Icon name="send" size={18} color={C.accent} strokeWidth={2} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.statusRow}>
            {marker}
            <Text style={[styles.status, isNew && styles.statusNew, warn && { color: C.warning }]} numberOfLines={1}>
              {status} · {timeAgo(item.latestAt)}
            </Text>
          </View>
        </View>
        {isNew ? (
          <Text style={styles.tapHint}>Ansehen</Text>
        ) : canReply ? (
          <Icon name="camera" size={20} color={C.textMuted} strokeWidth={2} />
        ) : null}
      </Pressable>
    );
  };

  const stories = (
    <View>
      <Text style={styles.section}>Storys</Text>
      {overview.stories.length === 0 ? (
        <Text style={styles.emptyStories}>Noch keine Storys. Teile ein Foto mit „Meine Story“.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
          {overview.stories.map((g) => (
            <Pressable key={g.user.id} onPress={() => onOpenStory(g)} style={styles.story} accessibilityRole="button">
              <View style={[styles.storyRing, (g.allViewed || g.isOwn) && styles.storyRingSeen]}>
                <CrewAvatar name={g.user.name} size={58} round />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {g.isOwn ? 'Meine Story' : g.user.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Text style={styles.section}>Snaps</Text>
    </View>
  );

  return (
    <Animated.View
      style={[styles.container, { paddingTop: insets.top, transform: [{ translateY: slide }] }]}
      {...swipe.panHandlers}>
      <View style={styles.header}>
        <Text style={styles.title}>Snaps</Text>
        <Pressable onPress={close} style={styles.cameraButton} accessibilityRole="button" accessibilityLabel="Zur Kamera">
          <Icon name="camera" size={22} color={C.onAccent} strokeWidth={2} />
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        renderItem={renderItem}
        ListHeaderComponent={stories}
        ListEmptyComponent={
          <Text style={styles.empty}>Noch keine Snaps. Mach ein Foto und schick es an deine Crew!</Text>
        }
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          atEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 4;
        }}
        onContentSizeChange={(_, h) => {
          // Kurze Liste (passt auf den Bildschirm) -> immer "unten"
          if (h <= height - insets.top - 80) atEnd.current = true;
        }}
        scrollEventThrottle={32}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { color: C.text, fontSize: 30, fontFamily: F.displayBold },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    color: C.textMuted,
    fontFamily: F.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  emptyStories: { color: C.textMuted, fontFamily: F.regular, fontSize: 14, paddingHorizontal: 20 },
  storyRow: { gap: 14, paddingHorizontal: 16 },
  story: { alignItems: 'center', width: 70, gap: 6 },
  storyRing: { padding: 3, borderRadius: 36, borderWidth: 2.5, borderColor: C.accent },
  storyRingSeen: { borderColor: C.borderStrong },
  storyName: { color: C.textSoft, fontFamily: F.medium, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { color: C.text, fontFamily: F.semibold, fontSize: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  status: { color: C.textMuted, fontFamily: F.regular, fontSize: 13, flexShrink: 1 },
  statusNew: { color: C.accent, fontFamily: F.semibold },
  square: { width: 12, height: 12, borderRadius: 3 },
  squareNew: { backgroundColor: C.accent },
  squareOpened: { borderWidth: 2, borderColor: C.accent },
  arrow: { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 11, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  arrowSent: { borderLeftColor: C.accent },
  arrowOpened: { borderLeftColor: C.textMuted },
  tapHint: { color: C.accent, fontFamily: F.semibold, fontSize: 13 },
  sentIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: C.textMuted, fontFamily: F.regular, fontSize: 15, textAlign: 'center', padding: 32 },
});
