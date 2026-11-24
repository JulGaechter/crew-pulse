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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Crew-Info</Text>
        <View style={styles.back} />
      </View>

      {!crew ? (
        error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator color="#666" style={styles.spinner} />
        )
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomTabInset + 24 }]}>
          <View style={styles.hero}>
            <CrewAvatar name={crew.name} size={72} />
            <Text style={styles.crewName}>{crew.name}</Text>
            {isOwner && (
              <Pressable onPress={() => onRename(crew)} hitSlop={8}>
                <Text style={styles.link}>Umbenennen</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Einladungscode</Text>
            <Text style={styles.code} selectable>
              {formatInviteCode(crew.inviteCode)}
            </Text>
            <Pressable onPress={share} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Code teilen</Text>
            </Pressable>
            {isOwner && (
              <Pressable onPress={newCode} disabled={busy} style={styles.secondaryLink}>
                <Text style={styles.link}>Neuen Code erstellen</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.value}>Mitteilungen</Text>
                <Text style={styles.hint}>
                  {pushSupported
                    ? crew.muted
                      ? 'Stumm – keine Benachrichtigungen für diese Crew'
                      : 'Benachrichtigung bei neuen Nachrichten'
                    : 'In dieser App-Variante nicht verfügbar'}
                </Text>
              </View>
              <Switch value={!crew.muted} onValueChange={toggleNotifications} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>
              {crew.memberCount} {crew.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}
            </Text>
            {crew.members.map((m) => (
              <View key={m.id} style={styles.member}>
                <CrewAvatar name={m.name} size={34} />
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.name}
                  {m.id === myId ? ' (du)' : ''}
                </Text>
                {m.role === 'owner' && <Text style={styles.ownerTag}>Ersteller</Text>}
              </View>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={confirmLeave} disabled={busy} style={styles.leave}>
            <Text style={styles.leaveText}>Crew verlassen</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  back: { paddingHorizontal: 8, minWidth: 40 },
  backText: { color: '#4da6ff', fontSize: 34, lineHeight: 36, fontWeight: '300' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  spinner: { marginTop: 60 },
  content: { padding: 16, gap: 16 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  crewName: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 16, gap: 12 },
  label: { color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  code: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  primary: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryLink: { alignItems: 'center', paddingVertical: 4 },
  link: { color: '#4da6ff', fontSize: 15 },
  pressed: { opacity: 0.7 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1, gap: 2 },
  value: { color: '#fff', fontSize: 16 },
  hint: { color: '#888', fontSize: 13 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberName: { color: '#fff', fontSize: 16, flex: 1 },
  ownerTag: {
    color: '#fbbf24',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  error: { color: '#f87171', fontSize: 14, textAlign: 'center', padding: 12 },
  leave: { backgroundColor: '#1c1c1c', borderRadius: 14, padding: 16, alignItems: 'center' },
  leaveText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
