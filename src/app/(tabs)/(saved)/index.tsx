import { EmptyState } from "@/components";
import { Bookmark, getBookmarks, toggleBookmark } from "@/services/DataService";
import { radius, spacing, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

export default function BookmarksScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const loadBookmarks = useCallback(async () => {
    const data = await getBookmarks();
    setBookmarks(data);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadBookmarks();
    }, [loadBookmarks])
  );

  const handleRemove = (item: Bookmark) => {
    Alert.alert(
      "Remove Bookmark",
      "Are you sure you want to remove this sutta from your bookmarks?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            await toggleBookmark(item.uid, item.translated_name, item.root_name);
            loadBookmarks();
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Bookmark }) => (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { 
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.7 : 1 
        }
      ]}
      onPress={() => router.push(`/reader/${item.uid}`)}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.translated_name}
          </Text>
          {item.root_name && (
            <Text style={[styles.cardRootTitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.root_name}
            </Text>
          )}
        </View>
        <Pressable 
          onPress={() => handleRemove(item)}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.uidBadge, { color: colors.textTertiary, backgroundColor: colors.surfaceVariant }]}>
          {item.uid.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Bookmarks" }} />
      {bookmarks.length === 0 ? (
        <EmptyState
          icon="🔖"
          title="Your Bookmarks"
          subtitle="Saved suttas will appear here for quick offline access."
        />
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  cardHeader: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
  },
  cardRootTitle: {
    fontSize: 14,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  uidBadge: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  dateText: {
    fontSize: 12,
  },
});

