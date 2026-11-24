import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { previewText } from '@/components/chat/message-bubble';
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
                  <Text style={styles.readName}>✓✓ {r.name || 'Mitglied'}</Text>
                  <Text style={styles.readTime}>{formatTime(r.lastReadAt)}</Text>
                </View>
              ))}
              {notYet.length > 0 && <Text style={[styles.readsTitle, styles.readsSpacer]}>Noch nicht gelesen</Text>}
              {notYet.map((r) => (
                <Text key={r.userId} style={styles.readPending}>
                  ✓ {r.name || 'Mitglied'}
                </Text>
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
                <Action label="↩︎  Antworten" onPress={run(() => onReply(message))} />
                {canEdit && <Action label="✏️  Bearbeiten" onPress={run(() => onEdit(message))} />}
                {isOwn && <Action label="👁  Gelesen von …" onPress={() => setShowReads(true)} />}
                {isOwn && <Action label="🗑  Löschen" destructive onPress={confirmDelete} />}
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Action({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      <Text style={[styles.actionText, destructive && styles.destructive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: { backgroundColor: '#1f1f1f', borderRadius: 20, padding: 14, gap: 12, maxWidth: 380, width: '100%' },
  preview: { color: '#aaa', fontSize: 13, paddingHorizontal: 4 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  emoji: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emojiMine: { backgroundColor: '#1e3a8a' },
  emojiText: { fontSize: 28 },
  pressed: { transform: [{ scale: 1.15 }] },
  actions: { backgroundColor: '#2a2a2a', borderRadius: 14, overflow: 'hidden' },
  action: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  actionPressed: { backgroundColor: '#333' },
  actionText: { color: '#fff', fontSize: 16 },
  destructive: { color: '#ef4444' },
  reads: { maxHeight: 320 },
  readsTitle: { color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  readsSpacer: { marginTop: 14 },
  readsEmpty: { color: '#666', fontSize: 14 },
  readRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  readName: { color: '#fff', fontSize: 15 },
  readTime: { color: '#888', fontSize: 13 },
  readPending: { color: '#aaa', fontSize: 15, paddingVertical: 6 },
});
