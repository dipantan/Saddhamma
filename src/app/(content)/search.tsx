import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { searchSuttas } from "@/services/DataService";
import { useTheme, spacing, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState(q || "");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q) {
      handleSearch(q);
    }
  }, [q]);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchSuttas(text);
      setResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderResult = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [
        styles.resultItem,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.divider,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={() => router.push(`/reader/${item.uid}`)}
    >
      <View style={styles.resultMain}>
        <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>
          {item.title || item.uid.toUpperCase()}
        </Text>
        <Text 
          style={[styles.resultSnippet, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {item.content_highlight || item.highlight || item.uid.toUpperCase()}
        </Text>
      </View>
      <View style={styles.resultBadge}>
        <Text style={[styles.badgeText, { color: colors.textTertiary }]}>
          {item.uid.toUpperCase()}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Custom Search Bar */}
      <View style={[styles.searchBarContainer, { backgroundColor: colors.headerBackground }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <Ionicons name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder="Search suttas…"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch(query)}
            returnKeyType="search"
            autoFocus={!q}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>
            Searching…
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item, index) => item.uid || index.toString()}
          ListHeaderComponent={
            results.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={[styles.countText, { color: colors.textTertiary }]}>
                  {results.length} result{results.length !== 1 ? "s" : ""} found
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            query && !loading ? (
              <View style={styles.center}>
                <Text style={styles.largeEmoji}>🔍</Text>
                <Text style={[styles.centerText, { color: colors.textSecondary }]}>
                  No results found for "{query}"
                </Text>
                <Text style={[styles.subText, { color: colors.textTertiary }]}>
                  Try a different keyword or sutta ID
                </Text>
              </View>
            ) : null
          }
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
  searchBarContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  listContent: {
    paddingBottom: spacing.huge,
  },
  listHeader: {
    padding: spacing.lg,
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: "row",
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  resultMain: {
    flex: 1,
    marginRight: spacing.md,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  resultSnippet: {
    fontSize: 14,
    lineHeight: 20,
  },
  resultBadge: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxxl,
  },
  centerText: {
    fontSize: 16,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  subText: {
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  largeEmoji: {
    fontSize: 48,
  },
});

