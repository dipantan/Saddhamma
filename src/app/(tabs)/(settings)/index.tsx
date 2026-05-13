import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SectionHeader } from "@/components";
import { useTheme, spacing, radius, type ThemeMode } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { buildFullTextIndex } from "@/services/DataService";

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Idle");

  const toggleTheme = () => {
    const next: Record<ThemeMode, ThemeMode> = {
      system: "light",
      light: "dark",
      dark: "system",
    };
    setMode(next[mode]);
  };

  const handleStartIndexing = async () => {
    setIsIndexing(true);
    setStatus("Indexing…");
    try {
      await buildFullTextIndex((processed, total) => {
        setProgress(processed / total);
        setStatus(`Indexed ${processed} of ${total} suttas`);
      });
      setStatus("Indexing Complete");
    } catch (err) {
      console.error(err);
      setStatus("Indexing Failed");
    } finally {
      setIsIndexing(false);
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

      <SectionHeader title="Data & Search" subtitle="Manage offline search index" />
      <View style={styles.section}>
        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {status}
          </Text>
          {isIndexing && (
            <View style={styles.progressWrapper}>
              <View style={[styles.progressBar, { backgroundColor: colors.divider }]}>
                <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
              </View>
              <Text style={[styles.progressPercent, { color: colors.textTertiary }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          )}
        </View>
        {renderSettingRow({
          icon: "search",
          label: "Rebuild Search Index",
          onPress: handleStartIndexing,
          disabled: isIndexing,
        })}
      </View>

      <SectionHeader title="About" />
      <View style={styles.section}>
        {renderSettingRow({
          icon: "information-circle",
          label: "License & Source",
          onPress: () => Linking.openURL("https://suttacentral.net/licensing"),
        })}
        {renderSettingRow({
          icon: "code-working",
          label: "App Version",
          value: "1.2.0 (Build 56)",
          onPress: () => {},
        })}
      </View>

      <View style={styles.footer}>
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
  },
});
