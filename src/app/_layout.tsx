import {
  addIndexListener,
  buildFullTextIndex,
  isDataReady,
  isIndexingInProgress,
  syncSuttaReminders,
} from "@/services/DataService";
import { ThemeProvider, useTheme } from "@/theme";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Snackbar } from "react-native-snackbar";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function GlobalProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(() => isIndexingInProgress());
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [widthAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
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
  const router = useRouter();
  
  useEffect(() => {
    let isMounted = true;

    // Handle notification that opened the app (cold start)
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!isMounted) return;
      const url = response?.notification.request.content.data?.url;
      if (url) {
        // Delay slightly to ensure layout and router are fully ready
        setTimeout(() => {
          router.push(url as any);
        }, 500);
      }
    }).catch(err => console.error("Error getting last notification response:", err));

    // Handle Notification Tap Deep Linking while app is running/backgrounded
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url;
      if (url) {
        router.push(url as any);
      }
    });

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
    
    return () => {
      isMounted = false;
      responseSubscription.remove();
    };
  }, [router]);

  useEffect(() => {
    const startBackgroundTasks = async () => {
      try {
        // Wait a bit for the app to settle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (await isDataReady()) {
          console.log("[Background] Starting FTS indexing...");
          await buildFullTextIndex();
          console.log("[Background] FTS indexing complete.");

          console.log("[Background] Synchronizing sutta reminders...");
          await syncSuttaReminders();
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
          name="(content)/timer"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Meditation Timer",
          }}
        />
        <Stack.Screen
          name="(content)/logs"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Practice Logs",
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
