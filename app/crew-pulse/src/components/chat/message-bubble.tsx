import { memo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { VoiceMessage } from '@/components/chat/voice-message';
import { Icon } from '@/components/ui/icon';
import { C, F, nameColor, R } from '@/constants/crew-theme';
import type { ChatMessage, MessageImage, ReplyPreview } from '@/services/chat-types';
import { imageSource } from '@/services/media';

const IMAGE_MAX_WIDTH = 240;
const IMAGE_MAX_HEIGHT = 320;

/** Namensfarbe (gut lesbar auf dunklen Bubbles) */
export const colorForName = nameColor;

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
      <View style={[styles.quoteBar, { backgroundColor: isOwn ? C.onAccent : colorForName(reply.sender) }]} />
      <View style={styles.quoteBody}>
        <Text style={[styles.quoteSender, { color: isOwn ? C.onAccent : colorForName(reply.sender) }]} numberOfLines={1}>
          {reply.sender}
        </Text>
        <Text style={[styles.quoteText, isOwn && styles.quoteTextOwn, reply.deleted && styles.italic]} numberOfLines={2}>
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
            <View style={styles.deletedRow}>
              <Icon name="trash" size={14} color={C.textMuted} strokeWidth={2} />
              <Text style={styles.deletedText}>Nachricht gelöscht</Text>
            </View>
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
                      <ActivityIndicator color={C.accent} />
                    </View>
                  )}
                </Pressable>
              )}

              {audio && <VoiceMessage audio={audio} token={token} isOwn={isOwn && !failed} onLongPress={longPress} />}

              {message.text ? (
                <Text style={[styles.text, isOwn && !failed && styles.textOwn, image && styles.padded, image && styles.afterImage]}>
                  {message.text}
                </Text>
              ) : null}
            </>
          )}

          <Text style={[styles.meta, isOwn && !deleted && !failed && styles.metaOwn, image && !deleted && styles.padded]}>{meta}</Text>
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

        {readLabel ? (
          <View style={styles.readRow}>
            {readLabel !== 'Zugestellt' && <Icon name="checks" size={14} strokeWidth={2.2} />}
            <Text style={styles.readLabel}>{readLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 3 },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  column: { maxWidth: '80%' },
  columnOwn: { alignItems: 'flex-end' },
  columnOther: { alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: R.lg },
  bubbleWithImage: { paddingHorizontal: 0, paddingTop: 0, overflow: 'hidden' },
  bubbleOwn: { backgroundColor: C.accent, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: C.bubbleOther, borderBottomLeftRadius: 6 },
  bubbleDeleted: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderStrong,
    paddingHorizontal: 13,
    paddingTop: 9,
  },
  bubblePending: { opacity: 0.7 },
  bubbleFailed: { backgroundColor: '#5B1A22' },
  bubbleHighlighted: { borderWidth: 2, borderColor: C.warning },
  padded: { paddingHorizontal: 13 },
  afterImage: { marginTop: 7 },
  sender: { fontSize: 12, fontFamily: F.semibold, marginBottom: 2 },
  senderOnImage: { paddingTop: 8, paddingBottom: 6 },
  quote: { flexDirection: 'row', borderRadius: R.sm, overflow: 'hidden', marginBottom: 6 },
  quoteOwn: { backgroundColor: 'rgba(10,13,20,0.12)' },
  quoteOther: { backgroundColor: 'rgba(255,255,255,0.06)' },
  quoteOnImage: { paddingHorizontal: 8, paddingTop: 8 },
  quoteBar: { width: 3 },
  quoteBody: { paddingHorizontal: 9, paddingVertical: 5, flexShrink: 1 },
  quoteSender: { fontSize: 12, fontFamily: F.bold },
  quoteText: { color: C.textSoft, fontSize: 13, fontFamily: F.regular },
  quoteTextOwn: { color: '#1D3A52' },
  italic: { fontStyle: 'italic' },
  image: { backgroundColor: C.raised },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,13,20,0.4)',
  },
  text: { color: C.text, fontSize: 15, lineHeight: 20, fontFamily: F.regular },
  textOwn: { color: C.onAccent },
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deletedText: { color: C.textMuted, fontStyle: 'italic', fontSize: 14, fontFamily: F.regular },
  meta: { color: C.textMuted, fontSize: 10, marginTop: 3, alignSelf: 'flex-end', fontFamily: F.medium },
  metaOwn: { color: C.onAccentMuted },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -5, paddingHorizontal: 8 },
  reactionsOwn: { justifyContent: 'flex-end' },
  chip: {
    backgroundColor: C.raised,
    borderRadius: R.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  chipMine: { backgroundColor: C.accentSoft, borderColor: C.accentBorder },
  chipText: { color: C.text, fontSize: 13, fontFamily: F.medium },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginHorizontal: 4 },
  readLabel: { color: C.textMuted, fontSize: 11, fontFamily: F.medium },
});
