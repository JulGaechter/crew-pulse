import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProviderButtons } from '@/components/auth/provider-buttons';
import type { AuthProvider } from '@/services/auth-providers';

type Props = {
  apple: boolean;
  google: boolean;
  busy: AuthProvider | null;
  error?: string | null;
  onProvider: (provider: AuthProvider) => void;
  /** Ohne Login weiter (Konto nur auf diesem Gerät) */
  onSkip: () => void;
};

export function LoginScreen({ apple, google, busy, error, onProvider, onSkip }: Props) {
  const hasProvider = apple || google;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.logo}>CrewPulse</Text>
          <Text style={styles.subtitle}>Chat, Snaps und Live-Standort mit deiner Crew.</Text>
        </View>

        <View style={styles.actions}>
          {hasProvider ? (
            <ProviderButtons apple={apple} google={google} busy={busy} onPress={onProvider} />
          ) : (
            <Text style={styles.note}>
              Anmelden mit Apple oder Google ist hier nicht verfügbar. Du kannst ohne Konto
              weitermachen.
            </Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={onSkip} disabled={busy !== null} style={styles.skip} hitSlop={8}>
            <Text style={styles.skipText}>
              {hasProvider ? 'Ohne Anmeldung fortfahren' : 'Weiter'}
            </Text>
          </Pressable>
          {hasProvider && (
            <Text style={styles.hint}>
              Ohne Anmeldung gilt dein Konto nur auf diesem Gerät. Verbinden kannst du später.
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111' },
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: 10 },
  logo: { color: '#fff', fontSize: 40, fontWeight: '800' },
  subtitle: { color: '#999', fontSize: 17, lineHeight: 24 },
  actions: { gap: 12, paddingBottom: 24 },
  note: { color: '#999', fontSize: 15, lineHeight: 21 },
  error: { color: '#f87171', fontSize: 14, textAlign: 'center' },
  skip: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: '#4da6ff', fontSize: 16, fontWeight: '600' },
  hint: { color: '#666', fontSize: 12, textAlign: 'center' },
});
