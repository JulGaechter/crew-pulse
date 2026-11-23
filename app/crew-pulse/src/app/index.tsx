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

import { MessageBubble } from '@/components/chat/message-bubble';
import { NamePrompt } from '@/components/chat/name-prompt';
import { useChat, type ConnectionState } from '@/hooks/use-chat';
import { BottomTabInset } from '@/constants/theme';
import type { ChatMessage } from '@/services/chat-types';
import { loadName, saveName } from '@/services/profile-storage';

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

export default function ChatScreen() {
  const [name, setName] = useState<string | null>(null);
  const [nameLoaded, setNameLoaded] = useState(false);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    loadName().then((stored) => {
      setName(stored);
      setNameLoaded(true);
    });
  }, []);

  const handleName = useCallback((newName: string) => {
    setName(newName);
    setEditingName(false);
    saveName(newName);
  }, []);

  if (!nameLoaded) {
    return (
      <View style={[styles.safeArea, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!name || editingName) {
    return (
      <NamePrompt
        initialName={name ?? ''}
        onSubmit={handleName}
        onCancel={name ? () => setEditingName(false) : undefined}
      />
    );
  }

  return <ChatRoom name={name} onEditName={() => setEditingName(true)} />;
}

function ChatRoom({ name, onEditName }: { name: string; onEditName: () => void }) {
  const { messages, connection, online, typingUsers, sendMessage, retryMessage, notifyTyping, maxLength } =
    useChat(name);

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
      const showSender = !older || older.sender !== item.sender;
      return (
        <MessageBubble
          message={item}
          isOwn={item.sender === name}
          showSender={showSender}
          onRetry={retryMessage}
        />
      );
    },
    [data, name, retryMessage],
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
        <Pressable onPress={onEditName} hitSlop={10} style={styles.nameChip}>
          <Text style={styles.nameChipText} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
      </View>

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
