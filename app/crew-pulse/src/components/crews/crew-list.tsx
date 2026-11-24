import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { previewText } from '@/components/chat/message-bubble';
import { CrewAvatar } from '@/components/crews/crew-avatar';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { Icon } from '@/components/ui/icon';
import { avatarColors, C, F, initials, R } from '@/constants/crew-theme';
import { BottomTabInset } from '@/constants/theme';
import type { ConnectionState } from '@/hooks/use-socket-connection';
import type { CrewSummary } from '@/services/chat-types';

function formatWhen(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Gestern';
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

/** Für die Suche: Gross-/Kleinschreibung und Akzente ignorieren ("Zürich" findet "zurich") */
function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
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
  // Knöpfe knapp über der schwebenden Tab-Leiste (iOS: Inhalt endet schon über dem Home-Indikator)
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom + 14 : insets.bottom + BottomTabInset + 12;
  const [query, setQuery] = useState('');
  const me = avatarColors(myName);

  // Suche in Crew-Namen und in der letzten Nachricht
  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return crews;
    return crews.filter(
      (c) => normalize(c.name).includes(q) || normalize(c.lastMessage?.text ?? '').includes(q),
    );
  }, [crews, query]);

  const renderItem = ({ item }: { item: CrewSummary }) => {
    const last = item.lastMessage;
    const preview = last
      ? `${last.senderId === myId ? 'Du' : last.sender}: ${previewText(last)}`
      : `${item.memberCount} ${item.memberCount === 1 ? 'Mitglied' : 'Mitglieder'} · noch keine Nachrichten`;
    const unread = item.unreadCount > 0;
    return (
      <Pressable
        onPress={() => onOpenCrew(item.id)}
        style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}${unread ? `, ${item.unreadCount} ungelesen` : ''}`}>
        <CrewAvatar name={item.name} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <View style={styles.nameRow}>
              <Text style={styles.crewName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.muted && <Icon name="bellOff" size={14} color={C.textMuted} strokeWidth={2} />}
            </View>
            <Text style={[styles.when, unread && !item.muted && styles.whenUnread]}>
              {formatWhen(last?.createdAt)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <Text
              style={[styles.preview, unread && styles.previewUnread, last?.deleted && styles.previewDeleted]}
              numberOfLines={1}>
              {preview}
            </Text>
            {unread && (
              <View style={[styles.badge, item.muted && styles.badgeMuted]}>
                <Text style={[styles.badgeText, item.muted && styles.badgeTextMuted]}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const searching = query.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Crews</Text>
            <ConnectionStatus connection={connection} />
          </View>
          <Pressable
            onPress={onOpenAccount}
            hitSlop={8}
            style={[styles.me, { backgroundColor: me.bg }]}
            accessibilityRole="button"
            accessibilityLabel="Konto">
            <Text style={[styles.meText, { color: me.fg }]}>{initials(myName)}</Text>
          </Pressable>
        </View>

        {crews.length > 0 && (
          <View style={styles.search}>
            <Icon name="search" size={18} color={C.textMuted} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Crews durchsuchen"
              placeholderTextColor={C.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Crews durchsuchen"
            />
          </View>
        )}
      </View>

      {showLinkHint && !searching && (
        <Pressable onPress={onOpenAccount} style={styles.hint} accessibilityRole="button">
          <Icon name="shield" size={22} />
          <Text style={styles.hintText}>Konto sichern – mit Apple oder Google verbinden</Text>
          <Icon name="chevron" size={16} strokeWidth={2} />
        </Pressable>
      )}

      {loading && crews.length === 0 ? (
        <ActivityIndicator color={C.accent} style={styles.spinner} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={C.accent} />}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.emptyContainer]}
          ListEmptyComponent={
            searching ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Keine Crew gefunden für „{query.trim()}“.</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Icon name="chat" size={30} />
                </View>
                <Text style={styles.emptyTitle}>Noch keine Crew</Text>
                <Text style={styles.emptyText}>
                  Erstelle eine Crew und lade deine Freunde mit dem Einladungscode ein – oder tritt mit einem Code
                  einer bestehenden Crew bei.
                </Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            )
          }
          ListFooterComponent={error && crews.length > 0 ? <Text style={styles.error}>{error}</Text> : undefined}
        />
      )}

      <View style={[styles.actions, { paddingBottom: bottomPadding }]}>
        <Pressable onPress={onJoin} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Icon name="code" size={18} strokeWidth={2} />
          <Text style={styles.secondaryText}>Mit Code beitreten</Text>
        </Pressable>
        <Pressable onPress={onCreate} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Icon name="plus" size={18} color={C.onAccent} strokeWidth={2.2} />
          <Text style={styles.primaryText}>Crew erstellen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: C.text, fontSize: 32, fontFamily: F.displayBold, letterSpacing: -0.6 },
  me: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  meText: { fontFamily: F.displayBold, fontSize: 15 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 15, fontFamily: F.regular, paddingVertical: 0 },
  hint: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: C.hintBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: R.lg,
  },
  hintText: { flex: 1, color: C.hintText, fontSize: 13, lineHeight: 18, fontFamily: F.medium },
  spinner: { marginTop: 60 },
  list: { paddingHorizontal: 8, paddingBottom: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.lg },
  rowUnread: { backgroundColor: C.surface },
  rowPressed: { backgroundColor: C.raised },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  crewName: { color: C.text, fontSize: 16, fontFamily: F.semibold, flexShrink: 1 },
  when: { color: C.textMuted, fontSize: 12, fontFamily: F.regular },
  whenUnread: { color: C.accent, fontFamily: F.semibold },
  preview: { color: C.textMuted, fontSize: 14, fontFamily: F.regular, flex: 1 },
  previewUnread: { color: C.textSoft },
  previewDeleted: { fontStyle: 'italic' },
  badge: {
    backgroundColor: C.accent,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMuted: { backgroundColor: C.borderStrong },
  badgeText: { color: C.onAccent, fontSize: 12, fontFamily: F.bold },
  badgeTextMuted: { color: C.textSoft },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { color: C.text, fontSize: 20, fontFamily: F.display, textAlign: 'center' },
  emptyText: { color: C.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center', fontFamily: F.regular },
  error: { color: C.danger, fontSize: 14, textAlign: 'center', padding: 12, fontFamily: F.medium },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  primary: {
    flex: 1,
    height: 50,
    backgroundColor: C.accent,
    borderRadius: R.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: C.onAccent, fontFamily: F.bold, fontSize: 15 },
  secondary: {
    flex: 1,
    height: 50,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: R.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: C.text, fontFamily: F.semibold, fontSize: 15 },
  pressed: { opacity: 0.75 },
});
