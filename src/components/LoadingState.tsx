import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme, spacing } from "@/theme";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading…" }: LoadingStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxxl,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});

