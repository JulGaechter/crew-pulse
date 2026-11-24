import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F, R } from '@/constants/crew-theme';
import type { AuthProvider } from '@/services/auth-providers';

type Props = {
  apple: boolean;
  google: boolean;
  /** Welcher Anbieter gerade lädt (null = keiner) */
  busy: AuthProvider | null;
  onPress: (provider: AuthProvider) => void;
  /** "continue" = Mit Apple fortfahren, "signIn" = Mit Apple anmelden */
  variant?: 'continue' | 'signIn';
};

export function ProviderButtons({ apple, google, busy, onPress, variant = 'continue' }: Props) {
  const disabled = busy !== null;

  return (
    <View style={styles.wrapper}>
      {apple && (
        <View pointerEvents={disabled ? 'none' : 'auto'} style={disabled && styles.dimmed}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              variant === 'continue'
                ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={R.lg}
            style={styles.appleButton}
            onPress={() => onPress('apple')}
          />
        </View>
      )}

      {google && (
        <Pressable
          onPress={() => onPress('google')}
          disabled={disabled}
          style={({ pressed }) => [styles.googleButton, (pressed || disabled) && styles.dimmed]}>
          {busy === 'google' ? (
            <ActivityIndicator color={C.text} />
          ) : (
            <>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleText}>
                {variant === 'continue' ? 'Mit Google fortfahren' : 'Mit Google anmelden'}
              </Text>
            </>
          )}
        </Pressable>
      )}

      {busy === 'apple' && <ActivityIndicator color={C.accent} style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  appleButton: { width: '100%', height: 54 },
  // Google: dunkle Variante passend zum Design
  googleButton: {
    height: 54,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleG: { fontSize: 20, fontFamily: F.bold, color: '#8AB4F8' },
  googleText: { fontSize: 17, fontFamily: F.semibold, color: C.text },
  dimmed: { opacity: 0.5 },
  spinner: { marginTop: 4 },
});
