import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { captionMetrics, SnapOverlayView } from '@/components/snaps/snap-overlay';
import { Icon, type IconName } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';
import type { PickedImage } from '@/services/media';
import type { SnapOverlay } from '@/services/snaps';

const COLORS = ['#FFFFFF', '#7CD4FF', '#FF5A6E', '#FFD34E', '#4ADE80', '#C084FC', '#0A0D14'];
const TIMERS: (number | null)[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null];
const MAX_PATH_CHARS = 7800;

export type EditedSnap = { photo: PickedImage; overlay: SnapOverlay | null; durationSec: number | null };

type Props = {
  photo: PickedImage;
  initial?: { overlay: SnapOverlay | null; durationSec: number | null };
  onClose: () => void;
  onNext: (snap: EditedSnap) => void;
};

type Mode = 'none' | 'draw' | 'text' | 'timer';

/** Foto bearbeiten: zeichnen, Bildunterschrift (verschiebbar), Timer – dann "Senden an" */
export function SnapEditor({ photo, initial, onClose, onNext }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('none');
  const [color, setColor] = useState(COLORS[1]);
  const [paths, setPaths] = useState<SnapOverlay['paths']>(initial?.overlay?.paths ?? []);
  const [live, setLive] = useState<{ d: string; c: string; s: number } | null>(null);
  const [caption, setCaption] = useState(initial?.overlay?.caption?.text ?? '');
  const [captionY, setCaptionY] = useState(initial?.overlay?.caption?.y ?? photo.height * 0.62);
  const [duration, setDuration] = useState<number | null>(initial ? initial.durationSec : 5);

  // Foto füllt den Bildschirm ("cover"): Umrechnung Bildschirm <-> Foto-Pixel
  const geo = useMemo(() => {
    const scale = Math.max(W / photo.width, H / photo.height);
    return { scale, ox: (W - photo.width * scale) / 2, oy: (H - photo.height * scale) / 2 };
  }, [W, H, photo.width, photo.height]);
  const toImage = (x: number, y: number) => ({
    x: Math.round((x - geo.ox) / geo.scale),
    y: Math.round((y - geo.oy) / geo.scale),
  });
  const strokeWidth = Math.round(photo.width * 0.012);

  // Aktuelle Werte für die PanResponder (werden nur einmal erstellt)
  const state = useRef({ mode, color, geo, strokeWidth, captionY });
  state.current = { mode, color, geo, strokeWidth, captionY };

  const drawing = useRef<{ d: string; last: { x: number; y: number } } | null>(null);
  const drawResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => state.current.mode === 'draw',
        onMoveShouldSetPanResponder: () => state.current.mode === 'draw',
        onPanResponderGrant: (e) => {
          const { geo: g } = state.current;
          const p = {
            x: Math.round((e.nativeEvent.locationX - g.ox) / g.scale),
            y: Math.round((e.nativeEvent.locationY - g.oy) / g.scale),
          };
          drawing.current = { d: `M${p.x} ${p.y} L${p.x} ${p.y}`, last: p };
          setLive({ d: drawing.current.d, c: state.current.color, s: state.current.strokeWidth });
        },
        onPanResponderMove: (e) => {
          const cur = drawing.current;
          if (!cur || cur.d.length > MAX_PATH_CHARS) return;
          const { geo: g } = state.current;
          const p = {
            x: Math.round((e.nativeEvent.locationX - g.ox) / g.scale),
            y: Math.round((e.nativeEvent.locationY - g.oy) / g.scale),
          };
          // Nur Punkte mit etwas Abstand speichern (Pfad bleibt klein)
          if (Math.hypot(p.x - cur.last.x, p.y - cur.last.y) < state.current.strokeWidth * 0.4) return;
          cur.d += ` ${p.x} ${p.y}`;
          cur.last = p;
          setLive({ d: cur.d, c: state.current.color, s: state.current.strokeWidth });
        },
        onPanResponderRelease: () => {
          const cur = drawing.current;
          drawing.current = null;
          setLive(null);
          if (cur) {
            setPaths((ps) =>
              ps.length >= 60 ? ps : [...ps, { d: cur.d, c: state.current.color, s: state.current.strokeWidth }],
            );
          }
        },
        onPanResponderTerminate: () => {
          drawing.current = null;
          setLive(null);
        },
      }),
    [],
  );

  // Bildunterschrift senkrecht verschieben
  const dragStart = useRef(0);
  const captionResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          dragStart.current = state.current.captionY;
        },
        onPanResponderMove: (_, g) => {
          const { geo: geom } = state.current;
          const minY = (insets.top + 90 - geom.oy) / geom.scale;
          const maxY = (H - insets.bottom - 150 - geom.oy) / geom.scale;
          const next = dragStart.current + g.dy / geom.scale;
          setCaptionY(Math.min(maxY, Math.max(minY, next)));
        },
      }),
    [H, insets.top, insets.bottom],
  );

  const overlay: SnapOverlay | null =
    paths.length || caption.trim()
      ? {
          v: 1,
          w: photo.width,
          h: photo.height,
          paths,
          caption: caption.trim() ? { text: caption.trim(), y: Math.round(captionY) } : null,
        }
      : null;

  const { fontSize, barHeight } = captionMetrics(photo.width);
  const captionTop = geo.oy + captionY * geo.scale - (barHeight * geo.scale) / 2;
  const showCaptionBar = mode === 'text' || caption.trim().length > 0;

  const toggle = (m: Mode) => {
    if (m !== 'text') Keyboard.dismiss();
    setMode((cur) => (cur === m ? 'none' : m));
  };

  const tool = (name: IconName, m: Mode, label: string) => (
    <Pressable
      onPress={() => toggle(m)}
      style={[styles.tool, mode === m && styles.toolActive]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Icon name={name} size={21} color={mode === m ? C.onAccent : C.text} strokeWidth={2} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />

      {/* Zeichenfläche (Tippen ausserhalb schliesst die Tastatur) */}
      <View
        style={StyleSheet.absoluteFill}
        {...drawResponder.panHandlers}
        onTouchEnd={() => {
          if (mode === 'text') {
            Keyboard.dismiss();
            setMode('none');
          }
        }}>
        <SnapOverlayView overlay={overlay} livePath={live} hideCaption />
      </View>

      {showCaptionBar && (
        <View
          style={[styles.captionBar, { top: captionTop, height: barHeight * geo.scale }]}
          {...captionResponder.panHandlers}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            autoFocus={mode === 'text' && !caption}
            onFocus={() => setMode('text')}
            onSubmitEditing={() => setMode('none')}
            maxLength={80}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            placeholder={mode === 'text' ? 'Text eingeben…' : ''}
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={[styles.captionInput, { fontSize: fontSize * geo.scale }]}
            textAlign="center"
          />
        </View>
      )}

      {/* Oben: Schliessen links, Werkzeuge rechts */}
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={onClose} style={styles.tool} accessibilityRole="button" accessibilityLabel="Verwerfen">
          <Icon name="close" size={22} color={C.text} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.tools}>
          {tool('text', 'text', 'Text')}
          {tool('pen', 'draw', 'Zeichnen')}
          {mode === 'draw' && paths.length > 0 && (
            <Pressable
              onPress={() => setPaths((p) => p.slice(0, -1))}
              style={styles.tool}
              accessibilityRole="button"
              accessibilityLabel="Rückgängig">
              <Icon name="undo" size={20} color={C.text} strokeWidth={2} />
            </Pressable>
          )}
          <Pressable
            onPress={() => toggle('timer')}
            style={[styles.tool, mode === 'timer' && styles.toolActive]}
            accessibilityRole="button"
            accessibilityLabel={`Timer: ${duration ? `${duration} Sekunden` : 'unbegrenzt'}`}>
            <Icon name="timer" size={20} color={mode === 'timer' ? C.onAccent : C.text} strokeWidth={2} />
            <Text style={[styles.timerLabel, mode === 'timer' && { color: C.onAccent }]}>
              {duration ? `${duration}s` : '∞'}
            </Text>
          </Pressable>
          {mode === 'draw' && (
            <View style={styles.colors}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Farbe ${c}`}
                  style={[styles.color, { backgroundColor: c }, color === c && styles.colorActive]}
                />
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Timer-Auswahl */}
      {mode === 'timer' && (
        <View style={[styles.timerBar, { bottom: insets.bottom + 96 }]}>
          <Text style={styles.timerTitle}>Wie lange sichtbar?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timerRow}>
            {TIMERS.map((t) => (
              <Pressable
                key={t ?? 'inf'}
                onPress={() => {
                  setDuration(t);
                  setMode('none');
                }}
                style={[styles.timerChip, duration === t && styles.timerChipActive]}
                accessibilityRole="button"
                accessibilityLabel={t ? `${t} Sekunden` : 'Unbegrenzt'}>
                <Text style={[styles.timerChipText, duration === t && { color: C.onAccent }]}>{t ? `${t}s` : '∞'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Unten: Weiter */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            onNext({ photo, overlay, durationSec: duration });
          }}
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.85 }]}
          accessibilityRole="button">
          <Text style={styles.nextText}>Senden an</Text>
          <Icon name="send" size={18} color={C.onAccent} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  tools: { alignItems: 'center', gap: 10 },
  tool: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(10,13,20,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActive: { backgroundColor: C.accent },
  timerLabel: { position: 'absolute', bottom: 3, fontSize: 9, color: C.text, fontFamily: F.bold },
  colors: {
    marginTop: 4,
    gap: 10,
    padding: 8,
    borderRadius: R.pill,
    backgroundColor: 'rgba(10,13,20,0.5)',
  },
  color: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  colorActive: { borderColor: '#FFFFFF', borderWidth: 3, transform: [{ scale: 1.15 }] },
  captionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,13,20,0.6)',
    justifyContent: 'center',
  },
  captionInput: { color: '#FFFFFF', fontFamily: F.semibold, paddingHorizontal: 16, paddingVertical: 0 },
  timerBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: R.xl,
    backgroundColor: 'rgba(18,23,34,0.92)',
    gap: 10,
  },
  timerTitle: { color: C.textSoft, fontFamily: F.semibold, fontSize: 13, paddingHorizontal: 4 },
  timerRow: { gap: 8, paddingHorizontal: 2 },
  timerChip: {
    minWidth: 46,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: R.pill,
    backgroundColor: C.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerChipActive: { backgroundColor: C.accent },
  timerChipText: { color: C.text, fontFamily: F.bold, fontSize: 15 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'flex-end', paddingHorizontal: 16 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 22,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  nextText: { color: C.onAccent, fontFamily: F.bold, fontSize: 16 },
});
