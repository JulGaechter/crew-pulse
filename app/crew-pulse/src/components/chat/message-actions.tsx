import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { previewText } from '@/components/chat/message-bubble';
import { Icon, type IconName } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';
import { REACTION_EMOJIS, type ChatMessage, type ReadState } from '@/services/chat-types';

type Props = {
  message: ChatMessage | null;
  myId: string;
  readStates: ReadState[];
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onClose: () => void;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Menü nach langem Drücken: Reaktionen, Antworten, Bearbeiten, Löschen, Gelesen von … */
export function MessageActions({ message, myId, readStates, onReact, onReply, onEdit, onDelete, onClose }: Props) {
  const [showReads, setShowReads] = useState(false);
  if (!message) return null;

  const isOwn = message.senderId === myId;
  const canEdit = isOwn && !message.audio;
  const mine = new Set((message.reactions ?? []).filter((r) => r.userIds.includes(myId)).map((r) => r.emoji));
  const preview = previewText({
    text: message.text,
    hasImage: Boolean(message.image),
    hasAudio: Boolean(message.audio),
  }).slice(0, 120);

  const others = readStates.filter((r) => r.userId !== myId && r.userId !== message.senderId);
  const readers = others.filter((r) => r.lastReadAt >= message.createdAt);
  const notYet = others.filter((r) => r.lastReadAt < message.createdAt);

  const close = () => {
    setShowReads(false);
    onClose();
  };
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  const confirmDelete = () => {
    close();
    Alert.alert('Nachricht löschen?', 'Die Nachricht wird für alle in der Crew gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => onDelete(message) },
    ]);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {preview ? (
            <Text style={styles.preview} numberOfLines={2}>
              {message.sender}: {preview}
            </Text>
          ) : null}

          {showReads ? (
            <ScrollView style={styles.reads}>
              <Text style={styles.readsTitle}>Gelesen ({readers.length})</Text>
              {readers.length === 0 ? <Text style={styles.readsEmpty}>Noch niemand</Text> : null}
              {readers.map((r) => (
                <View key={r.userId} style={styles.readRow}>
                  <View style={styles.readNameRow}>
                    <Icon name="checks" size={16} strokeWidth={2.2} />
                    <Text style={styles.readName}>{r.name || 'Mitglied'}</Text>
                  </View>
                  <Text style={styles.readTime}>{formatTime(r.lastReadAt)}</Text>
                </View>
              ))}
              {notYet.length > 0 && <Text style={[styles.readsTitle, styles.readsSpacer]}>Noch nicht gelesen</Text>}
              {notYet.map((r) => (
                <View key={r.userId} style={styles.readNameRow}>
                  <Icon name="check" size={16} color={C.textMuted} strokeWidth={2.2} />
                  <Text style={styles.readPending}>{r.name || 'Mitglied'}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <>
              <View style={styles.emojiRow}>
                {REACTION_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={run(() => onReact(message.id, emoji))}
                    style={({ pressed }) => [styles.emoji, mine.has(emoji) && styles.emojiMine, pressed && styles.pressed]}>
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.actions}>
                <Action icon="reply" label="Antworten" onPress={run(() => onReply(message))} />
                {canEdit && <Action icon="edit" label="Bearbeiten" onPress={run(() => onEdit(message))} />}
                {isOwn && <Action icon="eye" label="Gelesen von …" onPress={() => setShowReads(true)} />}
                {isOwn && <Action icon="trash" label="Löschen" destructive onPress={confirmDelete} last />}
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Action({
  icon,
  label,
  onPress,
  destructive,
  last,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, last && styles.actionLast, pressed && styles.actionPressed]}
      accessibilityRole="button">
      <Icon name={icon} size={20} color={destructive ? C.danger : C.accent} />
      <Text style={[styles.actionText, destructive && styles.destructive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    padding: 14,
    gap: 12,
    maxWidth: 380,
    width: '100%',
  },
  preview: { color: C.textMuted, fontSize: 13, paddingHorizontal: 4, fontFamily: F.regular },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  emoji: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emojiMine: { backgroundColor: C.accentSoft },
  emojiText: { fontSize: 28 },
  pressed: { transform: [{ scale: 1.15 }] },
  actions: { backgroundColor: C.raised, borderRadius: R.lg, overflow: 'hidden' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  actionLast: { borderBottomWidth: 0 },
  actionPressed: { backgroundColor: C.borderStrong },
  actionText: { color: C.text, fontSize: 16, fontFamily: F.medium },
  destructive: { color: C.danger },
  reads: { maxHeight: 320 },
  readsTitle: {
    color: C.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    fontFamily: F.semibold,
  },
  readsSpacer: { marginTop: 14 },
  readsEmpty: { color: C.textMuted, fontSize: 14, fontFamily: F.regular },
  readRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  readNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  readName: { color: C.text, fontSize: 15, fontFamily: F.medium },
  readTime: { color: C.textMuted, fontSize: 13, fontFamily: F.regular },
  readPending: { color: C.textSoft, fontSize: 15, fontFamily: F.regular },
});
