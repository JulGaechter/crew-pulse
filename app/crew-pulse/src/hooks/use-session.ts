import { createContext, useContext } from 'react';

import type { ConnectionState } from '@/hooks/use-socket-connection';
import type { Session } from '@/services/session';

/** Angemeldetes Konto – für alle Tabs (bereitgestellt von AuthGate im Root-Layout) */
export type SessionContextValue = {
  session: Session;
  /** Hinweis "Konto mit Apple/Google verbinden" anzeigen */
  showLinkHint: boolean;
  openAccount: () => void;
  /** Server lehnt den Token ab */
  onUnauthorized: () => void;
};

export const SessionContext = createContext<SessionContextValue | null>(null);
export const ConnectionContext = createContext<ConnectionState>('disconnected');

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession() wird ausserhalb von <AuthGate> verwendet');
  return value;
}

/** Zustand der Socket-Verbindung (eine Verbindung für die ganze App) */
export function useConnection(): ConnectionState {
  return useContext(ConnectionContext);
}
