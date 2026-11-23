import { useCallback, useEffect, useRef, useState } from 'react';

import { socket } from '@/services/api';
import type {
  ChatMessage,
  ChatUser,
  JoinAck,
  PresenceEvent,
  SendAck,
  TypingEvent,
} from '@/services/chat-types';
import type { Session } from '@/services/session';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const ACK_TIMEOUT_MS = 5000;
const TYPING_IDLE_MS = 2500;
const REMOTE_TYPING_EXPIRE_MS = 4000;
const MAX_LENGTH = 1000;

function makeClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fügt eine Nachricht ein oder ersetzt die passende optimistische Version. */
function upsertMessage(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  const byClientId = msg.clientId
    ? list.findIndex(
        (m) => m.clientId === msg.clientId && (!msg.senderId || m.senderId === msg.senderId),
      )
    : -1;
  if (byClientId !== -1) {
    const next = [...list];
    next[byClientId] = { ...msg, status: 'sent' };
    return next;
  }
  if (list.some((m) => m.id === msg.id)) return list;
  return [...list, { ...msg, status: 'sent' }];
}

/** Server-Verlauf übernehmen, aber noch offene/fehlgeschlagene lokale Nachrichten behalten. */
function mergeHistory(prev: ChatMessage[], history: ChatMessage[], myId: string): ChatMessage[] {
  const fromServer = history.map((m) => ({ ...m, status: 'sent' as const }));
  const known = new Set(
    history.filter((h) => h.senderId === myId && h.clientId).map((h) => h.clientId),
  );
  const stillOpen = prev.filter(
    (m) => (m.status === 'pending' || m.status === 'failed') && !known.has(m.clientId),
  );
  return [...fromServer, ...stillOpen];
}

type Options = {
  /** Wird aufgerufen, wenn der Server den Token ablehnt. */
  onUnauthorized?: () => void;
};

export function useChat(session: Session | null, { onUnauthorized }: Options = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('disconnected');
  const [online, setOnline] = useState<ChatUser[]>([]);
  // userId -> Name derjenigen, die gerade tippen
  const [typing, setTyping] = useState<Record<string, string>>({});

  const remoteTypingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const ownTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownIsTyping = useRef(false);

  // Aktuelle Werte für Callbacks, ohne bei Namensänderung neu zu verbinden.
  const userRef = useRef<ChatUser | null>(session?.user ?? null);
  userRef.current = session?.user ?? null;
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  const token = session?.token ?? null;
  const myId = session?.user.id ?? null;

  // --- Verbindung & Events ---------------------------------------------------
  useEffect(() => {
    if (!token || !myId) return;

    const join = () => {
      setConnection('connected');
      socket.timeout(ACK_TIMEOUT_MS).emit('join', {}, (err: Error | null, res?: JoinAck) => {
        if (err || !res?.ok) return;
        if (res.history) setMessages((prev) => mergeHistory(prev, res.history!, myId));
        if (res.online) setOnline(res.online);
      });
    };

    const onDisconnect = () => setConnection('disconnected');
    const onConnectError = (err: Error) => {
      setConnection('disconnected');
      if (err.message === 'unauthorized') onUnauthorizedRef.current?.();
    };
    const onReconnectAttempt = () => setConnection('connecting');

    const onMessage = (msg: ChatMessage) => setMessages((prev) => upsertMessage(prev, msg));

    const onPresence = ({ online }: PresenceEvent) => setOnline(online);

    const onUserUpdated = (user: ChatUser) => {
      setMessages((prev) =>
        prev.some((m) => m.senderId === user.id && m.sender !== user.name)
          ? prev.map((m) => (m.senderId === user.id ? { ...m, sender: user.name } : m))
          : prev,
      );
      setTyping((prev) => (prev[user.id] ? { ...prev, [user.id]: user.name } : prev));
    };

    const onTyping = ({ userId, name, isTyping }: TypingEvent) => {
      if (userId === myId) return;
      clearTimeout(remoteTypingTimers.current[userId]);
      if (isTyping) {
        setTyping((prev) => ({ ...prev, [userId]: name }));
        remoteTypingTimers.current[userId] = setTimeout(() => {
          setTyping(({ [userId]: _, ...rest }) => rest);
        }, REMOTE_TYPING_EXPIRE_MS);
      } else {
        setTyping(({ [userId]: _, ...rest }) => rest);
      }
    };

    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('message:new', onMessage);
    socket.on('presence', onPresence);
    socket.on('typing', onTyping);
    socket.on('user:updated', onUserUpdated);

    socket.auth = { token };
    setConnection('connecting');
    socket.connect();

    const timers = remoteTypingTimers.current;
    return () => {
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('message:new', onMessage);
      socket.off('presence', onPresence);
      socket.off('typing', onTyping);
      socket.off('user:updated', onUserUpdated);
      Object.values(timers).forEach(clearTimeout);
      if (ownTypingTimer.current) clearTimeout(ownTypingTimer.current);
      socket.disconnect();
      setConnection('disconnected');
      setTyping({});
      setOnline([]);
    };
  }, [token, myId]);

  // --- Senden ----------------------------------------------------------------
  const emitMessage = useCallback((clientId: string, text: string) => {
    socket
      .timeout(ACK_TIMEOUT_MS)
      .emit('message:send', { clientId, text }, (err: Error | null, res?: SendAck) => {
        if (err || !res?.ok || !res.message) {
          setMessages((prev) =>
            prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m)),
          );
          return;
        }
        setMessages((prev) => upsertMessage(prev, res.message!));
      });
  }, []);

  const stopTyping = useCallback(() => {
    if (ownTypingTimer.current) clearTimeout(ownTypingTimer.current);
    if (ownIsTyping.current) {
      ownIsTyping.current = false;
      socket.emit('typing', { isTyping: false });
    }
  }, []);

  const sendMessage = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, MAX_LENGTH);
      const me = userRef.current;
      if (!text || !me) return;
      stopTyping();
      const clientId = makeClientId();
      setMessages((prev) => [
        ...prev,
        {
          id: clientId,
          clientId,
          senderId: me.id,
          sender: me.name,
          text,
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
      ]);
      emitMessage(clientId, text);
    },
    [emitMessage, stopTyping],
  );

  const retryMessage = useCallback(
    (clientId: string) => {
      const msg = messages.find((m) => m.clientId === clientId);
      if (!msg) return;
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId ? { ...m, status: 'pending' } : m)),
      );
      emitMessage(clientId, msg.text);
    },
    [messages, emitMessage],
  );

  // --- Tippt gerade… ---------------------------------------------------------
  const notifyTyping = useCallback(() => {
    if (!socket.connected) return;
    if (!ownIsTyping.current) {
      ownIsTyping.current = true;
      socket.emit('typing', { isTyping: true });
    }
    if (ownTypingTimer.current) clearTimeout(ownTypingTimer.current);
    ownTypingTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [stopTyping]);

  return {
    messages,
    connection,
    online,
    typingUsers: Object.values(typing),
    sendMessage,
    retryMessage,
    notifyTyping,
    maxLength: MAX_LENGTH,
  };
}
