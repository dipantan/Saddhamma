import { LoadingState } from "@/components";
import {
  checkBookmark,
  getSuttaContent,
  loadSettings,
  saveSettings,
  stripHtml,
  toggleBookmark,
} from "@/services/DataService";
import { spacing, useTheme } from "@/theme";
import {
  Button,
  Checkbox,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Host,
  Items,
  LazyColumn,
  ModalBottomSheet,
  Text as NativeText,
  RNHostView,
  Row,
  Trigger,
} from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
} from "@expo/ui/jetpack-compose/modifiers";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReaderScreen() {
  const { uid, title } = useLocalSearchParams<{ uid: string; title: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);

  // Reader Settings
  const [showPali, setShowPali] = useState(true);
  const [showSegments, setShowSegments] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [fontSize, setFontSize] = useState(19);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    initReader();
  }, [uid]);

  const initReader = async () => {
    setLoading(true);
    try {
      const saved = await loadSettings();
      if (saved) {
        if (saved.showPali !== undefined) setShowPali(saved.showPali);
        if (saved.showSegments !== undefined)
          setShowSegments(saved.showSegments);
        if (saved.showComments !== undefined)
          setShowComments(saved.showComments);
        if (saved.fontSize !== undefined) setFontSize(saved.fontSize);
      }
      const result = await getSuttaContent(uid);
      console.log("result", result);
      setData(result);

      const bookmarked = await checkBookmark(uid);
      setIsBookmarked(bookmarked);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      saveSettings({ showPali, showSegments, showComments, fontSize });
    }
  }, [showPali, showSegments, showComments, fontSize]);

  useEffect(() => {
    const backAction = () => {
      if (menuExpanded) {
        setMenuExpanded(false);
        return true;
      }
      if (selectedComment) {
        setSelectedComment(null);
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [menuExpanded, selectedComment, router]);

  const sortedSegments = React.useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set([
        ...Object.keys(data.root_text || {}),
        ...Object.keys(data.translation_text || {}),
      ]),
    ).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }, [data?.root_text, data?.translation_text]);

  const renderSegment = React.useCallback(
    ({ item: segId }: { item: string }) => (
      <SegmentItem
        segId={segId}
        root={data?.root_text?.[segId]}
        trans={data?.translation_text?.[segId]}
        comment={data?.comment_text?.[segId]}
        colors={colors}
        fontSize={fontSize}
        showPali={showPali}
        showSegments={showSegments}
        showComments={showComments}
        onCommentPress={setSelectedComment}
      />
    ),
    [data, colors, fontSize, showPali, showSegments, showComments],
  );

  if (loading) return <LoadingState message="Loading Dhamma…" />;

  if (!data) {
    return (
      <Host>
        <View
          style={[
            styles.container,
            styles.center,
            { backgroundColor: colors.background, paddingTop: insets.top },
          ]}
        >
          <Text style={styles.largeEmoji}>📖</Text>
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>
            Sutta not found.
          </Text>
        </View>
      </Host>
    );
  }

  return (
    <Host style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: title || uid?.toUpperCase() || "Reader",
            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Host matchContents>
                  <RNHostView matchContents>
                    <Pressable
                      onPress={async () => {
                        const getBestTitle = (textMap: any) => {
                          if (!textMap) return "";
                          const keys = Object.keys(textMap);
                          if (keys.length === 0) return "";
                          // Prefer 0.2 (Sutta Name) over 0.1 (Nikaya Name)
                          const suttaNameKey = keys.find((k) =>
                            k.endsWith(":0.2"),
                          );
                          const firstKey = keys[0];
                          return textMap[suttaNameKey || firstKey] || "";
                        };

                        const transTitle =
                          getBestTitle(data?.translation_text) || uid;
                        const rootTitle = getBestTitle(data?.root_text) || "";

                        const newState = await toggleBookmark(
                          uid,
                          stripHtml(transTitle),
                          stripHtml(rootTitle),
                        );
                        setIsBookmarked(newState);
                      }}
                      style={styles.iconBtn}
                    >
                      <Ionicons
                        name={isBookmarked ? "bookmark" : "bookmark-outline"}
                        size={24}
                        color={
                          isBookmarked ? colors.primary : colors.textPrimary
                        }
                      />
                    </Pressable>
                  </RNHostView>
                </Host>

                <Host matchContents>
                  <DropdownMenu
                    expanded={menuExpanded}
                    onDismissRequest={() => setMenuExpanded(false)}
                  >
                    <Trigger>
                      <RNHostView matchContents>
                        <Pressable
                          onPress={() => setMenuExpanded(true)}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="ellipsis-vertical"
                            size={24}
                            color={colors.textPrimary}
                          />
                        </Pressable>
                      </RNHostView>
                    </Trigger>

                    <Items>
                      <DropdownMenuItem onClick={() => setShowPali(!showPali)}>
                        <DropdownMenuItem.LeadingIcon>
                          <Checkbox
                            value={showPali}
                            onCheckedChange={setShowPali}
                            colors={{
                              checkedColor: colors.primary,
                              uncheckedColor: colors.outline,
                              checkmarkColor: colors.surface,
                            }}
                          />
                        </DropdownMenuItem.LeadingIcon>
                        <DropdownMenuItem.Text>
                          <NativeText
                            color={colors.textPrimary}
                            style={{ typography: "bodyLarge" }}
                          >
                            Pāli Text
                          </NativeText>
                        </DropdownMenuItem.Text>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => setShowSegments(!showSegments)}
                      >
                        <DropdownMenuItem.LeadingIcon>
                          <Checkbox
                            value={showSegments}
                            onCheckedChange={setShowSegments}
                            colors={{
                              checkedColor: colors.primary,
                              uncheckedColor: colors.outline,
                              checkmarkColor: colors.surface,
                            }}
                          />
                        </DropdownMenuItem.LeadingIcon>
                        <DropdownMenuItem.Text>
                          <NativeText
                            color={colors.textPrimary}
                            style={{ typography: "bodyLarge" }}
                          >
                            Segments
                          </NativeText>
                        </DropdownMenuItem.Text>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => setShowComments(!showComments)}
                      >
                        <DropdownMenuItem.LeadingIcon>
                          <Checkbox
                            value={showComments}
                            onCheckedChange={setShowComments}
                            colors={{
                              checkedColor: colors.primary,
                              uncheckedColor: colors.outline,
                              checkmarkColor: colors.surface,
                            }}
                          />
                        </DropdownMenuItem.LeadingIcon>
                        <DropdownMenuItem.Text>
                          <NativeText
                            color={colors.textPrimary}
                            style={{ typography: "bodyLarge" }}
                          >
                            Comments
                          </NativeText>
                        </DropdownMenuItem.Text>
                      </DropdownMenuItem>

                      <HorizontalDivider thickness={1} color={colors.divider} />

                      <Column modifiers={[paddingAll(12)]}>
                        <NativeText
                          color={colors.textSecondary}
                          style={{ typography: "labelSmall" }}
                          modifiers={[padding(0, 0, 0, 8)]}
                        >
                          FONT SIZE
                        </NativeText>
                        <Row
                          horizontalArrangement={{ spacedBy: 16 }}
                          verticalAlignment="center"
                          modifiers={[fillMaxWidth()]}
                        >
                          <Button
                            colors={{ containerColor: colors.primary }}
                            onClick={() =>
                              setFontSize(Math.max(12, fontSize - 2))
                            }
                          >
                            <NativeText
                              color={colors.surface}
                              style={{ typography: "labelLarge" }}
                            >
                              A-
                            </NativeText>
                          </Button>
                          <NativeText
                            color={colors.textPrimary}
                            style={{ typography: "titleMedium" }}
                          >
                            {fontSize}
                          </NativeText>
                          <Button
                            colors={{ containerColor: colors.primary }}
                            onClick={() =>
                              setFontSize(Math.min(32, fontSize + 2))
                            }
                          >
                            <NativeText
                              color={colors.surface}
                              style={{ typography: "labelLarge" }}
                            >
                              A+
                            </NativeText>
                          </Button>
                        </Row>
                      </Column>
                    </Items>
                  </DropdownMenu>
                </Host>
              </View>
            ),
          }}
        />

        <FlatList
          data={sortedSegments}
          renderItem={renderSegment}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.listContent}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </View>

      {selectedComment && (
        <ModalBottomSheet
          onDismissRequest={() => setSelectedComment(null)}
          showDragHandle={true}
        >
          <Column
            modifiers={[
              paddingAll(24),
              fillMaxWidth(),
              background(colors.surface),
            ]}
          >
            <NativeText
              color={colors.textPrimary}
              style={{ typography: "titleLarge" }}
              modifiers={[padding(0, 8, 0, 8)]}
            >
              Note
            </NativeText>
            <LazyColumn modifiers={[fillMaxWidth(), height(300)]}>
              <Items>
                <NativeText
                  color={colors.textPrimary}
                  style={{ typography: "bodyMedium" }}
                >
                  {stripHtml(selectedComment)}
                </NativeText>
              </Items>
            </LazyColumn>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}

const SegmentItem = React.memo(
  ({
    segId,
    root,
    trans,
    comment,
    colors,
    fontSize,
    showPali,
    showSegments,
    showComments,
    onCommentPress,
  }: any) => {
    const segmentNum = segId.split(":")[1];
    const isHeader = segmentNum?.startsWith("0.");

    if (!trans && (!showPali || !root)) return null;

    if (isHeader) {
      const isTopLevel = segmentNum.startsWith("0.");
      return (
        <View style={styles.headerSegment}>
          {trans && (
            <Text
              selectable
              style={[
                isTopLevel ? styles.mainTitle : styles.sectionTitle,
                {
                  color: colors.textPrimary,
                  fontSize: fontSize + (isTopLevel ? 7 : 1),
                  textAlign: isTopLevel ? "center" : "left",
                },
              ]}
            >
              {trans}
            </Text>
          )}
          {showPali && root && (
            <Text
              selectable
              style={[
                isTopLevel ? styles.mainTitlePali : styles.sectionTitlePali,
                {
                  color: colors.textPali,
                  fontSize: fontSize - 1,
                  textAlign: isTopLevel ? "center" : "left",
                },
              ]}
            >
              {root}
            </Text>
          )}
        </View>
      );
    }

    return (
      <View style={styles.bodySegment}>
        {showSegments && (
          <View style={styles.segmentLeft}>
            <Text
              style={[styles.segmentNumber, { color: colors.textTertiary }]}
            >
              {segmentNum}
            </Text>
          </View>
        )}
        <View style={styles.segmentContent}>
          {trans && (
            <Text
              selectable
              style={[
                styles.bodyText,
                {
                  color: colors.textPrimary,
                  fontSize,
                  lineHeight: fontSize * 1.6,
                },
              ]}
            >
              {trans}
              {showComments && comment && (
                <View style={styles.asteriskContainer}>
                  <Pressable
                    onPress={() => onCommentPress(comment)}
                    hitSlop={20}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.5 : 1,
                      padding: 4,
                    })}
                  >
                    <Text
                      style={[
                        styles.commentAsterisk,
                        { color: colors.primary },
                      ]}
                    >
                      *
                    </Text>
                  </Pressable>
                </View>
              )}
            </Text>
          )}
          {showPali && root && (
            <Text
              selectable
              style={[
                styles.bodyText,
                styles.paliText,
                {
                  color: colors.textPali,
                  fontSize: fontSize - 1,
                  lineHeight: (fontSize - 1) * 1.6,
                },
              ]}
            >
              {root}
            </Text>
          )}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxxl,
  },
  centerText: {
    fontSize: 18,
    marginTop: spacing.lg,
  },
  largeEmoji: {
    fontSize: 48,
  },
  listContent: {
    paddingBottom: spacing.huge * 2,
  },
  headerSegment: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: "rgba(0,0,0,0.02)",
    marginBottom: spacing.md,
  },
  mainTitle: {
    fontWeight: "700",
    textAlign: "center",
  },
  mainTitlePali: {
    fontStyle: "italic",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontWeight: "700",
  },
  sectionTitlePali: {
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  bodySegment: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  segmentLeft: {
    width: 40,
    alignItems: "flex-end",
    paddingRight: spacing.md,
    paddingTop: 4,
  },
  segmentNumber: {
    fontSize: 10,
    fontWeight: "600",
    opacity: 0.5,
  },
  segmentContent: {
    flex: 1,
  },
  bodyText: {
    fontFamily: "System",
  },
  paliText: {
    fontStyle: "italic",
    marginTop: spacing.sm,
    opacity: 0.8,
  },
  commentAsterisk: {
    fontWeight: "bold",
    fontSize: 20,
  },
  asteriskContainer: {
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
    height: 24,
    width: 24,
  },
  iconBtn: {
    padding: spacing.sm,
  },
});
