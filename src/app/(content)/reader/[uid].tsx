import { LoadingState } from "@/components";
import {
  checkBookmark,
  getSuttaContent,
  loadSettings,
  saveSettings,
  stripHtml,
  toggleBookmark,
  getUserNotes,
  saveUserNote,
  getUserHighlights,
  toggleUserHighlight,
  addReadingLog,
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
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Snackbar } from "react-native-snackbar";

const SERIF_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

const isDuplicateText = (str1?: string, str2?: string): boolean => {
  if (!str1 || !str2) return false;
  // Normalize string by trimming, removing spaces, periods, brackets, parentheses,
  // and converting all varieties of dashes to a standard hyphen.
  const clean = (s: string) => {
    return s.trim()
      .toLowerCase()
      .replace(/[\s.\[\]\(\)]/g, "")
      .replace(/[\u2013\u2014-]/g, "-");
  };
  const s1 = clean(str1);
  const s2 = clean(str2);
  if (s1 === s2) return true;
  
  // Match range numbers (e.g. 1-10) or single numbers (e.g. 5)
  const isNumericOrRange = (s: string) => /^\d+(-\d+)*$/.test(s);
  if (isNumericOrRange(s1) && isNumericOrRange(s2)) {
    return true;
  }
  return false;
};

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

const formatAuthorName = (uid?: string): string => {
  if (!uid) return "";
  const code = uid.toLowerCase().trim();
  switch (code) {
    case "sujato":
      return "Bhikkhu Sujato";
    case "bodhi":
      return "Bhikkhu Bodhi";
    case "brahmali":
      return "Bhikkhu Brahmali";
    case "thanissaro":
      return "Thanissaro Bhikkhu";
    case "anandajoti":
      return "Bhikkhu Ānandajoti";
    case "soma":
      return "Soma Thera";
    case "nanamoli":
      return "Bhikkhu Ñāṇamoli";
    case "nyanaponika":
      return "Nyanaponika Thera";
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
  const [displayMode, setDisplayMode] = useState<"en" | "pli" | "bilingual">("bilingual");
  const [showSegments, setShowSegments] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [fontSize, setFontSize] = useState(19);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const showPali = displayMode === "pli" || displayMode === "bilingual";
  const showTranslation = displayMode === "en" || displayMode === "bilingual";

  // User Notes & Highlights
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [userHighlights, setUserHighlights] = useState<string[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [editingNoteSegmentId, setEditingNoteSegmentId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

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
        if (saved.displayMode !== undefined) {
          setDisplayMode(saved.displayMode);
        } else if (saved.showPali !== undefined) {
          setDisplayMode(saved.showPali ? "bilingual" : "en");
        }
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

        // Log to reading history
        const getBestTitle = (textMap: any) => {
          if (!textMap) return "";
          const keys = Object.keys(textMap);
          if (keys.length === 0) return "";
          const suttaNameKey = keys.find((k) => k.endsWith(":0.2"));
          const firstKey = keys[0];
          return textMap[suttaNameKey || firstKey] || "";
        };
        const transTitle = getBestTitle(result?.translation_text) || title || uid;
        addReadingLog(uid, stripHtml(transTitle)).catch(err => 
          console.error("Error logging reading history:", err)
        );

        // Load user notes and highlights
        const notes = await getUserNotes();
        const highlights = await getUserHighlights();
        if (isMounted) {
          setUserNotes(notes);
          setUserHighlights(highlights);
        }
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
  }, [uid, title]);

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
      saveSettings({ displayMode, showSegments, showComments, fontSize });
    }
  }, [displayMode, showSegments, showComments, fontSize]);

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
      if (activeSegmentId) {
        setActiveSegmentId(null);
        return true;
      }
      if (editingNoteSegmentId) {
        setEditingNoteSegmentId(null);
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
        showTranslation={showTranslation}
        showSegments={showSegments}
        showComments={showComments}
        onCommentPress={setSelectedComment}
        isHighlighted={userHighlights.includes(segId)}
        isSuttaHighlighted={userHighlights.includes(uid)}
        userNote={userNotes[segId]}
        onSegmentPress={setActiveSegmentId}
        authorUid={data?.author_uid}
      />
    ),
    [data, colors, fontSize, showPali, showTranslation, showSegments, showComments, hasTranslation, userHighlights, userNotes, uid],
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
                      <DropdownMenuItem onClick={() => setDisplayMode(showPali ? "en" : "bilingual")}>
                        <DropdownMenuItem.LeadingIcon>
                          <Checkbox
                            value={showPali}
                            onCheckedChange={(checked) => setDisplayMode(checked ? "bilingual" : "en")}
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

                      <DropdownMenuItem onClick={async () => {
                        const highlighted = await toggleUserHighlight(uid);
                        setUserHighlights(prev =>
                          highlighted ? [...prev, uid] : prev.filter(h => h !== uid)
                        );
                        setMenuExpanded(false);
                      }}>
                        <DropdownMenuItem.LeadingIcon>
                          <Ionicons
                            name={userHighlights.includes(uid) ? "star" : "star-outline"}
                            size={20}
                            color={userHighlights.includes(uid) ? "#FFD700" : colors.textPrimary}
                          />
                        </DropdownMenuItem.LeadingIcon>
                        <DropdownMenuItem.Text>
                          <NativeText
                            color={colors.textPrimary}
                            style={{ typography: "bodyLarge" }}
                          >
                            {userHighlights.includes(uid) ? "Remove Highlight" : "Highlight Sutta"}
                          </NativeText>
                        </DropdownMenuItem.Text>
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => {
                        setNoteText(userNotes[uid] || "");
                        setEditingNoteSegmentId(uid);
                        setMenuExpanded(false);
                      }}>
                        <DropdownMenuItem.LeadingIcon>
                          <Ionicons
                            name="journal-outline"
                            size={20}
                            color={colors.textPrimary}
                          />
                        </DropdownMenuItem.LeadingIcon>
                        <DropdownMenuItem.Text>
                          <NativeText
                            color={colors.textPrimary}
                            style={{ typography: "bodyLarge" }}
                          >
                            {userNotes[uid] ? "Edit Sutta Notes" : "Add Sutta Notes"}
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
            <View>
              {!hasTranslation && data && (
                <View style={[styles.infoBanner, { backgroundColor: colors.surfaceVariant, borderColor: colors.divider }]}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                  <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
                    No English translation is available for this text. Showing {getLanguageName(resolvedRootLang)} root text.
                  </Text>
                </View>
              )}
              {isLegacyTranslation && (
                <View style={[styles.infoBanner, { backgroundColor: colors.surfaceVariant, borderColor: colors.divider }]}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                  <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
                    This is a legacy, non-aligned translation by {data?.author_uid ? data.author_uid.charAt(0).toUpperCase() + data.author_uid.slice(1) : "author"}. {getLanguageName(resolvedRootLang)} and English texts are shown independently.
                  </Text>
                </View>
              )}
              {userNotes[uid] && (
                <View style={[styles.suttaNoteCard, { backgroundColor: colors.primary + "0A", borderColor: colors.primary + "30" }]}>
                  <View style={styles.suttaNoteHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="journal-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.suttaNoteHeaderTitle, { color: colors.primary }]}>Sutta Reflection Note</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Pressable 
                        onPress={() => {
                          setNoteText(userNotes[uid]);
                          setEditingNoteSegmentId(uid);
                        }}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      >
                        <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable 
                        onPress={async () => {
                          await saveUserNote(uid, "");
                          setUserNotes(prev => {
                            const updated = { ...prev };
                            delete updated[uid];
                            return updated;
                          });
                        }}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                  <Text style={[styles.suttaNoteText, { color: colors.textPrimary, fontSize: Math.max(13, fontSize - 4) }]}>
                    {userNotes[uid]}
                  </Text>
                </View>
              )}
            </View>
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

      {activeSegmentId && (
        <ModalBottomSheet
          onDismissRequest={() => setActiveSegmentId(null)}
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
              Segment Action
            </NativeText>
            
            <Row
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth(), padding(0, 0, 0, 16)]}
            >
              <Button
                colors={{ containerColor: colors.primary }}
                onClick={async () => {
                  const highlighted = await toggleUserHighlight(activeSegmentId);
                  setUserHighlights(prev =>
                    highlighted ? [...prev, activeSegmentId] : prev.filter(h => h !== activeSegmentId)
                  );
                  setActiveSegmentId(null);
                }}
                modifiers={[fillMaxWidth().weight(1)]}
              >
                <NativeText
                  color={colors.surface}
                  style={{ typography: "labelLarge" }}
                >
                  {userHighlights.includes(activeSegmentId) ? "Unhighlight" : "Highlight"}
                </NativeText>
              </Button>

              <Button
                colors={{ containerColor: colors.primary }}
                onClick={() => {
                  setNoteText(userNotes[activeSegmentId] || "");
                  setEditingNoteSegmentId(activeSegmentId);
                  setActiveSegmentId(null);
                }}
                modifiers={[fillMaxWidth().weight(1)]}
              >
                <NativeText
                  color={colors.surface}
                  style={{ typography: "labelLarge" }}
                >
                  {userNotes[activeSegmentId] ? "Edit Note" : "Add Note"}
                </NativeText>
              </Button>
            </Row>

            <Row
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth()]}
            >
              <Button
                colors={{ containerColor: colors.surfaceVariant }}
                onClick={async () => {
                  try {
                    const rootLine = data?.root_text?.[activeSegmentId] || "";
                    const transLine = data?.translation_text?.[activeSegmentId] || "";
                    let copyVal = "";
                    if (rootLine) copyVal += `${stripHtml(rootLine)}\n`;
                    if (transLine) copyVal += `${stripHtml(transLine)}`;
                    await Clipboard.setStringAsync(copyVal.trim());
                    Snackbar.show({
                      text: "Segment copied to clipboard",
                      duration: Snackbar.LENGTH_SHORT,
                    });
                  } catch (e) {
                    console.error(e);
                  }
                  setActiveSegmentId(null);
                }}
                modifiers={[fillMaxWidth().weight(1)]}
              >
                <NativeText
                  color={colors.textPrimary}
                  style={{ typography: "labelLarge" }}
                >
                  Copy Text
                </NativeText>
              </Button>

              {userNotes[activeSegmentId] && (
                <Button
                  colors={{ containerColor: "#FF3B30" }}
                  onClick={async () => {
                    await saveUserNote(activeSegmentId, "");
                    setUserNotes(prev => {
                      const updated = { ...prev };
                      delete updated[activeSegmentId];
                      return updated;
                    });
                    setActiveSegmentId(null);
                  }}
                  modifiers={[fillMaxWidth().weight(1)]}
                >
                  <NativeText
                    color={colors.surface}
                    style={{ typography: "labelLarge" }}
                  >
                    Delete Note
                  </NativeText>
                </Button>
              )}
            </Row>
          </Column>
        </ModalBottomSheet>
      )}

      {editingNoteSegmentId && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditingNoteSegmentId(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {userNotes[editingNoteSegmentId] ? "Edit Note" : "Add Note"}
              </Text>
              <TextInput
                style={[styles.noteInput, {
                  color: colors.textPrimary,
                  borderColor: colors.divider,
                  backgroundColor: colors.background
                }]}
                multiline
                numberOfLines={4}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Write your personal Dhamma note here..."
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => setEditingNoteSegmentId(null)}
                >
                  <Text style={[styles.buttonText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    await saveUserNote(editingNoteSegmentId, noteText);
                    setUserNotes(prev => {
                      const updated = { ...prev };
                      if (noteText.trim()) {
                        updated[editingNoteSegmentId] = noteText;
                      } else {
                        delete updated[editingNoteSegmentId];
                      }
                      return updated;
                    });
                    setEditingNoteSegmentId(null);
                  }}
                >
                  <Text style={[styles.buttonText, { color: colors.textInverse }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
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
  showTranslation: boolean;
  showSegments: boolean;
  showComments: boolean;
  onCommentPress: (comment: string) => void;
  isHighlighted: boolean;
  isSuttaHighlighted: boolean;
  userNote?: string;
  onSegmentPress: (segId: string) => void;
  authorUid?: string;
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
    showTranslation,
    showSegments,
    showComments,
    onCommentPress,
    isHighlighted,
    isSuttaHighlighted,
    userNote,
    onSegmentPress,
    authorUid,
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

    const displayTrans = showTranslation ? trans : undefined;

    if (!displayTrans && (!showPali || !root)) return null;

    if (isHeader) {
      const suttaHighlightedBgColor = colors.background === "#121212" ? "#302202" : "#FFF8EB";
      const suttaHighlightedBorderColor = colors.primary + "60";
      return (
        <View 
          style={[
            styles.headerSegment,
            isTitle && isSuttaHighlighted && {
              backgroundColor: suttaHighlightedBgColor,
              borderColor: suttaHighlightedBorderColor,
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginHorizontal: -spacing.sm,
            }
          ]}
        >
          <Text selectable style={{ textAlign: "center", width: "100%" }}>
            {isTitle && isSuttaHighlighted && (
              <Text style={{ textAlign: "center" }}>
                <Ionicons name="star" size={18} color="#FFD700" />
                {"  "}
              </Text>
            )}
            {isCollection && displayTrans && (
              <Text
                style={[
                  styles.collectionTitle,
                  {
                    color: colors.textSecondary,
                    fontSize: Math.max(12, fontSize - 5),
                  },
                ]}
              >
                {displayTrans.toUpperCase()}
                {"\n"}
              </Text>
            )}
            {isTitle && displayTrans && (
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
                {displayTrans}
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
                {isSubtitle && displayTrans ? "\n" : ""}
              </Text>
            )}
            {isSubtitle && displayTrans && (
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
                {displayTrans}
              </Text>
            )}
            {isTitle && authorUid && (
              <Text
                style={[
                  styles.translatorText,
                  {
                    color: colors.textSecondary,
                    fontSize: Math.max(12, fontSize - 4),
                  },
                ]}
              >
                {"\n"}
                {`Translation by ${formatAuthorName(authorUid)}`}
              </Text>
            )}
          </Text>
        </View>
      );
    }

    const isDuplicate = isDuplicateText(root, displayTrans);
    const highlightBgColor = colors.background === "#121212" ? "#382705" : "#FFF7E6";

    return (
      <Pressable
        onPress={() => onSegmentPress(segId)}
        style={({ pressed }) => [
          styles.bodySegment,
          {
            backgroundColor: isHighlighted ? highlightBgColor : (pressed ? colors.surfaceVariant : "transparent"),
          }
        ]}
      >
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
          <Text selectable={false} style={{ width: "100%" }}>
            {showPali && root && !isDuplicate && (
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
                {displayTrans ? "\n" : ""}
              </Text>
            )}
            {displayTrans && (
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
                    onPress={(e) => {
                      e.stopPropagation();
                      onCommentPress(comment);
                    }}
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

          {userNote && (
            <View style={[styles.userNoteContainer, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <View style={styles.userNoteHeader}>
                <Ionicons name="create-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.userNoteHeaderText, { color: colors.primary }]}>My Note</Text>
              </View>
              <Text style={[styles.userNoteText, { color: colors.textPrimary, fontSize: Math.max(12, fontSize - 2) }]}>
                {userNote}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
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
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
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
  userNoteContainer: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  userNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  userNoteHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  userNoteText: {
    lineHeight: 18,
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
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  noteInput: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlignVertical: "top",
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  translatorText: {
    fontFamily: SERIF_FONT,
    fontStyle: "italic",
    opacity: 0.8,
    textAlign: "center",
  },
  suttaNoteCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginVertical: spacing.md,
  },
  suttaNoteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  suttaNoteHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suttaNoteText: {
    lineHeight: 19,
    fontStyle: "italic",
  },
});

