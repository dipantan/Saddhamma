import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Host, Text, Column } from '@expo/ui';
import { Stack } from 'expo-router';

export default function SettingsScreen() {
  return (
    <Host>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <Column padding={20} gap={20}>
          <Text variant="titleMedium">Appearance</Text>
          <View style={styles.settingItem}>
            <Text variant="bodyLarge">Theme</Text>
            <Text variant="bodySmall">System Default</Text>
          </View>
          
          <Text variant="titleMedium" style={{ marginTop: 20 }}>Reader Settings</Text>
          <View style={styles.settingItem}>
            <Text variant="bodyLarge">Font Size</Text>
            <Text variant="bodySmall">Medium</Text>
          </View>

          <Text variant="titleMedium" style={{ marginTop: 20 }}>About</Text>
          <View style={styles.settingItem}>
            <Text variant="bodyLarge">Version</Text>
            <Text variant="bodySmall">1.2.0 (Build 56)</Text>
          </View>
        </Column>
      </ScrollView>
    </Host>
  );
}

const styles = StyleSheet.create({
  settingItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  }
});
