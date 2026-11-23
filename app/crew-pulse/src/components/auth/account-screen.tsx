import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProviderButtons } from '@/components/auth/provider-buttons';
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Konto</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.done}>Fertig</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <View style={styles.row}>
            <Text style={styles.value} numberOfLines={1}>
              {session.user.name}
            </Text>
            <Pressable onPress={onRename} hitSlop={8}>
              <Text style={styles.link}>Ändern</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Anmeldung</Text>
          {linked.length > 0 ? (
            linked.map((p) => (
              <View key={p} style={styles.row}>
                <Text style={styles.value}>{PROVIDER_LABEL[p] ?? p}</Text>
                <Text style={styles.connected}>Verbunden ✓</Text>
              </View>
            ))
          ) : (
            <Text style={styles.warning}>
              Nicht verbunden – dein Konto gilt nur auf diesem Gerät. Verbinde es, um es auf
              anderen Geräten zu nutzen und nicht zu verlieren.
            </Text>
          )}

          {(canLinkApple || canLinkGoogle) && (
            <View style={styles.connect}>
              <ProviderButtons
                apple={canLinkApple}
                google={canLinkGoogle}
                busy={busy}
                onPress={onConnect}
                variant="signIn"
              />
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Pressable onPress={confirmLogout} style={styles.logout} disabled={busy !== null}>
          <Text style={styles.logoutText}>Abmelden</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  done: { color: '#4da6ff', fontSize: 16, fontWeight: '600' },
  content: { padding: 16, gap: 16, paddingBottom: 140 },
  card: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 16, gap: 10 },
  label: { color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  value: { color: '#fff', fontSize: 17, flexShrink: 1 },
  link: { color: '#4da6ff', fontSize: 16 },
  connected: { color: '#22c55e', fontSize: 15 },
  warning: { color: '#fbbf24', fontSize: 14, lineHeight: 20 },
  connect: { marginTop: 6 },
  error: { color: '#f87171', fontSize: 14 },
  logout: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 16, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
