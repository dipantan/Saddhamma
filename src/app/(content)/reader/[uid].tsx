import { LoadingState } from "@/components";
import {
  getSuttaContent,
  loadSettings,
  saveSettings,
  stripHtml,
} from "@/services/DataService";
import { palette, spacing, useTheme } from "@/theme";
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
  fillMaxWidth,
  height,
  padding,
  paddingAll,
} from "@expo/ui/jetpack-compose/modifiers";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReaderScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
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
      setData(result);
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

  const sortedSegments = Array.from(
    new Set([
      ...Object.keys(data.root_text || {}),
      ...Object.keys(data.translation_text || {}),
    ]),
  ).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );

  const renderSegment = ({ item: segId }: { item: string }) => {
    const root = data.root_text?.[segId];
    const trans = data.translation_text?.[segId];
    const comment = data.comment_text?.[segId];
    const segmentNum = segId.split(":")[1];
    const isHeader = segmentNum?.startsWith("0.");

    if (!trans && (!showPali || !root)) return null;

    if (isHeader) {
      const isTopLevel = segmentNum.startsWith("0.");
      return (
        <View style={styles.headerSegment}>
          {trans && (
            <Text
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
                    onPress={() => setSelectedComment(comment)}
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
              style={[
                styles.paliText,
                {
                  color: colors.textPali,
                  fontSize: fontSize - 3,
                  lineHeight: (fontSize - 3) * 1.5,
                },
              ]}
            >
              {root}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Host style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: uid?.toUpperCase() || "Reader",
            headerRight: () => (
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
                          onClick={() =>
                            setFontSize(Math.max(12, fontSize - 2))
                          }
                        >
                          <NativeText
                            color={palette.white}
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
                          onClick={() =>
                            setFontSize(Math.min(32, fontSize + 2))
                          }
                        >
                          <NativeText
                            color={palette.white}
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
          <Column modifiers={[paddingAll(24), fillMaxWidth()]}>
            <NativeText
              style={{ typography: "titleLarge" }}
              modifiers={[padding(0, 8, 0, 8)]}
            >
              Note
            </NativeText>
            <LazyColumn modifiers={[fillMaxWidth(), height(300)]}>
              <Items>
                <NativeText style={{ typography: "bodyMedium" }}>
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
