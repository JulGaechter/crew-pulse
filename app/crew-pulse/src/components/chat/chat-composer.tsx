import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { previewText } from '@/components/chat/message-bubble';
import { formatDuration } from '@/hooks/use-voice-recorder';
import type { ChatMessage } from '@/services/chat-types';

export type ComposerMode = { type: 'reply'; message: ChatMessage } | { type: 'edit'; message: ChatMessage } | null;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength: number;
  mode: ComposerMode;
  onCancelMode: () => void;
  onSend: () => void;
  onAttach: () => void;
  bottomPadding: number;
  // Sprachnachricht
  recording: boolean;
  recordingMs: number;
  onStartRecording: () => void;
  onSendRecording: () => void;
  onCancelRecording: () => void;
};

/** Eingabezeile: Text, Foto, Sprachnachricht; darüber ggf. "Antwort an …" bzw. "Bearbeiten" */
export function ChatComposer({
  value,
  onChangeText,
  placeholder,
  maxLength,
  mode,
  onCancelMode,
  onSend,
  onAttach,
  bottomPadding,
  recording,
  recordingMs,
  onStartRecording,
  onSendRecording,
  onCancelRecording,
}: Props) {
  const hasText = value.trim().length > 0;
  const editing = mode?.type === 'edit';
  // Beim Bearbeiten einer Bild-Nachricht darf die Unterschrift leer werden
  const canSave = mode?.type === 'edit' ? hasText || Boolean(mode.message.image) : hasText;

  if (recording) {
    return (
      <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
        <View style={styles.row}>
          <Pressable onPress={onCancelRecording} hitSlop={8} style={styles.cancelRecording}>
            <Text style={styles.cancelRecordingText}>Abbrechen</Text>
          </Pressable>
          <View style={styles.recordingInfo}>
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{formatDuration(recordingMs)}</Text>
            <Text style={styles.recHint}>Aufnahme läuft …</Text>
          </View>
          <Pressable
            onPress={onSendRecording}
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
            accessibilityLabel="Sprachnachricht senden">
            <Text style={styles.sendText}>Senden</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      {mode && (
        <View style={styles.modeBar}>
          <View style={[styles.modeAccent, editing && styles.modeAccentEdit]} />
          <View style={styles.modeBody}>
            <Text style={[styles.modeTitle, editing && styles.modeTitleEdit]}>
              {editing ? 'Nachricht bearbeiten' : `Antwort an ${mode.message.sender}`}
            </Text>
            <Text style={styles.modeText} numberOfLines={1}>
              {previewText({
                text: mode.message.text,
                hasImage: Boolean(mode.message.image),
                hasAudio: Boolean(mode.message.audio),
              })}
            </Text>
          </View>
          <Pressable onPress={onCancelMode} hitSlop={10} style={styles.modeClose} accessibilityLabel="Abbrechen">
            <Text style={styles.modeCloseText}>✕</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        {!editing && (
          <Pressable
            onPress={onAttach}
            hitSlop={8}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
            accessibilityLabel="Foto senden">
            <Text style={styles.roundText}>＋</Text>
          </Pressable>
        )}
        <TextInput
          style={styles.input}
          placeholder={editing ? 'Neuer Text…' : placeholder}
          placeholderTextColor="#888"
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={maxLength}
          autoFocus={editing}
        />
        {hasText || editing ? (
          <Pressable
            style={({ pressed }) => [styles.sendButton, !canSave && styles.disabled, pressed && styles.pressed]}
            onPress={onSend}
            disabled={!canSave}>
            <Text style={styles.sendText}>{editing ? 'Speichern' : 'Senden'}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onStartRecording}
            hitSlop={8}
            style={({ pressed }) => [styles.round, styles.mic, pressed && styles.pressed]}
            accessibilityLabel="Sprachnachricht aufnehmen">
            <Text style={styles.micText}>🎤</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderTopWidth: 1, borderTopColor: '#262626', backgroundColor: '#111', paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, gap: 8 },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#1c1c1c',
    borderRadius: 10,
    overflow: 'hidden',
  },
  modeAccent: { width: 3, alignSelf: 'stretch', backgroundColor: '#3b82f6' },
  modeAccentEdit: { backgroundColor: '#f59e0b' },
  modeBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 6 },
  modeTitle: { color: '#60a5fa', fontSize: 12, fontWeight: '700' },
  modeTitleEdit: { color: '#fbbf24' },
  modeText: { color: '#bbb', fontSize: 13 },
  modeClose: { paddingHorizontal: 12, paddingVertical: 8 },
  modeCloseText: { color: '#888', fontSize: 16 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundText: { color: '#4da6ff', fontSize: 22, lineHeight: 24 },
  mic: { backgroundColor: '#1e3a8a' },
  micText: { fontSize: 18 },
  input: {
    flex: 1,
    backgroundColor: '#242424',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  cancelRecording: { height: 40, justifyContent: 'center', paddingHorizontal: 4 },
  cancelRecordingText: { color: '#ef4444', fontWeight: '600' },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, justifyContent: 'center' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  recTime: { color: '#fff', fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '600' },
  recHint: { color: '#888', fontSize: 13 },
});
