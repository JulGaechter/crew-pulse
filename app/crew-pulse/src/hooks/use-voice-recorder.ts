import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PermissionDeniedError } from '@/services/media';

const MAX_DURATION_MS = 5 * 60 * 1000; // danach automatisch senden
const MIN_DURATION_MS = 500; // kürzere Aufnahmen verwerfen (versehentlich getippt)

/**
 * Sprachnachricht aufnehmen: start() -> send() oder cancel().
 * onRecorded bekommt die Datei und die Dauer, wenn gesendet wird.
 */
export function useVoiceRecorder(onRecorded: (uri: string, durationMs: number) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [recording, setRecording] = useState(false);
  const finishing = useRef(false);

  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const start = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) throw new PermissionDeniedError();
    // Während der Aufnahme muss iOS das Mikrofon freigeben
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    finishing.current = false;
    setRecording(true);
  }, [recorder]);

  const finish = useCallback(
    async (send: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      const durationMs = state.durationMillis;
      try {
        await recorder.stop();
      } finally {
        // Zurück auf Wiedergabe über den Lautsprecher (sonst spielt iOS leise über die Hörmuschel)
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
        setRecording(false);
      }
      const uri = recorder.uri;
      if (send && uri && durationMs >= MIN_DURATION_MS) onRecordedRef.current(uri, durationMs);
    },
    [recorder, state.durationMillis],
  );

  // Maximallänge erreicht -> automatisch senden
  useEffect(() => {
    if (recording && state.durationMillis >= MAX_DURATION_MS) finish(true);
  }, [recording, state.durationMillis, finish]);

  return {
    recording,
    durationMs: state.durationMillis,
    start,
    send: () => finish(true),
    cancel: () => finish(false),
  };
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
