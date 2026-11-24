import { Image } from 'expo-image';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import Svg, { Circle } from 'react-native-svg';

import { CrewAvatar } from '@/components/crews/crew-avatar';
import { SnapOverlayView } from '@/components/snaps/snap-overlay';
import { Icon } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';
import { ApiError, type Session } from '@/services/session';
import {
  deleteStory,
  loadStoryViewers,
  markViewed,
  openSnap,
  reportScreenshot,
  timeAgo,
  type OpenedSnap,
  type StoryViewer,
} from '@/services/snaps';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  session: Session;
  /** Snaps nacheinander anzeigen (Direkt-Snaps eines Absenders oder Story-Teile) */
  snapIds: string[];
  startIndex?: number;
  kind: 'direct' | 'story';
  /** Eigene Story: Zuschauer anzeigen + löschen */
  isOwnStory?: boolean;
  onClose: () => void;
  /** Direkt zurück-snappen: Kamera öffnen, Absender ist schon ausgewählt */
  onReply?: (to: { id: string; name: string }) => void;
};

/** Vollbild-Ansicht: Tippen = weiter, gedrückt halten = Pause, Timer läuft ab */
export function SnapViewer({ session, snapIds, startIndex = 0, kind, isOwnStory = false, onClose, onReply }: Props) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);
  const [snap, setSnap] = useState<OpenedSnap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<View>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const paused = useRef(false);
  const viewedIds = useRef(new Set<string>());
  const currentId = snapIds[index];

  const finishCurrent = useCallback(() => {
    if (currentId && !isOwnStory && !viewedIds.current.has(currentId) && snap?.id === currentId) {
      viewedIds.current.add(currentId);
      markViewed(session, currentId);
    }
  }, [currentId, isOwnStory, session, snap?.id]);

  const next = useCallback(() => {
    finishCurrent();
    progress.stopAnimation();
    if (index + 1 >= snapIds.length) onClose();
    else setIndex((i) => i + 1);
  }, [finishCurrent, index, onClose, progress, snapIds.length]);

  const prev = useCallback(() => {
    // Zurück nur bei Storys (Direkt-Snaps sind nach dem Ansehen weg)
    if (kind !== 'story' || index === 0) return;
    progress.stopAnimation();
    setIndex((i) => i - 1);
  }, [index, kind, progress]);

  // Aktuellen Snap laden
  useEffect(() => {
    if (!currentId) return;
    let active = true;
    setSnap(null);
    setImageReady(false);
    setLoadError(null);
    setViewers(null);
    progress.setValue(0);
    openSnap(session, currentId)
      .then((s) => active && setSnap(s))
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && (e.status === 410 || e.status === 404)) {
          setLoadError(e.status === 410 ? 'Schon angesehen' : 'Nicht mehr verfügbar');
          setTimeout(() => active && next(), 900);
        } else setLoadError('Snap konnte nicht geladen werden.');
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, session]);

  // Timer starten, sobald das Foto sichtbar ist
  const run = useCallback(
    (from: number) => {
      if (!snap?.durationSec) return;
      Animated.timing(progress, {
        toValue: 1,
        duration: snap.durationSec * 1000 * (1 - from),
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && !paused.current) next();
      });
    },
    [next, progress, snap?.durationSec],
  );

  useEffect(() => {
    if (imageReady && snap && !viewers) {
      paused.current = false;
      run(0);
    }
    return () => progress.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageReady, snap?.id]);

  const pause = () => {
    paused.current = true;
    progress.stopAnimation();
  };
  const resume = () => {
    if (!paused.current) return;
    paused.current = false;
    progress.stopAnimation((v) => run(v));
  };

  // Beim Schliessen den letzten Snap als angesehen melden
  const finishRef = useRef(finishCurrent);
  finishRef.current = finishCurrent;
  useEffect(() => () => finishRef.current(), []);

  // Screenshot erkennen -> Absender benachrichtigen (wie bei Snapchat, kein Blockieren)
  const snapRef = useRef(snap);
  snapRef.current = snap;
  useEffect(() => {
    const sub = ScreenCapture.addScreenshotListener(() => {
      const s = snapRef.current;
      if (!s || isOwnStory) return;
      reportScreenshot(session, s.id);
      setToast(`Screenshot – ${s.from.name} wird benachrichtigt`);
      setTimeout(() => setToast(null), 2500);
    });
    return () => sub.remove();
  }, [isOwnStory, session]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  // Foto inkl. Zeichnung und Text in die Fotos-App speichern
  const save = async () => {
    if (!snap || saving) return;
    pause();
    setSaving(true);
    try {
      const perm = await requestPermissionsAsync(true);
      if (perm.status !== 'granted') {
        showToast('Kein Zugriff auf Fotos – in den Einstellungen erlauben');
        return;
      }
      const path = await captureRef(photoRef, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
      await Asset.create(path.startsWith('file://') ? path : `file://${path}`);
      if (isOwnStory) showToast('In Fotos gespeichert');
      else {
        // Wie ein Screenshot: der Absender erfährt es
        reportScreenshot(session, snap.id);
        showToast(`Gespeichert – ${snap.from.name} wird benachrichtigt`);
      }
    } catch (e) {
      console.warn('Snap speichern fehlgeschlagen', e);
      showToast('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
      resume();
    }
  };

  const reply = () => {
    if (!snap || !onReply) return;
    pause();
    onReply(snap.from);
  };

  const openViewers = async () => {
    if (!snap) return;
    pause();
    setViewers([]);
    try {
      setViewers(await loadStoryViewers(session, snap.id));
    } catch {
      setViewers([]);
    }
  };
  const closeViewers = () => {
    setViewers(null);
    resume();
  };

  const confirmDelete = () => {
    if (!snap) return;
    pause();
    Alert.alert('Story-Snap löschen?', 'Er verschwindet sofort für alle.', [
      { text: 'Abbrechen', style: 'cancel', onPress: resume },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStory(session, snap.id);
          } catch {}
          next();
        },
      },
    ]);
  };

  const ringSize = 30;
  const ringR = 12;
  const ringLen = 2 * Math.PI * ringR;

  return (
    <View style={styles.container}>
      {snap ? (
        <View ref={photoRef} collapsable={false} style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri: snap.photo.dataUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onLoad={() => setImageReady(true)}
            onError={() => setImageReady(true)}
          />
          <SnapOverlayView overlay={snap.overlay} />
        </View>
      ) : null}

      {(!snap || !imageReady) && (
        <View style={styles.center}>
          {loadError ? <Text style={styles.loadError}>{loadError}</Text> : <ActivityIndicator color={C.accent} />}
        </View>
      )}

      {/* Tippen links = zurück (Story), rechts/irgendwo = weiter, halten = Pause */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) => (kind === 'story' && e.nativeEvent.locationX < W * 0.28 ? prev() : next())}
        onLongPress={pause}
        onPressOut={resume}
        delayLongPress={200}
        accessibilityRole="button"
        accessibilityLabel="Weiter"
      />

      {/* Oben: Fortschritt + Absender */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        {kind === 'story' && (
          <View style={styles.bars}>
            {snapIds.map((id, i) => (
              <View key={id} style={styles.bar}>
                {i < index ? (
                  <View style={[styles.barFill, { width: '100%' }]} />
                ) : i === index ? (
                  <Animated.View
                    style={[
                      styles.barFill,
                      {
                        width: snap?.durationSec
                          ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : imageReady
                            ? '100%'
                            : '0%',
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}
        <View style={styles.header} pointerEvents="box-none">
          {snap && <CrewAvatar name={snap.from.name} size={36} round />}
          <View style={{ flex: 1 }} pointerEvents="none">
            <Text style={styles.name} numberOfLines={1}>
              {snap ? (isOwnStory ? 'Meine Story' : snap.from.name) : ''}
            </Text>
            {snap && <Text style={styles.time}>{timeAgo(snap.createdAt)}</Text>}
          </View>
          {kind === 'direct' && snap && (
            <View style={styles.ring} pointerEvents="none">
              {snap.durationSec ? (
                <Svg width={ringSize} height={ringSize}>
                  <Circle cx={15} cy={15} r={ringR} stroke="rgba(255,255,255,0.25)" strokeWidth={3} fill="none" />
                  <AnimatedCircle
                    cx={15}
                    cy={15}
                    r={ringR}
                    stroke={C.accent}
                    strokeWidth={3}
                    fill="none"
                    strokeDasharray={`${ringLen} ${ringLen}`}
                    strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [0, ringLen] })}
                    strokeLinecap="round"
                    transform="rotate(-90 15 15)"
                  />
                </Svg>
              ) : (
                <Text style={styles.infinite}>∞</Text>
              )}
            </View>
          )}
          <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Schliessen">
            <Icon name="close" size={22} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      {/* Eigene Story: Zuschauer + Löschen */}
      {isOwnStory && snap && (
        <View style={[styles.ownBar, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
          <Pressable onPress={openViewers} style={styles.ownButton} accessibilityRole="button">
            <Icon name="eye" size={18} color={C.text} />
            <Text style={styles.ownText}>Zuschauer</Text>
          </Pressable>
          <View style={styles.ownRight}>
            <Pressable onPress={save} style={styles.ownButton} accessibilityRole="button" accessibilityLabel="Speichern">
              {saving ? <ActivityIndicator color={C.text} /> : <Icon name="download" size={18} color={C.text} />}
            </Pressable>
            <Pressable onPress={confirmDelete} style={styles.ownButton} accessibilityRole="button" accessibilityLabel="Löschen">
              <Icon name="trash" size={18} color={C.danger} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Fremder Snap/Story: speichern + direkt zurück-snappen */}
      {!isOwnStory && snap && imageReady && (
        <View style={[styles.ownBar, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
          <Pressable onPress={save} style={styles.roundAction} accessibilityRole="button" accessibilityLabel="Speichern">
            {saving ? <ActivityIndicator color={C.text} /> : <Icon name="download" size={22} color={C.text} strokeWidth={2} />}
          </Pressable>
          {onReply && (
            <Pressable
              onPress={reply}
              style={({ pressed }) => [styles.replyButton, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`Snap an ${snap.from.name} zurückschicken`}>
              <Icon name="camera" size={20} color={C.onAccent} strokeWidth={2.2} />
              <Text style={styles.replyText}>Antworten</Text>
            </Pressable>
          )}
        </View>
      )}

      {toast && (
        <View style={[styles.toast, { top: insets.top + 70 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {viewers && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay }]} onPress={closeViewers} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {viewers.length} {viewers.length === 1 ? 'Zuschauer' : 'Zuschauer'}
            </Text>
            <FlatList
              data={viewers}
              keyExtractor={(v) => v.id}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={<Text style={styles.sheetEmpty}>Noch niemand.</Text>}
              renderItem={({ item }) => (
                <View style={styles.viewer}>
                  <CrewAvatar name={item.name} size={36} round />
                  <Text style={styles.viewerName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.screenshot && (
                    <View style={styles.shotBadge}>
                      <Text style={styles.shotText}>Screenshot</Text>
                    </View>
                  )}
                  <Text style={styles.viewerTime}>{timeAgo(item.viewedAt)}</Text>
                </View>
              )}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  loadError: { color: C.textSoft, fontFamily: F.semibold, fontSize: 16 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 10, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  name: {
    color: '#FFFFFF',
    fontFamily: F.bold,
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  time: { color: 'rgba(255,255,255,0.8)', fontFamily: F.medium, fontSize: 12 },
  ring: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  infinite: { color: '#FFFFFF', fontSize: 22, fontFamily: F.bold },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  ownBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  ownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: R.pill,
    backgroundColor: 'rgba(10,13,20,0.6)',
  },
  ownRight: { flexDirection: 'row', gap: 10 },
  roundAction: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(10,13,20,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 22,
    borderRadius: R.pill,
    backgroundColor: C.accent,
  },
  replyText: { color: C.onAccent, fontFamily: F.bold, fontSize: 16 },
  ownText: { color: C.text, fontFamily: F.semibold, fontSize: 14 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.pill,
    backgroundColor: 'rgba(18,23,34,0.92)',
  },
  toastText: { color: C.text, fontFamily: F.semibold, fontSize: 14 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong },
  sheetTitle: { color: C.text, fontFamily: F.displayBold, fontSize: 18, marginVertical: 12 },
  sheetEmpty: { color: C.textMuted, fontFamily: F.regular, fontSize: 15, paddingVertical: 20 },
  viewer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  viewerName: { flex: 1, color: C.text, fontFamily: F.semibold, fontSize: 15 },
  viewerTime: { color: C.textMuted, fontFamily: F.regular, fontSize: 12 },
  shotBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.accentSoft },
  shotText: { color: C.accent, fontFamily: F.semibold, fontSize: 11 },
});
