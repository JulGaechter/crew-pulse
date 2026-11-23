import AsyncStorage from '@react-native-async-storage/async-storage';

const NAME_KEY = 'crewpulse:name';

export async function loadName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export async function saveName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(NAME_KEY, name);
  } catch {
    // Speichern ist nice-to-have – der Chat funktioniert auch ohne.
  }
}
