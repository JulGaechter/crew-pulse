import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { C, F, R } from '@/constants/crew-theme';

/** Platzhalter für Tabs, die noch gebaut werden */
export function ComingSoon({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <View style={styles.iconBox}>
          <Icon name={icon} size={34} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Kommt bald</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  iconBox: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { color: C.text, fontSize: 26, fontFamily: F.displayBold, letterSpacing: -0.4 },
  text: { color: C.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center', fontFamily: F.regular, maxWidth: 300 },
  badge: {
    marginTop: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: { color: C.accent, fontSize: 12, fontFamily: F.semibold },
});
