import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { previewText } from '@/components/chat/message-bubble';
import { Icon } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';
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
          <Pressable
            onPress={onCancelRecording}
            hitSlop={8}
            style={styles.cancelRecording}
            accessibilityRole="button"
            accessibilityLabel="Aufnahme verwerfen">
            <Icon name="trash" size={20} color={C.danger} />
          </Pressable>
          <View style={styles.recordingInfo}>
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{formatDuration(recordingMs)}</Text>
            <Text style={styles.recHint}>Aufnahme läuft …</Text>
          </View>
          <Pressable
            onPress={onSendRecording}
            style={({ pressed }) => [styles.iconButton, styles.accentButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Sprachnachricht senden">
            <Icon name="send" size={20} color={C.onAccent} strokeWidth={2} />
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
            <Icon name="close" size={18} color={C.textMuted} strokeWidth={2} />
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        {!editing && (
          <Pressable
            onPress={onAttach}
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Foto senden">
            <Icon name="plus" size={22} strokeWidth={2} />
          </Pressable>
        )}
        <TextInput
          style={styles.input}
          placeholder={editing ? 'Neuer Text…' : placeholder}
          placeholderTextColor={C.textMuted}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={maxLength}
          autoFocus={editing}
        />
        {hasText || editing ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              styles.accentButton,
              !canSave && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={onSend}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Speichern' : 'Senden'}>
            <Icon name={editing ? 'check' : 'send'} size={20} color={C.onAccent} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onStartRecording}
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, styles.accentButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Sprachnachricht aufnehmen">
            <Icon name="mic" size={20} color={C.onAccent} strokeWidth={2} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: C.bg, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, gap: 8 },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    overflow: 'hidden',
  },
  modeAccent: { width: 3, alignSelf: 'stretch', backgroundColor: C.accent },
  modeAccentEdit: { backgroundColor: C.warning },
  modeBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 7 },
  modeTitle: { color: C.accent, fontSize: 12, fontFamily: F.bold },
  modeTitleEdit: { color: C.warning },
  modeText: { color: C.textSoft, fontSize: 13, fontFamily: F.regular },
  modeClose: { paddingHorizontal: 12, paddingVertical: 10 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentButton: { backgroundColor: C.accent },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    maxHeight: 120,
    fontSize: 15,
    fontFamily: F.regular,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  cancelRecording: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 22,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger },
  recTime: { color: C.text, fontSize: 16, fontVariant: ['tabular-nums'], fontFamily: F.semibold },
  recHint: { color: C.textMuted, fontSize: 13, fontFamily: F.regular },
});
