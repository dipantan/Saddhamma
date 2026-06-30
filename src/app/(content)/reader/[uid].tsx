import { LoadingState } from "@/components";
import {
  addReadingLog,
  checkBookmark,
  deleteSegmentAnnotation,
  getSuttaContent,
  getUserAnnotations,
  getUserNotes,
  loadSettings,
  saveSegmentAnnotation,
  saveSettings,
  saveUserNote,
  SegmentAnnotation,
  stripHtml,
  toggleBookmark,
} from "@/services/DataService";
import { radius, spacing, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Speech from "expo-speech";
import {
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Snackbar } from "react-native-snackbar";
export { CustomErrorBoundary as ErrorBoundary } from "@/components";

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

  // User Notes & Annotations
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [userAnnotations, setUserAnnotations] = useState<Record<string, SegmentAnnotation>>({});
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [editingNoteSegmentId, setEditingNoteSegmentId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isSuttaNoteExpanded, setIsSuttaNoteExpanded] = useState(false);

  // FlatList Ref
  const flatListRef = useRef<FlatList<any>>(null);

  // Text-To-Speech States
  const [isTtsActive, setIsTtsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTtsIndex, setCurrentTtsIndex] = useState<number>(0);
  const [pitch, setPitch] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Speech.Voice | null>(null);
  const [isVoicesModalVisible, setIsVoicesModalVisible] = useState(false);
  const [isTtsSettingsVisible, setIsTtsSettingsVisible] = useState(false);

  // sortedSegments needs to be declared before speakableItems so it can be accessed
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

  // Speakable items selector (English Translation text)
  const speakableItems = useMemo(() => {
    if (!data || !data.translation_text) return [];

    const items: { segId: string; text: string; index: number }[] = [];

    sortedSegments.forEach((segId, index) => {
      const isLegacy = segId.includes(":legacy:");
      let isHeader = false;
      let isTitle = false;
      let isCollection = false;

      if (isLegacy) {
        const parts = segId.split(":");
        const tag = parts[2];
        if (tag === "division") {
          isHeader = true;
          isCollection = true;
        } else if (tag === "h1") {
          isHeader = true;
          isTitle = true;
        } else if (tag === "h2" || tag === "h3") {
          isHeader = true;
        }
      } else {
        const segmentNum = segId.split(":")[1];
        isHeader = segmentNum?.startsWith("0.");
        if (isHeader) {
          isCollection = segmentNum === "0.1";
          isTitle = segmentNum === "0.2";
        }
      }

      const trans = data.translation_text[segId];
      if (trans && trans.trim()) {
        const cleanText = stripHtml(trans).trim();
        if (cleanText) {
          items.push({
            segId,
            text: cleanText,
            index,
          });
        }
      }
    });

    return items;
  }, [data, sortedSegments]);

  const currentPlayingSegId = useMemo(() => {
    if (!isTtsActive || currentTtsIndex < 0 || currentTtsIndex >= speakableItems.length) {
      return null;
    }
    return speakableItems[currentTtsIndex].segId;
  }, [isTtsActive, currentTtsIndex, speakableItems]);

  // Load voices available on device
  useEffect(() => {
    let isMounted = true;
    const fetchVoices = async () => {
      try {
        const availableVoices = await Speech.getAvailableVoicesAsync();
        if (!isMounted) return;
        const englishVoices = availableVoices.filter(
          (v) => v.language.toLowerCase().startsWith("en") || v.language.toLowerCase().includes("en")
        );
        englishVoices.sort((a, b) => a.name.localeCompare(b.name));
        setVoices(englishVoices);

        if (englishVoices.length > 0) {
          const defaultVoice = englishVoices.find((v) => v.quality === "Enhanced") || englishVoices[0];
          setSelectedVoice(defaultVoice);
        }
      } catch (err) {
        console.error("Error loading voices:", err);
      }
    };
    if (isTtsActive || data) {
      fetchVoices();
    }
    return () => {
      isMounted = false;
    };
  }, [isTtsActive, data]);

  useEffect(() => {
    return () => {
      Speech.stop().catch(err => console.error("Error stopping Speech on unmount:", err));
    };
  }, []);

  // Helper ref to avoid recursion ESLint warnings inside speakCurrentItem
  const speakCurrentItemRef = useRef<(index: number) => void>(() => {});

  const speakCurrentItem = useCallback(async (indexToSpeak: number) => {
    if (indexToSpeak < 0 || indexToSpeak >= speakableItems.length) {
      setIsPlaying(false);
      return;
    }

    const item = speakableItems[indexToSpeak];
    setCurrentTtsIndex(indexToSpeak);

    try {
      flatListRef.current?.scrollToIndex({
        index: item.index,
        animated: true,
        viewPosition: 0.3,
      });
    } catch (err) {
      console.warn("FlatList scrollToIndex failed:", err);
    }

    await Speech.stop();

    Speech.speak(item.text, {
      pitch,
      rate,
      voice: selectedVoice?.identifier,
      onDone: () => {
        speakCurrentItemRef.current(indexToSpeak + 1);
      },
      onStopped: () => {
      },
      onError: (err) => {
        console.error("Speech speak error:", err);
        setIsPlaying(false);
      },
    });
  }, [speakableItems, pitch, rate, selectedVoice]);

  // Keep ref updated
  useEffect(() => {
    speakCurrentItemRef.current = speakCurrentItem;
  }, [speakCurrentItem]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      await Speech.stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      speakCurrentItem(currentTtsIndex);
    }
  }, [isPlaying, currentTtsIndex, speakCurrentItem]);

  const handleNextSegment = useCallback(() => {
    if (currentTtsIndex < speakableItems.length - 1) {
      const nextIndex = currentTtsIndex + 1;
      setCurrentTtsIndex(nextIndex);
      if (isPlaying) {
        speakCurrentItem(nextIndex);
      } else {
        const item = speakableItems[nextIndex];
        try {
          flatListRef.current?.scrollToIndex({
            index: item.index,
            animated: true,
            viewPosition: 0.3,
          });
        } catch (err) {
          console.warn("FlatList scrollToIndex failed:", err);
        }
      }
    }
  }, [currentTtsIndex, speakableItems, isPlaying, speakCurrentItem]);

  const handlePrevSegment = useCallback(() => {
    if (currentTtsIndex > 0) {
      const prevIndex = currentTtsIndex - 1;
      setCurrentTtsIndex(prevIndex);
      if (isPlaying) {
        speakCurrentItem(prevIndex);
      } else {
        const item = speakableItems[prevIndex];
        try {
          flatListRef.current?.scrollToIndex({
            index: item.index,
            animated: true,
            viewPosition: 0.3,
          });
        } catch (err) {
          console.warn("FlatList scrollToIndex failed:", err);
        }
      }
    }
  }, [currentTtsIndex, speakableItems, isPlaying, speakCurrentItem]);

  const handleCloseTts = useCallback(async () => {
    await Speech.stop();
    setIsPlaying(false);
    setIsTtsActive(false);
  }, []);

  const handleActivateTts = useCallback(() => {
    setIsTtsActive(true);
    setIsPlaying(true);
    speakCurrentItem(0);
  }, [speakCurrentItem]);

  // Re-run segment speaker if settings change on the fly while playing
  useEffect(() => {
    if (isPlaying && isTtsActive) {
      speakCurrentItem(currentTtsIndex);
    }
  }, [selectedVoice, pitch, rate, isPlaying, isTtsActive, currentTtsIndex, speakCurrentItem]);

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

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Loading timed out. You may be offline or network connection is slow.")), 7000)
    );

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
      const result = await Promise.race([getSuttaContent(uid), timeoutPromise]) as any;
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

        // Load user notes and annotations
        const notes = await getUserNotes();
        const annotations = await getUserAnnotations();
        if (isMounted) {
          setUserNotes(notes);
          setUserAnnotations(annotations);
        }
      }
    } catch (err: any) {
      console.error("Reader init error:", err);
      if (isMounted) {
        setError(err?.message || "An unexpected error occurred while loading the sutta.");
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
  }, [menuExpanded, selectedComment, activeSegmentId, editingNoteSegmentId, router]);

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

  const handleShareEntireSutta = async () => {
    if (!data) return;
    try {
      let textToShare = "";

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

      if (acronym) textToShare += `${acronym}\n`;
      if (transTitle) textToShare += `${stripHtml(transTitle)}\n`;
      if (rootTitle) textToShare += `${stripHtml(rootTitle)}\n`;
      textToShare += "\n";

      sortedSegments.forEach((segId) => {
        const isHeader = segId.includes(":legacy:")
          ? (segId.split(":")[2] === "division" || segId.split(":")[2] === "h1" || segId.split(":")[2] === "h2" || segId.split(":")[2] === "h3")
          : segId.split(":")[1]?.startsWith("0.");

        if (isHeader) return;

        const rootLine = data?.root_text?.[segId];
        const transLine = data?.translation_text?.[segId];

        if (showPali && rootLine) {
          textToShare += `${stripHtml(rootLine)}\n`;
        }
        if (transLine) {
          textToShare += `${stripHtml(transLine)}\n`;
        }
        if ((showPali && rootLine) || transLine) {
          textToShare += "\n";
        }
      });

      setMenuExpanded(false);
      await Share.share({
        title: `${acronym || uid}: ${stripHtml(transTitle || "")}`,
        message: textToShare.trim(),
      });
    } catch (e) {
      console.error(e);
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
        annotation={userAnnotations[segId]}
        userNote={userNotes[segId]}
        onSegmentPress={setActiveSegmentId}
        authorUid={data?.author_uid}
        isPlaying={segId === currentPlayingSegId}
      />
    ),
    [data, colors, fontSize, showPali, showTranslation, showSegments, showComments, hasTranslation, userAnnotations, userNotes, currentPlayingSegId],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: title || uid?.toUpperCase() || "Reader",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={async () => {
                  const getBestTitle = (textMap: any) => {
                    if (!textMap) return "";
                    const keys = Object.keys(textMap);
                    if (keys.length === 0) return "";
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
            </View>
          ),
        }}
      />

      {loading ? (
        <LoadingState message="Loading Dhamma…" />
      ) : error || !data ? (
        <View
          style={[
            styles.container,
            styles.center,
            { backgroundColor: colors.background },
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
      ) : (
        <FlatList
          ref={flatListRef}
          data={sortedSegments}
          renderItem={renderSegment}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.listContent}
          extraData={currentPlayingSegId}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.highestMeasuredFrameIndex * 120,
              animated: false,
            });
            setTimeout(() => {
              try {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.3 });
              } catch (e) {
                console.warn("Failed to retry scrollToIndex:", e);
              }
            }, 100);
          }}
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
            {showComments && userNotes[uid] && (
              <View style={[styles.suttaNoteCard, { backgroundColor: colors.primary + "0A", borderColor: colors.primary + "30" }]}>
                <View style={styles.suttaNoteHeader}>
                  <Pressable
                    onPress={() => setIsSuttaNoteExpanded(!isSuttaNoteExpanded)}
                    style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="journal-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.suttaNoteHeaderTitle, { color: colors.primary, marginRight: 6 }]}>Sutta Reflection Note</Text>
                    <Ionicons
                      name={isSuttaNoteExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.primary}
                    />
                  </Pressable>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Pressable
                      onPress={() => {
                        setNoteText(userNotes[uid]);
                        setEditingNoteSegmentId(uid);
                      }}
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
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
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
                {isSuttaNoteExpanded && (
                  <Text style={[styles.suttaNoteText, { color: colors.textPrimary, fontSize: Math.max(13, fontSize - 4), marginTop: spacing.xs }]}>
                    {userNotes[uid]}
                  </Text>
                )}
              </View>
            )}
          </View>
        }
      />
      )}

      {selectedComment && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedComment(null)}
        >
          <Pressable style={styles.sheetOverlay} onPress={() => setSelectedComment(null)}>
            <Pressable style={[styles.sheetContent, { backgroundColor: colors.surface }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Note / Commentary</Text>
                <Pressable onPress={() => setSelectedComment(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
              <View style={{ maxHeight: 300, marginVertical: spacing.md }}>
                <Text style={[styles.commentText, { color: colors.textPrimary, fontSize: Math.max(13, fontSize - 1) }]}>
                  {stripHtml(selectedComment)}
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {activeSegmentId && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setActiveSegmentId(null)}
        >
          <Pressable style={styles.sheetOverlay} onPress={() => setActiveSegmentId(null)}>
            <Pressable style={[styles.sheetContent, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Segment Actions</Text>
                <Pressable onPress={() => setActiveSegmentId(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={[styles.sheetSubLabel, { color: colors.textSecondary }]}>HIGHLIGHT COLOR</Text>

              <View style={styles.colorPaletteRow}>
                {[
                  { name: "Yellow", color: "#FFB300", textColor: "#000000", id: "yellow" },
                  { name: "Green", color: "#4CAF50", textColor: "#FFFFFF", id: "green" },
                  { name: "Blue", color: "#2196F3", textColor: "#FFFFFF", id: "blue" },
                  { name: "Purple", color: "#9C27B0", textColor: "#FFFFFF", id: "purple" },
                ].map((item) => {
                  const isSelected = userAnnotations[activeSegmentId]?.color === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.colorChip,
                        {
                          backgroundColor: item.color,
                          opacity: pressed ? 0.7 : 1,
                          flexDirection: "row",
                          gap: 4,
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: colors.textPrimary,
                        }
                      ]}
                      onPress={async () => {
                        try {
                          const updated = await saveSegmentAnnotation(activeSegmentId, item.id as "yellow" | "green" | "blue" | "purple", userAnnotations[activeSegmentId]?.note || userNotes[activeSegmentId]);
                          setUserAnnotations(updated);
                        } catch (err) {
                          console.error("Error saving annotation:", err);
                        } finally {
                          setActiveSegmentId(null);
                        }
                      }}
                    >
                      {isSelected && <Ionicons name="checkmark" size={14} color={item.textColor} />}
                      <Text style={[styles.colorChipText, { color: item.textColor }]}>{item.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sheetSubLabel, { color: colors.textSecondary, marginTop: spacing.sm }]}>ACTIONS</Text>

              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.sheetActionBtn,
                      { backgroundColor: colors.surfaceVariant, opacity: pressed ? 0.8 : 1, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" }
                    ]}
                    onPress={async () => {
                      try {
                        const rootLine = data?.root_text?.[activeSegmentId] || "";
                        const transLine = data?.translation_text?.[activeSegmentId] || "";
                        let shareVal = "";
                        if (rootLine) shareVal += `${stripHtml(rootLine)}\n`;
                        if (transLine) shareVal += `${stripHtml(transLine)}`;
                        setActiveSegmentId(null);
                        await Share.share({
                          message: shareVal.trim(),
                        });
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  >
                    <Ionicons name="share-social-outline" size={18} color={colors.textPrimary} />
                    <Text style={[styles.sheetActionBtnText, { color: colors.textPrimary }]}>Share Segment</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.sheetActionBtn,
                      { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" }
                    ]}
                    onPress={() => {
                      const currentNote = userAnnotations[activeSegmentId]?.note || userNotes[activeSegmentId] || "";
                      setNoteText(currentNote);
                      setEditingNoteSegmentId(activeSegmentId);
                      setActiveSegmentId(null);
                    }}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.textInverse} />
                    <Text style={[styles.sheetActionBtnText, { color: colors.textInverse }]}>
                      {(userAnnotations[activeSegmentId]?.note || userNotes[activeSegmentId]) ? "Edit Note" : "Add Note"}
                    </Text>
                  </Pressable>
                </View>

                {(userAnnotations[activeSegmentId] || userAnnotations[activeSegmentId]?.note || userNotes[activeSegmentId]) && (
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    {userAnnotations[activeSegmentId] && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.sheetActionBtn,
                          { backgroundColor: colors.error + "1A", borderWidth: 1, borderColor: colors.error + "40", opacity: pressed ? 0.8 : 1, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center" }
                        ]}
                        onPress={async () => {
                          try {
                            const updated = await deleteSegmentAnnotation(activeSegmentId);
                            setUserAnnotations(updated);
                            Snackbar.show({
                              text: "Highlight removed",
                              duration: Snackbar.LENGTH_SHORT,
                            });
                          } catch (err) {
                            console.error("Error deleting annotation:", err);
                          } finally {
                            setActiveSegmentId(null);
                          }
                        }}
                      >
                        <Ionicons name="color-wand-outline" size={18} color={colors.error} />
                        <Text style={[styles.sheetActionBtnText, { color: colors.error }]}>Remove Highlight</Text>
                      </Pressable>
                    )}

                    {(userAnnotations[activeSegmentId]?.note || userNotes[activeSegmentId]) && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.sheetActionBtn,
                          { backgroundColor: colors.error + "1A", borderWidth: 1, borderColor: colors.error + "40", opacity: pressed ? 0.8 : 1, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center" }
                        ]}
                        onPress={async () => {
                          try {
                            await saveUserNote(activeSegmentId, "");
                            setUserNotes(prev => {
                              const updated = { ...prev };
                              delete updated[activeSegmentId];
                              return updated;
                            });
                            if (userAnnotations[activeSegmentId]) {
                              const updatedAnno = await saveSegmentAnnotation(
                                activeSegmentId,
                                userAnnotations[activeSegmentId].color,
                                ""
                              );
                              setUserAnnotations(updatedAnno);
                            }
                            Snackbar.show({
                              text: "Note deleted",
                              duration: Snackbar.LENGTH_SHORT,
                            });
                          } catch (err) {
                            console.error("Error deleting note:", err);
                          } finally {
                            setActiveSegmentId(null);
                          }
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                        <Text style={[styles.sheetActionBtnText, { color: colors.error }]}>Delete Note</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {editingNoteSegmentId && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditingNoteSegmentId(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
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
              <View style={[styles.modalButtons, { gap: spacing.xs }]}>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.surfaceVariant, flex: 1 }]}
                  onPress={() => setEditingNoteSegmentId(null)}
                >
                  <Text style={[styles.buttonText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                {(userNotes[editingNoteSegmentId] || userAnnotations[editingNoteSegmentId]?.note) && (
                  <Pressable
                    style={[styles.button, { backgroundColor: colors.error, flex: 1 }]}
                    onPress={async () => {
                      await saveUserNote(editingNoteSegmentId, "");
                      setUserNotes(prev => {
                        const updated = { ...prev };
                        delete updated[editingNoteSegmentId];
                        return updated;
                      });
                      if (userAnnotations[editingNoteSegmentId]) {
                        const updatedAnno = await saveSegmentAnnotation(
                          editingNoteSegmentId,
                          userAnnotations[editingNoteSegmentId].color,
                          ""
                        );
                        setUserAnnotations(updatedAnno);
                      }
                      Snackbar.show({
                        text: "Note deleted",
                        duration: Snackbar.LENGTH_SHORT,
                      });
                      setEditingNoteSegmentId(null);
                    }}
                  >
                    <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>Delete</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.button, { backgroundColor: colors.primary, flex: 1 }]}
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
                    if (userAnnotations[editingNoteSegmentId]) {
                      const updatedAnno = await saveSegmentAnnotation(
                        editingNoteSegmentId,
                        userAnnotations[editingNoteSegmentId].color,
                        noteText
                      );
                      setUserAnnotations(updatedAnno);
                    }
                    setEditingNoteSegmentId(null);
                  }}
                >
                  <Text style={[styles.buttonText, { color: colors.textInverse }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {menuExpanded && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setMenuExpanded(false)}
        >
          <Pressable style={styles.sheetOverlay} onPress={() => setMenuExpanded(false)}>
            <Pressable style={[styles.menuModalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Reader Options</Text>
                <Pressable onPress={() => setMenuExpanded(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Display Mode options */}
                <Text style={[styles.sheetSubLabel, { color: colors.textSecondary }]}>DISPLAY MODE</Text>
                {[
                  { label: "Bilingual (EN + Pāli)", mode: "bilingual" },
                  { label: "English Only", mode: "en" },
                  { label: `${getLanguageName(resolvedRootLang)} Only`, mode: "pli" },
                ].map((item) => (
                  <Pressable
                    key={item.mode}
                    style={({ pressed }) => [
                      styles.menuOptionRow,
                      { opacity: pressed ? 0.7 : 1 }
                    ]}
                    onPress={() => setDisplayMode(item.mode as any)}
                  >
                    <Ionicons
                      name={displayMode === item.mode ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={displayMode === item.mode ? colors.primary : colors.textTertiary}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>{item.label}</Text>
                  </Pressable>
                ))}

                <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />

                {/* Toggles */}
                <Text style={[styles.sheetSubLabel, { color: colors.textSecondary }]}>VIEW OPTIONS</Text>
                <Pressable
                  style={({ pressed }) => [styles.menuOptionRow, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => setShowSegments(!showSegments)}
                >
                  <Ionicons
                    name={showSegments ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={showSegments ? colors.primary : colors.textTertiary}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>Segment Numbers</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.menuOptionRow, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => setShowComments(!showComments)}
                >
                  <Ionicons
                    name={showComments ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={showComments ? colors.primary : colors.textTertiary}
                    style={{ marginRight: 12 }}
                  />
                  <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>Notes & Comments</Text>
                </Pressable>

                <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />

                {/* Sutta Actions */}
                <Pressable
                  style={({ pressed }) => [styles.menuOptionRow, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={handleShareEntireSutta}
                >
                  <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>Share Sutta</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.menuOptionRow, { opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => {
                    setNoteText(userNotes[uid] || "");
                    setEditingNoteSegmentId(uid);
                    setMenuExpanded(false);
                  }}
                >
                  <Ionicons name="journal-outline" size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>
                    {userNotes[uid] ? "Edit Sutta Notes" : "Add Sutta Notes"}
                  </Text>
                </Pressable>

                <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />

                {/* Font Size */}
                <Text style={[styles.sheetSubLabel, { color: colors.textSecondary }]}>FONT SIZE</Text>
                <View style={styles.fontSizeControlsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.fontAdjustBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                    onPress={() => setFontSize(Math.max(12, fontSize - 2))}
                  >
                    <Text style={styles.fontAdjustBtnText}>A-</Text>
                  </Pressable>
                  <Text style={[styles.fontSizeVal, { color: colors.textPrimary }]}>{fontSize}</Text>
                  <Pressable
                    style={({ pressed }) => [styles.fontAdjustBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                    onPress={() => setFontSize(Math.min(32, fontSize + 2))}
                  >
                    <Text style={styles.fontAdjustBtnText}>A+</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Text-to-Speech FAB Button */}
      {!isTtsActive && !loading && !error && data && speakableItems.length > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.ttsFab,
            {
              backgroundColor: colors.primary,
              bottom: insets.bottom + spacing.lg,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleActivateTts}
        >
          <Ionicons name="volume-medium-outline" size={24} color={colors.textInverse} />
        </Pressable>
      )}

      {/* Floating Audio Controller Panel */}
      {isTtsActive && (
        <View
          style={[
            styles.ttsControllerPanel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
            },
          ]}
        >
          <View style={styles.ttsHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="headset-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.ttsProgressText, { color: colors.textSecondary }]}>
                Segment {currentTtsIndex + 1} of {speakableItems.length}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable
                onPress={() => setIsTtsSettingsVisible(!isTtsSettingsVisible)}
                hitSlop={10}
              >
                <Ionicons
                  name={isTtsSettingsVisible ? "options" : "options-outline"}
                  size={20}
                  color={isTtsSettingsVisible ? colors.primary : colors.textSecondary}
                />
              </Pressable>
              <Pressable onPress={handleCloseTts} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Settings Sub-Panel for Pitch, Speed & Voice */}
          {isTtsSettingsVisible && (
            <View style={[styles.ttsSettingsPanel, { borderTopColor: colors.divider }]}>
              {/* Pitch Controls */}
              <View style={styles.ttsSettingRow}>
                <Text style={[styles.ttsSettingLabel, { color: colors.textSecondary }]}>Pitch</Text>
                <View style={styles.ttsValueAdjuster}>
                  <Pressable
                    style={[styles.ttsStepBtn, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => setPitch(prev => Math.max(0.5, parseFloat((prev - 0.1).toFixed(1))))}
                  >
                    <Text style={[styles.ttsStepBtnText, { color: colors.textPrimary }]}>-</Text>
                  </Pressable>
                  <Text style={[styles.ttsValueText, { color: colors.textPrimary }]}>{pitch.toFixed(1)}x</Text>
                  <Pressable
                    style={[styles.ttsStepBtn, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => setPitch(prev => Math.min(2.0, parseFloat((prev + 0.1).toFixed(1))))}
                  >
                    <Text style={[styles.ttsStepBtnText, { color: colors.textPrimary }]}>+</Text>
                  </Pressable>
                </View>
              </View>

              {/* Speed/Rate Controls */}
              <View style={styles.ttsSettingRow}>
                <Text style={[styles.ttsSettingLabel, { color: colors.textSecondary }]}>Speed</Text>
                <View style={styles.ttsValueAdjuster}>
                  <Pressable
                    style={[styles.ttsStepBtn, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => setRate(prev => Math.max(0.5, parseFloat((prev - 0.1).toFixed(1))))}
                  >
                    <Text style={[styles.ttsStepBtnText, { color: colors.textPrimary }]}>-</Text>
                  </Pressable>
                  <Text style={[styles.ttsValueText, { color: colors.textPrimary }]}>{rate.toFixed(1)}x</Text>
                  <Pressable
                    style={[styles.ttsStepBtn, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => setRate(prev => Math.min(2.0, parseFloat((prev + 0.1).toFixed(1))))}
                  >
                    <Text style={[styles.ttsStepBtnText, { color: colors.textPrimary }]}>+</Text>
                  </Pressable>
                </View>
              </View>

              {/* Voice Selector Row */}
              <View style={styles.ttsSettingRow}>
                <Text style={[styles.ttsSettingLabel, { color: colors.textSecondary }]}>Voice</Text>
                <Pressable
                  style={[styles.ttsVoiceBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                  onPress={() => setIsVoicesModalVisible(true)}
                >
                  <Text style={[styles.ttsVoiceBtnText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {selectedVoice ? selectedVoice.name : "System Default"}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Primary Controls Row */}
          <View style={[styles.ttsControlsRow, isTtsSettingsVisible && { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
            <Pressable
              style={({ pressed }) => [
                styles.ttsControlBtn,
                { opacity: currentTtsIndex === 0 || pressed ? 0.5 : 1 }
              ]}
              disabled={currentTtsIndex === 0}
              onPress={handlePrevSegment}
            >
              <Ionicons name="play-skip-back" size={24} color={colors.textPrimary} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.ttsPlayBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }
              ]}
              onPress={handlePlayPause}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={28}
                color={colors.textInverse}
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.ttsControlBtn,
                { opacity: currentTtsIndex === speakableItems.length - 1 || pressed ? 0.5 : 1 }
              ]}
              disabled={currentTtsIndex === speakableItems.length - 1}
              onPress={handleNextSegment}
            >
              <Ionicons name="play-skip-forward" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Voice Selection Modal */}
      {isVoicesModalVisible && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsVoicesModalVisible(false)}
        >
          <Pressable style={styles.sheetOverlay} onPress={() => setIsVoicesModalVisible(false)}>
            <Pressable style={[styles.menuModalContent, { backgroundColor: colors.surface, maxHeight: "50%" }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Select English Voice</Text>
                <Pressable onPress={() => setIsVoicesModalVisible(false)} hitSlop={10}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              {voices.length === 0 ? (
                <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
                  <Text style={{ color: colors.textSecondary }}>No English voices found on device.</Text>
                </View>
              ) : (
                <FlatList
                  data={voices}
                  keyExtractor={(item) => item.identifier}
                  renderItem={({ item }) => {
                    const isSelected = selectedVoice?.identifier === item.identifier;
                    const lang = item.language.toLowerCase();
                    let flag = "🌐";
                    let country = "EN";
                    if (lang.includes("us")) { flag = "🇺🇸"; country = "US"; }
                    else if (lang.includes("gb") || lang.includes("uk")) { flag = "🇬🇧"; country = "UK"; }
                    else if (lang.includes("au")) { flag = "🇦🇺"; country = "AU"; }
                    else if (lang.includes("in")) { flag = "🇮🇳"; country = "IN"; }
                    else if (lang.includes("ca")) { flag = "🇨🇦"; country = "CA"; }
                    else if (lang.includes("ie")) { flag = "🇮🇪"; country = "IE"; }
                    else if (lang.includes("za")) { flag = "🇿🇦"; country = "ZA"; }

                    return (
                      <Pressable
                        style={({ pressed }) => [
                          styles.menuOptionRow,
                          {
                            opacity: pressed ? 0.7 : 1,
                            backgroundColor: isSelected ? colors.primary + "12" : "transparent",
                            borderRadius: radius.md,
                            paddingHorizontal: spacing.sm,
                            marginVertical: 2,
                          }
                        ]}
                        onPress={() => {
                          setSelectedVoice(item);
                          setIsVoicesModalVisible(false);
                        }}
                      >
                        <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{flag}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.menuOptionText, { color: colors.textPrimary, fontWeight: isSelected ? "700" : "400" }]}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                            {country} ({item.language}) {item.quality && `• ${item.quality}`}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color={colors.primary} />
                        )}
                      </Pressable>
                    );
                  }}
                  contentContainerStyle={{ paddingBottom: spacing.xl }}
                />
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
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
  annotation?: SegmentAnnotation;
  userNote?: string;
  onSegmentPress: (segId: string) => void;
  authorUid?: string;
  isPlaying?: boolean;
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
    annotation,
    userNote,
    onSegmentPress,
    authorUid,
    isPlaying = false,
  }: SegmentItemProps) => {
    const [isNoteExpanded, setIsNoteExpanded] = useState(false);
    const isLegacy = segId.includes(":legacy:");
    let isHeader = false;
    let isCollection = false;
    let isTitle = false;
    let isSubtitle = false;
    let segmentNum = segId.split(":")[1];

    const isDark = colors.background === "#121212" || colors.background === "#000000";

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
      return (
        <View
          style={[
            styles.headerSegment,
            isPlaying && {
              backgroundColor: isDark ? "rgba(32, 138, 239, 0.15)" : "rgba(32, 138, 239, 0.08)",
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            }
          ]}
        >
          <Text style={{ textAlign: "center", width: "100%" }}>
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

    const getHighlightBg = (colorName?: string) => {
      switch (colorName) {
        case "green": return isDark ? "#0D3316" : "#E8F5E9";
        case "blue": return isDark ? "#0A243A" : "#E3F2FD";
        case "purple": return isDark ? "#280A33" : "#F3E5F5";
        case "yellow":
        default: return isDark ? "#382705" : "#FFF8E1";
      }
    };

    const getHighlightAccent = (colorName?: string) => {
      switch (colorName) {
        case "green": return "#4CAF50";
        case "blue": return "#2196F3";
        case "purple": return "#9C27B0";
        case "yellow":
        default: return "#FFB300";
      }
    };

    const highlightBg = annotation ? getHighlightBg(annotation.color) : undefined;
    const activeNoteText = annotation?.note || userNote;
    const cardAccentColor = annotation ? getHighlightAccent(annotation.color) : colors.primary;

    return (
      <Pressable
        onLongPress={() => onSegmentPress(segId)}
        delayLongPress={300}
        style={({ pressed }) => [
          styles.bodySegment,
          {
            backgroundColor: isPlaying
              ? (isDark ? "rgba(32, 138, 239, 0.18)" : "rgba(32, 138, 239, 0.1)")
              : (highlightBg ? highlightBg : (pressed ? colors.surfaceVariant : "transparent")),
            borderLeftWidth: isPlaying ? 4 : 0,
            borderLeftColor: colors.primary,
            paddingLeft: isPlaying ? spacing.sm - 4 : spacing.sm,
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
              </Text>
            )}
          </Text>

          {showComments && comment && (
            <Pressable
              onPress={() => onCommentPress(comment)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [
                styles.commentIconBtn,
                {
                  backgroundColor: colors.primary + "1A",
                  borderColor: colors.primary + "35",
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            </Pressable>
          )}

          {showComments && activeNoteText && (
            <View style={[styles.userNoteContainer, { backgroundColor: cardAccentColor + "15", borderColor: cardAccentColor + "40" }]}>
              <Pressable
                onPress={() => setIsNoteExpanded(!isNoteExpanded)}
                style={styles.userNoteHeader}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Ionicons name="create-outline" size={14} color={cardAccentColor} style={{ marginRight: 6 }} />
                  <Text style={[styles.userNoteHeaderText, { color: cardAccentColor }]}>Annotation Note</Text>
                </View>
                <Ionicons
                  name={isNoteExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={cardAccentColor}
                />
              </Pressable>
              {isNoteExpanded && (
                <Text style={[styles.userNoteText, { color: colors.textPrimary, fontSize: Math.max(12, fontSize - 2), marginTop: 4 }]}>
                  {activeNoteText}
                </Text>
              )}
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
  commentIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sheetSubLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  commentText: {
    lineHeight: 22,
  },
  colorPaletteRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  colorChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  colorChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sheetActionRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  sheetActionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetActionBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  menuModalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: "80%",
  },
  menuOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  dividerLine: {
    height: 1,
    marginVertical: spacing.md,
  },
  fontSizeControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  fontAdjustBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  fontAdjustBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  fontSizeVal: {
    fontSize: 18,
    fontWeight: "700",
    minWidth: 40,
    textAlign: "center",
  },
  ttsFab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4.65,
    zIndex: 99,
  },
  ttsControllerPanel: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.md,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderWidth: 1,
    zIndex: 99,
  },
  ttsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  ttsProgressText: {
    fontSize: 12,
    fontWeight: "600",
  },
  ttsSettingsPanel: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  ttsSettingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ttsSettingLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  ttsValueAdjuster: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ttsStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ttsStepBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  ttsValueText: {
    fontSize: 13,
    fontWeight: "600",
    minWidth: 36,
    textAlign: "center",
  },
  ttsVoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 140,
    maxWidth: 200,
  },
  ttsVoiceBtnText: {
    fontSize: 12,
    fontWeight: "500",
    marginRight: 4,
    flex: 1,
  },
  ttsControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xxl,
    marginVertical: spacing.xs,
  },
  ttsControlBtn: {
    padding: spacing.sm,
  },
  ttsPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
});

