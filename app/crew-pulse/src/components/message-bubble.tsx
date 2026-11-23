import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/services/chat-types';

const NAME_COLORS = ['#4da6ff', '#f59e0b', '#22c55e', '#ec4899', '#a78bfa', '#14b8a6', '#f97316'];

export function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type Props = {
  message: ChatMessage;
  isOwn: boolean;
  /** Name nur beim ersten Bubble einer Serie desselben Absenders zeigen. */
  showSender: boolean;
  onRetry?: (clientId: string) => void;
};

function MessageBubbleBase({ message, isOwn, showSender, onRetry }: Props) {
  const failed = message.status === 'failed';
  const pending = message.status === 'pending';

  const statusLabel = pending ? 'Senden…' : failed ? 'Nicht gesendet · Tippen zum Wiederholen' : '';

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <Pressable
        disabled={!failed}
        onPress={() => message.clientId && onRetry?.(message.clientId)}
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          pending && styles.bubblePending,
          failed && styles.bubbleFailed,
        ]}>
        {!isOwn && showSender && (
          <Text style={[styles.sender, { color: colorForName(message.sender) }]}>
            {message.sender}
          </Text>
        )}
        <Text style={styles.text}>{message.text}</Text>
        <Text style={[styles.meta, isOwn && styles.metaOwn]}>
          {statusLabel || formatTime(message.createdAt)}
        </Text>
      </Pressable>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 2 },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '80%',
  },
  bubbleOwn: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#222', borderBottomLeftRadius: 4 },
  bubblePending: { opacity: 0.6 },
  bubbleFailed: { backgroundColor: '#7f1d1d' },
  sender: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  text: { color: '#fff', fontSize: 15, lineHeight: 20 },
  meta: { color: '#999', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  metaOwn: { color: '#dbeafe' },
});
