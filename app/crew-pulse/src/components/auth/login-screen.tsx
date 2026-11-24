import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProviderButtons } from '@/components/auth/provider-buttons';
import { Icon } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';
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
          {/* Logo mit dezenten Ringen dahinter */}
          <View style={styles.logoWrap}>
            <View style={[styles.ring, styles.ringOuter]} />
            <View style={[styles.ring, styles.ringInner]} />
            <View style={styles.logo}>
              <Icon name="pulse" size={56} strokeWidth={2.4} />
            </View>
          </View>
          <Text style={styles.title}>CrewPulse</Text>
          <Text style={styles.subtitle}>Chat, Snaps und Live-Standort mit deiner Crew.</Text>
        </View>

        <View style={styles.actions}>
          {hasProvider ? (
            <ProviderButtons apple={apple} google={google} busy={busy} onPress={onProvider} />
          ) : (
            <Text style={styles.note}>
              Anmelden mit Apple oder Google ist hier nicht verfügbar. Du kannst ohne Konto weitermachen.
            </Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={onSkip} disabled={busy !== null} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>{hasProvider ? 'Ohne Anmeldung fortfahren' : 'Weiter'}</Text>
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
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 20, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  logoWrap: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginBottom: -40 },
  ring: { position: 'absolute', borderWidth: 1 },
  ringOuter: { width: 240, height: 240, borderRadius: 120, borderColor: C.accentSoft },
  ringInner: { width: 164, height: 164, borderRadius: 82, borderColor: C.accentBorder },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: C.text, fontSize: 38, fontFamily: F.displayBold, letterSpacing: -0.8 },
  subtitle: {
    color: '#A3ADBF',
    fontSize: 16,
    lineHeight: 23,
    fontFamily: F.regular,
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: { gap: 12 },
  note: { color: C.textMuted, fontSize: 15, lineHeight: 21, fontFamily: F.regular, textAlign: 'center' },
  error: { color: C.danger, fontSize: 14, textAlign: 'center', fontFamily: F.medium },
  skip: { alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: R.md },
  skipText: { color: C.accent, fontSize: 16, fontFamily: F.semibold },
  hint: { color: C.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', fontFamily: F.regular },
});
