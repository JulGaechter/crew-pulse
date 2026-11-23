import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
            cornerRadius={14}
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
            <ActivityIndicator color="#111" />
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

      {busy === 'apple' && <ActivityIndicator color="#fff" style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  appleButton: { width: '100%', height: 50 },
  googleButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleG: { fontSize: 20, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 17, fontWeight: '600', color: '#111' },
  dimmed: { opacity: 0.5 },
  spinner: { marginTop: 4 },
});
