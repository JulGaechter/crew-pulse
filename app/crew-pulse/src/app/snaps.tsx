import { useCallback, useState } from 'react';
import { usePathname } from 'expo-router';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { SnapCamera } from '@/components/snaps/snap-camera';
import { SnapEditor, type EditedSnap } from '@/components/snaps/snap-editor';
import { SnapInbox } from '@/components/snaps/snap-inbox';
import { SnapSendSheet, type SnapTargets } from '@/components/snaps/snap-send-sheet';
import { SnapViewer } from '@/components/snaps/snap-viewer';
import { useSession, useConnection } from '@/hooks/use-session';
import { useSnaps } from '@/hooks/use-snaps';
import type { PickedImage } from '@/services/media';
import { UnauthorizedError } from '@/services/session';
import { sendSnap, type StoryGroup } from '@/services/snaps';

type Viewing = { snapIds: string[]; startIndex: number; kind: 'direct' | 'story'; isOwnStory: boolean };

/**
 * Snap-Tab wie bei Snapchat: Kamera -> bearbeiten -> "Senden an".
 * Posteingang (Snaps + Storys) über den Knopf oben links.
 */
export default function SnapsTab() {
  const { session, onUnauthorized } = useSession();
  const connection = useConnection();
  const focused = usePathname() === '/snaps';
  const [inboxOpen, setInboxOpen] = useState(false);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [edited, setEdited] = useState<EditedSnap | null>(null);
  const [step, setStep] = useState<'edit' | 'send'>('edit');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const onScreenshot = useCallback((ev: { by: { name: string }; kind: 'direct' | 'story' }) => {
    Alert.alert('📸 Screenshot', `${ev.by.name} hat einen Screenshot von deinem ${ev.kind === 'story' ? 'Story-Snap' : 'Snap'} gemacht.`);
  }, []);
  const { overview, refresh, unopenedCount, hasNewStories } = useSnaps(session, connection, onUnauthorized, onScreenshot);

  const discard = () => {
    setPhoto(null);
    setEdited(null);
    setStep('edit');
    setSendError(null);
  };

  const send = async (targets: SnapTargets) => {
    if (!edited) return;
    setSending(true);
    setSendError(null);
    try {
      await sendSnap(session, { ...edited, ...targets });
      discard();
      setReplyTo(null);
      refresh();
    } catch (e) {
      if (e instanceof UnauthorizedError) onUnauthorized();
      else setSendError('Senden fehlgeschlagen. Bitte nochmals versuchen.');
    } finally {
      setSending(false);
    }
  };

  const openFrom = (senderId: string) => {
    // Ungeöffnete Snaps dieses Absenders, älteste zuerst
    const ids = overview.received
      .filter((s) => s.from.id === senderId && !s.opened)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((s) => s.id);
    if (ids.length) setViewing({ snapIds: ids, startIndex: 0, kind: 'direct', isOwnStory: false });
  };

  const openStory = (group: StoryGroup) => {
    const firstUnseen = group.snaps.findIndex((s) => !s.viewed);
    setViewing({
      snapIds: group.snaps.map((s) => s.id),
      startIndex: group.isOwn || firstUnseen < 0 ? 0 : firstUnseen,
      kind: 'story',
      isOwnStory: group.isOwn,
    });
  };

  const closeViewer = () => {
    setViewing(null);
    refresh();
  };

  // Aus einem geöffneten Snap direkt zurück-snappen
  const replyFromViewer = (to: { id: string; name: string }) => {
    setViewing(null);
    setInboxOpen(false);
    setReplyTo(to);
    refresh();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {inboxOpen ? (
        <SnapInbox
          overview={overview}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onClose={() => setInboxOpen(false)}
          onOpenFrom={openFrom}
          onOpenStory={openStory}
          onReply={(to) => {
            setInboxOpen(false);
            setReplyTo(to);
          }}
        />
      ) : (
        <SnapCamera
          active={focused && !photo && !viewing}
          unopenedCount={unopenedCount}
          hasNewStories={hasNewStories}
          onCaptured={setPhoto}
          onOpenInbox={() => setInboxOpen(true)}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      )}

      {/* Bearbeiten + Senden als Vollbild über der Tab-Leiste */}
      <Modal visible={!!photo} animationType="fade" presentationStyle="fullScreen" onRequestClose={discard}>
        {photo && step === 'edit' && (
          <SnapEditor
            photo={photo}
            initial={edited ?? undefined}
            onClose={discard}
            onNext={(snap) => {
              setEdited(snap);
              setStep('send');
            }}
          />
        )}
        {photo && edited && step === 'send' && (
          <SnapSendSheet
            session={session}
            sending={sending}
            error={sendError}
            onBack={() => setStep('edit')}
            onSend={send}
            initialUserIds={replyTo ? [replyTo.id] : undefined}
          />
        )}
      </Modal>

      <Modal visible={!!viewing} animationType="fade" presentationStyle="fullScreen" onRequestClose={closeViewer}>
        {viewing && (
          <SnapViewer
            session={session}
            snapIds={viewing.snapIds}
            startIndex={viewing.startIndex}
            kind={viewing.kind}
            isOwnStory={viewing.isOwnStory}
            onClose={closeViewer}
            onReply={replyFromViewer}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
