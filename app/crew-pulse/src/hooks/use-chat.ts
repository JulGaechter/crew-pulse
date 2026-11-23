import { useCallback, useEffect, useRef, useState } from 'react';

import { socket } from '@/services/api';
import type {
  ChatMessage,
  JoinAck,
  PresenceEvent,
  SendAck,
  TypingEvent,
} from '@/services/chat-types';

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
    ? list.findIndex((m) => m.clientId && m.clientId === msg.clientId)
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
function mergeHistory(prev: ChatMessage[], history: ChatMessage[]): ChatMessage[] {
  const fromServer = history.map((m) => ({ ...m, status: 'sent' as const }));
  const known = new Set(history.map((h) => h.clientId).filter(Boolean));
  const stillOpen = prev.filter(
    (m) => (m.status === 'pending' || m.status === 'failed') && !known.has(m.clientId),
  );
  return [...fromServer, ...stillOpen];
}

export function useChat(name: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('disconnected');
  const [online, setOnline] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const remoteTypingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const ownTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownIsTyping = useRef(false);

  // --- Verbindung & Events ---------------------------------------------------
  useEffect(() => {
    if (!name) return;

    const join = () => {
      setConnection('connected');
      socket.timeout(ACK_TIMEOUT_MS).emit('join', { name }, (err: Error | null, res?: JoinAck) => {
        if (err || !res?.ok) return;
        if (res.history) setMessages((prev) => mergeHistory(prev, res.history!));
        if (res.online) setOnline(res.online);
      });
    };

    const onDisconnect = () => setConnection('disconnected');
    const onConnectError = () => setConnection('disconnected');
    const onReconnectAttempt = () => setConnection('connecting');

    const onMessage = (msg: ChatMessage) => setMessages((prev) => upsertMessage(prev, msg));

    const onPresence = ({ online }: PresenceEvent) => setOnline(online);

    const onTyping = ({ name: who, isTyping }: TypingEvent) => {
      if (who === name) return;
      clearTimeout(remoteTypingTimers.current[who]);
      if (isTyping) {
        setTypingUsers((prev) => (prev.includes(who) ? prev : [...prev, who]));
        remoteTypingTimers.current[who] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== who));
        }, REMOTE_TYPING_EXPIRE_MS);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u !== who));
      }
    };

    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('message:new', onMessage);
    socket.on('presence', onPresence);
    socket.on('typing', onTyping);

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
      Object.values(timers).forEach(clearTimeout);
      if (ownTypingTimer.current) clearTimeout(ownTypingTimer.current);
      socket.disconnect();
      setConnection('disconnected');
      setTypingUsers([]);
      setOnline([]);
    };
  }, [name]);

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
      if (!text || !name) return;
      stopTyping();
      const clientId = makeClientId();
      setMessages((prev) => [
        ...prev,
        {
          id: clientId,
          clientId,
          sender: name,
          text,
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
      ]);
      emitMessage(clientId, text);
    },
    [name, emitMessage, stopTyping],
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
    typingUsers,
    sendMessage,
    retryMessage,
    notifyTyping,
    maxLength: MAX_LENGTH,
  };
}
