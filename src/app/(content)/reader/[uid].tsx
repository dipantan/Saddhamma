import { LoadingState } from "@/components";
import {
  checkBookmark,
  getSuttaContent,
  loadSettings,
  saveSettings,
  stripHtml,
  toggleBookmark,
} from "@/services/DataService";
import { radius, spacing, useTheme } from "@/theme";
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
  paddingAll
} from "@expo/ui/jetpack-compose/modifiers";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Snackbar } from "react-native-snackbar";

const SERIF_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

const getLanguageName = (langCode: string): string => {
  if (!langCode) return "Root";
  const code = langCode.toLowerCase().trim();
  switch (code) {
    case "pli":
      return "Pāli";
    case "lzh":
    case "zh":
      return "Chinese";
    case "san":
    case "sa":
      return "Sanskrit";
    case "en":
      return "English";
    default:
      return code.charAt(0).toUpperCase() + code.slice(1);
  }
};

export default function ReaderScreen() {
  const { uid, title } = useLocalSearchParams<{ uid: string; title: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);

  // Reader Settings
  const [showPali, setShowPali] = useState(true);
  const [showSegments, setShowSegments] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [fontSize, setFontSize] = useState(19);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const resolvedRootLang = useMemo(() => {
    if (data?.root_lang) return data.root_lang;
    const lowerUid = uid?.toLowerCase() || "";
    if (lowerUid.startsWith("t") || lowerUid.startsWith("da") || lowerUid.startsWith("ma") || lowerUid.startsWith("sa") || lowerUid.startsWith("ea")) {
      return "lzh";
    } else if (lowerUid.startsWith("arv")) {
      return "san";
    }
    return "pli";
  }, [data, uid]);

  const initReader = useCallback(async (isMounted: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const saved = await loadSettings();
      if (!isMounted) return;
      if (saved) {
        setShowPali(prev => saved.showPali !== undefined ? saved.showPali : prev);
        setShowSegments(prev => saved.showSegments !== undefined ? saved.showSegments : prev);
        setShowComments(prev => saved.showComments !== undefined ? saved.showComments : prev);
        setFontSize(prev => saved.fontSize !== undefined ? saved.fontSize : prev);
      }
      const result = await getSuttaContent(uid);
      if (!isMounted) return;
      if (!result) {
        setError("Sutta content could not be loaded. It might be missing or you may be offline.");
      } else {
        setData(result);
        const bookmarked = await checkBookmark(uid);
        setIsBookmarked(bookmarked);
      }
    } catch (err) {
      console.error(err);
      if (isMounted) {
        setError("An unexpected error occurred while loading the sutta.");
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  }, [uid]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        initReader(isMounted);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [initReader]);

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

  const handleCopyEntireSutta = async () => {
    if (!data) return;
    try {
      let copyText = "";

      const getBestTitle = (textMap: any) => {
        if (!textMap) return "";
        const keys = Object.keys(textMap);
        if (keys.length === 0) return "";
        const suttaNameKey = keys.find((k) => k.endsWith(":0.2"));
        const firstKey = keys[0];
        return textMap[suttaNameKey || firstKey] || "";
      };

      const transTitle = getBestTitle(data?.translation_text);
      const rootTitle = getBestTitle(data?.root_text);
      const acronym = data?.acronym || uid?.toUpperCase();

      if (acronym) copyText += `${acronym}\n`;
      if (transTitle) copyText += `${stripHtml(transTitle)}\n`;
      if (rootTitle) copyText += `${stripHtml(rootTitle)}\n`;
      copyText += "\n";

      sortedSegments.forEach((segId) => {
        const isHeader = segId.includes(":legacy:")
          ? (segId.split(":")[2] === "division" || segId.split(":")[2] === "h1" || segId.split(":")[2] === "h2" || segId.split(":")[2] === "h3")
          : segId.split(":")[1]?.startsWith("0.");

        if (isHeader) return;

        const rootLine = data?.root_text?.[segId];
        const transLine = data?.translation_text?.[segId];

        if (showPali && rootLine) {
          copyText += `${stripHtml(rootLine)}\n`;
        }
        if (transLine) {
          copyText += `${stripHtml(transLine)}\n`;
        }
        if ((showPali && rootLine) || transLine) {
          copyText += "\n";
        }
      });

      await Clipboard.setStringAsync(copyText.trim());
      Snackbar.show({
        text: "Sutta copied to clipboard",
        duration: Snackbar.LENGTH_SHORT,
      });
      setMenuExpanded(false);
    } catch (e) {
      console.error(e);
      Snackbar.show({
        text: "Failed to copy sutta text",
        duration: Snackbar.LENGTH_SHORT,
        backgroundColor: colors.error,
      });
    }
  };

  const hasTranslation = useMemo(() => {
    if (!data || !data.translation_text) return false;
    return Object.keys(data.translation_text).length > 0;
  }, [data?.translation_text]);

  const isLegacyTranslation = useMemo(() => {
    if (!data || !data.translation_text) return false;
    return Object.keys(data.translation_text).some(k => k.includes(":legacy"));
  }, [data?.translation_text]);

  const sortedSegments = useMemo(() => {
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

  const renderSegment = useCallback(
    ({ item: segId }: { item: string }) => (
      <SegmentItem
        segId={segId}
        root={data?.root_text?.[segId]}
        trans={data?.translation_text?.[segId]}
        comment={data?.comment_text?.[segId]}
        colors={colors}
        fontSize={fontSize}
        showPali={showPali || !hasTranslation}
        showSegments={showSegments}
        showComments={showComments}
        onCommentPress={setSelectedComment}
      />
    ),
    [data, colors, fontSize, showPali, showSegments, showComments, hasTranslation],
  );

  if (loading) return <LoadingState message="Loading Dhamma…" />;

  if (error || !data) {
    return (
      <Host>
        <View
          style={[
            styles.container,
            styles.center,
            { backgroundColor: colors.background, paddingTop: insets.top },
          ]}
        >
          <Text style={styles.largeEmoji}>{error ? "⚠️" : "📖"}</Text>
          <Text style={[styles.centerText, { color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl }]}>
            {error || "Sutta not found."}
          </Text>
          {error && (
            <Pressable 
              style={({ pressed }) => [
                styles.retryButton, 
                { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => initReader(true)}
            >
              <Text style={[styles.retryButtonText, { color: colors.textInverse }]}>Retry</Text>
            </Pressable>
          )}
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
                        Snackbar.show({
                          text: newState ? "Sutta bookmarked" : "Bookmark removed",
                          duration: Snackbar.LENGTH_SHORT,
                        });
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
                            {`${getLanguageName(resolvedRootLang)} Text`}
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

                      <DropdownMenuItem onClick={handleCopyEntireSutta}>
                        <DropdownMenuItem.LeadingIcon>
                          <Ionicons
                            name="copy-outline"
                            size={20}
                            color={colors.textPrimary}
                          />
                        </DropdownMenuItem.LeadingIcon>
                        <DropdownMenuItem.Text>
                          <NativeText
                            color={colors.textPrimary}
                            style={{ typography: "bodyLarge" }}
                          >
                            Copy entire sutta
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
          ListHeaderComponent={
            !hasTranslation && data ? (
              <View style={[styles.infoBanner, { backgroundColor: colors.surfaceVariant, borderColor: colors.divider }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
                  No English translation is available for this text. Showing {getLanguageName(resolvedRootLang)} root text.
                </Text>
              </View>
            ) : isLegacyTranslation ? (
              <View style={[styles.infoBanner, { backgroundColor: colors.surfaceVariant, borderColor: colors.divider }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
                  This is a legacy, non-aligned translation by {data?.author_uid ? data.author_uid.charAt(0).toUpperCase() + data.author_uid.slice(1) : "author"}. {getLanguageName(resolvedRootLang)} and English texts are shown independently.
                </Text>
              </View>
            ) : null
          }
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
            ]}
          >
            <NativeText
              color={colors.textPrimary}
              style={{ typography: "titleLarge" }}
              modifiers={[padding(0, 0, 16, 0)]}
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

interface SegmentItemProps {
  segId: string;
  root?: string;
  trans?: string;
  comment?: string;
  colors: any;
  fontSize: number;
  showPali: boolean;
  showSegments: boolean;
  showComments: boolean;
  onCommentPress: (comment: string) => void;
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
  }: SegmentItemProps) => {
    const isLegacy = segId.includes(":legacy:");
    let isHeader = false;
    let isCollection = false;
    let isTitle = false;
    let isSubtitle = false;
    let segmentNum = segId.split(":")[1];

    if (isLegacy) {
      const parts = segId.split(":");
      const tag = parts[2];
      segmentNum = parts[3]; // Numeric index of the legacy paragraph
      if (tag === "division") {
        isHeader = true;
        isCollection = true;
      } else if (tag === "h1") {
        isHeader = true;
        isTitle = true;
      } else if (tag === "h2" || tag === "h3") {
        isHeader = true;
        isSubtitle = true;
      }
    } else {
      isHeader = segmentNum?.startsWith("0.");
      if (isHeader) {
        isCollection = segmentNum === "0.1";
        isTitle = segmentNum === "0.2";
        isSubtitle = !isCollection && !isTitle;
      }
    }

    if (!trans && (!showPali || !root)) return null;

    if (isHeader) {
      return (
        <View style={styles.headerSegment}>
          <Text selectable style={{ textAlign: "center", width: "100%" }}>
            {isCollection && trans && (
              <Text
                style={[
                  styles.collectionTitle,
                  {
                    color: colors.textSecondary,
                    fontSize: Math.max(12, fontSize - 5),
                  },
                ]}
              >
                {trans.toUpperCase()}
                {"\n"}
              </Text>
            )}
            {isTitle && trans && (
              <Text
                style={[
                  styles.mainTitle,
                  {
                    color: colors.textPrimary,
                    fontSize: fontSize + 10,
                    lineHeight: (fontSize + 10) * 1.3,
                  },
                ]}
              >
                {trans}
                {showPali && root ? "\n" : ""}
              </Text>
            )}
            {showPali && root && (
              <Text
                style={[
                  styles.paliText,
                  styles.headerPali,
                  {
                    color: colors.textPali,
                    fontSize: isTitle ? fontSize + 1 : fontSize - 2,
                    lineHeight: isTitle ? (fontSize + 1) * 1.4 : (fontSize - 2) * 1.4,
                  },
                ]}
              >
                {root}
                {isSubtitle && trans ? "\n" : ""}
              </Text>
            )}
            {isSubtitle && trans && (
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: colors.textSecondary,
                    fontSize: fontSize - 1,
                    lineHeight: (fontSize - 1) * 1.4,
                  },
                ]}
              >
                {trans}
              </Text>
            )}
          </Text>
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
          <Text selectable style={{ width: "100%" }}>
            {showPali && root && (
              <Text
                style={[
                  styles.bodyText,
                  styles.paliText,
                  {
                    color: colors.textPali,
                    fontSize: fontSize - 1.5,
                    lineHeight: (fontSize - 1.5) * 1.5,
                  },
                ]}
              >
                {root}
                {trans ? "\n" : ""}
              </Text>
            )}
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
                  <Text
                    onPress={() => onCommentPress(comment)}
                    style={[
                      styles.commentAsterisk,
                      { color: colors.primary, fontSize: fontSize * 1.2 },
                    ]}
                  >
                    *
                  </Text>
                )}
              </Text>
            )}
          </Text>
        </View>
      </View>
    );
  },
);

SegmentItem.displayName = "SegmentItem";

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
    paddingBottom: spacing.huge * 3,
    paddingHorizontal: spacing.xl,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginVertical: spacing.md,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  headerSegment: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    alignItems: "center",
    marginBottom: spacing.xl,
    width: "100%",
  },
  collectionTitle: {
    fontFamily: SERIF_FONT,
    fontWeight: "600",
    letterSpacing: 2.0,
    opacity: 0.7,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  mainTitle: {
    fontFamily: SERIF_FONT,
    fontWeight: "400",
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: SERIF_FONT,
    fontStyle: "italic",
    opacity: 0.8,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  headerPali: {
    fontStyle: "italic",
    marginTop: spacing.xs,
    opacity: 0.95,
    textAlign: "center",
  },
  bodySegment: {
    flexDirection: "row",
    paddingVertical: spacing.md,
  },
  segmentLeft: {
    width: 44,
    alignItems: "flex-start",
    paddingRight: spacing.sm,
    paddingTop: 4,
  },
  segmentNumber: {
    fontSize: 10,
    fontWeight: "400",
    opacity: 0.35,
  },
  segmentContent: {
    flex: 1,
  },
  bodyText: {
    fontFamily: SERIF_FONT,
  },
  paliText: {
    fontFamily: SERIF_FONT,
    fontStyle: "italic",
  },
  commentAsterisk: {
    fontWeight: "bold",
    paddingLeft: 2,
    lineHeight: 0,
  },
  iconBtn: {
    padding: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
