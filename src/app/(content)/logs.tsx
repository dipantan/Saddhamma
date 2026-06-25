import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  FlatList,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import { useTheme } from "@/theme";
import { spacing, radius } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import {
  getMeditationLogs,
  addMeditationLog,
  deleteMeditationLog,
  getGradualTrainingLogs,
  saveGradualTrainingLog,
  getReadingLogs,
  clearReadingLogs,
  deleteReadingLog,
  MeditationLog,
  GradualTrainingCheckIn,
  ReadingLog,
} from "@/services/DataService";
import { Snackbar } from "react-native-snackbar";

const SERIF_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

type TabType = "checkin" | "meditation" | "reading" | "badges";

export default function PracticeLogsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>("checkin");

  // Data States
  const [meditationLogs, setMeditationLogs] = useState<MeditationLog[]>([]);
  const [gradualLogs, setGradualLogs] = useState<Record<string, GradualTrainingCheckIn>>({});
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);

  // Daily Check-in date state
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Check-in Form States
  const [senseRestraint, setSenseRestraint] = useState(false);
  const [moderationEating, setModerationEating] = useState(false);
  const [wakefulness, setWakefulness] = useState(false);
  const [mindfulness, setMindfulness] = useState(false);
  const [precepts, setPrecepts] = useState(false);
  const [checkinNotes, setCheckinNotes] = useState("");

  // Manual Log Modal States
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  // Format date to local YYYY-MM-DD
  const formatDateString = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const syncFormForDate = useCallback((date: Date, allLogs: Record<string, GradualTrainingCheckIn>) => {
    const dateStr = formatDateString(date);
    const log = allLogs[dateStr];
    if (log) {
      setSenseRestraint(log.senseRestraint);
      setModerationEating(log.moderationEating);
      setWakefulness(log.wakefulness);
      setMindfulness(log.mindfulnessClearComprehension);
      setPrecepts(log.preceptsObserved);
      setCheckinNotes(log.notes || "");
    } else {
      setSenseRestraint(false);
      setModerationEating(false);
      setWakefulness(false);
      setMindfulness(false);
      setPrecepts(false);
      setCheckinNotes("");
    }
  }, []);

  const loadAllLogs = useCallback(async () => {
    try {
      const med = await getMeditationLogs();
      const grad = await getGradualTrainingLogs();
      const read = await getReadingLogs();
      setMeditationLogs(med);
      setGradualLogs(grad);
      setReadingLogs(read);
      syncFormForDate(selectedDate, grad);
    } catch (e) {
      console.error(e);
    }
  }, [selectedDate, syncFormForDate]);

  // Load logs when focused
  useFocusEffect(
    useCallback(() => {
      loadAllLogs();
    }, [loadAllLogs])
  );

  // Handle Save Check-in
  const handleSaveCheckin = async () => {
    const dateStr = formatDateString(selectedDate);
    const checkIn: GradualTrainingCheckIn = {
      date: dateStr,
      senseRestraint,
      moderationEating,
      wakefulness,
      mindfulnessClearComprehension: mindfulness,
      preceptsObserved: precepts,
      notes: checkinNotes.trim(),
    };

    try {
      await saveGradualTrainingLog(dateStr, checkIn);
      await loadAllLogs();
      Snackbar.show({
        text: `Daily check-in saved for ${dateStr}`,
        duration: Snackbar.LENGTH_SHORT,
      });
    } catch (error) {
      console.error(error);
      Snackbar.show({
        text: "Failed to save daily check-in",
        duration: Snackbar.LENGTH_SHORT,
        backgroundColor: colors.error,
      });
    }
  };

  // Adjust Daily Check-in date
  const changeDate = (days: number) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() + days);
    
    // Prevent going into future
    if (nextDate.getTime() > new Date().getTime()) {
      return;
    }
    setSelectedDate(nextDate);
    syncFormForDate(nextDate, gradualLogs);
  };

  // Handle Save Manual Meditation Log
  const handleSaveManualLog = async () => {
    const mins = parseInt(manualMinutes);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert("Invalid Duration", "Please enter a valid number of minutes.");
      return;
    }

    try {
      await addMeditationLog(mins, manualNotes.trim());
      setShowManualModal(false);
      setManualMinutes("");
      setManualNotes("");
      await loadAllLogs();
      Snackbar.show({
        text: "Meditation logged successfully",
        duration: Snackbar.LENGTH_SHORT,
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Handle Delete Meditation Log
  const handleDeleteLog = (id: string) => {
    Alert.alert(
      "Delete Log",
      "Are you sure you want to delete this meditation session log?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteMeditationLog(id);
            await loadAllLogs();
            Snackbar.show({
              text: "Meditation log deleted",
              duration: Snackbar.LENGTH_SHORT,
            });
          },
        },
      ]
    );
  };

  // Handle Clear Reading History
  const handleClearReadingHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear your reading history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearReadingLogs();
            await loadAllLogs();
            Snackbar.show({
              text: "Reading history cleared",
              duration: Snackbar.LENGTH_SHORT,
            });
          },
        },
      ]
    );
  };

  // Handle Delete Reading Item
  const handleDeleteReadingItem = (uid: string, timestamp: number) => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to remove this entry from your reading history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteReadingLog(uid, timestamp);
            await loadAllLogs();
            Snackbar.show({
              text: "History entry removed",
              duration: Snackbar.LENGTH_SHORT,
            });
          },
        },
      ]
    );
  };

  // Calculate Streak
  const calculateStreak = () => {
    if (meditationLogs.length === 0) return 0;
    
    // Set of meditation dates in YYYY-MM-DD
    const dates = new Set(
      meditationLogs.map((log) => new Date(log.timestamp).toISOString().split("T")[0])
    );
    
    let streak = 0;
    const checkDate = new Date();
    const todayStr = formatDateString(checkDate);
    
    // If no session today, check if yesterday was active to keep streak alive
    if (!dates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = formatDateString(checkDate);
      if (!dates.has(yesterdayStr)) {
        return 0; // Streak broken
      }
    }
    
    while (true) {
      const dateStr = formatDateString(checkDate);
      if (dates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  };

  const streak = calculateStreak();
  const totalMeditationMinutes = meditationLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const totalMeditationHours = (totalMeditationMinutes / 60).toFixed(1);

  // Render Daily Check-in Tab
  const renderCheckIn = () => {
    const isToday = formatDateString(selectedDate) === formatDateString(new Date());
    
    const renderFactorRow = (
      icon: keyof typeof Ionicons.glyphMap,
      title: string,
      pali: string,
      description: string,
      value: boolean,
      setValue: (v: boolean) => void
    ) => (
      <View style={[styles.factorCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.factorHeader}>
          <View style={styles.factorTitleGroup}>
            <Ionicons name={icon} size={22} color={colors.primary} style={{ marginRight: spacing.sm }} />
            <View>
              <Text style={[styles.factorTitle, { color: colors.textPrimary }]}>{title}</Text>
              <Text style={[styles.factorPali, { color: colors.textTertiary }]}>{pali}</Text>
            </View>
          </View>
          <Switch
            value={value}
            onValueChange={setValue}
            trackColor={{ false: colors.divider, true: colors.primary + "80" }}
            thumbColor={value ? colors.primary : colors.outline}
          />
        </View>
        <Text style={[styles.factorDesc, { color: colors.textSecondary }]}>{description}</Text>
      </View>
    );

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
        {/* Date Selector Header */}
        <View style={[styles.datePickerContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Pressable onPress={() => changeDate(-1)} style={styles.datePickerBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.dateText, { color: colors.textPrimary }]}>
            {isToday ? "Today" : formatDateString(selectedDate)}
          </Text>
          <Pressable 
            onPress={() => changeDate(1)} 
            disabled={isToday}
            style={[styles.datePickerBtn, { opacity: isToday ? 0.3 : 1 }]}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginBottom: spacing.md }]}>
          {"The Buddha's Gradual Training factors (MN 53):"}
        </Text>

        {renderFactorRow(
          "eye-outline",
          "Sense Restraint",
          "indriya-saṃvara",
          "Guarding the senses. When seeing a form, hearing a sound, or thinking a thought, not grasping at its features or details.",
          senseRestraint,
          setSenseRestraint
        )}

        {renderFactorRow(
          "restaurant-outline",
          "Moderation in Eating",
          "bhojane mattaññutā",
          "Reflecting wisely when taking food. Eating not for fun, pride, or beautification, but only to sustain the body in health.",
          moderationEating,
          setModerationEating
        )}

        {renderFactorRow(
          "sunny-outline",
          "Wakefulness",
          "jāgariya",
          "Cleansing the mind of obstructive states during the day and night; not yielding to sloth, torpor, or oversleeping.",
          wakefulness,
          setWakefulness
        )}

        {renderFactorRow(
          "walk-outline",
          "Mindfulness & Comprehension",
          "sati-sampajañña",
          "Acting with clear comprehension when walking, looking, stretching, eating, drinking, speaking, or keeping silent.",
          mindfulness,
          setMindfulness
        )}

        {renderFactorRow(
          "shield-checkmark-outline",
          "Precept Observance",
          "sīla",
          "Upholding the moral virtues and precepts (e.g. Five Precepts: refraining from harming, stealing, lying, misconduct, and intoxicants).",
          precepts,
          setPrecepts
        )}

        {/* Daily notes */}
        <View style={styles.noteBox}>
          <Text style={[styles.noteBoxTitle, { color: colors.textPrimary }]}>Daily Reflections</Text>
          <TextInput
            style={[
              styles.noteTextInput,
              {
                color: colors.textPrimary,
                borderColor: colors.divider,
                backgroundColor: colors.card,
              },
            ]}
            multiline
            numberOfLines={3}
            placeholder="Add reflections on your practice, obstacles faced, or insights today..."
            placeholderTextColor={colors.textTertiary}
            value={checkinNotes}
            onChangeText={setCheckinNotes}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleSaveCheckin}
        >
          <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>Save Check-in</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // Render Meditation Tab
  const renderMeditation = () => {
    const renderMeditationItem = ({ item }: { item: MeditationLog }) => (
      <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.logHeaderRow}>
          <View>
            <Text style={[styles.logDuration, { color: colors.textPrimary }]}>
              🧘 {item.durationMinutes} minutes
            </Text>
            <Text style={[styles.logTime, { color: colors.textTertiary }]}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
          </View>
          <Pressable
            hitSlop={10}
            onPress={() => handleDeleteLog(item.id)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        </View>
        {item.notes ? (
          <Text style={[styles.logNotes, { color: colors.textSecondary }]}>
            {item.notes}
          </Text>
        ) : null}
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{streak}d</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Streak</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{meditationLogs.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sessions</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{totalMeditationHours}h</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Time</Text>
          </View>
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={[styles.listHeaderTitle, { color: colors.textPrimary }]}>Meditation History</Text>
          <Pressable
            style={({ pressed }) => [
              styles.manualLogBtn,
              { backgroundColor: colors.surfaceVariant, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => setShowManualModal(true)}
          >
            <Ionicons name="add" size={16} color={colors.textPrimary} style={{ marginRight: 4 }} />
            <Text style={[styles.manualLogBtnText, { color: colors.textPrimary }]}>Log Session</Text>
          </Pressable>
        </View>

        <FlatList
          showsVerticalScrollIndicator={false}
          data={meditationLogs}
          renderItem={renderMeditationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.largeEmoji}>🧘</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No meditation sessions logged yet. Try using the Meditation Timer!
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  // Render Reading History Tab
  const renderReading = () => {
    const renderReadingItem = ({ item }: { item: ReadingLog }) => (
      <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.logHeaderRow}>
          <Pressable 
            style={{ flex: 1, marginRight: spacing.sm }}
            onPress={() => router.push(`/reader/${item.uid}`)}
          >
            <Text style={[styles.logSuttaTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.logTime, { color: colors.textTertiary }]}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={[styles.uidBadge, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.uidBadgeText, { color: colors.textSecondary }]}>
                {item.uid.toUpperCase()}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => handleDeleteReadingItem(item.uid, item.timestamp)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </Pressable>
          </View>
        </View>
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        {readingLogs.length > 0 && (
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listHeaderTitle, { color: colors.textPrimary }]}>Suttas Read</Text>
            <Pressable
              style={({ pressed }) => [
                styles.manualLogBtn,
                { backgroundColor: colors.error + "15", opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleClearReadingHistory}
            >
              <Ionicons name="trash-outline" size={14} color={colors.error} style={{ marginRight: 4 }} />
              <Text style={[styles.manualLogBtnText, { color: colors.error }]}>Clear History</Text>
            </Pressable>
          </View>
        )}

        <FlatList
          showsVerticalScrollIndicator={false}
          data={readingLogs}
          renderItem={renderReadingItem}
          keyExtractor={(item, idx) => `${item.uid}-${item.timestamp}-${idx}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.largeEmoji}>📖</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your reading history is empty. Suttas you read will appear here automatically.
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  const renderBadges = () => {
    // 1. Calculate statistics
    const totalSuttasRead = readingLogs.length;
    const totalSessions = meditationLogs.length;
    const totalMins = meditationLogs.reduce((sum, log) => sum + log.durationMinutes, 0);
    const maxDuration = meditationLogs.length > 0 
      ? Math.max(...meditationLogs.map(l => l.durationMinutes)) 
      : 0;
    const gradualLogsArray = Object.values(gradualLogs);
    const totalCheckins = gradualLogsArray.length;
    
    // Streak calculations
    const streak = calculateStreak();
    
    // Sense restraint check-ins
    const senseCount = gradualLogsArray.filter(l => l.senseRestraint).length;
    // Precepts check-ins
    const preceptsCount = gradualLogsArray.filter(l => l.preceptsObserved).length;
    
    // Virtuous day (all 5 checked)
    const hasVirtuousDay = gradualLogsArray.some(
      log => log.senseRestraint && log.moderationEating && log.wakefulness && log.mindfulnessClearComprehension && log.preceptsObserved
    );

    // List of badge definitions
    const badgesList = [
      // Sīla (Virtue) Badges
      {
        id: "sila_first",
        title: "Sīla Novice",
        description: "Complete your first daily practice check-in.",
        icon: "shield-checkmark" as const,
        category: "Sīla (Virtue)",
        unlocked: totalCheckins >= 1,
        progress: Math.min(1, totalCheckins / 1),
        progressText: `${totalCheckins} / 1`,
      },
      {
        id: "sila_guard",
        title: "Sense Guard",
        description: "Restrain the senses (Indriya-saṃvara) on 3 different days.",
        icon: "eye" as const,
        category: "Sīla (Virtue)",
        unlocked: senseCount >= 3,
        progress: Math.min(1, senseCount / 3),
        progressText: `${senseCount} / 3 days`,
      },
      {
        id: "sila_precepts",
        title: "Pure Precepts",
        description: "Observe the ethical precepts on 5 different days.",
        icon: "heart" as const,
        category: "Sīla (Virtue)",
        unlocked: preceptsCount >= 5,
        progress: Math.min(1, preceptsCount / 5),
        progressText: `${preceptsCount} / 5 days`,
      },
      {
        id: "sila_virtuous",
        title: "Perfect Day",
        description: "Check in all 5 gradual training factors on a single day.",
        icon: "star" as const,
        category: "Sīla (Virtue)",
        unlocked: hasVirtuousDay,
        progress: hasVirtuousDay ? 1 : 0,
        progressText: hasVirtuousDay ? "Completed" : "0 / 1",
      },

      // Meditation (Samādhi) Badges
      {
        id: "med_first",
        title: "Mindfulness Spark",
        description: "Log your first meditation session.",
        icon: "pulse" as const,
        category: "Samādhi (Concentration)",
        unlocked: totalSessions >= 1,
        progress: Math.min(1, totalSessions / 1),
        progressText: `${totalSessions} / 1`,
      },
      {
        id: "med_streak",
        title: "Steady Stream",
        description: "Maintain a 5-day meditation streak.",
        icon: "flame" as const,
        category: "Samādhi (Concentration)",
        unlocked: streak >= 5,
        progress: Math.min(1, streak / 5),
        progressText: `${streak} / 5 days`,
      },
      {
        id: "med_hours",
        title: "Deep Samādhi",
        description: "Accumulate a total of 5 hours (300 mins) of meditation.",
        icon: "water" as const,
        category: "Samādhi (Concentration)",
        unlocked: totalMins >= 300,
        progress: Math.min(1, totalMins / 300),
        progressText: `${Math.round(totalMins)} / 300m`,
      },
      {
        id: "med_duration",
        title: "Dhyāna Explorer",
        description: "Complete a single meditation session of 45 minutes or more.",
        icon: "hourglass" as const,
        category: "Samādhi (Concentration)",
        unlocked: maxDuration >= 45,
        progress: maxDuration >= 45 ? 1 : Math.min(1, maxDuration / 45),
        progressText: `${Math.round(maxDuration)} / 45m`,
      },

      // Reading (Paññā) Badges
      {
        id: "read_first",
        title: "First Steps",
        description: "Read your first sutta translation.",
        icon: "book" as const,
        category: "Paññā (Wisdom)",
        unlocked: totalSuttasRead >= 1,
        progress: Math.min(1, totalSuttasRead / 1),
        progressText: `${totalSuttasRead} / 1`,
      },
      {
        id: "read_seeker",
        title: "Dhamma Seeker",
        description: "Read 5 different suttas.",
        icon: "compass" as const,
        category: "Paññā (Wisdom)",
        unlocked: totalSuttasRead >= 5,
        progress: Math.min(1, totalSuttasRead / 5),
        progressText: `${totalSuttasRead} / 5`,
      },
      {
        id: "read_scholar",
        title: "Dhamma Scholar",
        description: "Read 15 different suttas.",
        icon: "library" as const,
        category: "Paññā (Wisdom)",
        unlocked: totalSuttasRead >= 15,
        progress: Math.min(1, totalSuttasRead / 15),
        progressText: `${totalSuttasRead} / 15`,
      },
    ];

    const unlockedCount = badgesList.filter(b => b.unlocked).length;
    const totalBadges = badgesList.length;

    // Group badges by category
    const categories = ["Sīla (Virtue)", "Samādhi (Concentration)", "Paññā (Wisdom)"] as const;

    return (
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
        {/* Summary Card */}
        <View style={[styles.badgeSummaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.badgeSummaryTextGroup}>
            <Text style={[styles.badgeSummaryTitle, { color: colors.textPrimary }]}>Dhamma Progress</Text>
            <Text style={[styles.badgeSummaryLevel, { color: colors.primary }]}>
              {unlockedCount === totalBadges 
                ? "Arahant (Noble One)" 
                : unlockedCount >= 8 
                ? "Sotāpanna (Stream-Enterer)" 
                : unlockedCount >= 4 
                ? "Kalyāṇamitta (Virtuous Friend)" 
                : "Sādhaka (Practitioner)"}
            </Text>
            <Text style={[styles.badgeSummarySub, { color: colors.textSecondary }]}>
              {unlockedCount} of {totalBadges} badges unlocked
            </Text>
          </View>
          <View style={[styles.badgeSummaryIconCircle, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="trophy" size={36} color={colors.primary} />
          </View>
        </View>

        {categories.map((category) => {
          const catBadges = badgesList.filter(b => b.category === category);
          return (
            <View key={category} style={styles.badgeSection}>
              <Text style={[styles.badgeSectionHeader, { color: colors.textPrimary }]}>{category}</Text>
              {catBadges.map((badge) => (
                <View 
                  key={badge.id} 
                  style={[
                    styles.badgeCard, 
                    { 
                      backgroundColor: colors.card, 
                      borderColor: badge.unlocked ? colors.primary + "40" : colors.cardBorder,
                      opacity: badge.unlocked ? 1 : 0.65
                    }
                  ]}
                >
                  <View style={styles.badgeCardMain}>
                    <View 
                      style={[
                        styles.badgeIconCircle, 
                        { 
                          backgroundColor: badge.unlocked ? colors.primary + "15" : colors.surfaceVariant,
                          borderColor: badge.unlocked ? colors.primary : "transparent",
                          borderWidth: badge.unlocked ? 1 : 0,
                        }
                      ]}
                    >
                      <Ionicons 
                        name={badge.icon} 
                        size={24} 
                        color={badge.unlocked ? colors.primary : colors.textTertiary} 
                      />
                    </View>
                    <View style={styles.badgeTextGroup}>
                      <Text 
                        style={[
                          styles.badgeTitle, 
                          { 
                            color: colors.textPrimary,
                            fontWeight: badge.unlocked ? "700" : "500"
                          }
                        ]}
                      >
                        {badge.title}
                      </Text>
                      <Text style={[styles.badgeDesc, { color: colors.textSecondary }]}>
                        {badge.description}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Progress bar */}
                  <View style={styles.badgeProgressWrapper}>
                    <View style={[styles.badgeProgressBar, { backgroundColor: colors.divider }]}>
                      <View 
                        style={[
                          styles.badgeProgressFill, 
                          { 
                            backgroundColor: badge.unlocked ? colors.primary : colors.textTertiary, 
                            width: `${badge.progress * 100}%` 
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.badgeProgressText, { color: colors.textTertiary }]}>
                      {badge.progressText}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Practice Logs" }} />

      {/* Tabs segment controller */}
      <View style={[styles.tabSelector, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Pressable
          style={[styles.tabBtn, activeTab === "checkin" && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab("checkin")}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === "checkin" ? colors.textInverse : colors.textPrimary }]}>
            Check-in
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "meditation" && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab("meditation")}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === "meditation" ? colors.textInverse : colors.textPrimary }]}>
            Meditation
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "reading" && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab("reading")}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === "reading" ? colors.textInverse : colors.textPrimary }]}>
            Reading
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "badges" && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab("badges")}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === "badges" ? colors.textInverse : colors.textPrimary }]}>
            Badges
          </Text>
        </Pressable>
      </View>

      {/* Tab Screen Content */}
      <View style={{ flex: 1 }}>
        {activeTab === "checkin" && renderCheckIn()}
        {activeTab === "meditation" && renderMeditation()}
        {activeTab === "reading" && renderReading()}
        {activeTab === "badges" && renderBadges()}
      </View>

      {/* Manual log modal */}
      <Modal
        visible={showManualModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Log Meditation Session
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Duration (minutes)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.divider,
                    backgroundColor: colors.background,
                  },
                ]}
                keyboardType="numeric"
                placeholder="e.g. 20"
                placeholderTextColor={colors.textTertiary}
                value={manualMinutes}
                onChangeText={setManualMinutes}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.divider,
                    backgroundColor: colors.background,
                  },
                ]}
                multiline
                numberOfLines={3}
                placeholder="How was the concentration? Hindrances faced? Insights?"
                placeholderTextColor={colors.textTertiary}
                value={manualNotes}
                onChangeText={setManualNotes}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowManualModal(false);
                  setManualMinutes("");
                  setManualNotes("");
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveManualLog}
              >
                <Text style={[styles.modalBtnText, { color: colors.textInverse }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  tabSelector: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 2,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tabContent: {
    paddingBottom: spacing.huge,
  },
  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  datePickerBtn: {
    padding: spacing.sm,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: SERIF_FONT,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginHorizontal: spacing.xs,
  },
  factorCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  factorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  factorTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },
  factorTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  factorPali: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 1,
  },
  factorDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  noteBox: {
    marginBottom: spacing.xl,
  },
  noteBoxTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  noteTextInput: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlignVertical: "top",
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "center",
    marginVertical: spacing.md,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statItem: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  manualLogBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  manualLogBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: spacing.huge,
  },
  logCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  logHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logDuration: {
    fontSize: 15,
    fontWeight: "700",
  },
  logSuttaTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  logTime: {
    fontSize: 11,
    marginTop: 2,
  },
  logNotes: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
    fontStyle: "italic",
  },
  uidBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  uidBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxxl,
    marginTop: spacing.xxl,
  },
  largeEmoji: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.lg,
    fontFamily: SERIF_FONT,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  badgeSummaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  badgeSummaryTextGroup: {
    flex: 1,
  },
  badgeSummaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: SERIF_FONT,
  },
  badgeSummaryLevel: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  badgeSummarySub: {
    fontSize: 12,
    marginTop: 4,
  },
  badgeSummaryIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.md,
  },
  badgeSection: {
    marginBottom: spacing.xl,
  },
  badgeSectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: SERIF_FONT,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  badgeCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  badgeCardMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  badgeTextGroup: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 14,
  },
  badgeDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  badgeProgressWrapper: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeProgressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginRight: spacing.md,
  },
  badgeProgressFill: {
    height: "100%",
  },
  badgeProgressText: {
    fontSize: 10,
    fontWeight: "600",
    minWidth: 70,
    textAlign: "right",
  },
});
