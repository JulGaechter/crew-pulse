import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { ConnectionState } from '@/hooks/use-socket-connection';
import { socket } from '@/services/api';
import type { CrewSummary } from '@/services/chat-types';
import {
  crewIdFromResponse,
  isSnapResponse,
  pushSupported,
  registerForPush,
  setAppBadge,
  setOpenCrewForNotifications,
} from '@/services/push';
import type { Session } from '@/services/session';

type Options = {
  session: Session;
  connection: ConnectionState;
  /** Crew, deren Chat gerade offen ist */
  openCrewId: string | null;
  crews: CrewSummary[];
  /** Benachrichtigung angetippt -> diese Crew öffnen */
  onOpenCrew: (crewId: string) => void;
};

export function usePushNotifications({ session, connection, openCrewId, crews, onOpenCrew }: Options) {
  const onOpenCrewRef = useRef(onOpenCrew);
  useEffect(() => {
    onOpenCrewRef.current = onOpenCrew;
  }, [onOpenCrew]);

  // 1. Gerät registrieren (einmal pro Anmeldung)
  const token = session.token;
  useEffect(() => {
    registerForPush(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 2. Dem Server sagen, welche Crew offen ist – im Hintergrund keine.
  //    Für die offene Crew schickt der Server dann keinen Push.
  useEffect(() => {
    // currentState kann beim Start noch leer sein -> dann als aktiv behandeln
    const report = (state: string | null | undefined) => {
      const crewId = !state || state === 'active' ? openCrewId : null;
      setOpenCrewForNotifications(crewId);
      if (socket.connected) socket.emit('view', { crewId });
    };
    report(AppState.currentState);
    const sub = AppState.addEventListener('change', report);
    return () => sub.remove();
  }, [openCrewId, connection]);

  // 3. Zahl am App-Icon = ungelesene Nachrichten in nicht stummen Crews
  useEffect(() => {
    const total = crews.filter((c) => !c.muted).reduce((sum, c) => sum + c.unreadCount, 0);
    setAppBadge(total);
  }, [crews]);

  // 4. Benachrichtigung angetippt -> Crew öffnen (auch wenn die App dadurch erst startet)
  useEffect(() => {
    if (!pushSupported) return;
    let active = true;
    // Snap -> Snap-Tab öffnen, Chat-Nachricht -> Crew öffnen
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (isSnapResponse(response)) {
        router.navigate('/snaps');
        return true;
      }
      const crewId = crewIdFromResponse(response);
      if (crewId) {
        onOpenCrewRef.current(crewId);
        return true;
      }
      return false;
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active && handle(response)) Notifications.clearLastNotificationResponseAsync().catch(() => {});
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handle(response);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
}
