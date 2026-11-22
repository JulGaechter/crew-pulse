import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Message = {
  id: string;
  sender: string;
  text: string;
  time: string;
};

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Du',
      text: 'Willkommen bei CrewPulse! Testnachricht für die Gruppe.',
      time: 'Jetzt',
    },
  ]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const now = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'Du',
        text: trimmed,
        time: now,
      },
    ]);
    setInput('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.bubble}>
              <Text style={styles.sender}>{item.sender}</Text>
              <Text style={styles.text}>{item.text}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          )}
        />

        <View
          style={[
            styles.inputRow,
            { paddingBottom: keyboardVisible ? 12 : 20 },
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="Nachricht an die Crew..."
            placeholderTextColor="#888"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.button} onPress={sendMessage}>
            <Text style={styles.buttonText}>Senden</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#111',
  },
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  list: {
    padding: 16,
    paddingTop: 20,
    gap: 10,
  },
  bubble: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  sender: {
    color: '#4da6ff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  text: {
    color: '#fff',
    fontSize: 15,
  },
  time: {
    color: '#999',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    backgroundColor: '#111',
  },
  input: {
    flex: 1,
    backgroundColor: '#242424',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});