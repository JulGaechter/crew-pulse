// Ergänzt app.json um die Einstellungen für "Mit Apple/Google anmelden".
// Die Google-Client-IDs kommen aus der .env (EXPO_PUBLIC_GOOGLE_...).

const BUNDLE_ID = 'ch.gaechterkind.crewpulse';

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? []), 'expo-apple-authentication'];

  // Google braucht auf iOS ein URL-Schema = umgedrehte iOS-Client-ID.
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    const id = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
    plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: `com.googleusercontent.apps.${id}` },
    ]);
  }

  return {
    ...config,
    ios: {
      ...config.ios,
      bundleIdentifier: config.ios?.bundleIdentifier ?? BUNDLE_ID,
      usesAppleSignIn: true,
    },
    android: {
      ...config.android,
      package: config.android?.package ?? BUNDLE_ID,
    },
    plugins,
  };
};
