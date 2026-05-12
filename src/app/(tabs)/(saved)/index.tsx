import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';

export default function BookmarksScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Bookmarks" }} />
      <View style={styles.content}>
        <Text style={styles.icon}>🔖</Text>
        <Text style={styles.title}>Your Bookmarks</Text>
        <Text style={styles.subtitle}>
          Saved suttas will appear here for quick offline access.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  }
});
