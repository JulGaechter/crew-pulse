import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { previewText } from '@/components/chat/message-bubble';
import { CrewAvatar } from '@/components/crews/crew-avatar';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { BottomTabInset } from '@/constants/theme';
import type { ConnectionState } from '@/hooks/use-socket-connection';
import type { CrewSummary } from '@/services/chat-types';

function formatWhen(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Gestern';
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

type Props = {
  crews: CrewSummary[];
  loading: boolean;
  error: string | null;
  connection: ConnectionState;
  myId: string;
  myName: string;
  showLinkHint: boolean;
  onRefresh: () => void;
  onOpenCrew: (crewId: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onOpenAccount: () => void;
};

export function CrewList({
  crews,
  loading,
  error,
  connection,
  myId,
  myName,
  showLinkHint,
  onRefresh,
  onOpenCrew,
  onCreate,
  onJoin,
  onOpenAccount,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom + BottomTabInset + 12;

  const renderItem = ({ item }: { item: CrewSummary }) => {
    const last = item.lastMessage;
    const lastText = last ? previewText(last) : '';
    const preview = last
      ? `${last.senderId === myId ? 'Du' : last.sender}: ${lastText}`
      : `${item.memberCount} ${item.memberCount === 1 ? 'Mitglied' : 'Mitglieder'} · noch keine Nachrichten`;
    const unread = item.unreadCount > 0;
    return (
      <Pressable
        onPress={() => onOpenCrew(item.id)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <CrewAvatar name={item.name} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.crewName} numberOfLines={1}>
              {item.name}
              {item.muted ? '  🔕' : ''}
            </Text>
            <Text style={[styles.when, unread && styles.whenUnread]}>{formatWhen(last?.createdAt)}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
              {preview}
            </Text>
            {unread && (
              <View style={[styles.badge, item.muted && styles.badgeMuted]}>
                <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Crews</Text>
          <ConnectionStatus connection={connection} />
        </View>
        <Pressable onPress={onOpenAccount} hitSlop={10} style={styles.nameChip}>
          <Text style={styles.nameChipText} numberOfLines={1}>
            {myName}
          </Text>
        </Pressable>
      </View>

      {showLinkHint && (
        <Pressable onPress={onOpenAccount} style={styles.linkHint}>
          <Text style={styles.linkHintText}>
            Konto sichern: Mit Apple oder Google verbinden, um es auf allen Geräten zu nutzen ›
          </Text>
        </Pressable>
      )}

      {loading && crews.length === 0 ? (
        <ActivityIndicator color="#666" style={styles.spinner} />
      ) : (
        <FlatList
          data={crews}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#888" />}
          contentContainerStyle={crews.length === 0 && styles.emptyContainer}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Noch keine Crew</Text>
              <Text style={styles.emptyText}>
                Erstelle eine Crew und lade deine Freunde mit dem Einladungscode ein – oder tritt
                mit einem Code einer bestehenden Crew bei.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          }
          ListFooterComponent={error && crews.length > 0 ? <Text style={styles.error}>{error}</Text> : undefined}
        />
      )}

      <View style={[styles.actions, { paddingBottom: bottomPadding }]}>
        <Pressable onPress={onJoin} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Mit Code beitreten</Text>
        </Pressable>
        <Pressable onPress={onCreate} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Crew erstellen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  nameChip: {
    backgroundColor: '#242424',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 140,
  },
  nameChipText: { color: '#4da6ff', fontWeight: '600', fontSize: 13 },
  linkHint: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  linkHintText: { color: '#93c5fd', fontSize: 13 },
  spinner: { marginTop: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowPressed: { backgroundColor: '#1a1a1a' },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  crewName: { color: '#fff', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  when: { color: '#777', fontSize: 12 },
  whenUnread: { color: '#4da6ff' },
  preview: { color: '#888', fontSize: 14, flex: 1 },
  previewUnread: { color: '#ddd' },
  badge: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMuted: { backgroundColor: '#4b5563' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#1f1f1f', marginLeft: 76 },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#888', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  error: { color: '#f87171', fontSize: 14, textAlign: 'center', padding: 12 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#262626',
  },
  primary: { flex: 1, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondary: { flex: 1, backgroundColor: '#242424', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  pressed: { opacity: 0.7 },
});
