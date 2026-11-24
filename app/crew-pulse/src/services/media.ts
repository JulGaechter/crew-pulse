import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { API_URL } from '@/services/api';
import type { ChatMessage, MessageAudio, MessageImage } from '@/services/chat-types';
import { request, type Session } from '@/services/session';

const MAX_SIDE = 1600; // längste Seite nach dem Verkleinern
const JPEG_QUALITY = 0.7;

export type PickedImage = { uri: string; width: number; height: number };
export type PreparedImage = PickedImage & { base64: string };

export class PermissionDeniedError extends Error {
  constructor() {
    super('permission_denied');
  }
}

/** Foto aus der Mediathek wählen oder mit der Kamera aufnehmen. null = abgebrochen. */
export async function pickImage(source: 'library' | 'camera'): Promise<PickedImage | null> {
  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new PermissionDeniedError();
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
}

/** Auf max. 1600 px verkleinern und als JPEG (mit Base64 für den Upload) speichern. */
export async function prepareImage(picked: PickedImage): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(picked.uri);
  if (picked.width >= picked.height && picked.width > MAX_SIDE) context.resize({ width: MAX_SIDE });
  else if (picked.height > picked.width && picked.height > MAX_SIDE) context.resize({ height: MAX_SIDE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!result.base64) throw new Error('Bild konnte nicht verarbeitet werden');
  return { uri: result.uri, width: result.width, height: result.height, base64: result.base64 };
}

export async function uploadImage(
  session: Session,
  crewId: string,
  image: PreparedImage,
): Promise<{ id: string; width: number; height: number }> {
  const data = await request<{ image: { id: string; width: number; height: number } }>(
    `/crews/${crewId}/images`,
    {
      method: 'POST',
      token: session.token,
      body: JSON.stringify({ data: image.base64, width: image.width, height: image.height }),
    },
  );
  return data.image;
}

/** Quelle für <Image>: eigenes Bild lokal, sonst vom Server (mit Anmeldung) */
export function imageSource(image: MessageImage, token: string) {
  if (image.localUri) return { uri: image.localUri };
  return { uri: `${API_URL}/media/${image.id}`, headers: { Authorization: `Bearer ${token}` } };
}

export async function loadOlderMessages(
  session: Session,
  crewId: string,
  beforeId: string,
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  return request(`/crews/${crewId}/messages?before=${encodeURIComponent(beforeId)}`, {
    token: session.token,
  });
}

/** Aufnahme (m4a) hochladen */
export async function uploadAudio(
  session: Session,
  crewId: string,
  uri: string,
  durationMs: number,
): Promise<{ id: string; durationMs: number }> {
  const data = await new File(uri).base64();
  const res = await request<{ audio: { id: string; durationMs: number } }>(`/crews/${crewId}/audio`, {
    method: 'POST',
    token: session.token,
    body: JSON.stringify({ data, durationMs: Math.round(durationMs) }),
  });
  return res.audio;
}

/** Quelle für den Audio-Player: eigene Aufnahme lokal, sonst vom Server (mit Anmeldung) */
export function audioSource(audio: MessageAudio, token: string) {
  if (audio.localUri) return { uri: audio.localUri };
  return { uri: `${API_URL}/audio/${audio.id}`, headers: { Authorization: `Bearer ${token}` } };
}
