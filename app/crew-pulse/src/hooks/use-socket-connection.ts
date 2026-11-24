import { useEffect, useRef, useState } from 'react';

import { socket } from '@/services/api';
import type { Session } from '@/services/session';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/**
 * Hält die Socket-Verbindung offen, solange jemand angemeldet ist.
 * Die Chats der einzelnen Crews hängen sich nur an diese Verbindung an.
 */
export function useSocketConnection(session: Session | null, onUnauthorized?: () => void) {
  const [connection, setConnection] = useState<ConnectionState>(
    socket.connected ? 'connected' : 'disconnected',
  );
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const token = session?.token ?? null;

  useEffect(() => {
    if (!token) return;

    const onConnect = () => setConnection('connected');
    const onDisconnect = () => setConnection('disconnected');
    const onConnectError = (err: Error) => {
      setConnection('disconnected');
      if (err.message === 'unauthorized') onUnauthorizedRef.current?.();
    };
    const onReconnectAttempt = () => setConnection('connecting');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    socket.auth = { token };
    setConnection('connecting');
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.disconnect();
      setConnection('disconnected');
    };
  }, [token]);

  return connection;
}
