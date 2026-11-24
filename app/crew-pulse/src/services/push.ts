import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { request, type Session } from '@/services/session';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** In Expo Go auf Android gibt es keine Push-Benachrichtigungen (ab SDK 53), im Browser auch nicht. */
export const pushSupported = Platform.OS !== 'web' && !(isExpoGo && Platform.OS === 'android');

export type PushRegistration =
  | { status: 'granted'; token: string }
  | { status: 'denied' | 'unsupported' | 'error' };

// Welche Crew ist gerade offen? Für die gibt es im Vordergrund kein Banner.
let openCrewId: string | null = null;
export function setOpenCrewForNotifications(crewId: string | null) {
  openCrewId = crewId;
}

if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const crewId = notification.request.content.data?.crewId;
      const isOpen = typeof crewId === 'string' && crewId === openCrewId;
      return {
        shouldPlaySound: !isOpen,
        shouldSetBadge: true,
        shouldShowBanner: !isOpen,
        shouldShowList: !isOpen,
      };
    },
  });
}

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Erlaubnis holen, Expo-Push-Token abrufen und beim Server registrieren. */
export async function registerForPush(session: Session): Promise<PushRegistration> {
  if (!pushSupported) return { status: 'unsupported' };
  try {
    if (Platform.OS === 'android') {
      // Muss zum channelId passen, den der Server mitschickt
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Nachrichten',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      }));
    }
    if (status !== 'granted') return { status: 'denied' };

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('Push: Keine EAS projectId gefunden – einmal "npx eas-cli@latest init" ausführen.');
      return { status: 'error' };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await request('/push-tokens', {
      method: 'POST',
      token: session.token,
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    return { status: 'granted', token };
  } catch (e) {
    console.warn('Push-Registrierung fehlgeschlagen:', e);
    return { status: 'error' };
  }
}

/** Zahl am App-Icon setzen (0 = entfernen). */
export async function setAppBadge(count: number) {
  if (!pushSupported) return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // nicht jeder Android-Launcher kann Badges
  }
}

/** Wurde eine Snap-Benachrichtigung angetippt? */
export function isSnapResponse(response: Notifications.NotificationResponse | null) {
  return response?.notification.request.content.data?.type === 'snap';
}

/** Crew-ID aus einer angetippten Benachrichtigung */
export function crewIdFromResponse(response: Notifications.NotificationResponse | null) {
  const crewId = response?.notification.request.content.data?.crewId;
  return typeof crewId === 'string' ? crewId : null;
}
