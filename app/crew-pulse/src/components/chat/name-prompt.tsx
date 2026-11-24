import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formStyles, placeholderColor, spinnerOnAccent } from '@/components/ui/form-styles';

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
          placeholderTextColor={placeholderColor}
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
            <ActivityIndicator color={spinnerOnAccent} />
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

const styles = formStyles;
