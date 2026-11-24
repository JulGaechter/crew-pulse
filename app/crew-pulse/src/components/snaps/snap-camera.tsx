import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';
import { BottomTabInset } from '@/constants/theme';
import type { PickedImage } from '@/services/media';

type Props = {
  /** Kamera nur aktiv, wenn der Tab sichtbar ist (Akku, Privatsphäre) */
  active: boolean;
  unopenedCount: number;
  hasNewStories: boolean;
  onCaptured: (photo: PickedImage) => void;
  onOpenInbox: () => void;
  /** Zurück-snappen: an wen die Antwort geht */
  replyTo?: { id: string; name: string } | null;
  onCancelReply?: () => void;
};

/** Vollbild-Kamera wie bei Snapchat: Auslöser unten, Posteingang oben links, Blitz/Wechseln oben rechts */
export function SnapCamera({ active, unopenedCount, hasNewStories, onCaptured, onOpenInbox, replyTo, onCancelReply }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'ios' ? insets.bottom + 20 : insets.bottom + BottomTabInset + 20;

  // Nach unten wischen öffnet den Posteingang (wie bei Snapchat); der Knopf bleibt
  const openInboxRef = useRef(onOpenInbox);
  openInboxRef.current = onOpenInbox;
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dy > 70 || g.vy > 0.6) openInboxRef.current();
        },
      }),
    [],
  );

  // Doppelt tippen = Kamera wechseln (wie bei Snapchat)
  const lastTap = useRef(0);
  const onTapPreview = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      setFacing((f) => (f === 'back' ? 'front' : 'back'));
    } else lastTap.current = now;
  };

  // Kamera wird beim Verlassen des Tabs abgebaut -> danach neu auf "bereit" warten
  useEffect(() => {
    if (!active) setReady(false);
  }, [active]);

  const capture = async () => {
    if (!ready || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85, shutterSound: false });
      if (photo) onCaptured({ uri: photo.uri, width: photo.width, height: photo.height });
    } finally {
      setCapturing(false);
    }
  };

  const inboxBadge = unopenedCount > 0 || hasNewStories;

  const topBar = (
    <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
      <Pressable
        onPress={onOpenInbox}
        style={styles.roundButton}
        accessibilityRole="button"
        accessibilityLabel={`Snaps und Storys${unopenedCount ? `, ${unopenedCount} neu` : ''}`}>
        <Icon name="chat" size={22} color={C.text} strokeWidth={2} />
        {inboxBadge && (
          <View style={styles.badge}>
            {unopenedCount > 0 ? <Text style={styles.badgeText}>{unopenedCount > 9 ? '9+' : unopenedCount}</Text> : null}
          </View>
        )}
      </Pressable>
      {permission?.granted && (
        <View style={styles.topRight}>
          <Pressable
            onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
            style={[styles.roundButton, flash === 'on' && styles.roundButtonActive]}
            accessibilityRole="button"
            accessibilityLabel={flash === 'on' ? 'Blitz aus' : 'Blitz an'}>
            <Icon name="flash" size={20} color={flash === 'on' ? C.onAccent : C.text} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.roundButton}
            accessibilityRole="button"
            accessibilityLabel="Kamera wechseln">
            <Icon name="refresh" size={20} color={C.text} strokeWidth={2} />
          </Pressable>
        </View>
      )}
    </View>
  );

  // --- Noch keine Erlaubnis ---
  if (!permission?.granted) {
    return (
      <View style={styles.container} {...swipe.panHandlers}>
        {topBar}
        <View style={styles.permission}>
          <View style={styles.permissionIcon}>
            <Icon name="camera" size={34} />
          </View>
          <Text style={styles.permissionTitle}>Kamera für Snaps</Text>
          <Text style={styles.permissionText}>
            {permission && !permission.canAskAgain
              ? 'Der Kamerazugriff ist ausgeschaltet. Du kannst ihn in den iPhone-Einstellungen erlauben.'
              : 'Erlaube den Kamerazugriff, um Snaps aufzunehmen.'}
          </Text>
          {(!permission || permission.canAskAgain) && (
            <Pressable onPress={requestPermission} style={styles.permissionButton} accessibilityRole="button">
              <Text style={styles.permissionButtonText}>Kamera erlauben</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} {...swipe.panHandlers}>
      {active ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          mirror={facing === 'front'}
          onCameraReady={() => setReady(true)}
        />
      ) : null}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onTapPreview}
        accessibilityLabel="Doppelt tippen, um die Kamera zu wechseln"
      />
      {topBar}
      <View style={[styles.bottom, { paddingBottom: bottom }]}>
        {replyTo && (
          <View style={styles.reply}>
            <Text style={styles.replyText} numberOfLines={1}>
              Antwort an {replyTo.name}
            </Text>
            <Pressable onPress={onCancelReply} hitSlop={10} accessibilityRole="button" accessibilityLabel="Antwort abbrechen">
              <Icon name="close" size={16} color={C.text} strokeWidth={2.4} />
            </Pressable>
          </View>
        )}
        <Pressable
          onPress={capture}
          disabled={!ready || capturing}
          style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}
          accessibilityRole="button"
          accessibilityLabel="Foto aufnehmen">
          {capturing ? <ActivityIndicator color={C.text} /> : <View style={styles.shutterInner} />}
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
    paddingHorizontal: 16,
    zIndex: 2,
  },
  topRight: { gap: 10 },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(10,13,20,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonActive: { backgroundColor: C.accent },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: C.onAccent, fontSize: 10, fontFamily: F.bold },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '80%',
    marginBottom: 16,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: 'rgba(10,13,20,0.6)',
  },
  replyText: { color: C.text, fontFamily: F.semibold, fontSize: 14, flexShrink: 1 },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { transform: [{ scale: 0.92 }] },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.15)' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, backgroundColor: C.bg },
  permissionIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  permissionTitle: { color: C.text, fontSize: 24, fontFamily: F.displayBold },
  permissionText: { color: C.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center', fontFamily: F.regular },
  permissionButton: {
    marginTop: 10,
    height: 50,
    paddingHorizontal: 24,
    borderRadius: R.lg,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: { color: C.onAccent, fontFamily: F.bold, fontSize: 16 },
});
