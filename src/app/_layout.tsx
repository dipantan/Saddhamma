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
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [visible, setVisible] = useState(() => isIndexingInProgress());
  const [showModal, setShowModal] = useState(false);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [widthAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = addIndexListener((processed, total) => {
      const active = isIndexingInProgress();
      setVisible(active);
      setProcessedCount(processed);
      setTotalCount(total);

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
    <>
      <Pressable 
        onPress={() => setShowModal(true)} 
        hitSlop={{ top: 10, bottom: 15, left: 20, right: 20 }}
        style={[styles.progressContainer, { top: insets.top, backgroundColor: colors.divider }]}
      >
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
      </Pressable>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Library Search Indexing
            </Text>
            
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              {totalCount > 0 ? `Indexed ${processedCount} of ${totalCount} suttas` : "Indexing search library…"}
            </Text>

            <View style={styles.modalProgressWrapper}>
              <View style={[styles.modalProgressBarBase, { backgroundColor: colors.divider }]}>
                <View 
                  style={[
                    styles.modalProgressBarFill, 
                    { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }
                  ]} 
                />
              </View>
              <Text style={[styles.modalProgressPercent, { color: colors.textTertiary }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }
              ]}
              onPress={() => setShowModal(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textInverse }]}>
                Dismiss
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
    height: 6,
    zIndex: 9999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalProgressWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  modalProgressBarBase: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  modalProgressBarFill: {
    height: "100%",
  },
  modalProgressPercent: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalCloseBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
