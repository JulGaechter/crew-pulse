import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CrewAvatar } from '@/components/crews/crew-avatar';
import { Icon } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';
import type { CrewSummary } from '@/services/chat-types';
import { listCrews } from '@/services/crews';
import type { Session } from '@/services/session';
import { loadContacts, type SnapContact } from '@/services/snaps';

export type SnapTargets = { toStory: boolean; crewIds: string[]; userIds: string[] };

type Props = {
  session: Session;
  sending: boolean;
  error: string | null;
  onBack: () => void;
  onSend: (targets: SnapTargets) => void;
  /** Schon ausgewählte Personen (z. B. beim Zurück-snappen) */
  initialUserIds?: string[];
};

type Row =
  | { kind: 'story' }
  | { kind: 'crew'; crew: CrewSummary }
  | { kind: 'person'; person: SnapContact }
  | { kind: 'hint'; text: string };

/** "Senden an": Meine Story, Crews (alle Mitglieder) und einzelne Personen */
export function SnapSendSheet({ session, sending, error, onBack, onSend, initialUserIds }: Props) {
  const insets = useSafeAreaInsets();
  const [crews, setCrews] = useState<CrewSummary[] | null>(null);
  const [people, setPeople] = useState<SnapContact[] | null>(null);
  const [crewError, setCrewError] = useState(false);
  const [peopleError, setPeopleError] = useState(false);
  const [query, setQuery] = useState('');
  const [toStory, setToStory] = useState(false);
  const [crewIds, setCrewIds] = useState<Set<string>>(new Set());
  const [userIds, setUserIds] = useState<Set<string>>(() => new Set(initialUserIds ?? []));

  useEffect(() => {
    let active = true;
    // Getrennt laden: Fehlt eins, bleibt das andere trotzdem auswählbar
    listCrews(session)
      .then((c) => active && setCrews(c))
      .catch(() => {
        if (!active) return;
        setCrews([]);
        setCrewError(true);
      });
    loadContacts(session)
      .then((p) => active && setPeople(p))
      .catch(() => {
        if (!active) return;
        setPeople([]);
        setPeopleError(true);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const toggle = (set: Set<string>, id: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (name: string) => !q || name.toLowerCase().includes(q);
    const result: { title: string; data: Row[] }[] = [];
    if (!q) result.push({ title: 'Story', data: [{ kind: 'story' }] });
    const crewRows = (crews ?? []).filter((c) => match(c.name)).map((crew) => ({ kind: 'crew', crew }) as Row);
    if (crewRows.length) result.push({ title: 'Crews', data: crewRows });
    else if (!q && crewError) result.push({ title: 'Crews', data: [{ kind: 'hint', text: 'Crews konnten nicht geladen werden.' }] });

    const personRows = (people ?? []).filter((p) => match(p.name)).map((person) => ({ kind: 'person', person }) as Row);
    if (personRows.length) result.push({ title: 'Personen', data: personRows });
    else if (!q) {
      const text = peopleError
        ? 'Personen konnten nicht geladen werden. Läuft auf dem Server schon die neue Version (docker compose up -d --build api)?'
        : 'Noch niemand sonst in deinen Crews. Teile den Einladungscode einer Crew – wer beitritt, erscheint hier.';
      result.push({ title: 'Personen', data: [{ kind: 'hint', text }] });
    }
    return result;
  }, [crews, people, query, crewError, peopleError]);

  const selectedNames = [
    ...(toStory ? ['Meine Story'] : []),
    ...(crews ?? []).filter((c) => crewIds.has(c.id)).map((c) => c.name),
    ...(people ?? []).filter((p) => userIds.has(p.id)).map((p) => p.name),
  ];
  const canSend = selectedNames.length > 0 && !sending;

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'hint') return <Text style={styles.hint}>{item.text}</Text>;
    let selected = false;
    let onPress: () => void;
    let avatar: ReactNode;
    let title: string;
    let subtitle: string;
    if (item.kind === 'story') {
      selected = toStory;
      onPress = () => setToStory((s) => !s);
      avatar = (
        <View style={styles.storyAvatar}>
          <Icon name="camera" size={22} color={C.onAccent} strokeWidth={2} />
        </View>
      );
      title = 'Meine Story';
      subtitle = 'Alle aus deinen Crews · 24 Stunden';
    } else if (item.kind === 'crew') {
      selected = crewIds.has(item.crew.id);
      onPress = () => toggle(crewIds, item.crew.id, setCrewIds);
      avatar = <CrewAvatar name={item.crew.name} size={44} />;
      title = item.crew.name;
      subtitle = `${item.crew.memberCount} ${item.crew.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}`;
    } else {
      selected = userIds.has(item.person.id);
      onPress = () => toggle(userIds, item.person.id, setUserIds);
      avatar = <CrewAvatar name={item.person.name} size={44} round />;
      title = item.person.name;
      subtitle = item.person.crews.join(', ');
    }
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.raised }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}>
        {avatar}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? <Icon name="check" size={15} color={C.onAccent} strokeWidth={3} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Zurück">
          <Icon name="back" size={22} color={C.text} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Senden an</Text>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={18} color={C.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Suchen"
          placeholderTextColor={C.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      {!crews || !people ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) =>
            item.kind === 'story'
              ? 'story'
              : item.kind === 'crew'
                ? `c-${item.crew.id}`
                : item.kind === 'person'
                  ? `u-${item.person.id}`
                  : `h-${item.text}`
          }
          renderItem={renderRow}
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={<Text style={[styles.muted, { padding: 24 }]}>Niemand gefunden.</Text>}
        />
      )}

      {/* Leiste unten wie bei Snapchat: Auswahl + Senden */}
      {selectedNames.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footerRow}>
            <Text style={styles.footerNames} numberOfLines={2}>
              {selectedNames.join(', ')}
            </Text>
            <Pressable
              onPress={() => onSend({ toStory, crewIds: [...crewIds], userIds: [...userIds] })}
              disabled={!canSend}
              style={({ pressed }) => [styles.send, (!canSend || pressed) && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Senden">
              {sending ? (
                <ActivityIndicator color={C.onAccent} />
              ) : (
                <Icon name="send" size={22} color={C.onAccent} strokeWidth={2.2} />
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 22, fontFamily: F.displayBold },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontFamily: F.regular, fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { color: C.textMuted, fontFamily: F.regular, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, paddingVertical: 6 },
  muted: { color: C.textMuted, fontFamily: F.regular, fontSize: 15, textAlign: 'center' },
  section: {
    color: C.textMuted,
    fontFamily: F.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  storyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: C.text, fontFamily: F.semibold, fontSize: 16 },
  rowSub: { color: C.textMuted, fontFamily: F.regular, fontSize: 13 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: C.accent, borderColor: C.accent },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 8,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerNames: { flex: 1, color: C.text, fontFamily: F.semibold, fontSize: 15 },
  send: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: C.danger, fontFamily: F.medium, fontSize: 13 },
});
