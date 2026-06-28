import { getLocalVersion, VersionInfo } from "@/services/SyncService";
import { radius, spacing, useTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AboutScreen() {
  const { colors } = useTheme();
  const [dataVersion, setDataVersion] = useState<VersionInfo | null>(null);
  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const buildNumber = Constants.expoConfig?.android?.versionCode || 1;

  useEffect(() => {
    getLocalVersion().then(setDataVersion);
  }, []);

  const renderSection = (title: string, content: string) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
      <Text style={[styles.sectionText, { color: colors.textSecondary }]}>{content}</Text>
    </View>
  );

  const renderButton = (icon: keyof typeof Ionicons.glyphMap, label: string, url: string) => (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={() => Linking.openURL(url)}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );

  const renderPipelineStep = (icon: keyof typeof Ionicons.glyphMap, step: string, desc: string, isLast = false) => (
    <View style={styles.pipelineStep}>
      <View style={styles.pipelineIconWrapper}>
        <View style={[styles.pipelineIcon, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        {!isLast && <View style={[styles.pipelineLine, { backgroundColor: colors.primary }]} />}
      </View>
      <View style={styles.pipelineContent}>
        <Text style={[styles.pipelineStepTitle, { color: colors.textPrimary }]}>{step}</Text>
        <Text style={[styles.pipelineStepDesc, { color: colors.textSecondary }]}>{desc}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
      <Stack.Screen options={{ title: "About Saddhamma" }} />
      
      <View style={styles.header}>
        <Image 
          source={require("../../../../assets/images/icon.png")} 
          style={styles.logo} 
        />
        <Text style={[styles.appName, { color: colors.textPrimary }]}>Saddhamma</Text>
        <Text style={[styles.appVersion, { color: colors.textTertiary }]}>
          Version {appVersion} (Build {buildNumber})
        </Text>
      </View>

      <View style={styles.content}>
        {renderSection(
          "Our Mission",
          "Saddhamma is a high-performance, offline-first reader dedicated to providing easy access to the Pāli Canon. Our goal is to make the Buddha's teachings available to everyone, everywhere, without the need for an internet connection."
        )}

        {renderSection(
          "Privacy & Offline Verification",
          "Saddhamma is built with privacy and offline capability at its core. There is no telemetry, no tracking, and no collection of personal information. All your reading history, settings, search logs, and bookmarks remain entirely on your device in local SQLite databases and configurations. Network activity is limited exclusively to downloading Sutta updates from GitHub Releases when requested."
        )}

        {renderSection(
          "Open Source",
          "This project is entirely open-source and licensed under GPL-3.0. We believe in the free distribution of the Dhamma and the software that carries it."
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Contact Us</Text>
          <Pressable 
            onPress={() => Linking.openURL("mailto:dipantan755@gmail.com")}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
              For any queries, suggestions, or grievance redressal, please email us at <Text style={{ color: colors.primary, fontWeight: "600" }}>dipantan755@gmail.com</Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Dhamma Pipeline</Text>
          <View style={styles.pipelineContainer}>
            {renderPipelineStep("logo-github", "Upstream", "SuttaCentral bilara-data repository")}
            {renderPipelineStep("server-outline", "Server", "API server processes & packages data")}
            {renderPipelineStep("phone-portrait-outline", "App", "Saddhamma builds local search index", true)}
          </View>
          <View style={[styles.syncInfo, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.syncInfoText, { color: colors.textSecondary }]}>
              Commit: <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{dataVersion?.commit?.substring(0, 7) || "Unknown"}</Text>
            </Text>
            <Text style={[styles.syncInfoText, { color: colors.textSecondary }]}>
              Last Synced: <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{
                dataVersion?.timestamp || dataVersion?.date || dataVersion?.updated_at 
                  ? new Date(dataVersion.timestamp || dataVersion.date || dataVersion.updated_at || "").toLocaleDateString() 
                  : "Never"
              }</Text>
            </Text>
          </View>
        </View>

        {renderSection(
          "Credits",
          "All Sutta texts and metadata are provided by SuttaCentral. We are deeply grateful for their tireless work in making the Pāli Canon freely available to the world."
        )}

        <View style={styles.buttonGroup}>
          {renderButton("globe-outline", "Official Website", "https://saddhamma.online")}
          {renderButton("book", "SuttaCentral", "https://suttacentral.net")}
        </View>

        <View style={styles.buttonGroup}>
          {renderButton("logo-github", "View Source Code", "https://github.com/dipantan/Saddhamma")}
          {renderButton("shield-checkmark-outline", "Privacy Policy", "https://saddhamma.online/privacy.html")}
        </View>

        <View style={styles.buttonGroup}>
          {renderButton("bug-outline", "Report an Issue", "https://github.com/dipantan/Saddhamma/issues")}
        </View>

        {renderSection(
          "Tech Stack",
          "Built with modern technologies to ensure speed and reliability:\n• Expo SDK 56\n• React Native\n• SQLite FTS5\n• Expo Router"
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            May all beings be happy and free.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingVertical: spacing.huge,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
  },
  appVersion: {
    fontSize: 13,
    marginTop: spacing.xs,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    paddingVertical: spacing.huge,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  pipelineContainer: {
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  pipelineStep: {
    flexDirection: "row",
    gap: spacing.md,
  },
  pipelineIconWrapper: {
    alignItems: "center",
  },
  pipelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  pipelineLine: {
    width: 2,
    flex: 1,
    marginVertical: -2,
  },
  pipelineContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  pipelineStepTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  pipelineStepDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  syncInfo: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  syncInfoText: {
    fontSize: 12,
  },
});
