import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConnectionState } from '@/hooks/use-socket-connection';
import { socket } from '@/services/api';
import type {
  ChatMessage,
  ChatUser,
  JoinAck,
  PresenceEvent,
  Reaction,
  ReactionEvent,
  ReadEvent,
  ReadState,
  ReplyPreview,
  SendAck,
  TypingEvent,
} from '@/services/chat-types';
import {
  loadOlderMessages,
  prepareImage,
  uploadAudio,
  uploadImage,
  type PickedImage,
} from '@/services/media';
import type { Session } from '@/services/session';

const ACK_TIMEOUT_MS = 5000;
const TYPING_IDLE_MS = 2500;
const REMOTE_TYPING_EXPIRE_MS = 4000;
const MAX_LENGTH = 1000;

type PendingMedia =
  | { kind: 'image'; picked: PickedImage; uploadedId?: string }
  | { kind: 'audio'; uri: string; durationMs: number; uploadedId?: string };

/** Was für einen erneuten Sendeversuch gebraucht wird */
type PendingSend = { text: string; replyToId?: string; media?: PendingMedia };

function makeClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function byTime(a: ChatMessage, b: ChatMessage) {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** Server-Version übernehmen, aber lokale Dateien (eigenes Bild/eigene Aufnahme) behalten – kein Flackern */
function mergeServerVersion(prev: ChatMessage | undefined, msg: ChatMessage): ChatMessage {
  return {
    ...msg,
    status: 'sent',
    image: msg.image && prev?.image?.localUri ? { ...msg.image, localUri: prev.image.localUri } : msg.image,
    audio: msg.audio && prev?.audio?.localUri ? { ...msg.audio, localUri: prev.audio.localUri } : msg.audio,
  };
}

/** Fügt eine Nachricht ein oder ersetzt die passende (optimistische) Version. */
function upsertMessage(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  const idx = list.findIndex(
    (m) =>
      m.id === msg.id ||
      (msg.clientId && m.clientId === msg.clientId && (!msg.senderId || m.senderId === msg.senderId)),
  );
  if (idx === -1) return [...list, mergeServerVersion(undefined, msg)];
  const next = [...list];
  next[idx] = mergeServerVersion(list[idx], msg);
  return next;
}

/** Bearbeitet/gelöscht: Nachricht ersetzen und Zitate in Antworten nachziehen */
function applyUpdate(list: ChatMessage[], updated: ChatMessage): ChatMessage[] {
  return list.map((m) => {
    if (m.id === updated.id) return mergeServerVersion(m, updated);
    if (m.replyTo?.id === updated.id) {
      return {
        ...m,
        replyTo: {
          ...m.replyTo,
          text: updated.deleted ? '' : updated.text,
          hasImage: Boolean(updated.image),
          hasAudio: Boolean(updated.audio),
          deleted: Boolean(updated.deleted),
        },
      };
    }
    return m;
  });
}

/** Neuer Verlauf vom Server + bereits geladene ältere + noch offene lokale Nachrichten */
function mergeHistory(prev: ChatMessage[], history: ChatMessage[], myId: string): ChatMessage[] {
  let merged = prev.filter((m) => m.status === 'sent' || !m.status);
  for (const msg of history) merged = upsertMessage(merged, msg);
  const known = new Set(merged.filter((m) => m.senderId === myId && m.clientId).map((m) => m.clientId));
  const stillOpen = prev.filter(
    (m) => (m.status === 'pending' || m.status === 'failed') && !known.has(m.clientId),
  );
  return [...merged.sort(byTime), ...stillOpen];
}

/** Eigene Reaktion lokal umschalten (bevor der Server antwortet) */
function toggleLocal(reactions: Reaction[] = [], emoji: string, myId: string): Reaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (!existing) return [...reactions, { emoji, userIds: [myId] }];
  const userIds = existing.userIds.includes(myId)
    ? existing.userIds.filter((id) => id !== myId)
    : [...existing.userIds, myId];
  return userIds.length
    ? reactions.map((r) => (r.emoji === emoji ? { ...r, userIds } : r))
    : reactions.filter((r) => r.emoji !== emoji);
}

function toReplyPreview(m: ChatMessage): ReplyPreview {
  return {
    id: m.id,
    senderId: m.senderId,
    sender: m.sender,
    text: m.text,
    hasImage: Boolean(m.image),
    hasAudio: Boolean(m.audio),
    deleted: Boolean(m.deleted),
  };
}

/** Chat einer Crew. Die Socket-Verbindung selbst kommt von useSocketConnection. */
export function useChat(crewId: string, session: Session, connection: ConnectionState) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [online, setOnline] = useState<ChatUser[]>([]);
  const [readStates, setReadStates] = useState<ReadState[]>([]);
  // userId -> Name derjenigen, die gerade tippen
  const [typing, setTyping] = useState<Record<string, string>>({});

  const remoteTypingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const ownTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownIsTyping = useRef(false);
  const loadedRef = useRef(false);
  // Noch nicht bestätigte Nachrichten: clientId -> alles für einen neuen Versuch
  const pendingSends = useRef<Record<string, PendingSend>>({});

  const myId = session.user.id;
  const myName = session.user.name;

  // --- Beitreten (bei jeder (Wieder-)Verbindung) -----------------------------
  useEffect(() => {
    if (connection !== 'connected') return;
    socket.timeout(ACK_TIMEOUT_MS).emit('join', { crewId }, (err: Error | null, res?: JoinAck) => {
      if (err || !res?.ok) return;
      if (res.history) setMessages((prev) => mergeHistory(prev, res.history!, myId));
      if (res.online) setOnline(res.online);
      if (res.readStates) setReadStates(res.readStates);
      // Beim ersten Laden entscheidet der Server, ob es ältere gibt; danach bleibt der Stand
      if (!loadedRef.current) setHasMore(Boolean(res.hasMore));
      loadedRef.current = true;
      setLoaded(true);
    });
  }, [connection, crewId, myId]);

  // --- Events dieser Crew ----------------------------------------------------
  useEffect(() => {
    const onMessage = (msg: ChatMessage) => {
      if (msg.crewId !== crewId) return;
      setMessages((prev) => upsertMessage(prev, msg));
      // Chat ist offen -> gleich als gelesen markieren
      if (msg.senderId !== myId) socket.emit('crew:read', { crewId });
    };

    const onUpdated = (msg: ChatMessage) => {
      if (msg.crewId === crewId) setMessages((prev) => applyUpdate(prev, msg));
    };

    const onRead = (ev: ReadEvent) => {
      if (ev.crewId !== crewId) return;
      setReadStates((prev) =>
        prev.some((r) => r.userId === ev.userId)
          ? prev.map((r) => (r.userId === ev.userId ? { ...r, lastReadAt: ev.lastReadAt } : r))
          : [...prev, { userId: ev.userId, name: '', lastReadAt: ev.lastReadAt }],
      );
    };

    const onReaction = (ev: ReactionEvent) => {
      if (ev.crewId !== crewId) return;
      setMessages((prev) => prev.map((m) => (m.id === ev.messageId ? { ...m, reactions: ev.reactions } : m)));
    };

    const onPresence = (ev: PresenceEvent) => {
      if (ev.crewId === crewId) setOnline(ev.online);
    };

    const onUserUpdated = (user: ChatUser) => {
      setMessages((prev) =>
        prev.map((m) => {
          const senderChanged = m.senderId === user.id && m.sender !== user.name;
          const quoteChanged = m.replyTo?.senderId === user.id && m.replyTo.sender !== user.name;
          if (!senderChanged && !quoteChanged) return m;
          return {
            ...m,
            sender: senderChanged ? user.name : m.sender,
            replyTo: quoteChanged && m.replyTo ? { ...m.replyTo, sender: user.name } : m.replyTo,
          };
        }),
      );
      setOnline((prev) => prev.map((u) => (u.id === user.id ? { ...u, name: user.name } : u)));
      setReadStates((prev) => prev.map((r) => (r.userId === user.id ? { ...r, name: user.name } : r)));
      setTyping((prev) => (prev[user.id] ? { ...prev, [user.id]: user.name } : prev));
    };

    const onTyping = ({ crewId: ev, userId, name, isTyping }: TypingEvent) => {
      if (ev !== crewId || userId === myId) return;
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

    socket.on('message:new', onMessage);
    socket.on('message:updated', onUpdated);
    socket.on('read:updated', onRead);
    socket.on('reaction:updated', onReaction);
    socket.on('presence', onPresence);
    socket.on('typing', onTyping);
    socket.on('user:updated', onUserUpdated);

    const timers = remoteTypingTimers.current;
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:updated', onUpdated);
      socket.off('read:updated', onRead);
      socket.off('reaction:updated', onReaction);
      socket.off('presence', onPresence);
      socket.off('typing', onTyping);
      socket.off('user:updated', onUserUpdated);
      Object.values(timers).forEach(clearTimeout);
      if (ownTypingTimer.current) clearTimeout(ownTypingTimer.current);
      if (ownIsTyping.current) {
        ownIsTyping.current = false;
        socket.emit('typing', { crewId, isTyping: false });
      }
    };
  }, [crewId, myId]);

  // --- Ältere Nachrichten ----------------------------------------------------
  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder) return;
    const oldest = messages.find((m) => m.status === 'sent' || !m.status);
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = await loadOlderMessages(session, crewId, oldest.id);
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const older = page.messages.filter((m) => !known.has(m.id)).map((m) => ({ ...m, status: 'sent' as const }));
        return [...older, ...prev];
      });
      setHasMore(page.hasMore);
    } catch {
      // nächster Versuch beim nächsten Hochscrollen
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, messages, session, crewId]);

  // --- Senden ----------------------------------------------------------------
  const markFailed = useCallback((clientId: string) => {
    setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m)));
  }, []);

  /** Medien hochladen (falls nötig) und Nachricht an den Server schicken */
  const deliver = useCallback(
    async (clientId: string) => {
      const pending = pendingSends.current[clientId];
      if (!pending) return;
      const { text, replyToId, media } = pending;
      try {
        let imageId: string | undefined;
        let audioId: string | undefined;
        if (media && !media.uploadedId) {
          if (media.kind === 'image') {
            const uploaded = await uploadImage(session, crewId, await prepareImage(media.picked));
            media.uploadedId = uploaded.id;
          } else {
            const uploaded = await uploadAudio(session, crewId, media.uri, media.durationMs);
            media.uploadedId = uploaded.id;
          }
        }
        if (media?.kind === 'image') imageId = media.uploadedId;
        if (media?.kind === 'audio') audioId = media.uploadedId;

        socket
          .timeout(ACK_TIMEOUT_MS)
          .emit(
            'message:send',
            { crewId, clientId, text, imageId, audioId, replyToId },
            (err: Error | null, res?: SendAck) => {
              if (err || !res?.ok || !res.message) return markFailed(clientId);
              delete pendingSends.current[clientId];
              setMessages((prev) => upsertMessage(prev, res.message!));
            },
          );
      } catch {
        markFailed(clientId);
      }
    },
    [session, crewId, markFailed],
  );

  const stopTyping = useCallback(() => {
    if (ownTypingTimer.current) clearTimeout(ownTypingTimer.current);
    if (ownIsTyping.current) {
      ownIsTyping.current = false;
      socket.emit('typing', { crewId, isTyping: false });
    }
  }, [crewId]);

  /** Optimistische Nachricht anzeigen und senden */
  const queue = useCallback(
    (fields: Pick<ChatMessage, 'text' | 'image' | 'audio'>, replyTo?: ChatMessage, media?: PendingMedia) => {
      const clientId = makeClientId();
      pendingSends.current[clientId] = { text: fields.text, replyToId: replyTo?.id, media };
      setMessages((prev) => [
        ...prev,
        {
          id: clientId,
          clientId,
          crewId,
          senderId: myId,
          sender: myName,
          ...fields,
          replyTo: replyTo ? toReplyPreview(replyTo) : undefined,
          reactions: [],
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
      ]);
      deliver(clientId);
    },
    [crewId, myId, myName, deliver],
  );

  const sendMessage = useCallback(
    (raw: string, replyTo?: ChatMessage) => {
      const text = raw.trim().slice(0, MAX_LENGTH);
      if (!text) return;
      stopTyping();
      queue({ text }, replyTo);
    },
    [queue, stopTyping],
  );

  const sendImage = useCallback(
    (picked: PickedImage, caption = '', replyTo?: ChatMessage) => {
      const text = caption.trim().slice(0, MAX_LENGTH);
      queue(
        { text, image: { id: '', width: picked.width, height: picked.height, localUri: picked.uri } },
        replyTo,
        { kind: 'image', picked },
      );
    },
    [queue],
  );

  const sendVoice = useCallback(
    (uri: string, durationMs: number, replyTo?: ChatMessage) => {
      queue({ text: '', audio: { id: '', durationMs, localUri: uri } }, replyTo, { kind: 'audio', uri, durationMs });
    },
    [queue],
  );

  const retryMessage = useCallback(
    (clientId: string) => {
      if (!pendingSends.current[clientId]) return;
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'pending' } : m)));
      deliver(clientId);
    },
    [deliver],
  );

  // --- Bearbeiten & Löschen (nur eigene) ------------------------------------
  /** Lokal sofort ändern; bei Fehler zurück auf den alten Stand. -> true, wenn der Server zugestimmt hat */
  const changeMessage = useCallback(
    (event: 'message:edit' | 'message:delete', messageId: string, optimistic: Partial<ChatMessage>, payload: object) =>
      new Promise<boolean>((resolve) => {
        const before = messages.find((m) => m.id === messageId);
        if (!before) return resolve(false);
        setMessages((prev) => applyUpdate(prev, { ...before, ...optimistic }));
        socket
          .timeout(ACK_TIMEOUT_MS)
          .emit(event, { messageId, ...payload }, (err: Error | null, res?: SendAck) => {
            if (!err && res?.ok && res.message) {
              setMessages((prev) => applyUpdate(prev, res.message!));
              resolve(true);
            } else {
              setMessages((prev) => applyUpdate(prev, before));
              resolve(false);
            }
          });
      }),
    [messages],
  );

  const editMessage = useCallback(
    (messageId: string, raw: string) => {
      const text = raw.trim().slice(0, MAX_LENGTH);
      return changeMessage('message:edit', messageId, { text, edited: true }, { text });
    },
    [changeMessage],
  );

  const deleteMessage = useCallback(
    (messageId: string) =>
      changeMessage(
        'message:delete',
        messageId,
        { deleted: true, text: '', image: undefined, audio: undefined, reactions: [] },
        {},
      ),
    [changeMessage],
  );

  // --- Reaktionen ------------------------------------------------------------
  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      const before = messages.find((m) => m.id === messageId)?.reactions;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: toggleLocal(m.reactions, emoji, myId) } : m)),
      );
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit(
          'reaction:toggle',
          { messageId, emoji },
          (err: Error | null, res?: { ok: boolean; reactions?: Reaction[] }) => {
            // Bei Fehler zurücksetzen, sonst Stand vom Server übernehmen
            const reactions = !err && res?.ok ? res.reactions : before;
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
          },
        );
    },
    [messages, myId],
  );

  // --- Tippt gerade… ---------------------------------------------------------
  const notifyTyping = useCallback(() => {
    if (!socket.connected) return;
    if (!ownIsTyping.current) {
      ownIsTyping.current = true;
      socket.emit('typing', { crewId, isTyping: true });
    }
    if (ownTypingTimer.current) clearTimeout(ownTypingTimer.current);
    ownTypingTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [crewId, stopTyping]);

  return {
    messages,
    loaded,
    hasMore,
    loadingOlder,
    loadOlder,
    online,
    readStates,
    typingUsers: Object.values(typing),
    sendMessage,
    sendImage,
    sendVoice,
    retryMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    notifyTyping,
    maxLength: MAX_LENGTH,
  };
}
