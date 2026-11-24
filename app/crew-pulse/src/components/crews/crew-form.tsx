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

type Mode = 'create' | 'join' | 'rename';

const COPY: Record<Mode, { title: string; subtitle: string; placeholder: string; button: string }> = {
  create: {
    title: 'Neue Crew',
    subtitle: 'Gib deiner Crew einen Namen. Danach bekommst du einen Code zum Einladen.',
    placeholder: 'z. B. Wochenend-Crew',
    button: 'Crew erstellen',
  },
  join: {
    title: 'Crew beitreten',
    subtitle: 'Gib den 6-stelligen Einladungscode ein, den du bekommen hast.',
    placeholder: 'ABC-123',
    button: 'Beitreten',
  },
  rename: {
    title: 'Crew umbenennen',
    subtitle: 'Alle Mitglieder sehen den neuen Namen.',
    placeholder: 'Name der Crew',
    button: 'Speichern',
  },
};

type Props = {
  mode: Mode;
  initialValue?: string;
  busy: boolean;
  error?: string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

export function CrewForm({ mode, initialValue = '', busy, error, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);
  const copy = COPY[mode];
  const isCode = mode === 'join';

  const cleaned = isCode ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : value.trim();
  const valid = isCode ? cleaned.length === 6 : cleaned.length >= 2 && cleaned.length <= 40;
  const canSubmit = valid && !busy;

  const submit = () => canSubmit && onSubmit(cleaned);

  // Code als "ABC-123" anzeigen, während man tippt
  const handleChange = (text: string) => {
    if (!isCode) return setValue(text);
    const raw = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setValue(raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
        <TextInput
          style={[styles.input, isCode && styles.codeInput]}
          placeholder={copy.placeholder}
          placeholderTextColor={placeholderColor}
          value={value}
          onChangeText={handleChange}
          onSubmitEditing={submit}
          autoFocus
          autoCapitalize={isCode ? 'characters' : 'sentences'}
          autoCorrect={false}
          maxLength={isCode ? 7 : 40}
          returnKeyType="done"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.button, !canSubmit && styles.buttonDisabled, pressed && styles.pressed]}
          onPress={submit}
          disabled={!canSubmit}>
          {busy ? <ActivityIndicator color={spinnerOnAccent} /> : <Text style={styles.buttonText}>{copy.button}</Text>}
        </Pressable>
        <Pressable onPress={onCancel} style={styles.cancel} disabled={busy}>
          <Text style={styles.cancelText}>Abbrechen</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = formStyles;
