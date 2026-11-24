import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProviderButtons } from '@/components/auth/provider-buttons';
import { Icon } from '@/components/ui/icon';
import { avatarColors, C, F, initials, R } from '@/constants/crew-theme';
import type { AuthProvider } from '@/services/auth-providers';
import type { Session } from '@/services/session';

const PROVIDER_LABEL: Record<string, string> = { apple: 'Apple', google: 'Google' };

type Props = {
  session: Session;
  apple: boolean;
  google: boolean;
  busy: AuthProvider | null;
  error?: string | null;
  onRename: () => void;
  onConnect: (provider: AuthProvider) => void;
  onLogout: () => void;
  onClose: () => void;
};

export function AccountScreen({
  session,
  apple,
  google,
  busy,
  error,
  onRename,
  onConnect,
  onLogout,
  onClose,
}: Props) {
  const linked = session.user.providers ?? [];
  const canLinkApple = apple && !linked.includes('apple');
  const canLinkGoogle = google && !linked.includes('google');

  const confirmLogout = () => {
    const message =
      linked.length > 0
        ? `Du kannst dich jederzeit wieder mit ${linked.map((p) => PROVIDER_LABEL[p] ?? p).join(' oder ')} anmelden.`
        : 'Dein Konto ist mit keinem Login verbunden. Nach dem Abmelden kommst du nicht mehr hinein – verbinde es vorher mit Apple oder Google.';
    Alert.alert('Abmelden?', message, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: onLogout },
    ]);
  };

  const me = avatarColors(session.user.name);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Konto</Text>
        <Pressable onPress={onClose} hitSlop={8} style={styles.doneButton} accessibilityRole="button">
          <Text style={styles.done}>Fertig</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, styles.profile]}>
          <View style={[styles.avatar, { backgroundColor: me.bg }]}>
            <Text style={[styles.avatarText, { color: me.fg }]}>{initials(session.user.name)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name} numberOfLines={1}>
              {session.user.name}
            </Text>
            <Text style={styles.hint}>So sieht dich deine Crew</Text>
          </View>
          <Pressable onPress={onRename} style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.smallButtonText}>Ändern</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Anmeldung</Text>
          {linked.length > 0 ? (
            linked.map((p) => (
              <View key={p} style={styles.row}>
                <Icon name="user" size={22} />
                <Text style={styles.value}>{PROVIDER_LABEL[p] ?? p}</Text>
                <View style={styles.connectedRow}>
                  <Icon name="check" size={14} color={C.online} strokeWidth={2.6} />
                  <Text style={styles.connected}>Verbunden</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.warningRow}>
              <Icon name="shield" size={22} color={C.warning} />
              <Text style={styles.warning}>
                Nicht verbunden – dein Konto gilt nur auf diesem Gerät. Verbinde es, um es auf anderen Geräten zu
                nutzen und nicht zu verlieren.
              </Text>
            </View>
          )}

          {(canLinkApple || canLinkGoogle) && (
            <View style={styles.connect}>
              <ProviderButtons apple={canLinkApple} google={canLinkGoogle} busy={busy} onPress={onConnect} variant="signIn" />
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          disabled={busy !== null}
          accessibilityRole="button">
          <Text style={styles.logoutText}>Abmelden</Text>
        </Pressable>
        <Text style={styles.version}>CrewPulse · Version 1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 8,
  },
  title: { color: C.text, fontSize: 28, fontFamily: F.displayBold, letterSpacing: -0.4 },
  doneButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  done: { color: C.accent, fontSize: 16, fontFamily: F.semibold },
  content: { padding: 16, gap: 14, paddingBottom: 140 },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.raised,
    borderRadius: R.xl,
    padding: 16,
    gap: 12,
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.displayBold, fontSize: 22 },
  profileText: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: C.text, fontSize: 20, fontFamily: F.display },
  hint: { color: C.textMuted, fontSize: 13, fontFamily: F.regular },
  smallButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: C.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { color: C.accent, fontSize: 14, fontFamily: F.semibold },
  label: { color: C.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: F.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { color: C.text, fontSize: 16, flex: 1, fontFamily: F.regular },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  connected: { color: C.online, fontSize: 13, fontFamily: F.semibold },
  warningRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  warning: { color: '#F7CF9B', fontSize: 14, lineHeight: 20, flex: 1, fontFamily: F.regular },
  connect: { marginTop: 4 },
  error: { color: C.danger, fontSize: 14, fontFamily: F.medium },
  pressed: { opacity: 0.75 },
  logout: {
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    borderRadius: R.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: C.danger, fontSize: 16, fontFamily: F.semibold },
  version: { color: C.textMuted, fontSize: 12, textAlign: 'center', fontFamily: F.regular },
});
