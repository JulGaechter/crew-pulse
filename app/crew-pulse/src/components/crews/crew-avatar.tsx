import { StyleSheet, Text, View } from 'react-native';

import { avatarColors, F, initials } from '@/constants/crew-theme';

/** Abgerundetes Quadrat mit Initialen; Farben aus dem Namen. round = Kreis (für Personen) */
export function CrewAvatar({ name, size = 52, round = false }: { name: string; size?: number; round?: boolean }) {
  const { bg, fg } = avatarColors(name);
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: round ? size / 2 : size * 0.34, backgroundColor: bg },
      ]}>
      <Text style={[styles.text, { color: fg, fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: F.displayBold },
});
