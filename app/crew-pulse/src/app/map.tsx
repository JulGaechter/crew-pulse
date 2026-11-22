import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>CrewPulse Karte</Text>
      <Text style={styles.subtitle}>Live-Standort & Geistermodus (folgt als Nächstes)</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#999', fontSize: 14, textAlign: 'center' },
});