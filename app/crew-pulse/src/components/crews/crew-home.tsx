import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

import { ChatRoom } from '@/components/chat/chat-room';
import { CrewForm } from '@/components/crews/crew-form';
import { CrewInfo } from '@/components/crews/crew-info';
import { CrewList } from '@/components/crews/crew-list';
import { useCrews } from '@/hooks/use-crews';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useSocketConnection } from '@/hooks/use-socket-connection';
import { ApiError, UnauthorizedError, type Session } from '@/services/session';
import { createCrew, joinCrew, renameCrew } from '@/services/crews';
import type { CrewSummary } from '@/services/chat-types';

type View =
  | { name: 'list' }
  | { name: 'chat'; crewId: string }
  | { name: 'info'; crewId: string }
  | { name: 'create' }
  | { name: 'join' }
  | { name: 'rename'; crewId: string; current: string };

type Props = {
  session: Session;
  showLinkHint: boolean;
  onOpenAccount: () => void;
  onUnauthorized: () => void;
};

function formError(e: unknown, mode: 'create' | 'join' | 'rename') {
  if (e instanceof ApiError) {
    if (mode === 'join' && e.code === 'invalid_code') return 'Diesen Code gibt es nicht. Bitte prüfen.';
    if (e.code === 'too_many_attempts') return 'Zu viele falsche Codes. Versuch es in ein paar Minuten nochmals.';
    if (e.code === 'invalid_name') return 'Der Name muss 2–40 Zeichen lang sein.';
  }
  return 'Keine Verbindung zum Server. Bitte nochmals versuchen.';
}

export function CrewHome({ session, showLinkHint, onOpenAccount, onUnauthorized }: Props) {
  const connection = useSocketConnection(session, onUnauthorized);
  const [view, setView] = useState<View>({ name: 'list' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCrewId = view.name === 'chat' ? view.crewId : null;
  const { crews, loading, error: listError, refresh, addOrUpdate, remove } = useCrews(
    session,
    connection,
    activeCrewId,
    onUnauthorized,
  );

  const go = useCallback((next: View) => {
    setError(null);
    setBusy(false);
    setView(next);
  }, []);

  // Benachrichtigung angetippt: Crew öffnen. Ist sie noch nicht in der Liste
  // (gerade erst beigetreten, Liste lädt noch), zuerst neu laden.
  const [pendingCrewId, setPendingCrewId] = useState<string | null>(null);
  const openFromNotification = useCallback(
    (crewId: string) => {
      if (crews.some((c) => c.id === crewId)) {
        go({ name: 'chat', crewId });
      } else {
        setPendingCrewId(crewId);
        refresh();
      }
    },
    [crews, go, refresh],
  );
  useEffect(() => {
    if (pendingCrewId && crews.some((c) => c.id === pendingCrewId)) {
      go({ name: 'chat', crewId: pendingCrewId });
      setPendingCrewId(null);
    }
  }, [pendingCrewId, crews, go]);

  usePushNotifications({
    session,
    connection,
    openCrewId: activeCrewId,
    crews,
    onOpenCrew: openFromNotification,
  });

  // Android: Zurück-Taste führt eine Ebene zurück statt die App zu schliessen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view.name === 'list') return false;
      if (view.name === 'info') go({ name: 'chat', crewId: view.crewId });
      else if (view.name === 'rename') go({ name: 'info', crewId: view.crewId });
      else go({ name: 'list' });
      return true;
    });
    return () => sub.remove();
  }, [view, go]);

  // Crew wurde (z. B. auf einem anderen Gerät) verlassen -> zurück zur Liste
  const viewCrewId = 'crewId' in view ? view.crewId : null;
  const viewCrewMissing = !loading && viewCrewId !== null && !crews.some((c) => c.id === viewCrewId);
  useEffect(() => {
    if (viewCrewMissing) go({ name: 'list' });
  }, [viewCrewMissing, go]);

  const submitForm = async (mode: 'create' | 'join' | 'rename', value: string) => {
    setBusy(true);
    setError(null);
    try {
      let crew: CrewSummary;
      if (mode === 'create') crew = await createCrew(session, value);
      else if (mode === 'join') crew = (await joinCrew(session, value)).crew;
      else {
        if (view.name !== 'rename') return;
        crew = await renameCrew(session, view.crewId, value);
      }
      addOrUpdate(crew);
      go(mode === 'rename' ? { name: 'info', crewId: crew.id } : { name: 'chat', crewId: crew.id });
    } catch (e) {
      if (e instanceof UnauthorizedError) return onUnauthorized();
      setError(formError(e, mode));
      setBusy(false);
    }
  };

  switch (view.name) {
    case 'create':
    case 'join':
      return (
        <CrewForm
          key={view.name}
          mode={view.name}
          busy={busy}
          error={error}
          onSubmit={(v) => submitForm(view.name as 'create' | 'join', v)}
          onCancel={() => go({ name: 'list' })}
        />
      );

    case 'rename':
      return (
        <CrewForm
          mode="rename"
          initialValue={view.current}
          busy={busy}
          error={error}
          onSubmit={(v) => submitForm('rename', v)}
          onCancel={() => go({ name: 'info', crewId: view.crewId })}
        />
      );

    case 'info':
      return (
        <CrewInfo
          crewId={view.crewId}
          session={session}
          onBack={() => go({ name: 'chat', crewId: view.crewId })}
          onRename={(crew) => go({ name: 'rename', crewId: crew.id, current: crew.name })}
          onLeft={(crewId) => {
            remove(crewId);
            go({ name: 'list' });
          }}
          onCrewUpdated={addOrUpdate}
          onUnauthorized={onUnauthorized}
        />
      );

    case 'chat': {
      const crew = crews.find((c) => c.id === view.crewId);
      if (!crew) return null; // wird oben zurück zur Liste geschickt
      return (
        <ChatRoom
          key={crew.id}
          crew={crew}
          session={session}
          connection={connection}
          onBack={() => go({ name: 'list' })}
          onOpenInfo={() => go({ name: 'info', crewId: crew.id })}
        />
      );
    }

    default:
      return (
        <CrewList
          crews={crews}
          loading={loading}
          error={listError}
          connection={connection}
          myId={session.user.id}
          myName={session.user.name}
          showLinkHint={showLinkHint}
          onRefresh={refresh}
          onOpenCrew={(crewId) => go({ name: 'chat', crewId })}
          onCreate={() => go({ name: 'create' })}
          onJoin={() => go({ name: 'join' })}
          onOpenAccount={onOpenAccount}
        />
      );
  }
}
