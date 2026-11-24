import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { C } from '@/constants/crew-theme';

/**
 * Übernimmt den nativen Splash (gleiches Bild, gleicher Hintergrund)
 * und blendet ihn sanft aus, sobald die App gezeichnet ist.
 */
export function CrewSplash() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <Animated.View exiting={FadeOut.duration(350)} style={styles.overlay} pointerEvents="none">
      <View
        onLayout={() => {
          SplashScreen.hideAsync().finally(() => setTimeout(() => setVisible(false), 150));
        }}
        style={styles.center}>
        <Image source={require('@/assets/images/splash-icon.png')} style={styles.image} contentFit="contain" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: C.bg, zIndex: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: 120, height: 120 },
});
