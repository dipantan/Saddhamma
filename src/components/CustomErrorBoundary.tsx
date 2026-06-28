import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { ErrorBoundaryProps, useRouter } from "expo-router";
import { useTheme } from "@/theme";
import { spacing, radius } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { generateErrorReport, logError, sendErrorEmail } from "@/services/LoggerService";

const SERIF_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

export function CustomErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [reportText, setReportText] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    logError(error, "ExpoRouter ErrorBoundary");
    generateErrorReport(error, "ExpoRouter Boundary").then(setReportText);
  }, [error]);

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const fullReport = reportText || await generateErrorReport(error, "ExpoRouter Boundary");
      await sendErrorEmail(fullReport, `Saddhamma App Error: ${error?.message || "Unknown Exception"}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: colors.error + "15" }]}>
          <Ionicons name="warning-outline" size={40} color={colors.error} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Something Went Wrong
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          An unexpected error occurred in this screen. Don't worry, your data is safe. You can send a crash report directly to the developer to help fix it.
        </Text>

        <View style={[styles.errorBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.errorName, { color: colors.error }]}>
            {error?.name || "Error"}
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textPrimary }]}>
            {error?.message || String(error)}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary, opacity: pressed || isSending ? 0.8 : 1 }
            ]}
            onPress={handleSendEmail}
            disabled={isSending}
          >
            <Ionicons name="mail-outline" size={20} color={colors.textInverse} style={{ marginRight: 8 }} />
            <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>
              {isSending ? "Opening Mail..." : "Send Error Report (Email)"}
            </Text>
          </Pressable>

          <View style={styles.secondaryRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={retry}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Try Again</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => router.replace("/")}
            >
              <Ionicons name="home-outline" size={18} color={colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Go Home</Text>
            </Pressable>
          </View>
        </View>

        <Pressable 
          style={styles.detailsToggle} 
          onPress={() => setShowDetails(!showDetails)}
        >
          <Text style={[styles.detailsToggleText, { color: colors.primary }]}>
            {showDetails ? "Hide Stack Trace ▲" : "View Detailed Diagnostics ▼"}
          </Text>
        </Pressable>

        {showDetails && (
          <ScrollView style={[styles.detailsScroll, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.detailsText, { color: colors.textSecondary }]}>
              {reportText}
            </Text>
          </ScrollView>
        )}
      </View>
    </View>
  );
}
export default CustomErrorBoundary;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: SERIF_FONT,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  errorBox: {
    width: "100%",
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  errorName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionButtons: {
    width: "100%",
    gap: spacing.md,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    width: "100%",
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailsToggle: {
    marginTop: spacing.xl,
    padding: spacing.sm,
  },
  detailsToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  detailsScroll: {
    width: "100%",
    maxHeight: 200,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  detailsText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
