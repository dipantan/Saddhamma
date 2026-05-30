import {
  addIndexListener,
  buildFullTextIndex,
  isDataReady,
  isIndexingInProgress,
} from "@/services/DataService";
import { ThemeProvider, useTheme } from "@/theme";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Snackbar } from "react-native-snackbar";

function GlobalProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [widthAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Check initial state only once on mount
    const isActive = isIndexingInProgress();
    setVisible(isActive);

    const unsubscribe = addIndexListener((processed, total) => {
      const active = isIndexingInProgress();
      setVisible(active);

      if (total > 0) {
        const percent = processed / total;
        setProgress(percent);
        
        Animated.timing(widthAnim, {
          toValue: percent,
          duration: 300,
          useNativeDriver: false,
        }).start();
      } else {
        setProgress(0);
        widthAnim.setValue(0);
      }
    });

    return unsubscribe;
  }, [widthAnim]);

  if (!visible || progress >= 1) return null;

  return (
    <View style={[styles.progressContainer, { top: insets.top, backgroundColor: colors.divider }]}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: "#FFD54F", // Saffron / ochre accent color
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

function RootNavigator() {
  const { colors, isDark } = useTheme();
  
  useEffect(() => {
    // Handle OTA Updates
    async function onFetchUpdateAsync() {
      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          
          Snackbar.show({
            text: "Update downloaded successfully",
            duration: Snackbar.LENGTH_INDEFINITE,
            action: {
              text: "RESTART",
              textColor: "#FFD54F",
              onPress: () => {
                Updates.reloadAsync();
              },
            },
          });
        }
      } catch (error) {
        console.log(`Error fetching latest Expo update: ${error}`);
      }
    }

    if (!__DEV__) {
      onFetchUpdateAsync();
    }

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
      <GlobalProgressBar />
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

const styles = StyleSheet.create({
  progressContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    zIndex: 9999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
  },
});
