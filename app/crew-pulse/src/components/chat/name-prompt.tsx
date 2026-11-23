import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  initialName?: string;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
  /** Während der Server antwortet */
  busy?: boolean;
  /** Fehlermeldung unter dem Eingabefeld */
  error?: string | null;
};

export function NamePrompt({ initialName = '', onSubmit, onCancel, busy = false, error }: Props) {
  const [value, setValue] = useState(initialName);
  const trimmed = value.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 24;
  const canSubmit = valid && !busy;

  const submit = () => canSubmit && onSubmit(trimmed);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>Wie heisst du?</Text>
        <Text style={styles.subtitle}>So sieht dich deine Crew im Chat.</Text>
        <TextInput
          style={styles.input}
          placeholder="Dein Name"
          placeholderTextColor="#666"
          value={value}
          onChangeText={setValue}
          onSubmitEditing={submit}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={24}
          returnKeyType="done"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.button, !canSubmit && styles.buttonDisabled, pressed && styles.pressed]}
          onPress={submit}
          disabled={!canSubmit}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{onCancel ? 'Speichern' : 'Los geht’s'}</Text>
          )}
        </Pressable>
        {onCancel && (
          <Pressable onPress={onCancel} style={styles.cancel}>
            <Text style={styles.cancelText}>Abbrechen</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111' },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#999', fontSize: 15, marginBottom: 12 },
  input: {
    backgroundColor: '#242424',
    color: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  error: { color: '#f87171', fontSize: 14 },
  buttonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: '#999' },
});
