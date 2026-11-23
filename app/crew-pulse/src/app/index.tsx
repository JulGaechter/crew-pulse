import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountScreen } from '@/components/auth/account-screen';
import { LoginScreen } from '@/components/auth/login-screen';
import { MessageBubble } from '@/components/chat/message-bubble';
import { NamePrompt } from '@/components/chat/name-prompt';
import { BottomTabInset } from '@/constants/theme';
import { useAuthAvailability } from '@/hooks/use-auth-availability';
import { useChat, type ConnectionState } from '@/hooks/use-chat';
import {
  signInWith,
  SignInCancelled,
  signOutProviders,
  type AuthProvider,
} from '@/services/auth-providers';
import type { ChatMessage } from '@/services/chat-types';
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

const STATUS_LABEL: Record<ConnectionState, string> = {
  connected: 'Verbunden',
  connecting: 'Verbinde…',
  disconnected: 'Offline',
};

const STATUS_COLOR: Record<ConnectionState, string> = {
  connected: '#22c55e',
  connecting: '#f59e0b',
  disconnected: '#ef4444',
};

function typingText(users: string[]) {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0]} schreibt…`;
  if (users.length === 2) return `${users[0]} und ${users[1]} schreiben…`;
  return 'Mehrere schreiben…';
}

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

type Screen = 'chat' | 'account' | 'rename' | 'anonymous-name';

export default function ChatScreen() {
  const { apple, google, any: hasProvider } = useAuthAvailability();

  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>('chat');
  const [prefillName, setPrefillName] = useState('');
  const [busyName, setBusyName] = useState(false);
  const [busyProvider, setBusyProvider] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = (next: Screen) => {
    setError(null);
    setScreen(next);
  };

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
        setScreen('chat');
      } catch (e) {
        if (e instanceof SignInCancelled) return;
        if (e instanceof UnauthorizedError) {
          // Bisheriger Token ungültig -> ohne ihn nochmals versuchen
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
        setScreen('chat');
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          await clearSession();
          setSession(null);
          setScreen('chat');
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
    setScreen('chat');
  }, [session]);

  // Server lehnt den Token ab (z. B. Datenbank zurückgesetzt)
  const handleUnauthorized = useCallback(async () => {
    const wasLinked = (session?.user.providers ?? []).length > 0;
    const name = session?.user.name ?? '';
    await clearSession();
    setSession(null);
    // Mit Login verbunden -> einfach neu anmelden lassen. Sonst: neues Gerätekonto mit gleichem Namen.
    if (wasLinked || !name) return;
    try {
      setSession(await register(name));
    } catch {
      setPrefillName(name);
    }
  }, [session]);

  if (!loaded) {
    return (
      <View style={[styles.safeArea, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  // --- Nicht angemeldet ---
  if (!session) {
    if (screen === 'anonymous-name' || (!hasProvider && prefillName)) {
      return (
        <NamePrompt
          initialName={prefillName}
          onSubmit={handleName}
          onCancel={hasProvider ? () => go('chat') : undefined}
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
        onSkip={() => go('anonymous-name')}
      />
    );
  }

  // --- Angemeldet ---
  if (screen === 'rename') {
    return (
      <NamePrompt
        initialName={session.user.name}
        onSubmit={handleName}
        onCancel={() => go('account')}
        busy={busyName}
        error={error}
      />
    );
  }

  if (screen === 'account') {
    return (
      <AccountScreen
        session={session}
        apple={apple}
        google={google}
        busy={busyProvider}
        error={error}
        onRename={() => go('rename')}
        onConnect={handleProvider}
        onLogout={handleLogout}
        onClose={() => go('chat')}
      />
    );
  }

  const showLinkHint = hasProvider && (session.user.providers ?? []).length === 0;

  return (
    <ChatRoom
      session={session}
      onOpenAccount={() => go('account')}
      onUnauthorized={handleUnauthorized}
      showLinkHint={showLinkHint}
    />
  );
}

type ChatRoomProps = {
  session: Session;
  onOpenAccount: () => void;
  onUnauthorized: () => void;
  /** Hinweis "Konto mit Apple/Google verbinden" anzeigen */
  showLinkHint: boolean;
};

function ChatRoom({ session, onOpenAccount, onUnauthorized, showLinkHint }: ChatRoomProps) {
  const { messages, connection, online, typingUsers, sendMessage, retryMessage, notifyTyping, maxLength } =
    useChat(session, { onUnauthorized });
  const myId = session.user.id;
  const name = session.user.name;

  const [input, setInput] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  // Die native Tab-Leiste schwebt über dem Inhalt – Eingabe darüber platzieren.
  // Bei offener Tastatur ist die Tab-Leiste verdeckt, dann reicht wenig Abstand.
  const inputBottomPadding = keyboardVisible ? 8 : insets.bottom + BottomTabInset + 12;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Invertierte Liste: neueste Nachricht unten, scrollt automatisch mit.
  const data = useMemo(() => [...messages].reverse(), [messages]);

  const handleChange = (text: string) => {
    setInput(text);
    if (text.trim()) notifyTyping();
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // In der invertierten Liste ist index + 1 die ältere Nachricht.
      const older = data[index + 1];
      const authorKey = (m: ChatMessage) => m.senderId ?? `name:${m.sender}`;
      const showSender = !older || authorKey(older) !== authorKey(item);
      return (
        <MessageBubble
          message={item}
          isOwn={item.senderId === myId}
          showSender={showSender}
          onRetry={retryMessage}
        />
      );
    },
    [data, myId, retryMessage],
  );

  const canSend = input.trim().length > 0;
  const typing = typingText(typingUsers);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Crew-Chat</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[connection] }]} />
            <Text style={styles.statusText}>
              {STATUS_LABEL[connection]}
              {connection === 'connected' && online.length > 0 ? ` · ${online.length} online` : ''}
            </Text>
          </View>
        </View>
        <Pressable onPress={onOpenAccount} hitSlop={10} style={styles.nameChip}>
          <Text style={styles.nameChipText} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
      </View>

      {showLinkHint && (
        <Pressable onPress={onOpenAccount} style={styles.linkHint}>
          <Text style={styles.linkHintText}>
            Konto sichern: Mit Apple oder Google verbinden, um es auf allen Geräten zu nutzen ›
          </Text>
        </Pressable>
      )}

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <FlatList
          data={data}
          inverted
          keyExtractor={(item) => item.clientId ?? item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>
              {connection === 'connected'
                ? 'Noch keine Nachrichten. Schreib als Erste:r etwas!'
                : 'Verbinde mit der Crew…'}
            </Text>
          }
        />

        <Text style={styles.typing}>{typing}</Text>

        <View style={[styles.inputRow, { paddingBottom: inputBottomPadding }]}>
          <TextInput
            style={styles.input}
            placeholder="Nachricht an die Crew..."
            placeholderTextColor="#888"
            value={input}
            onChangeText={handleChange}
            multiline
            maxLength={maxLength}
          />
          <Pressable
            style={({ pressed }) => [styles.button, !canSend && styles.buttonDisabled, pressed && styles.pressed]}
            onPress={handleSend}
            disabled={!canSend}>
            <Text style={styles.buttonText}>Senden</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111' },
  center: { justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#999', fontSize: 12 },
  nameChip: {
    backgroundColor: '#242424',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 140,
  },
  nameChipText: { color: '#4da6ff', fontWeight: '600', fontSize: 13 },
  linkHint: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  linkHintText: { color: '#93c5fd', fontSize: 13 },
  list: { paddingHorizontal: 12, paddingVertical: 12 },
  empty: {
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
    // In invertierter Liste wird der Empty-State gespiegelt – zurückdrehen.
    transform: [{ scaleY: -1 }],
  },
  typing: { color: '#888', fontSize: 12, fontStyle: 'italic', paddingHorizontal: 16, minHeight: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    backgroundColor: '#111',
  },
  input: {
    flex: 1,
    backgroundColor: '#242424',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
