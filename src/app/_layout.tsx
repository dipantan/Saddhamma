import { ThemeProvider, useTheme } from "@/theme";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useEffect } from "react";
import { isDataReady, buildFullTextIndex } from "@/services/DataService";

function RootNavigator() {
  const { colors, isDark } = useTheme();
  
  useEffect(() => {
    const startBackgroundTasks = async () => {
      try {
        // Wait a bit for the app to settle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (await isDataReady()) {
          console.log("[Background] Starting FTS indexing...");
          await buildFullTextIndex();
          console.log("[Background] FTS indexing complete.");
        }
      } catch (error) {
        console.error("[Background] Task failed:", error);
      }
    };

    startBackgroundTasks();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // Using a consistent header style across the root stack to avoid 
          // re-initializing the native color coordinator during transitions.
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTintColor: colors.headerText,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="(content)/search"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Search",
          }}
        />
        <Stack.Screen
          name="(content)/menu/[id]"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Menu",
          }}
        />
        <Stack.Screen
          name="(content)/reader/[uid]"
          options={{
            presentation: "fullScreenModal",
            headerShown: true,
            title: "Reader",
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
