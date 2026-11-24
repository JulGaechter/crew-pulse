import { prepareImage, type PickedImage } from '@/services/media';
import { request, type Session } from '@/services/session';

/**
 * Snaps & Storys
 *
 * REST
 *   POST   /snaps/photos         { data: base64, width, height }  -> { photo }
 *   POST   /snaps                { photoId, width, height, overlay, durationSec, crewIds, userIds, toStory }
 *   GET    /snaps                -> { received, sent, stories }
 *   GET    /snaps/contacts       -> { people }
 *   POST   /snaps/:id/open       -> { snap }   (Foto; Direkt-Snap nur einmal)
 *   POST   /snaps/:id/viewed     -> 204        (danach ist ein Direkt-Snap weg)
 *   POST   /snaps/:id/screenshot -> 204        (Absender wird benachrichtigt)
 *   GET    /snaps/:id/viewers    -> { viewers } (eigene Story)
 *   DELETE /snaps/:id            -> 204        (eigene Story)
 *
 * Socket.io (Server -> App): "snap:new", "snap:opened", "snap:screenshot", "story:new", "story:viewed"
 */

/** Zeichnung + Text, Koordinaten im Pixelraum des Fotos (w × h) */
export type SnapOverlay = {
  v: 1;
  w: number;
  h: number;
  paths: { d: string; c: string; s: number }[];
  caption?: { text: string; y: number } | null;
};

export type ReceivedSnap = {
  id: string;
  from: { id: string; name: string };
  createdAt: string;
  durationSec: number | null;
  opened: boolean;
  screenshot: boolean;
};

export type SentSnap = {
  id: string;
  createdAt: string;
  durationSec: number | null;
  total: number;
  opened: number;
  screenshots: number;
  names: string[];
  /** gleiche Reihenfolge wie names */
  recipientIds?: string[];
};

export type StorySnapInfo = {
  id: string;
  createdAt: string;
  durationSec: number | null;
  viewed: boolean;
  viewCount?: number;
  screenshotCount?: number;
};

export type StoryGroup = {
  user: { id: string; name: string };
  snaps: StorySnapInfo[];
  isOwn: boolean;
  allViewed: boolean;
  latestAt: string;
};

export type SnapOverview = { received: ReceivedSnap[]; sent: SentSnap[]; stories: StoryGroup[] };

export type OpenedSnap = {
  id: string;
  kind: 'direct' | 'story';
  from: { id: string; name: string };
  createdAt: string;
  durationSec: number | null;
  overlay: SnapOverlay | null;
  photo: { width: number; height: number; dataUri: string };
};

export type SnapContact = { id: string; name: string; crews: string[] };
export type StoryViewer = { id: string; name: string; viewedAt: string; screenshot: boolean };

export async function loadOverview(session: Session): Promise<SnapOverview> {
  return request('/snaps', { token: session.token });
}

export async function loadContacts(session: Session): Promise<SnapContact[]> {
  const data = await request<{ people: SnapContact[] }>('/snaps/contacts', { token: session.token });
  return data.people;
}

export type SendSnapInput = {
  photo: PickedImage;
  overlay: SnapOverlay | null;
  durationSec: number | null;
  crewIds: string[];
  userIds: string[];
  toStory: boolean;
};

/** Foto verkleinern, hochladen und an alle Empfänger/die Story schicken */
export async function sendSnap(session: Session, input: SendSnapInput) {
  const prepared = await prepareImage(input.photo);
  const { photo } = await request<{ photo: { id: string; width: number; height: number } }>('/snaps/photos', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({ data: prepared.base64, width: prepared.width, height: prepared.height }),
  });
  // Zeichnung wurde auf das Original gezeichnet -> auf die verkleinerte Grösse umrechnen
  const overlay = input.overlay ? scaleOverlay(input.overlay, prepared.width, prepared.height) : null;
  return request<{ directId: string | null; recipients: number; storyId: string | null }>('/snaps', {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({
      photoId: photo.id,
      width: prepared.width,
      height: prepared.height,
      overlay,
      durationSec: input.durationSec,
      crewIds: input.crewIds,
      userIds: input.userIds,
      toStory: input.toStory,
    }),
  });
}

/** Overlay auf eine andere Bildgrösse umrechnen (gleiches Seitenverhältnis) */
function scaleOverlay(o: SnapOverlay, w: number, h: number): SnapOverlay {
  const k = w / o.w;
  if (Math.abs(k - 1) < 0.001) return o;
  const scalePath = (d: string) => d.replace(/-?\d+(\.\d+)?/g, (n) => (Math.round(Number(n) * k * 10) / 10).toString());
  return {
    v: 1,
    w,
    h,
    paths: o.paths.map((p) => ({ d: scalePath(p.d), c: p.c, s: Math.round(p.s * k * 10) / 10 })),
    caption: o.caption ? { text: o.caption.text, y: Math.round(o.caption.y * k) } : null,
  };
}

export async function openSnap(session: Session, snapId: string): Promise<OpenedSnap> {
  const data = await request<{ snap: OpenedSnap }>(`/snaps/${snapId}/open`, { method: 'POST', token: session.token });
  return data.snap;
}

export async function markViewed(session: Session, snapId: string) {
  await request(`/snaps/${snapId}/viewed`, { method: 'POST', token: session.token }).catch(() => {});
}

export async function reportScreenshot(session: Session, snapId: string) {
  await request(`/snaps/${snapId}/screenshot`, { method: 'POST', token: session.token }).catch(() => {});
}

export async function loadStoryViewers(session: Session, snapId: string): Promise<StoryViewer[]> {
  const data = await request<{ viewers: StoryViewer[] }>(`/snaps/${snapId}/viewers`, { token: session.token });
  return data.viewers;
}

export async function deleteStory(session: Session, snapId: string) {
  await request(`/snaps/${snapId}`, { method: 'DELETE', token: session.token });
}

/** "vor 5 Min." usw. */
export function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return `vor ${Math.floor(diff / 86400)} T.`;
}
