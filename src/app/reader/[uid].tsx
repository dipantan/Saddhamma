import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Host, Text, Column } from '@expo/ui';
import { getSuttaContent } from '@/services/DataService';

export default function ReaderScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [content, setContent] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContent() {
      if (uid) {
        const data = await getSuttaContent(uid);
        setContent(data);
      }
      setLoading(false);
    }
    loadContent();
  }, [uid]);

  if (loading) {
    return (
      <Column flex={1} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" />
      </Column>
    );
  }

  if (!content) {
    return (
      <Column flex={1} justifyContent="center" alignItems="center">
        <Text>Sutta not found or not synced yet.</Text>
      </Column>
    );
  }

  return (
    <Host>
      <Stack.Screen options={{ title: uid }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Column gap={16}>
          {Object.entries(content).map(([key, text]) => (
            <Column key={key} gap={4}>
              <Text variant="bodySmall" style={styles.segmentId}>{key}</Text>
              <Text variant="bodyLarge">{text}</Text>
            </Column>
          ))}
        </Column>
      </ScrollView>
    </Host>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    backgroundColor: '#fff',
  },
  segmentId: {
    color: '#999',
    fontSize: 10,
  }
});
