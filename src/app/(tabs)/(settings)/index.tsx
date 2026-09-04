import { SectionHeader } from "@/components";
import {
  addIndexListener,
  buildFullTextIndex,
  isIndexingInProgress,
  loadSettings,
  saveSettings,
  syncSuttaReminders
} from "@/services/DataService";
import { getLogFilePath, readLogs } from "@/services/LoggerService";
import { radius, spacing, useTheme, type ThemeMode } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const [isIndexing, setIsIndexing] = useState(isIndexingInProgress());
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(isIndexingInProgress() ? "Indexing…" : "Idle");

  // Reader Preferences States
  const [displayMode, setDisplayMode] = useState<"en" | "pli" | "bilingual">("bilingual");
  const [showSegments, setShowSegments] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [fontSize, setFontSize] = useState(19);

  // Reminder States
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(9);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [reminderFrequency, setReminderFrequency] = useState<"once" | "daily" | "weekly">("daily");
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Temporary States for Modal Config
  const [tempReminderEnabled, setTempReminderEnabled] = useState(false);
  const [tempReminderHour, setTempReminderHour] = useState(9);
  const [tempReminderMinute, setTempReminderMinute] = useState(0);
  const [tempReminderFrequency, setTempReminderFrequency] = useState<"once" | "daily" | "weekly">("daily");

  // Log Modal state
  const [showLogModal, setShowLogModal] = useState(false);
  const [logContent, setLogContent] = useState("");

  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const buildNumber = Constants.expoConfig?.android?.versionCode || 1;

  const updateSavedSettings = (fields: any) => {
    const nextFields = {
      displayMode,
      showSegments,
      showComments,
      fontSize,
      reminderEnabled,
      reminderHour,
      reminderMinute,
      reminderFrequency,
      ...fields,
    };
    // Keep showPali updated for backward compatibility
    if (nextFields.displayMode !== undefined) {
      nextFields.showPali = nextFields.displayMode === "bilingual" || nextFields.displayMode === "pli";
    }
    saveSettings(nextFields);
  };

  const handleCycleDisplayMode = () => {
    const modes: ("en" | "pli" | "bilingual")[] = ["bilingual", "en", "pli"];
    const nextIdx = (modes.indexOf(displayMode) + 1) % modes.length;
    const next = modes[nextIdx];
    setDisplayMode(next);
    updateSavedSettings({ displayMode: next });
  };

  const handleToggleSegments = () => {
    const next = !showSegments;
    setShowSegments(next);
    updateSavedSettings({ showSegments: next });
  };

  const handleToggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    updateSavedSettings({ showComments: next });
  };

  const handleAdjustFontSize = (delta: number) => {
    const next = Math.max(12, Math.min(32, fontSize + delta));
    setFontSize(next);
    updateSavedSettings({ fontSize: next });
  };

  const handleSaveReminder = async () => {
    if (tempReminderEnabled) {
      try {
        // Request Notification Permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please enable notification permissions in system settings to receive Daily Sutta reminders."
          );
          setTempReminderEnabled(false);
          setReminderEnabled(false);
          updateSavedSettings({ reminderEnabled: false });
          await syncSuttaReminders();
          return;
        }

        // Save settings first, then sync reminders
        const nextSettings = {
          reminderEnabled: true,
          reminderHour: tempReminderHour,
          reminderMinute: tempReminderMinute,
          reminderFrequency: tempReminderFrequency,
        };
        updateSavedSettings(nextSettings);

        // Schedule notifications
        await syncSuttaReminders();

        // Commit temp states to main component states
        setReminderEnabled(true);
        setReminderHour(tempReminderHour);
        setReminderMinute(tempReminderMinute);
        setReminderFrequency(tempReminderFrequency);

        Alert.alert("Success", "Reminder scheduled successfully!");
        setShowReminderModal(false);
      } catch (error) {
        console.error("Error setting notification:", error);
        Alert.alert("Error", "Failed to schedule notification.");
      }
    } else {
      try {
        updateSavedSettings({ reminderEnabled: false });
        await syncSuttaReminders();

        setReminderEnabled(false);

        Alert.alert("Disabled", "Daily Sutta reminders have been disabled.");
        setShowReminderModal(false);
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "Failed to disable reminders.");
      }
    }
  };

  React.useEffect(() => {
    const removeListener = addIndexListener((processed, total) => {
      if (total > 0) {
        setProgress(processed / total);
        if (processed < total) {
          setIsIndexing(true);
          setStatus(`Indexed ${processed} of ${total} suttas`);
        } else {
          setIsIndexing(false);
          setStatus("Indexing Complete");
        }
      }
    });

    // Load initial reader settings
    loadSettings().then((saved) => {
      if (saved) {
        if (saved.displayMode !== undefined) {
          setDisplayMode(saved.displayMode);
        } else if (saved.showPali !== undefined) {
          setDisplayMode(saved.showPali ? "bilingual" : "en");
        }
        if (saved.showSegments !== undefined) setShowSegments(saved.showSegments);
        if (saved.showComments !== undefined) setShowComments(saved.showComments);
        if (saved.fontSize !== undefined) setFontSize(saved.fontSize);

        // Load reminder settings
        if (saved.reminderEnabled !== undefined) setReminderEnabled(saved.reminderEnabled);
        if (saved.reminderHour !== undefined) setReminderHour(saved.reminderHour);
        if (saved.reminderMinute !== undefined) setReminderMinute(saved.reminderMinute);
        if (saved.reminderFrequency !== undefined) setReminderFrequency(saved.reminderFrequency);
      }
    });

    return () => removeListener();
  }, []);

  const toggleTheme = () => {
    const next: Record<ThemeMode, ThemeMode> = {
      system: "light",
      light: "dark",
      dark: "system",
    };
    setMode(next[mode]);
  };

  const handleStartIndexing = async () => {
    if (isIndexing) return;
    setStatus("Indexing…");
    try {
      await buildFullTextIndex();
    } catch (err) {
      console.error(err);
      setStatus("Indexing Failed");
    }
  };

  const renderSettingRow = ({
    icon,
    label,
    value,
    onPress,
    disabled = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.divider,
          opacity: pressed && !disabled ? 0.7 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.rowLead}>
        <Ionicons name={icon} size={22} color={colors.primary} />
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          {label}
        </Text>
      </View>
      <View style={styles.rowTail}>
        {value && (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
            {value}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <SectionHeader
        title="Appearance"
        subtitle="Customize how the app looks and feels"
      />
      <View style={styles.section}>
        {renderSettingRow({
          icon: "color-palette",
          label: "Theme Mode",
          value: mode.charAt(0).toUpperCase() + mode.slice(1),
          onPress: toggleTheme,
        })}
      </View>

      <SectionHeader
        title="Reader Preferences"
        subtitle="Default preferences for sutta reading screen"
      />
      <View style={styles.section}>
        {renderSettingRow({
          icon: "book",
          label: "Default Display Mode",
          value: displayMode === "bilingual"
            ? "Bilingual (EN+Pāli)"
            : displayMode === "pli"
              ? "Pāli Only"
              : "English Only",
          onPress: handleCycleDisplayMode,
        })}
        {renderSettingRow({
          icon: "list",
          label: "Segment Numbers",
          value: showSegments ? "Show" : "Hide",
          onPress: handleToggleSegments,
        })}
        {renderSettingRow({
          icon: "chatbubble-ellipses",
          label: "Notes & Comments",
          value: showComments ? "Show" : "Hide",
          onPress: handleToggleComments,
        })}

        <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
          <View style={styles.rowLead}>
            <Ionicons name="text" size={22} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              Default Font Size
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable
              onPress={() => handleAdjustFontSize(-2)}
              style={({ pressed }) => [styles.fontBtn, { backgroundColor: colors.surfaceVariant, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>A-</Text>
            </Pressable>
            <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 16 }}>{fontSize}</Text>
            <Pressable
              onPress={() => handleAdjustFontSize(2)}
              style={({ pressed }) => [styles.fontBtn, { backgroundColor: colors.surfaceVariant, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>A+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <SectionHeader
        title="Reminders & Practice"
        subtitle="Manage daily practice notifications"
      />
      <View style={styles.section}>
        {renderSettingRow({
          icon: "alarm-outline",
          label: "Daily Sutta Reminder",
          value: reminderEnabled
            ? `${reminderFrequency.charAt(0).toUpperCase() + reminderFrequency.slice(1)} at ${reminderHour.toString().padStart(2, "0")}:${reminderMinute.toString().padStart(2, "0")}`
            : "Disabled",
          onPress: () => {
            setTempReminderEnabled(reminderEnabled);
            setTempReminderHour(reminderHour);
            setTempReminderMinute(reminderMinute);
            setTempReminderFrequency(reminderFrequency);
            setShowReminderModal(true);
          },
        })}
      </View>

      <SectionHeader title="About" />
      <View style={styles.section}>
        {renderSettingRow({
          icon: "information-circle",
          label: "About Saddhamma",
          onPress: () => router.push("/(tabs)/(settings)/about" as any),
        })}
        {renderSettingRow({
          icon: "search-outline",
          label: "Rebuild Search Index",
          value: isIndexing ? `${status} (${Math.round(progress * 100)}%)` : "Ready",
          disabled: isIndexing,
          onPress: handleStartIndexing,
        })}
        {renderSettingRow({
          icon: "shield-checkmark-outline",
          label: "Privacy Policy",
          onPress: () => Linking.openURL("https://saddhamma.online/privacy.html"),
        })}
        {renderSettingRow({
          icon: "bug-outline",
          label: "Report an Issue",
          onPress: () => Linking.openURL("https://github.com/dipantan/Saddhamma/issues"),
        })}
        {renderSettingRow({
          icon: "heart-outline",
          label: "Support the Project",
          onPress: () => Linking.openURL("https://saddhamma.online/support.html"),
        })}
        {renderSettingRow({
          icon: "document-text-outline",
          label: "Diagnostic Crash Logs",
          onPress: async () => {
            const logs = await readLogs();
            setLogContent(logs);
            setShowLogModal(true);
          },
        })}
      </View>

      {/* Reminder Config Modal */}
      <Modal
        visible={showReminderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Sutta Reminder Settings
            </Text>

            {/* Toggle Row */}
            <View style={styles.modalSettingRow}>
              <Text style={[styles.modalSettingLabel, { color: colors.textPrimary }]}>
                Enable Reminder
              </Text>
              <Switch
                value={tempReminderEnabled}
                onValueChange={setTempReminderEnabled}
                trackColor={{ false: colors.divider, true: colors.primary + "80" }}
                thumbColor={tempReminderEnabled ? colors.primary : colors.outline}
              />
            </View>

            {tempReminderEnabled && (
              <>
                {/* Frequency Selector */}
                <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                  Frequency
                </Text>
                <View style={styles.freqOptions}>
                  {(["once", "daily", "weekly"] as const).map((freq) => (
                    <Pressable
                      key={freq}
                      style={({ pressed }) => [
                        styles.freqChip,
                        {
                          backgroundColor: tempReminderFrequency === freq ? colors.primary : colors.surfaceVariant,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      onPress={() => setTempReminderFrequency(freq)}
                    >
                      <Text
                        style={[
                          styles.freqChipText,
                          { color: tempReminderFrequency === freq ? colors.textInverse : colors.textPrimary },
                        ]}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Time Picker Controls */}
                <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                  Reminder Time
                </Text>
                <View style={styles.timeControlsRow}>
                  {/* Hours */}
                  <View style={styles.timeColumn}>
                    <Pressable
                      style={styles.timeBtn}
                      onPress={() => setTempReminderHour((h) => (h + 1) % 24)}
                    >
                      <Ionicons name="chevron-up" size={24} color={colors.textPrimary} />
                    </Pressable>
                    <Text style={[styles.timeVal, { color: colors.textPrimary }]}>
                      {tempReminderHour.toString().padStart(2, "0")}
                    </Text>
                    <Pressable
                      style={styles.timeBtn}
                      onPress={() => setTempReminderHour((h) => (h - 1 + 24) % 24)}
                    >
                      <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
                    </Pressable>
                    <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>Hours</Text>
                  </View>

                  <Text style={[styles.timeColon, { color: colors.textPrimary }]}>:</Text>

                  {/* Minutes */}
                  <View style={styles.timeColumn}>
                    <Pressable
                      style={styles.timeBtn}
                      onPress={() => setTempReminderMinute((m) => (m + 5) % 60)}
                    >
                      <Ionicons name="chevron-up" size={24} color={colors.textPrimary} />
                    </Pressable>
                    <Text style={[styles.timeVal, { color: colors.textPrimary }]}>
                      {tempReminderMinute.toString().padStart(2, "0")}
                    </Text>
                    <Pressable
                      style={styles.timeBtn}
                      onPress={() => setTempReminderMinute((m) => (m - 5 + 60) % 60)}
                    >
                      <Ionicons name="chevron-down" size={24} color={colors.textPrimary} />
                    </Pressable>
                    <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>Mins</Text>
                  </View>
                </View>
              </>
            )}

            {/* Modal Action Buttons */}
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowReminderModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveReminder}
              >
                <Text style={[styles.modalBtnText, { color: colors.textInverse }]}>
                  Save Settings
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Diagnostic Logs Modal */}
      <Modal
        visible={showLogModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLogModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: "80%" }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              App Diagnostic Logs
            </Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: spacing.md }}>
              Path: {getLogFilePath()}
            </Text>

            <ScrollView style={{ width: "100%", maxHeight: 300, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <Text style={{ fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", color: colors.textPrimary }}>
                {logContent}
              </Text>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.md, width: "100%" }}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={async () => {
                  await Clipboard.setStringAsync(`Path: ${getLogFilePath()}\n\nLogs:\n${logContent}`);
                  Alert.alert("Copied", "Diagnostic logs copied to clipboard.");
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Copy Logs</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowLogModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textInverse }]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <Text style={[styles.versionText, { color: colors.textTertiary }]}>
          Version {appVersion} (Build {buildNumber})
        </Text>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          May all beings be happy and free.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.huge,
  },
  section: {
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  rowLead: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 16,
    marginLeft: spacing.md,
  },
  rowTail: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowValue: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  infoBox: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  progressWrapper: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginRight: spacing.sm,
  },
  progressFill: {
    height: "100%",
  },
  progressPercent: {
    fontSize: 11,
    width: 30,
    textAlign: "right",
  },
  footer: {
    marginTop: spacing.huge,
    alignItems: "center",
    padding: spacing.xl,
  },
  footerText: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  fontBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
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
  },
  modalSettingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalSettingLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalSubLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  freqOptions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  freqChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  freqChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  timeControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  timeColumn: {
    alignItems: "center",
  },
  timeBtn: {
    padding: 4,
  },
  timeVal: {
    fontSize: 28,
    fontWeight: "700",
    marginVertical: 4,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  timeColon: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: -20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
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
});
