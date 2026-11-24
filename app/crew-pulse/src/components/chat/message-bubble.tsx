import { memo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { VoiceMessage } from '@/components/chat/voice-message';
import type { ChatMessage, MessageImage, ReplyPreview } from '@/services/chat-types';
import { imageSource } from '@/services/media';

const NAME_COLORS = ['#4da6ff', '#f59e0b', '#22c55e', '#ec4899', '#a78bfa', '#14b8a6', '#f97316'];
const IMAGE_MAX_WIDTH = 240;
const IMAGE_MAX_HEIGHT = 320;

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

/** Kurztext für Zitate und Vorschauen */
export function previewText(m: { text: string; hasImage?: boolean; hasAudio?: boolean; deleted?: boolean }) {
  if (m.deleted) return 'Nachricht gelöscht';
  if (m.hasAudio) return '🎤 Sprachnachricht';
  if (m.hasImage) return m.text ? `📷 ${m.text}` : '📷 Foto';
  return m.text;
}

/** Bild im Bubble: Seitenverhältnis beibehalten, in einen Rahmen einpassen */
function fitImage(image: MessageImage) {
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 1;
  let width = IMAGE_MAX_WIDTH;
  let height = width / ratio;
  if (height > IMAGE_MAX_HEIGHT) {
    height = IMAGE_MAX_HEIGHT;
    width = height * ratio;
  }
  return { width, height };
}

function Quote({ reply, isOwn, onPress }: { reply: ReplyPreview; isOwn: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.quote, isOwn ? styles.quoteOwn : styles.quoteOther]}>
      <View style={[styles.quoteBar, { backgroundColor: colorForName(reply.sender) }]} />
      <View style={styles.quoteBody}>
        <Text style={[styles.quoteSender, { color: isOwn ? '#fff' : colorForName(reply.sender) }]} numberOfLines={1}>
          {reply.sender}
        </Text>
        <Text style={[styles.quoteText, reply.deleted && styles.italic]} numberOfLines={2}>
          {previewText(reply)}
        </Text>
      </View>
    </Pressable>
  );
}

type Props = {
  message: ChatMessage;
  isOwn: boolean;
  myId: string;
  token: string;
  /** Name nur beim ersten Bubble einer Serie desselben Absenders zeigen. */
  showSender: boolean;
  /** z. B. "Gesehen von Anna" unter der eigenen neuesten Nachricht */
  readLabel?: string;
  /** Kurz hervorheben (nach Sprung zu einer zitierten Nachricht) */
  highlighted?: boolean;
  onRetry?: (clientId: string) => void;
  /** Lange drücken -> Menü (Reaktionen, Antworten, …) */
  onLongPress?: (message: ChatMessage) => void;
  onPressImage?: (message: ChatMessage) => void;
  onPressReply?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
};

function MessageBubbleBase({
  message,
  isOwn,
  myId,
  token,
  showSender,
  readLabel,
  highlighted,
  onRetry,
  onLongPress,
  onPressImage,
  onPressReply,
  onToggleReaction,
}: Props) {
  const failed = message.status === 'failed';
  const pending = message.status === 'pending';
  const sent = !pending && !failed;
  const deleted = Boolean(message.deleted);
  const canInteract = sent && !deleted;
  const longPress = canInteract ? () => onLongPress?.(message) : undefined;

  const statusLabel = pending ? 'Senden…' : failed ? 'Nicht gesendet · Tippen zum Wiederholen' : '';
  const meta = statusLabel || `${message.edited ? 'bearbeitet · ' : ''}${formatTime(message.createdAt)}`;
  const reactions = message.reactions ?? [];
  const image = message.image;
  const audio = message.audio;

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.column, isOwn ? styles.columnOwn : styles.columnOther]}>
        <Pressable
          onPress={() => {
            if (failed && message.clientId) onRetry?.(message.clientId);
          }}
          onLongPress={longPress}
          delayLongPress={300}
          style={[
            styles.bubble,
            image && styles.bubbleWithImage,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            deleted && styles.bubbleDeleted,
            pending && styles.bubblePending,
            failed && styles.bubbleFailed,
            highlighted && styles.bubbleHighlighted,
          ]}>
          {!isOwn && showSender && (
            <Text
              style={[
                styles.sender,
                image && styles.padded,
                image && styles.senderOnImage,
                { color: colorForName(message.sender) },
              ]}>
              {message.sender}
            </Text>
          )}

          {message.replyTo && !deleted && (
            <View style={image && styles.quoteOnImage}>
              <Quote reply={message.replyTo} isOwn={isOwn} onPress={() => onPressReply?.(message.replyTo!.id)} />
            </View>
          )}

          {deleted ? (
            <Text style={[styles.text, styles.deletedText]}>🚫 Nachricht gelöscht</Text>
          ) : (
            <>
              {image && (
                <Pressable
                  onPress={() =>
                    failed && message.clientId ? onRetry?.(message.clientId) : onPressImage?.(message)
                  }
                  onLongPress={longPress}
                  delayLongPress={300}>
                  <Image source={imageSource(image, token)} style={[styles.image, fitImage(image)]} resizeMode="cover" />
                  {pending && (
                    <View style={styles.imageOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                </Pressable>
              )}

              {audio && <VoiceMessage audio={audio} token={token} isOwn={isOwn} onLongPress={longPress} />}

              {message.text ? (
                <Text style={[styles.text, image && styles.padded, image && styles.afterImage]}>{message.text}</Text>
              ) : null}
            </>
          )}

          <Text style={[styles.meta, isOwn && styles.metaOwn, image && !deleted && styles.padded]}>{meta}</Text>
        </Pressable>

        {reactions.length > 0 && !deleted && (
          <View style={[styles.reactions, isOwn && styles.reactionsOwn]}>
            {reactions.map((r) => {
              const mine = r.userIds.includes(myId);
              return (
                <Pressable
                  key={r.emoji}
                  onPress={() => onToggleReaction?.(message.id, r.emoji)}
                  hitSlop={4}
                  style={[styles.chip, mine && styles.chipMine]}>
                  <Text style={styles.chipText}>
                    {r.emoji}
                    {r.userIds.length > 1 ? ` ${r.userIds.length}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {readLabel ? <Text style={styles.readLabel}>{readLabel}</Text> : null}
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 2 },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  column: { maxWidth: '80%' },
  columnOwn: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleWithImage: { paddingHorizontal: 0, paddingTop: 0, overflow: 'hidden' },
  bubbleOwn: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#222', borderBottomLeftRadius: 4 },
  bubbleDeleted: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', paddingHorizontal: 12, paddingTop: 8 },
  bubblePending: { opacity: 0.7 },
  bubbleFailed: { backgroundColor: '#7f1d1d' },
  bubbleHighlighted: { borderWidth: 2, borderColor: '#fbbf24' },
  padded: { paddingHorizontal: 12 },
  afterImage: { marginTop: 6 },
  sender: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  senderOnImage: { paddingTop: 6, paddingBottom: 4 },
  quote: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  quoteOwn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  quoteOther: { backgroundColor: 'rgba(255,255,255,0.07)' },
  quoteOnImage: { paddingHorizontal: 8, paddingTop: 8 },
  quoteBar: { width: 3 },
  quoteBody: { paddingHorizontal: 8, paddingVertical: 5, flexShrink: 1 },
  quoteSender: { fontSize: 12, fontWeight: '700' },
  quoteText: { color: '#ddd', fontSize: 13 },
  italic: { fontStyle: 'italic' },
  image: { backgroundColor: '#333' },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  text: { color: '#fff', fontSize: 15, lineHeight: 20 },
  deletedText: { color: '#888', fontStyle: 'italic', fontSize: 14 },
  meta: { color: '#999', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  metaOwn: { color: '#dbeafe' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -4, paddingHorizontal: 6 },
  reactionsOwn: { justifyContent: 'flex-end' },
  chip: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#111',
  },
  chipMine: { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' },
  chipText: { color: '#fff', fontSize: 13 },
  readLabel: { color: '#777', fontSize: 11, marginTop: 3, marginHorizontal: 4 },
});
