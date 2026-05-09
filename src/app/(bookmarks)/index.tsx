import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Host, Text, Column } from '@expo/ui';
import { Stack } from 'expo-router';

export default function BookmarksScreen() {
  return (
    <Host>
      <Stack.Screen options={{ title: "Bookmarks" }} />
      <Column flex={1} alignItems="center" justifyContent="center" padding={20}>
        <Text style={{ fontSize: 64 }}>🔖</Text>
        <Text variant="titleMedium" style={{ marginTop: 20 }}>Your Bookmarks</Text>
        <Text variant="bodySmall" style={{ color: '#666', textAlign: 'center', marginTop: 10 }}>
          Saved suttas will appear here for quick offline access.
        </Text>
      </Column>
    </Host>
  );
}
