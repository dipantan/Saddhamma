import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { getMenu } from "@/services/DataService";
import { useTheme, spacing, radius } from "@/theme";
import { Ionicons } from "@expo/vector-icons";

export default function MenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [headerInfo, setHeaderInfo] = useState({ title: "", blurb: "" });

  useEffect(() => {
    loadMenu();
  }, [id]);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const data = await getMenu(id);
      if (data) {
        let menuItems: any[] = [];
        let title = id.toUpperCase();
        let blurb = "";

        if (Array.isArray(data)) {
          if (data.length === 1 && data[0].children) {
            const parent = data[0];
            menuItems = parent.children;
            title = parent.translated_name || parent.root_name || title;
            blurb = parent.blurb || "";
          } else {
            menuItems = data;
          }
        } else if (data.children) {
          menuItems = data.children;
          title = data.translated_name || data.root_name || title;
          blurb = data.blurb || "";
        } else {
          menuItems = [data];
          title = data.translated_name || data.root_name || title;
          blurb = data.blurb || "";
        }

        setItems(menuItems);
        setHeaderInfo({ title, blurb });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isLeaf = item.node_type === "leaf" || item.type === "text";
    const hasBadge = item.yellow_brick_road && item.yellow_brick_road_count > 0;

    return (
      <View style={styles.cardWrapper}>
        <Pressable
          style={({ pressed }) => [
            styles.itemCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => 
            isLeaf 
              ? router.push(`/reader/${item.uid}`) 
              : router.push(`/menu/${item.uid}`)
          }
        >
          {/* Header Row with Title and Badge */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                {item.translated_name || item.root_name || item.uid}
              </Text>
              
              <View style={styles.metaRow}>
                {item.root_lang_iso && (
                  <View style={[styles.langBadge, { backgroundColor: colors.surfaceVariant }]}>
                    <Text style={[styles.langBadgeText, { color: colors.textTertiary }]}>
                      {item.root_lang_iso.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[styles.itemRoot, { color: colors.textSecondary }]}>
                  {(item.root_name || item.acronym || item.uid).toUpperCase()}
                </Text>
                {item.child_range && (
                  <Text style={[styles.itemRange, { color: colors.textSecondary }]}>
                    {item.child_range}
                  </Text>
                )}
              </View>
            </View>
            
            {hasBadge && (
              <View style={[styles.badge, { backgroundColor: "#B58105" }]}>
                <Text style={styles.badgeText}>
                  {item.yellow_brick_road_count} English
                </Text>
              </View>
            )}
          </View>

          {/* Blurb / Description */}
          {item.blurb && (
            <Text 
              style={[styles.itemBlurb, { color: colors.textPrimary }]}
              numberOfLines={isLeaf ? 2 : undefined}
            >
              {item.blurb}
            </Text>
          )}

          {/* Footer for leaf items */}
          {isLeaf && (
            <View style={styles.cardFooter}>
               <Text style={[styles.uidBadge, { color: colors.textTertiary, backgroundColor: colors.surfaceVariant }]}>
                {item.uid.toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: headerInfo.title }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.uid || index.toString()}
          ListHeaderComponent={
            headerInfo.blurb ? (
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  {headerInfo.title}
                </Text>
                <Text style={[styles.headerBlurb, { color: colors.textSecondary }]}>
                  {headerInfo.blurb}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.center}>
                <Text style={styles.largeEmoji}>📭</Text>
                <Text style={[styles.centerText, { color: colors.textSecondary }]}>
                  No items found in this section.
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxxl,
  },
  centerText: {
    fontSize: 16,
    marginTop: spacing.lg,
  },
  largeEmoji: {
    fontSize: 48,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  headerBlurb: {
    fontSize: 14,
    lineHeight: 22,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.huge,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  itemCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  itemRoot: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  langBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  langBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  itemRange: {
    fontSize: 12,
    fontWeight: "400",
    marginLeft: spacing.md,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  itemBlurb: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  cardFooter: {
    marginTop: spacing.lg,
    flexDirection: "row",
  },
  uidBadge: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
});

