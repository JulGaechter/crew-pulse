// Ergänzt app.json um die Einstellungen für Login (Apple/Google) und Push-Benachrichtigungen.
// Die Google-Client-IDs kommen aus der .env (EXPO_PUBLIC_GOOGLE_...).
// Die EAS projectId steht in app.json unter expo.extra.eas.projectId (siehe Anleitung).

const BUNDLE_ID = 'ch.gaechterkind.crewpulse';

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];
  const addPlugin = (name, options) => {
    const exists = plugins.some((p) => (Array.isArray(p) ? p[0] : p) === name);
    if (!exists) plugins.push(options ? [name, options] : name);
  };

  addPlugin('expo-apple-authentication');
  addPlugin('expo-notifications');
  addPlugin('expo-image-picker', {
    photosPermission: 'CrewPulse braucht Zugriff auf deine Fotos, damit du Bilder in den Chat schicken kannst.',
    cameraPermission: 'CrewPulse braucht die Kamera, damit du Fotos aufnehmen und in den Chat schicken kannst.',
    microphonePermission: 'CrewPulse braucht das Mikrofon für Sprachnachrichten.',
  });
  addPlugin('expo-audio', {
    microphonePermission: 'CrewPulse braucht das Mikrofon, damit du Sprachnachrichten aufnehmen kannst.',
  });

  // Google braucht auf iOS ein URL-Schema = umgedrehte iOS-Client-ID.
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    const id = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    addPlugin('@react-native-google-signin/google-signin', {
      iosUrlScheme: `com.googleusercontent.apps.${id}`,
    });
  }

  // Design "Midnight Ice": immer dunkel, Splash auf dunklem Grund
  const BG = '#0A0D14';
  const ICON_BG = '#14324A';
  const themedPlugins = plugins.map((p) =>
    (Array.isArray(p) ? p[0] : p) === 'expo-splash-screen'
      ? ['expo-splash-screen', { backgroundColor: BG, image: './assets/images/splash-icon.png', imageWidth: 120 }]
      : p,
  );

  return {
    ...config,
    userInterfaceStyle: 'dark',
    backgroundColor: BG,
    icon: './assets/images/icon.png',
    ios: {
      ...config.ios,
      icon: './assets/images/icon.png',
      bundleIdentifier: config.ios?.bundleIdentifier ?? BUNDLE_ID,
      usesAppleSignIn: true,
    },
    android: {
      ...config.android,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        backgroundColor: ICON_BG,
      },
      package: config.android?.package ?? BUNDLE_ID,
    },
    plugins: themedPlugins,
  };
};
