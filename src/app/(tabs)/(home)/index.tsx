import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { isDataReady, getRootCategories } from "@/services/DataService";
import { checkForUpdates, syncData } from "@/services/SyncService";
import { useTheme } from "@/theme/ThemeContext";
import { spacing, radius } from "@/theme/tokens";
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

  useEffect(() => {
    checkInitialState();
  }, []);

  const loadCategories = async () => {
    const rootCats = await getRootCategories();
    setCategories(rootCats);
  };

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

  const checkInitialState = async () => {
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
  };

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
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.uid}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              The Piṭakas
            </Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
              Explore the Pāli Canon
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
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
});

