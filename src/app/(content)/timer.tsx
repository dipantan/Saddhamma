import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Vibration,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Switch,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useTheme } from "@/theme";
import { spacing, radius } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { addMeditationLog } from "@/services/DataService";
import { Snackbar } from "react-native-snackbar";

const SERIF_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

const PRESETS = [5, 10, 15, 20, 30, 45, 60];

export default function MeditationTimerScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  // Timer states
  const [selectedMinutes, setSelectedMinutes] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Log Modal states
  const [showLogModal, setShowLogModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [actualDurationMinutes, setActualDurationMinutes] = useState(0);

  // Bell states
  const [halfwayBell, setHalfwayBell] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(0);

  // References
  const timerRef = useRef<any>(null);
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  // Format MM:SS (supports negative values for overtime)
  const formatTime = (seconds: number) => {
    const isOvertime = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const timeStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return isOvertime ? `+${timeStr}` : timeStr;
  };

  // Breathing animation loop
  const startBreathingAnimation = useCallback(() => {
    scaleAnim.setValue(1);
    pulseAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnim.current.start();
  }, [scaleAnim]);

  const stopBreathingAnimation = useCallback(() => {
    if (pulseAnim.current) {
      pulseAnim.current.stop();
      pulseAnim.current = null;
    }
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  // Start Timer
  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    startBreathingAnimation();
  };

  // Pause Timer
  const handlePause = () => {
    setIsPaused(true);
    stopBreathingAnimation();
  };

  // Resume Timer
  const handleResume = () => {
    setIsPaused(false);
    startBreathingAnimation();
  };

  // Cancel/Reset Timer
  const handleCancel = () => {
    const elapsedSeconds = selectedMinutes * 60 - timeLeft;
    const elapsedMinutes = Math.round(elapsedSeconds / 60);

    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(selectedMinutes * 60);
    stopBreathingAnimation();

    if (elapsedMinutes >= 1) {
      setActualDurationMinutes(elapsedMinutes);
      setShowLogModal(true);
    }
  };

  // Finish Timer (Overtime Completion)
  const handleFinish = () => {
    const elapsedSeconds = selectedMinutes * 60 - timeLeft;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    setIsRunning(false);
    setIsPaused(false);
    stopBreathingAnimation();
    setActualDurationMinutes(elapsedMinutes);
    setShowLogModal(true);
  };

  // Timer Tick Effect
  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const nextTimeLeft = prev - 1;

          // Vibration completion trigger when passing from 1 to 0
          if (prev === 1) {
            Vibration.vibrate([0, 500, 250, 500, 250, 500]);
          }

          // Vibration triggers for bells (only during normal countdown)
          if (nextTimeLeft > 0) {
            const totalSeconds = selectedMinutes * 60;
            const elapsed = totalSeconds - nextTimeLeft;
            // Halfway Bell
            if (halfwayBell && elapsed === Math.floor(totalSeconds / 2)) {
              Vibration.vibrate(200);
            }
            // Interval Bell
            if (intervalMinutes > 0 && elapsed % (intervalMinutes * 60) === 0) {
              Vibration.vibrate([0, 150, 100, 150]);
            }
          }

          return nextTimeLeft;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, isPaused, selectedMinutes, stopBreathingAnimation, halfwayBell, intervalMinutes]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (pulseAnim.current) {
        pulseAnim.current.stop();
      }
    };
  }, []);

  const handleSaveLog = async () => {
    try {
      await addMeditationLog(actualDurationMinutes, sessionNotes.trim());
      setShowLogModal(false);
      setSessionNotes("");
      Snackbar.show({
        text: "Meditation session logged",
        duration: Snackbar.LENGTH_SHORT,
      });
      router.back();
    } catch (error) {
      console.error(error);
      Snackbar.show({
        text: "Failed to save meditation log",
        duration: Snackbar.LENGTH_SHORT,
        backgroundColor: colors.error,
      });
    }
  };

  // Determine breathing instruction text based on tick remainder
  // Scale goes up from 0s to 4s (Inhale), goes down from 4s to 8s (Exhale)
  const isOvertime = timeLeft <= 0;
  const isExhaling = (Math.abs(timeLeft) % 8) < 4;
  const instructionText = isRunning && !isPaused 
    ? (isOvertime
        ? `Overtime • ${isExhaling ? "Exhale gently…" : "Inhale deeply…"}`
        : (isExhaling ? "Exhale gently…" : "Inhale deeply…")
      ) 
    : "Be still and mindfully aware";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Meditation Timer" }} />
      
      {!isRunning ? (
        // Settings Mode
        <View style={styles.configContainer}>
          <View style={styles.configHeader}>
            <Ionicons name="sunny-outline" size={48} color={colors.primary} />
            <Text style={[styles.configTitle, { color: colors.textPrimary }]}>
              Mindful Meditation
            </Text>
            <Text style={[styles.configSubtitle, { color: colors.textSecondary }]}>
              Set your session length and settle into stillness.
            </Text>
          </View>

          {/* Preset Buttons */}
          <View style={styles.presetsGrid}>
            {PRESETS.map((mins) => (
              <Pressable
                key={mins}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    backgroundColor: selectedMinutes === mins ? colors.primary : colors.card,
                    borderColor: selectedMinutes === mins ? colors.primary : colors.cardBorder,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => {
                  setSelectedMinutes(mins);
                  setTimeLeft(mins * 60);
                }}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: selectedMinutes === mins ? colors.textInverse : colors.textPrimary },
                  ]}
                >
                  {mins} min
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Adjust controls */}
          <View style={styles.adjustRow}>
            <Pressable
              style={({ pressed }) => [
                styles.adjustBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => {
                const next = Math.max(1, selectedMinutes - 1);
                setSelectedMinutes(next);
                setTimeLeft(next * 60);
              }}
            >
              <Ionicons name="remove" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={[styles.adjustValue, { color: colors.textPrimary }]}>
              {selectedMinutes} <Text style={{ fontSize: 18, fontWeight: "normal" }}>mins</Text>
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.adjustBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => {
                const next = Math.min(180, selectedMinutes + 1);
                setSelectedMinutes(next);
                setTimeLeft(next * 60);
              }}
            >
              <Ionicons name="add" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Bell Settings */}
          <View style={[styles.bellConfigCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.bellConfigHeader}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} style={{ marginRight: spacing.sm }} />
              <Text style={[styles.bellConfigTitle, { color: colors.textPrimary }]}>Haptic Bells</Text>
            </View>

            {/* Halfway Toggle */}
            <View style={styles.bellSettingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bellSettingLabel, { color: colors.textPrimary }]}>Halfway Marker</Text>
                <Text style={[styles.bellSettingDesc, { color: colors.textSecondary }]}>Vibrate once at the halfway point</Text>
              </View>
              <Switch
                value={halfwayBell}
                onValueChange={setHalfwayBell}
                trackColor={{ false: colors.divider, true: colors.primary + "80" }}
                thumbColor={halfwayBell ? colors.primary : colors.outline}
              />
            </View>

            {/* Interval Selector */}
            <View style={[styles.bellSettingRow, { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.sm, paddingTop: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bellSettingLabel, { color: colors.textPrimary }]}>Interval Reminder</Text>
                <Text style={[styles.bellSettingDesc, { color: colors.textSecondary }]}>Vibrate periodically during session</Text>
              </View>
              <View style={styles.intervalOptions}>
                {[0, 1, 5, 10].map((mins) => (
                  <Pressable
                    key={mins}
                    style={({ pressed }) => [
                      styles.intervalChip,
                      {
                        backgroundColor: intervalMinutes === mins ? colors.primary : colors.surfaceVariant,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => setIntervalMinutes(mins)}
                  >
                    <Text
                      style={[
                        styles.intervalChipText,
                        { color: intervalMinutes === mins ? colors.textInverse : colors.textSecondary },
                      ]}
                    >
                      {mins === 0 ? "Off" : `${mins}m`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Start Button */}
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleStart}
          >
            <Text style={[styles.startBtnText, { color: colors.textInverse }]}>
              Start Session
            </Text>
          </Pressable>
        </View>
      ) : (
        // Active Timer Mode
        <View style={styles.activeContainer}>
          {/* Animated pulsing breathing guide */}
          <View style={styles.animationWrapper}>
            <Animated.View
              style={[
                styles.breathingOrb,
                {
                  transform: [{ scale: scaleAnim }],
                  backgroundColor: colors.primary + "12",
                  borderColor: colors.primary + "30",
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.innerOrb,
                  {
                    transform: [{ scale: Animated.multiply(scaleAnim, 0.85) }],
                    backgroundColor: colors.primary + "20",
                  },
                ]}
              />
            </Animated.View>

            {/* Centered Timer Countdown */}
            <View style={styles.timeOverlay}>
              <Text style={[styles.timeText, { color: colors.textPrimary }]}>
                {formatTime(timeLeft)}
              </Text>
              <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                {instructionText}
              </Text>
            </View>
          </View>

          {/* Controls Bar */}
          <View style={styles.controlsRow}>
            {isPaused ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.controlCircle,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={handleCancel}
                >
                  <Ionicons name="stop" size={24} color={colors.error} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.controlCircle,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={handleResume}
                >
                  <Ionicons name="play" size={24} color={colors.textInverse} />
                </Pressable>
              </>
            ) : (
              <>
                {timeLeft <= 0 && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.controlCircle,
                      { backgroundColor: colors.primary, marginRight: spacing.md, opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={handleFinish}
                  >
                    <Ionicons name="checkmark" size={24} color={colors.textInverse} />
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.controlCircle,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={handlePause}
                >
                  <Ionicons name="pause" size={24} color={colors.textPrimary} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {/* Manual logging / save modal */}
      <Modal
        visible={showLogModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLogModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Meditation Completed
            </Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              You meditated for <Text style={{ fontWeight: "700", color: colors.primary }}>{actualDurationMinutes} minutes</Text>. Would you like to log this session?
            </Text>
            
            <TextInput
              style={[
                styles.notesInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.divider,
                  backgroundColor: colors.background,
                },
              ]}
              multiline
              numberOfLines={4}
              placeholder="How was your meditation? Add reflections or notes..."
              placeholderTextColor={colors.textTertiary}
              value={sessionNotes}
              onChangeText={setSessionNotes}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowLogModal(false);
                  router.back();
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Discard</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveLog}
              >
                <Text style={[styles.modalBtnText, { color: colors.textInverse }]}>Save Log</Text>
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
    padding: spacing.xl,
    justifyContent: "center",
  },
  configContainer: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.huge,
  },
  configHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  configTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: spacing.md,
    fontFamily: SERIF_FONT,
    textAlign: "center",
  },
  configSubtitle: {
    fontSize: 15,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    marginVertical: spacing.xl,
    maxWidth: 320,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
  },
  presetChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxl,
    marginVertical: spacing.xl,
  },
  adjustBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  adjustValue: {
    fontSize: 32,
    fontWeight: "700",
    minWidth: 110,
    textAlign: "center",
  },
  startBtn: {
    width: "100%",
    maxWidth: 300,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  startBtnText: {
    fontSize: 18,
    fontWeight: "700",
  },
  activeContainer: {
    flex: 1,
    justifyContent: "space-around",
    alignItems: "center",
  },
  animationWrapper: {
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  breathingOrb: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  innerOrb: {
    width: 220,
    height: 220,
    borderRadius: 110,
    position: "absolute",
  },
  timeOverlay: {
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: SERIF_FONT,
  },
  instructionText: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: spacing.md,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  controlsRow: {
    flexDirection: "row",
    gap: spacing.xxl,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.huge,
  },
  controlCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
    fontSize: 20,
    fontWeight: "700",
    marginBottom: spacing.sm,
    fontFamily: SERIF_FONT,
  },
  modalText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  notesInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlignVertical: "top",
    fontSize: 15,
    marginBottom: spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  bellConfigCard: {
    width: "100%",
    maxWidth: 300,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  bellConfigHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  bellConfigTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  bellSettingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bellSettingLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  bellSettingDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  intervalOptions: {
    flexDirection: "row",
    gap: 6,
  },
  intervalChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  intervalChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
