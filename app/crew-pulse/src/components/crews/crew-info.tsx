import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CrewAvatar } from '@/components/crews/crew-avatar';
import { Icon } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';
import { BottomTabInset } from '@/constants/theme';
import { socket } from '@/services/api';
import type { CrewDetail, CrewSummary } from '@/services/chat-types';
import {
  formatInviteCode,
  getCrew,
  leaveCrew,
  regenerateInviteCode,
  setCrewMuted,
} from '@/services/crews';
import { pushSupported } from '@/services/push';
import { UnauthorizedError, type Session } from '@/services/session';

type Props = {
  crewId: string;
  session: Session;
  onBack: () => void;
  onRename: (crew: CrewDetail) => void;
  onLeft: (crewId: string) => void;
  /** Stummschalten geändert -> Crew-Liste aktualisieren */
  onCrewUpdated: (crew: CrewSummary) => void;
  onUnauthorized: () => void;
};

export function CrewInfo({
  crewId,
  session,
  onBack,
  onRename,
  onLeft,
  onCrewUpdated,
  onUnauthorized,
}: Props) {
  const [crew, setCrew] = useState<CrewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const myId = session.user.id;
  const isOwner = crew?.role === 'owner';

  const load = useCallback(async () => {
    try {
      setCrew(await getCrew(session, crewId));
      setError(null);
    } catch (e) {
      if (e instanceof UnauthorizedError) onUnauthorized();
      else setError('Crew konnte nicht geladen werden.');
    }
  }, [session, crewId, onUnauthorized]);

  useEffect(() => {
    load();
    // Neue Mitglieder, neuer Code usw. live übernehmen
    const onChanged = (ev: { crewId?: string }) => {
      if (!ev?.crewId || ev.crewId === crewId) load();
    };
    socket.on('crews:changed', onChanged);
    return () => {
      socket.off('crews:changed', onChanged);
    };
  }, [load, crewId]);

  const toggleNotifications = async (enabled: boolean) => {
    if (!crew) return;
    const previous = crew;
    setCrew({ ...crew, muted: !enabled }); // sofort umschalten, bei Fehler zurück
    try {
      const updated = await setCrewMuted(session, crewId, !enabled);
      setCrew((c) => (c ? { ...c, ...updated } : c));
      onCrewUpdated(updated);
    } catch {
      setCrew(previous);
      setError('Einstellung konnte nicht gespeichert werden.');
    }
  };

  const share = () => {
    if (!crew) return;
    Share.share({
      message: `Tritt meiner Crew „${crew.name}“ in CrewPulse bei! Einladungscode: ${formatInviteCode(crew.inviteCode)}`,
    }).catch(() => {});
  };

  const newCode = () => {
    Alert.alert(
      'Neuen Code erstellen?',
      'Der bisherige Code funktioniert danach nicht mehr. Wer schon Mitglied ist, bleibt drin.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Neuer Code',
          onPress: async () => {
            setBusy(true);
            try {
              setCrew(await regenerateInviteCode(session, crewId));
            } catch {
              setError('Neuer Code konnte nicht erstellt werden.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const confirmLeave = () => {
    if (!crew) return;
    const lastMember = crew.memberCount <= 1;
    Alert.alert(
      'Crew verlassen?',
      lastMember
        ? 'Du bist das letzte Mitglied. Die Crew und alle Nachrichten werden gelöscht.'
        : 'Du siehst die Nachrichten danach nicht mehr. Mit dem Code kannst du wieder beitreten.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: lastMember ? 'Verlassen & löschen' : 'Verlassen',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await leaveCrew(session, crewId);
              onLeft(crewId);
            } catch {
              setError('Verlassen hat nicht geklappt. Bitte nochmals versuchen.');
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const code = crew ? crew.inviteCode : '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Zurück">
          <Icon name="back" size={24} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Crew-Info</Text>
        <View style={styles.headerButton} />
      </View>

      {!crew ? (
        error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator color={C.accent} style={styles.spinner} />
        )
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomTabInset + 24 }]}>
          <View style={styles.hero}>
            <CrewAvatar name={crew.name} size={72} />
            <Text style={styles.crewName}>{crew.name}</Text>
            {isOwner && (
              <Pressable onPress={() => onRename(crew)} hitSlop={8} style={styles.linkButton} accessibilityRole="button">
                <Text style={styles.link}>Umbenennen</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Einladungscode</Text>
            <View style={styles.codeRow} accessible accessibilityLabel={`Einladungscode ${formatInviteCode(code)}`}>
              {code.split('').map((ch, i) => (
                <View key={i} style={[styles.codeCell, i === 3 && styles.codeGap]}>
                  <Text style={styles.codeChar} selectable>
                    {ch}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.codeActions}>
              <Pressable onPress={share} style={({ pressed }) => [styles.primary, pressed && styles.pressed]} accessibilityRole="button">
                <Icon name="share" size={18} color={C.onAccent} strokeWidth={2} />
                <Text style={styles.primaryText}>Code teilen</Text>
              </Pressable>
              {isOwner && (
                <Pressable
                  onPress={newCode}
                  disabled={busy}
                  style={({ pressed }) => [styles.squareButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Neuen Code erstellen">
                  <Icon name="refresh" size={20} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={[styles.card, styles.switchRow]}>
            <Icon name={crew.muted ? 'bellOff' : 'bell'} size={22} color={crew.muted ? C.textMuted : C.accent} />
            <View style={styles.switchText}>
              <Text style={styles.value}>Mitteilungen</Text>
              <Text style={styles.hint}>
                {pushSupported
                  ? crew.muted
                    ? 'Stumm – keine Benachrichtigungen'
                    : 'Bei neuen Nachrichten'
                  : 'In dieser App-Variante nicht verfügbar'}
              </Text>
            </View>
            <Switch
              value={!crew.muted}
              onValueChange={toggleNotifications}
              trackColor={{ false: C.borderStrong, true: C.accent }}
              thumbColor={C.bg}
              ios_backgroundColor={C.borderStrong}
              accessibilityLabel="Mitteilungen"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>
              {crew.memberCount} {crew.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}
            </Text>
            {crew.members.map((m) => (
              <View key={m.id} style={styles.member}>
                <CrewAvatar name={m.name} size={36} round />
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.name}
                  {m.id === myId ? <Text style={styles.memberYou}> (du)</Text> : null}
                </Text>
                {m.role === 'owner' && <Text style={styles.ownerTag}>Ersteller</Text>}
              </View>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={confirmLeave} disabled={busy} style={({ pressed }) => [styles.leave, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.leaveText}>Crew verlassen</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerButton: { width: 44, height: 44, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: C.text, fontSize: 17, fontFamily: F.display },
  spinner: { marginTop: 60 },
  content: { padding: 16, gap: 12 },
  hero: { alignItems: 'center', gap: 6, paddingBottom: 6 },
  crewName: { color: C.text, fontSize: 24, fontFamily: F.displayBold, textAlign: 'center', marginTop: 4 },
  linkButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 10 },
  link: { color: C.accent, fontSize: 15, fontFamily: F.semibold },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.raised,
    borderRadius: R.xl,
    padding: 16,
    gap: 12,
  },
  label: { color: C.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: F.semibold },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  codeCell: {
    width: 40,
    height: 50,
    borderRadius: R.sm,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeGap: { marginLeft: 12 },
  codeChar: { color: C.text, fontSize: 24, fontFamily: F.displayBold },
  codeActions: { flexDirection: 'row', gap: 8 },
  primary: {
    flex: 1,
    height: 48,
    backgroundColor: C.accent,
    borderRadius: R.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: C.onAccent, fontFamily: F.bold, fontSize: 15 },
  squareButton: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    backgroundColor: C.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  switchText: { flex: 1, gap: 2 },
  value: { color: C.text, fontSize: 16, fontFamily: F.medium },
  hint: { color: C.textMuted, fontSize: 13, fontFamily: F.regular },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberName: { color: C.text, fontSize: 16, flex: 1, fontFamily: F.regular },
  memberYou: { color: C.textMuted },
  ownerTag: {
    color: C.accent,
    backgroundColor: C.accentSoft,
    fontSize: 11,
    fontFamily: F.semibold,
    borderRadius: R.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  error: { color: C.danger, fontSize: 14, textAlign: 'center', padding: 12, fontFamily: F.medium },
  leave: {
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    borderRadius: R.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveText: { color: C.danger, fontSize: 16, fontFamily: F.semibold },
});
