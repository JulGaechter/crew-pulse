import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConnectionState } from '@/hooks/use-socket-connection';
import { socket } from '@/services/api';
import type { ChatMessage, ChatUser, CrewSummary } from '@/services/chat-types';
import { listCrews } from '@/services/crews';
import { UnauthorizedError, type Session } from '@/services/session';

function sortByActivity(crews: CrewSummary[]) {
  return [...crews].sort((a, b) =>
    (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''),
  );
}

/**
 * Liste der eigenen Crews. Lädt neu bei (Wieder-)Verbindung und wenn der Server
 * "crews:changed" meldet; neue Nachrichten aktualisieren Vorschau und Ungelesen-Zähler direkt.
 */
export function useCrews(
  session: Session,
  connection: ConnectionState,
  activeCrewId: string | null,
  onUnauthorized: () => void,
) {
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(activeCrewId);
  useEffect(() => {
    activeRef.current = activeCrewId;
  }, [activeCrewId]);
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const myId = session.user.id;

  const refresh = useCallback(async () => {
    try {
      const list = await listCrews(session);
      setCrews(sortByActivity(list));
      setError(null);
    } catch (e) {
      if (e instanceof UnauthorizedError) onUnauthorizedRef.current();
      else setError('Crews konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Beim Start und nach jeder Wiederverbindung neu laden (es könnte etwas verpasst worden sein)
  useEffect(() => {
    if (connection === 'connected') refresh();
  }, [connection, refresh]);

  useEffect(() => {
    // Erster Versuch auch ohne Socket (z. B. wenn die Verbindung noch aufgebaut wird)
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => refresh();

    const onMessage = (msg: ChatMessage) => {
      setCrews((prev) => {
        if (!prev.some((c) => c.id === msg.crewId)) return prev;
        const next = prev.map((c) => {
          if (c.id !== msg.crewId) return c;
          const fromOther = msg.senderId !== myId;
          const isOpen = activeRef.current === c.id;
          return {
            ...c,
            lastMessage: {
              text: msg.text,
              sender: msg.sender,
              id: msg.id,
              senderId: msg.senderId,
              hasImage: Boolean(msg.image),
              hasAudio: Boolean(msg.audio),
              createdAt: msg.createdAt,
            },
            unreadCount: fromOther && !isOpen ? c.unreadCount + 1 : c.unreadCount,
          };
        });
        return sortByActivity(next);
      });
    };

    const onUserUpdated = (user: ChatUser) => {
      setCrews((prev) =>
        prev.map((c) =>
          c.lastMessage?.senderId === user.id
            ? { ...c, lastMessage: { ...c.lastMessage, sender: user.name } }
            : c,
        ),
      );
    };

    // Letzte Nachricht wurde bearbeitet oder gelöscht -> Vorschau anpassen
    const onUpdated = (msg: ChatMessage) => {
      setCrews((prev) =>
        prev.map((c) =>
          c.id === msg.crewId && c.lastMessage?.id === msg.id
            ? {
                ...c,
                lastMessage: {
                  ...c.lastMessage,
                  text: msg.text,
                  hasImage: Boolean(msg.image),
                  hasAudio: Boolean(msg.audio),
                  deleted: Boolean(msg.deleted),
                },
              }
            : c,
        ),
      );
    };

    socket.on('crews:changed', onChanged);
    socket.on('message:new', onMessage);
    socket.on('message:updated', onUpdated);
    socket.on('user:updated', onUserUpdated);
    return () => {
      socket.off('crews:changed', onChanged);
      socket.off('message:new', onMessage);
      socket.off('message:updated', onUpdated);
      socket.off('user:updated', onUserUpdated);
    };
  }, [refresh, myId]);

  // Geöffnete Crew gilt als gelesen
  useEffect(() => {
    if (!activeCrewId) return;
    setCrews((prev) =>
      prev.some((c) => c.id === activeCrewId && c.unreadCount > 0)
        ? prev.map((c) => (c.id === activeCrewId ? { ...c, unreadCount: 0 } : c))
        : prev,
    );
  }, [activeCrewId, crews]);

  /** Nach Erstellen/Beitreten sofort anzeigen, ohne auf den Server zu warten */
  const addOrUpdate = useCallback((crew: CrewSummary) => {
    setCrews((prev) => sortByActivity([crew, ...prev.filter((c) => c.id !== crew.id)]));
  }, []);

  const remove = useCallback((crewId: string) => {
    setCrews((prev) => prev.filter((c) => c.id !== crewId));
  }, []);

  return { crews, loading, error, refresh, addOrUpdate, remove };
}
