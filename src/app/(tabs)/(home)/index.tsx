import { getRootCategories, isDataReady, getDailySutta } from "@/services/DataService";
import { checkForUpdates, syncData } from "@/services/SyncService";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/theme/ThemeContext";
import { radius, spacing } from "@/theme/tokens";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
const CATEGORY_EMOJIS: Record<string, string> = {
  sutta: "☸️",
  vinaya: "📜",
  abhidhamma: "💎",
};

const DEFAULT_EMOJI = "📖";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | null>(0);
  const [syncMessage, setSyncMessage] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [dailySutta, setDailySutta] = useState<{ uid: string; title: string; acronym?: string } | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const rootCats = await getRootCategories();
      setCategories(rootCats);
      const ds = await getDailySutta();
      setDailySutta(ds);
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setElapsedTime(0);
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const success = await syncData((p) => {
        setSyncProgress(p.percent);
        setSyncMessage(p.message);
      });
      if (success) {
        setDataLoaded(true);
        setShowSyncDialog(false);
        loadCategories();
      } else {
        setSyncError("Sync failed. Please check your connection.");
      }
    } catch (error) {
      console.error(error);
      setSyncError("An unexpected error occurred during sync.");
    } finally {
      clearInterval(timer);
      setIsSyncing(false);
    }
  };

  const checkInitialState = useCallback(async () => {
    const ready = await isDataReady();
    setDataLoaded(ready);
    if (!ready) {
      setShowSyncDialog(true);
    } else {
      loadCategories();
      await checkForUpdates(() => {
        setShowSyncDialog(true);
        handleSync();
      });
    }
  }, [loadCategories]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        checkInitialState();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [checkInitialState]);

  const renderCategory = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={() => router.push(`/menu/${item.uid}`)}
    >
      <Text style={styles.emoji}>{CATEGORY_EMOJIS[item.uid] || DEFAULT_EMOJI}</Text>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {item.root_name}
        </Text>
        <Text
          style={[styles.cardTranslated, { color: colors.textSecondary }]}
        >
          {item.translated_name}
        </Text>
        <Text
          style={[styles.cardSubtitle, { color: colors.textTertiary }]}
        >
          {item.blurb}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Saddhamma",
          headerSearchBarOptions: {
            placeholder: "Search Suttas…",
            onSearchButtonPress: (e) =>
              router.push(`/search?q=${e.nativeEvent.text}`),
          },
        }}
      />

      <FlatList
        showsVerticalScrollIndicator={false}
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.uid}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                The Piṭakas
              </Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                Explore the Pāli Canon
              </Text>
              {isLoadingCategories && (
                <ActivityIndicator 
                  color={colors.primary} 
                  style={{ marginTop: spacing.lg }} 
                />
              )}
            </View>

            {/* Sutta of the Day Card */}
            {dailySutta && (
              <View style={[styles.dailyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.dailyHeader}>
                  <Ionicons name="bookmark-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.dailyHeaderLabel, { color: colors.primary }]}>Sutta of the Day</Text>
                </View>
                <Text style={[styles.dailyTitle, { color: colors.textPrimary }]}>
                  {dailySutta.title}
                </Text>
                <View style={styles.dailyFooter}>
                  <View style={[styles.uidBadge, { backgroundColor: colors.surfaceVariant }]}>
                    <Text style={[styles.uidBadgeText, { color: colors.textSecondary }]}>
                      {dailySutta.acronym || dailySutta.uid.toUpperCase()}
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.readNowBtn,
                      { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={() => router.push({
                      pathname: "/reader/[uid]",
                      params: {
                        uid: dailySutta.uid,
                        title: dailySutta.title,
                      },
                    } as any)}
                  >
                    <Text style={[styles.readNowBtnText, { color: colors.textInverse }]}>Read Now</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.textInverse} style={{ marginLeft: 4 }} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Practice Companion section */}
            <View style={styles.companionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.companionCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => router.push("/(content)/timer" as any)}
              >
                <View style={[styles.companionIconBg, { backgroundColor: colors.primary + "15" }]}>
                  <Ionicons name="sunny-outline" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.companionTitle, { color: colors.textPrimary }]}>
                  Meditation
                </Text>
                <Text style={[styles.companionSub, { color: colors.textSecondary }]}>
                  Timer & Breathing
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.companionCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => router.push("/(content)/logs" as any)}
              >
                <View style={[styles.companionIconBg, { backgroundColor: colors.accent + "15" }]}>
                  <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                </View>
                <Text style={[styles.companionTitle, { color: colors.textPrimary }]}>
                  Practice Logs
                </Text>
                <Text style={[styles.companionSub, { color: colors.textSecondary }]}>
                  Stats & Daily Check-in
                </Text>
              </Pressable>
            </View>
          </View>
        }
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <View style={styles.footerContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.supportBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => WebBrowser.openBrowserAsync("https://saddhamma.online/support")}
            >
              <Ionicons name="heart" size={18} color="#E040FB" style={{ marginRight: 8 }} />
              <Text style={[styles.supportBtnText, { color: colors.textPrimary }]}>
                Support Saddhamma (Buy Me a Coffee)
              </Text>
            </Pressable>
          </View>
        }
      />

      {/* Sync Dialog */}
      <Modal
        visible={showSyncDialog}
        transparent
        animationType="fade"
        onRequestClose={() => dataLoaded && !isSyncing && setShowSyncDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Sutta Library Sync
            </Text>
            
            <Text style={[styles.modalText, { color: syncError ? colors.error : colors.textSecondary }]}>
              {syncError ||
                (isSyncing
                  ? syncMessage || "Syncing data..."
                  : "The library needs to be downloaded for offline use.")}
            </Text>

            {isSyncing && (
              <View style={styles.progressContainer}>
                {syncProgress === null ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <View style={[styles.progressBarBase, { backgroundColor: colors.divider }]}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { backgroundColor: colors.primary, width: `${syncProgress * 100}%` }
                      ]} 
                    />
                  </View>
                )}
                <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                  {syncProgress !== null
                    ? `${Math.round(syncProgress * 100)}% Complete (${elapsedTime}s)`
                    : `Processing… (${elapsedTime}s)`}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              {!isSyncing && (
                <Pressable
                  style={[styles.button, { backgroundColor: colors.primary }]}
                  onPress={handleSync}
                >
                  <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                    {syncError ? "Try Again" : "Download Now"}
                  </Text>
                </Pressable>
              )}
              
              {dataLoaded && !isSyncing && (
                <Pressable
                  style={[styles.button, { marginTop: spacing.sm }]}
                  onPress={() => setShowSyncDialog(false)}
                >
                  <Text style={[styles.buttonText, { color: colors.primary }]}>
                    Cancel
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.huge,
  },
  header: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: spacing.xs,
  },
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  emoji: {
    fontSize: 32,
    marginRight: spacing.lg,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardTranslated: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalContent: {
    width: "100%",
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  progressContainer: {
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  progressBarBase: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: "100%",
  },
  progressText: {
    fontSize: 12,
  },
  modalButtons: {
    width: "100%",
  },
  button: {
    width: "100%",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  companionRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  companionCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  companionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  companionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  companionSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  dailyCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dailyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dailyHeaderLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.0,
  },
  dailyTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  dailyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  uidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  uidBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  readNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  readNowBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  footerContainer: {
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.md,
  },
  supportBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  supportBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

