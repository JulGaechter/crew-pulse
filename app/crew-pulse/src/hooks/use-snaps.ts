import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConnectionState } from '@/hooks/use-socket-connection';
import { socket } from '@/services/api';
import { UnauthorizedError, type Session } from '@/services/session';
import { loadOverview, type SnapOverview } from '@/services/snaps';

type ScreenshotEvent = { snapId: string; kind: 'direct' | 'story'; by: { id: string; name: string } };

/**
 * Posteingang, gesendete Snaps und Storys. Lädt neu, wenn der Server etwas meldet.
 * onScreenshot: jemand hat einen Screenshot von einem meiner Snaps gemacht.
 */
export function useSnaps(
  session: Session,
  connection: ConnectionState,
  onUnauthorized: () => void,
  onScreenshot?: (ev: ScreenshotEvent) => void,
) {
  const [overview, setOverview] = useState<SnapOverview>({ received: [], sent: [], stories: [] });
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScreenshotRef = useRef(onScreenshot);
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onScreenshotRef.current = onScreenshot;
    onUnauthorizedRef.current = onUnauthorized;
  }, [onScreenshot, onUnauthorized]);

  const refresh = useCallback(async () => {
    try {
      setOverview(await loadOverview(session));
    } catch (e) {
      if (e instanceof UnauthorizedError) onUnauthorizedRef.current();
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Mehrere Ereignisse kurz hintereinander -> nur einmal laden
  const refreshSoon = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 250);
  }, [refresh]);

  useEffect(() => {
    if (connection === 'connected') refresh();
  }, [connection, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onShot = (ev: ScreenshotEvent) => {
      onScreenshotRef.current?.(ev);
      refreshSoon();
    };
    socket.on('snap:new', refreshSoon);
    socket.on('snap:opened', refreshSoon);
    socket.on('story:new', refreshSoon);
    socket.on('story:viewed', refreshSoon);
    socket.on('snap:screenshot', onShot);
    return () => {
      socket.off('snap:new', refreshSoon);
      socket.off('snap:opened', refreshSoon);
      socket.off('story:new', refreshSoon);
      socket.off('story:viewed', refreshSoon);
      socket.off('snap:screenshot', onShot);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [refreshSoon]);

  const unopenedCount = overview.received.filter((s) => !s.opened).length;
  const hasNewStories = overview.stories.some((g) => !g.isOwn && !g.allViewed);

  return { overview, loading, refresh, unopenedCount, hasNewStories };
}
