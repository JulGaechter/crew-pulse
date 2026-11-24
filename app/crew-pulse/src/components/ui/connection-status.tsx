import { StyleSheet, Text, View } from 'react-native';

import { C, F } from '@/constants/crew-theme';
import type { ConnectionState } from '@/hooks/use-socket-connection';

const LABEL: Record<ConnectionState, string> = {
  connected: 'Verbunden',
  connecting: 'Verbinde…',
  disconnected: 'Offline',
};

const COLOR: Record<ConnectionState, string> = {
  connected: C.online,
  connecting: C.warning,
  disconnected: C.danger,
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
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { color: C.textMuted, fontSize: 12, fontFamily: F.regular },
});
