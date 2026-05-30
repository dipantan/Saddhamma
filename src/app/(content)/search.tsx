import { searchSuttas, stripHtml } from "@/services/DataService";
import { radius, spacing, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const SEARCH_DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState(q || "");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (text: string) => {
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
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (q && isMounted) {
        performSearch(q);
      }
    });
    return () => {
      isMounted = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, performSearch]);

  const handleTextChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      performSearch(text);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    performSearch(query);
  }, [query]);


  const renderSnippetText = (text: string, textColor: string, highlightColor: string) => {
    if (!text) return null;
    const parts = text.split(/(<b>.*?<\/b>)/g);
    return (
      <Text style={{ color: textColor, fontSize: 13, lineHeight: 18 }}>
        {parts.map((part, index) => {
          if (part.startsWith("<b>") && part.endsWith("</b>")) {
            const content = part.substring(3, part.length - 4);
            return (
              <Text key={index} style={{ fontWeight: "700", color: highlightColor }}>
                {content}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  const renderResult = ({ item }: { item: any }) => {
    const displayTitle = item.title || item.uid.toUpperCase();
    const rootTitle = item.root_name;
    const acronym = item.acronym || item.uid.toUpperCase();
    const snippet = item.content_highlight || item.highlight;
    const blurb = item.blurb;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.resultItem,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.divider,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        onPress={() => router.push(`/reader/${item.uid}`)}
      >
        <View style={styles.resultMain}>
          {/* Top Row: Acronym & Root Name */}
          <View style={styles.resultMetaRow}>
            <View style={[styles.acronymBadge, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.acronymText, { color: colors.textPrimary }]}>
                {acronym}
              </Text>
            </View>
            {rootTitle && (
              <Text style={[styles.rootTitleText, { color: colors.textTertiary }]} numberOfLines={1}>
                {rootTitle}
              </Text>
            )}
          </View>

          {/* Main Sutta Title */}
          <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>
            {displayTitle}
          </Text>

          {/* Sutta Blurb (if available) */}
          {blurb && (
            <Text style={[styles.resultBlurb, { color: colors.textSecondary }]} numberOfLines={2}>
              {stripHtml(blurb)}
            </Text>
          )}

          {/* Snippet Match (if available) */}
          {snippet && (
            <View style={[styles.snippetContainer, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <Text style={[styles.snippetLabel, { color: colors.textTertiary }]}>MATCH</Text>
              {renderSnippetText(snippet, colors.textPrimary, colors.primary)}
            </View>
          )}
        </View>
        
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>
      </Pressable>
    );
  };

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
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoFocus={!q}
          />
          {query.length > 0 && (
            <Pressable onPress={() => handleTextChange("")}>
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
                  No results found for &quot;{query}&quot;
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
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  acronymBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
  },
  acronymText: {
    fontSize: 10,
    fontWeight: "700",
  },
  rootTitleText: {
    fontSize: 12,
    fontStyle: "italic",
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  resultBlurb: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  snippetContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  snippetLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  arrowContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: spacing.sm,
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

