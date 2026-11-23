import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export type AuthProvider = 'apple' | 'google';

/** Ergebnis von Apple/Google: das ID-Token fürs Backend und (falls geliefert) der Name. */
export type ProviderResult = {
  idToken: string;
  name?: string;
};

/** Nutzer hat das Login-Fenster geschlossen – kein Fehler, nichts anzeigen. */
export class SignInCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// --- Apple -------------------------------------------------------------------

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<ProviderResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Kein Token von Apple erhalten');
    // Apple liefert den Namen nur beim allerersten Login.
    const name =
      [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') ||
      undefined;
    return { idToken: credential.identityToken, name };
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw e;
  }
}

// --- Google ------------------------------------------------------------------

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Google geht nur im Development Build / in der echten App, nicht in Expo Go. */
export function isGoogleAvailable(): boolean {
  if (Platform.OS === 'web' || isExpoGo || !GOOGLE_WEB_CLIENT_ID) return false;
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) return false;
  return true;
}

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let googleConfigured = false;

function loadGoogle(): GoogleModule {
  // Erst hier laden: In Expo Go fehlt das native Modul, ein Import beim Start würde abstürzen.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: GoogleModule = require('@react-native-google-signin/google-signin');
  if (!googleConfigured) {
    mod.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID, // nötig, damit Google ein idToken liefert
      iosClientId: GOOGLE_IOS_CLIENT_ID,
    });
    googleConfigured = true;
  }
  return mod;
}

export async function signInWithGoogle(): Promise<ProviderResult> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = loadGoogle();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new SignInCancelled();
    const { idToken, user } = response.data;
    if (!idToken) throw new Error('Kein Token von Google erhalten');
    return { idToken, name: user.name ?? undefined };
  } catch (e) {
    if (e instanceof SignInCancelled) throw e;
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) throw new SignInCancelled();
    throw e;
  }
}

export async function signInWith(provider: AuthProvider): Promise<ProviderResult> {
  return provider === 'apple' ? signInWithApple() : signInWithGoogle();
}

/** Beim Abmelden auch die Google-Sitzung im Gerät beenden (sonst wird beim nächsten Mal kein Konto abgefragt). */
export async function signOutProviders() {
  if (!isGoogleAvailable()) return;
  try {
    await loadGoogle().GoogleSignin.signOut();
  } catch {
    // egal
  }
}
