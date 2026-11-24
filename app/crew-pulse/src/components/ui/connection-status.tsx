import { StyleSheet, Text, View } from 'react-native';

import type { ConnectionState } from '@/hooks/use-socket-connection';

const LABEL: Record<ConnectionState, string> = {
  connected: 'Verbunden',
  connecting: 'Verbinde…',
  disconnected: 'Offline',
};

const COLOR: Record<ConnectionState, string> = {
  connected: '#22c55e',
  connecting: '#f59e0b',
  disconnected: '#ef4444',
};

/** Punkt + Text; wenn verbunden, kann statt "Verbunden" ein eigener Text stehen (z. B. "3 online"). */
export function ConnectionStatus({
  connection,
  connectedText,
}: {
  connection: ConnectionState;
  connectedText?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: COLOR[connection] }]} />
      <Text style={styles.text} numberOfLines={1}>
        {connection === 'connected' && connectedText ? connectedText : LABEL[connection]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: '#999', fontSize: 12 },
});
