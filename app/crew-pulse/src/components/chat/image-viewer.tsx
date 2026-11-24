import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/services/chat-types';
import { imageSource } from '@/services/media';
import { Icon } from '@/components/ui/icon';
import { C, F } from '@/constants/crew-theme';

type Props = {
  message: ChatMessage | null;
  token: string;
  onClose: () => void;
};

/** Bild im Vollbild. Antippen schliesst. */
export function ImageViewer({ message, token, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const image = message?.image;

  return (
    <Modal visible={Boolean(image)} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.container} onPress={onClose}>
        {image && <Image source={imageSource(image, token)} style={styles.image} resizeMode="contain" />}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.sender} numberOfLines={1}>
            {message?.sender}
          </Text>
          <View style={styles.closeButton} accessibilityLabel="Schliessen">
            <Icon name="close" size={20} color={C.text} strokeWidth={2} />
          </View>
        </View>
        {message?.text ? (
          <View style={[styles.caption, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.captionText}>{message.text}</Text>
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sender: { color: C.text, fontSize: 16, fontFamily: F.semibold, flex: 1 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  captionText: { color: C.text, fontSize: 15, lineHeight: 21, fontFamily: F.regular },
});
