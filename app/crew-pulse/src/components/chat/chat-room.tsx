import { setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatComposer, type ComposerMode } from '@/components/chat/chat-composer';
import { ImageViewer } from '@/components/chat/image-viewer';
import { MessageActions } from '@/components/chat/message-actions';
import { MessageBubble } from '@/components/chat/message-bubble';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { BottomTabInset } from '@/constants/theme';
import { useChat } from '@/hooks/use-chat';
import type { ConnectionState } from '@/hooks/use-socket-connection';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import type { ChatMessage, CrewSummary, ReadState } from '@/services/chat-types';
import { PermissionDeniedError, pickImage } from '@/services/media';
import type { Session } from '@/services/session';

function typingText(users: string[]) {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0]} schreibt…`;
  if (users.length === 2) return `${users[0]} und ${users[1]} schreiben…`;
  return 'Mehrere schreiben…';
}

/** "Gesehen von …" für die eigene neueste Nachricht */
function readLabelFor(message: ChatMessage, readStates: ReadState[], myId: string) {
  const others = readStates.filter((r) => r.userId !== myId);
  if (others.length === 0) return undefined;
  const readers = others.filter((r) => r.lastReadAt >= message.createdAt);
  if (readers.length === 0) return 'Zugestellt';
  if (others.length === 1) return 'Gesehen';
  if (readers.length === others.length) return 'Gesehen von allen';
  const names = readers.map((r) => r.name).filter(Boolean);
  if (names.length === 0) return `Gesehen von ${readers.length}`;
  return names.length <= 3
    ? `Gesehen von ${names.join(', ')}`
    : `Gesehen von ${names.slice(0, 2).join(', ')} und ${names.length - 2} weiteren`;
}

type Props = {
  crew: CrewSummary;
  session: Session;
  connection: ConnectionState;
  onBack: () => void;
  onOpenInfo: () => void;
};

export function ChatRoom({ crew, session, connection, onBack, onOpenInfo }: Props) {
  const {
    messages,
    loaded,
    hasMore,
    loadingOlder,
    loadOlder,
    online,
    readStates,
    typingUsers,
    sendMessage,
    sendImage,
    sendVoice,
    retryMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    notifyTyping,
    maxLength,
  } = useChat(crew.id, session, connection);
  const myId = session.user.id;
  const token = session.token;

  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  const [viewing, setViewing] = useState<ChatMessage | null>(null);
  const [mode, setMode] = useState<ComposerMode>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [input, setInput] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  // Die native Tab-Leiste schwebt über dem Inhalt – Eingabe darüber platzieren.
  // Bei offener Tastatur ist die Tab-Leiste verdeckt, dann reicht wenig Abstand.
  const inputBottomPadding = keyboardVisible ? 8 : insets.bottom + BottomTabInset + 12;

  useEffect(() => {
    // Sprachnachrichten auch im Lautlos-Modus hörbar abspielen
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
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

  // "Gesehen von …" nur unter der eigenen neuesten (angekommenen) Nachricht
  const lastOwnSent = useMemo(
    () => data.find((m) => m.senderId === myId && (m.status === 'sent' || !m.status) && !m.deleted),
    [data, myId],
  );
  const readLabel = lastOwnSent ? readLabelFor(lastOwnSent, readStates, myId) : undefined;

  // --- Sprachnachricht --------------------------------------------------------
  const replyTarget = mode?.type === 'reply' ? mode.message : undefined;
  const onRecorded = useCallback(
    (uri: string, durationMs: number) => {
      sendVoice(uri, durationMs, replyTarget);
      setMode(null);
    },
    [sendVoice, replyTarget],
  );
  const recorder = useVoiceRecorder(onRecorded);

  const startRecording = async () => {
    try {
      Keyboard.dismiss();
      await recorder.start();
    } catch (e) {
      Alert.alert(
        e instanceof PermissionDeniedError ? 'Kein Mikrofonzugriff' : 'Aufnahme nicht möglich',
        e instanceof PermissionDeniedError
          ? 'Erlaube den Zugriff auf das Mikrofon in den iPhone-Einstellungen.'
          : 'Bitte nochmals versuchen.',
      );
    }
  };

  // --- Text, Bearbeiten -------------------------------------------------------
  const handleChange = (text: string) => {
    setInput(text);
    if (text.trim() && mode?.type !== 'edit') notifyTyping();
  };

  const cancelMode = () => {
    if (mode?.type === 'edit') setInput('');
    setMode(null);
  };

  const handleSend = async () => {
    if (mode?.type === 'edit') {
      const target = mode.message;
      const text = input;
      setMode(null);
      setInput('');
      const ok = await editMessage(target.id, text);
      if (!ok) Alert.alert('Bearbeiten fehlgeschlagen', 'Bitte nochmals versuchen.');
      return;
    }
    if (!input.trim()) return;
    sendMessage(input, replyTarget);
    setInput('');
    setMode(null);
  };

  const startEdit = (message: ChatMessage) => {
    setMode({ type: 'edit', message });
    setInput(message.text);
  };

  const startReply = (message: ChatMessage) => {
    if (mode?.type === 'edit') setInput('');
    setMode({ type: 'reply', message });
  };

  const handleDelete = async (message: ChatMessage) => {
    if (mode?.message.id === message.id) cancelMode();
    const ok = await deleteMessage(message.id);
    if (!ok) Alert.alert('Löschen fehlgeschlagen', 'Bitte nochmals versuchen.');
  };

  // --- Foto -------------------------------------------------------------------
  // Ein bereits getippter Text wird als Bildunterschrift mitgeschickt
  const attachFrom = async (source: 'camera' | 'library') => {
    try {
      const picked = await pickImage(source);
      if (!picked) return;
      sendImage(picked, input, replyTarget);
      setInput('');
      setMode(null);
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        Alert.alert('Kein Kamerazugriff', 'Erlaube den Zugriff auf die Kamera in den iPhone-Einstellungen.');
      } else {
        Alert.alert('Foto konnte nicht geladen werden', 'Bitte nochmals versuchen.');
      }
    }
  };

  const handleAttach = () => {
    Alert.alert('Foto senden', undefined, [
      { text: 'Foto aufnehmen', onPress: () => attachFrom('camera') },
      { text: 'Aus Mediathek wählen', onPress: () => attachFrom('library') },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  // --- Zur zitierten Nachricht springen --------------------------------------
  const jumpTo = useCallback(
    (messageId: string) => {
      const index = data.findIndex((m) => m.id === messageId);
      if (index === -1) {
        Alert.alert('Nachricht nicht geladen', 'Scrolle weiter nach oben, um ältere Nachrichten zu laden.');
        return;
      }
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedId(messageId);
      setTimeout(() => setHighlightedId((id) => (id === messageId ? null : id)), 1600);
    },
    [data],
  );

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
          myId={myId}
          token={token}
          showSender={showSender}
          readLabel={item.id === lastOwnSent?.id ? readLabel : undefined}
          highlighted={item.id === highlightedId}
          onRetry={retryMessage}
          onLongPress={setActionsFor}
          onPressImage={setViewing}
          onPressReply={jumpTo}
          onToggleReaction={toggleReaction}
        />
      );
    },
    [data, myId, token, lastOwnSent?.id, readLabel, highlightedId, retryMessage, jumpTo, toggleReaction],
  );

  const onlineText = `${crew.memberCount} Mitglieder · ${online.length} online`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Pressable onPress={onOpenInfo} style={styles.titleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {crew.name}
          </Text>
          <ConnectionStatus connection={connection} connectedText={onlineText} />
        </Pressable>
        <Pressable onPress={onOpenInfo} hitSlop={12} style={styles.infoButton}>
          <Text style={styles.infoText}>ⓘ</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={data}
          inverted
          keyExtractor={(item) => item.clientId ?? item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          // Ganz nach oben gescrollt (invertierte Liste: "Ende") -> ältere Nachrichten laden
          onEndReached={hasMore ? loadOlder : undefined}
          onEndReachedThreshold={0.3}
          // Ziel noch nicht gemessen -> grob hinscrollen und nochmals versuchen
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            }, 250);
          }}
          ListFooterComponent={
            loadingOlder ? <ActivityIndicator color="#666" style={styles.olderSpinner} /> : undefined
          }
          ListEmptyComponent={
            loaded ? (
              <Text style={styles.empty}>Noch keine Nachrichten. Schreib als Erste:r etwas!</Text>
            ) : (
              <ActivityIndicator color="#666" style={styles.emptySpinner} />
            )
          }
        />

        <Text style={styles.typing}>{typingText(typingUsers)}</Text>

        <ChatComposer
          value={input}
          onChangeText={handleChange}
          placeholder={`Nachricht an ${crew.name}…`}
          maxLength={maxLength}
          mode={mode}
          onCancelMode={cancelMode}
          onSend={handleSend}
          onAttach={handleAttach}
          bottomPadding={inputBottomPadding}
          recording={recorder.recording}
          recordingMs={recorder.durationMs}
          onStartRecording={startRecording}
          onSendRecording={recorder.send}
          onCancelRecording={recorder.cancel}
        />
      </KeyboardAvoidingView>

      <MessageActions
        message={actionsFor}
        myId={myId}
        readStates={readStates}
        onReact={toggleReaction}
        onReply={startReply}
        onEdit={startEdit}
        onDelete={handleDelete}
        onClose={() => setActionsFor(null)}
      />
      <ImageViewer message={viewing} token={token} onClose={() => setViewing(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111' },
  container: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  back: { paddingHorizontal: 8 },
  backText: { color: '#4da6ff', fontSize: 34, lineHeight: 36, fontWeight: '300' },
  titleWrap: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  infoButton: { paddingHorizontal: 10 },
  infoText: { color: '#4da6ff', fontSize: 22 },
  list: { paddingHorizontal: 12, paddingVertical: 12 },
  empty: {
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
    // In invertierter Liste wird der Empty-State gespiegelt – zurückdrehen.
    transform: [{ scaleY: -1 }],
  },
  emptySpinner: { marginTop: 40 },
  olderSpinner: { marginVertical: 16 },
  typing: { color: '#888', fontSize: 12, fontStyle: 'italic', paddingHorizontal: 16, minHeight: 16 },
});
