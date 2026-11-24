import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AuthGate } from '@/components/auth/auth-gate';
import { CrewSplash } from '@/components/crew-splash';
import { C } from '@/constants/crew-theme';

SplashScreen.preventAutoHideAsync();

// Navigation in den CrewPulse-Farben (immer dunkel)
const crewTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: C.surface,
    border: C.border,
    text: C.text,
    primary: C.accent,
  },
};

export default function TabLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // Splash bleibt sichtbar, bis die Schriften geladen sind (bei Fehler mit Systemschrift weiter)
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <ThemeProvider value={crewTheme}>
      <AuthGate>
        <AppTabs />
      </AuthGate>
      <CrewSplash />
    </ThemeProvider>
  );
}
