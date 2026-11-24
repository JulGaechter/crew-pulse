import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AccountScreen } from '@/components/auth/account-screen';
import { LoginScreen } from '@/components/auth/login-screen';
import { NamePrompt } from '@/components/chat/name-prompt';
import { C } from '@/constants/crew-theme';
import { useAuthAvailability } from '@/hooks/use-auth-availability';
import { ConnectionContext, SessionContext, type SessionContextValue } from '@/hooks/use-session';
import { useSocketConnection } from '@/hooks/use-socket-connection';
import {
  signInWith,
  SignInCancelled,
  signOutProviders,
  type AuthProvider,
} from '@/services/auth-providers';
import {
  ApiError,
  clearSession,
  loadLegacyName,
  loadSession,
  loginWithProvider,
  logout,
  refreshMe,
  register,
  rename,
  UnauthorizedError,
  type Session,
} from '@/services/session';

const NETWORK_ERROR = 'Keine Verbindung zum Server. Bitte nochmals versuchen.';

function loginErrorMessage(e: unknown, provider: AuthProvider) {
  const label = provider === 'apple' ? 'Apple' : 'Google';
  if (e instanceof ApiError) {
    if (e.code === 'provider_not_configured') return `${label}-Login ist auf dem Server noch nicht eingerichtet.`;
    if (e.code === 'provider_unreachable') return `${label} ist gerade nicht erreichbar. Bitte später nochmals.`;
    if (e.status === 401) return `${label} hat die Anmeldung nicht bestätigt. Bitte nochmals versuchen.`;
    return NETWORK_ERROR;
  }
  return `Anmeldung mit ${label} fehlgeschlagen. Bitte nochmals versuchen.`;
}

/** Hält die Socket-Verbindung für die ganze App offen, solange jemand angemeldet ist */
function ConnectionProvider({ session, onUnauthorized, children }: { session: Session; onUnauthorized: () => void; children: ReactNode }) {
  const connection = useSocketConnection(session, onUnauthorized);
  return <ConnectionContext.Provider value={connection}>{children}</ConnectionContext.Provider>;
}

type Overlay = 'none' | 'account' | 'rename';

/**
 * Kümmert sich um Anmeldung, Konto und Namensänderung – für die ganze App (Root-Layout).
 * Ist jemand angemeldet, werden die Tabs angezeigt; Konto und Verbindung stehen über
 * useSession()/useConnection() bereit. Konto-Screens liegen darüber, damit nichts neu lädt.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { apple, google, any: hasProvider } = useAuthAvailability();

  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [askAnonymousName, setAskAnonymousName] = useState(false);
  const [prefillName, setPrefillName] = useState('');
  const [busyName, setBusyName] = useState(false);
  const [busyProvider, setBusyProvider] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showOverlay = useCallback((next: Overlay) => {
    setError(null);
    setOverlay(next);
  }, []);

  // Gespeichertes Konto laden. Wer noch einen Namen aus der ganz alten Version hat,
  // bekommt automatisch ein Konto mit diesem Namen.
  useEffect(() => {
    (async () => {
      const stored = await loadSession();
      if (stored) {
        setSession(stored);
        // Profil im Hintergrund aktualisieren (Name, verknüpfte Logins)
        refreshMe(stored)
          .then(setSession)
          .catch(async (e) => {
            if (e instanceof UnauthorizedError) {
              await clearSession();
              setSession(null);
            }
          });
      } else {
        const legacyName = await loadLegacyName();
        if (legacyName) {
          try {
            setSession(await register(legacyName));
          } catch {
            setPrefillName(legacyName);
          }
        }
      }
      setLoaded(true);
    })();
  }, []);

  // Anmelden oder (wenn schon ein Konto aktiv ist) verknüpfen
  const handleProvider = useCallback(
    async (provider: AuthProvider) => {
      setBusyProvider(provider);
      setError(null);
      try {
        const result = await signInWith(provider);
        const { session: next } = await loginWithProvider(provider, result, session);
        setSession(next);
        setOverlay('none');
        setAskAnonymousName(false);
      } catch (e) {
        if (e instanceof SignInCancelled) return;
        if (e instanceof UnauthorizedError) {
          await clearSession();
          setSession(null);
        }
        setError(loginErrorMessage(e, provider));
      } finally {
        setBusyProvider(null);
      }
    },
    [session],
  );

  // Name ändern bzw. Konto ohne Login anlegen
  const handleName = useCallback(
    async (name: string) => {
      setBusyName(true);
      setError(null);
      try {
        setSession(session ? await rename(session, name) : await register(name));
        setOverlay(session ? 'account' : 'none');
        setAskAnonymousName(false);
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          await clearSession();
          setSession(null);
          setOverlay('none');
        } else {
          setError(NETWORK_ERROR);
        }
      } finally {
        setBusyName(false);
      }
    },
    [session],
  );

  const handleLogout = useCallback(async () => {
    if (session) await logout(session);
    await signOutProviders();
    setSession(null);
    setPrefillName('');
    setOverlay('none');
  }, [session]);

  // Server lehnt den Token ab (z. B. Datenbank zurückgesetzt)
  const handleUnauthorized = useCallback(async () => {
    const wasLinked = (session?.user.providers ?? []).length > 0;
    const name = session?.user.name ?? '';
    await clearSession();
    setSession(null);
    setOverlay('none');
    // Mit Login verbunden -> einfach neu anmelden lassen. Sonst: neues Gerätekonto mit gleichem Namen.
    if (wasLinked || !name) return;
    try {
      setSession(await register(name));
    } catch {
      setPrefillName(name);
    }
  }, [session]);

  const openAccount = useCallback(() => showOverlay('account'), [showOverlay]);

  if (!loaded) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  // --- Nicht angemeldet ---
  if (!session) {
    if (askAnonymousName || (!hasProvider && prefillName)) {
      return (
        <NamePrompt
          initialName={prefillName}
          onSubmit={handleName}
          onCancel={
            hasProvider
              ? () => {
                  setError(null);
                  setAskAnonymousName(false);
                }
              : undefined
          }
          busy={busyName}
          error={error}
        />
      );
    }
    return (
      <LoginScreen
        apple={apple}
        google={google}
        busy={busyProvider}
        error={error}
        onProvider={handleProvider}
        onSkip={() => {
          setError(null);
          setAskAnonymousName(true);
        }}
      />
    );
  }

  // --- Angemeldet ---
  const showLinkHint = hasProvider && (session.user.providers ?? []).length === 0;
  const contextValue: SessionContextValue = {
    session,
    showLinkHint,
    openAccount,
    onUnauthorized: handleUnauthorized,
  };

  return (
    <View style={styles.fill}>
      <SessionContext.Provider value={contextValue}>
        <ConnectionProvider session={session} onUnauthorized={handleUnauthorized}>
          {children}
        </ConnectionProvider>
      </SessionContext.Provider>

      {overlay !== 'none' && (
        <View style={StyleSheet.absoluteFill}>
          {overlay === 'rename' ? (
            <NamePrompt
              initialName={session.user.name}
              onSubmit={handleName}
              onCancel={() => showOverlay('account')}
              busy={busyName}
              error={error}
            />
          ) : (
            <AccountScreen
              session={session}
              apple={apple}
              google={google}
              busy={busyProvider}
              error={error}
              onRename={() => showOverlay('rename')}
              onConnect={handleProvider}
              onLogout={handleLogout}
              onClose={() => showOverlay('none')}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
});
