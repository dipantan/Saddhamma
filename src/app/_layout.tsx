import { Stack } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="menu/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Menu' }} />
        <Stack.Screen name="reader/[uid]" options={{ presentation: 'fullScreenModal', headerShown: true, title: 'Reader' }} />
      </Stack>
    </View>
  );
}

/**
 * We move the Tabs definition to a separate component or handle it via (home), (saved), (settings)
 * Since NativeTabs is a navigator, it usually needs to be at the root of a group.
 */
