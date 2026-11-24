import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_URL } from '@/services/api';
import type { AuthProvider, ProviderResult } from '@/services/auth-providers';
import type { ChatUser } from '@/services/chat-types';

export type Session = {
  user: ChatUser;
  token: string;
};

/** Fehler vom Server mit HTTP-Status und Fehlercode (z. B. 503 "provider_not_configured"). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** Der Server kennt den Token nicht (mehr) – neu anmelden nötig. */
export class UnauthorizedError extends ApiError {
  constructor() {
    super(401, 'unauthorized');
  }
}

// SecureStore erlaubt nur Buchstaben, Zahlen, ".", "-" und "_" im Schlüssel.
const SESSION_KEY = 'crewpulse.session';
// Name aus der Version vor den Benutzerkonten – wird einmalig übernommen.
const LEGACY_NAME_KEY = 'crewpulse:name';

// Token gehört in den sicheren Speicher (iOS Keychain). Im Browser gibt es den nicht.
async function readSecure(key: string) {
  return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}
async function writeSecure(key: string, value: string) {
  return Platform.OS === 'web'
    ? AsyncStorage.setItem(key, value)
    : SecureStore.setItemAsync(key, value);
}
async function deleteSecure(key: string) {
  return Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key);
}

// --- Lokaler Speicher --------------------------------------------------------

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await readSecure(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.token && parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

async function saveSession(session: Session) {
  await writeSecure(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  try {
    await deleteSecure(SESSION_KEY);
  } catch {
    // egal
  }
}

export async function loadLegacyName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LEGACY_NAME_KEY);
  } catch {
    return null;
  }
}

// --- Server ------------------------------------------------------------------

export async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      // kein JSON
    }
    throw new ApiError(res.status, code);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

async function storeAndReturn(session: Session) {
  await saveSession(session);
  AsyncStorage.removeItem(LEGACY_NAME_KEY).catch(() => {});
  return session;
}

/** Konto ohne Login anlegen (gilt nur auf diesem Gerät). */
export async function register(name: string): Promise<Session> {
  const data = await request<Session>('/users', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return storeAndReturn({ user: data.user, token: data.token });
}

export type LoginOutcome = 'signed_in' | 'linked' | 'created';

/**
 * Mit Apple/Google anmelden. Ist auf dem Gerät schon ein Konto aktiv, schickt die App
 * dessen Token mit – der Server verknüpft dann Apple/Google mit diesem Konto.
 */
export async function loginWithProvider(
  provider: AuthProvider,
  result: ProviderResult,
  current: Session | null,
): Promise<{ session: Session; outcome: LoginOutcome }> {
  const data = await request<Session & { outcome: LoginOutcome }>(`/auth/${provider}`, {
    method: 'POST',
    token: current?.token,
    body: JSON.stringify({ idToken: result.idToken, name: result.name }),
  });
  const session = await storeAndReturn({ user: data.user, token: data.token });
  return { session, outcome: data.outcome };
}

/** Profil neu laden (Name, verknüpfte Logins). */
export async function refreshMe(session: Session): Promise<Session> {
  const data = await request<{ user: ChatUser }>('/users/me', { token: session.token });
  const next: Session = { ...session, user: data.user };
  await saveSession(next);
  return next;
}

/** Anzeigenamen ändern. */
export async function rename(session: Session, name: string): Promise<Session> {
  const data = await request<{ user: ChatUser }>('/users/me', {
    method: 'PATCH',
    token: session.token,
    body: JSON.stringify({ name }),
  });
  const next: Session = { ...session, user: data.user };
  await saveSession(next);
  return next;
}

/** Auf diesem Gerät abmelden. */
export async function logout(session: Session) {
  try {
    await request('/auth/logout', { method: 'POST', token: session.token });
  } catch {
    // Auch offline lokal abmelden
  }
  await clearSession();
}
