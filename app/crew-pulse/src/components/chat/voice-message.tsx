import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { C, F } from '@/constants/crew-theme';
import { formatDuration } from '@/hooks/use-voice-recorder';
import type { MessageAudio } from '@/services/chat-types';
import { audioSource } from '@/services/media';

type Props = {
  audio: MessageAudio;
  token: string;
  isOwn: boolean;
  onLongPress?: () => void;
};

// Feste "Wellenform" (echte Pegel kennt der Server nicht) – aus der ID abgeleitet, damit sie stabil bleibt
const BARS = 22;
function waveform(seed: string) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) | 0;
    const r = ((h >>> 8) % 100) / 100;
    const envelope = Math.sin((Math.PI * (i + 1)) / (BARS + 1)); // in der Mitte höher
    return 5 + Math.round((6 + r * 12) * (0.45 + envelope * 0.55));
  });
}

/** Sprachnachricht abspielen: Play/Pause, Wellenform als Fortschritt, Zeit */
export function VoiceMessage({ audio, token, isOwn, onLongPress }: Props) {
  // Neue Quelle nur, wenn sich die Datei ändert (nicht bei jedem Rendern)
  const source = useMemo(
    () => audioSource(audio, token),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audio.id, audio.localUri, token],
  );
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const bars = useMemo(() => waveform(audio.id || audio.localUri || 'x'), [audio.id, audio.localUri]);

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
  const played = isOwn ? C.onAccent : C.accent;
  const unplayed = isOwn ? 'rgba(10,13,20,0.28)' : '#3A4A63';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        onLongPress={onLongPress}
        delayLongPress={300}
        hitSlop={6}
        style={[styles.button, { backgroundColor: isOwn ? C.onAccent : C.accent }]}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : 'Sprachnachricht abspielen'}>
        <Icon name={status.playing ? 'pause' : 'play'} size={16} color={isOwn ? C.accent : C.onAccent} />
      </Pressable>
      <View style={styles.track}>
        <View style={styles.wave}>
          {bars.map((h, i) => (
            <View
              key={i}
              style={[styles.bar, { height: h, backgroundColor: (i + 0.5) / BARS <= progress ? played : unplayed }]}
            />
          ))}
        </View>
        <Text style={[styles.time, isOwn && styles.timeOwn]}>{formatDuration(shownMs)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 210, paddingVertical: 2 },
  button: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, gap: 4 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  bar: { width: 3, borderRadius: 2 },
  time: { color: C.textMuted, fontSize: 11, fontFamily: F.medium },
  timeOwn: { color: C.onAccentMuted },
});
