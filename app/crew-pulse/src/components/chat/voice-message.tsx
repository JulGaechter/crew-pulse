import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '@/hooks/use-voice-recorder';
import type { MessageAudio } from '@/services/chat-types';
import { audioSource } from '@/services/media';

type Props = {
  audio: MessageAudio;
  token: string;
  isOwn: boolean;
  onLongPress?: () => void;
};

/** Sprachnachricht abspielen: Play/Pause, Fortschritt, Zeit */
export function VoiceMessage({ audio, token, isOwn, onLongPress }: Props) {
  // Neue Quelle nur, wenn sich die Datei ändert (nicht bei jedem Rendern)
  const source = useMemo(
    () => audioSource(audio, token),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audio.id, audio.localUri, token],
  );
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  const totalSec = status.duration > 0 ? status.duration : audio.durationMs / 1000;
  const progress = totalSec > 0 ? Math.min(1, status.currentTime / totalSec) : 0;

  // Am Ende zurück an den Anfang
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (totalSec > 0 && status.currentTime >= totalSec - 0.1) player.seekTo(0);
      player.play();
    }
  };

  const shownMs = status.playing || status.currentTime > 0 ? status.currentTime * 1000 : audio.durationMs;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        onLongPress={onLongPress}
        delayLongPress={300}
        hitSlop={6}
        style={[styles.button, isOwn ? styles.buttonOwn : styles.buttonOther]}
        accessibilityLabel={status.playing ? 'Pause' : 'Abspielen'}>
        <Text style={[styles.icon, isOwn ? styles.iconOwn : styles.iconOther]}>{status.playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.bar, isOwn ? styles.barOwn : styles.barOther]}>
          <View style={[styles.fill, isOwn ? styles.fillOwn : styles.fillOther, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.time, isOwn && styles.timeOwn]}>
          🎤 {formatDuration(shownMs)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200, paddingVertical: 2 },
  button: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  buttonOwn: { backgroundColor: '#fff' },
  buttonOther: { backgroundColor: '#3b82f6' },
  icon: { fontSize: 14, fontWeight: '700' },
  iconOwn: { color: '#2563eb' },
  iconOther: { color: '#fff' },
  track: { flex: 1, gap: 4 },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  barOwn: { backgroundColor: 'rgba(255,255,255,0.35)' },
  barOther: { backgroundColor: '#444' },
  fill: { height: 4 },
  fillOwn: { backgroundColor: '#fff' },
  fillOther: { backgroundColor: '#3b82f6' },
  time: { color: '#aaa', fontSize: 11 },
  timeOwn: { color: '#dbeafe' },
});
