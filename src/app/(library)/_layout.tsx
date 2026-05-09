import { Stack } from "expo-router/stack";
import { PlatformColor } from "react-native";

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitle: true,
        headerLargeStyle: { backgroundColor: "transparent" },
        headerBlurEffect: "prominent",
        headerTitleStyle: { color: PlatformColor("label") },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: "Library",
        }} 
      />
      <Stack.Screen 
        name="menu/[id]" 
        options={{ 
          headerLargeTitle: false,
        }} 
      />
      <Stack.Screen 
        name="reader/[uid]" 
        options={{ 
          title: "Reader",
          headerLargeTitle: false,
          headerTransparent: false, // Reader should probably have a solid header for better focus
        }} 
      />
    </Stack>
  );
}
