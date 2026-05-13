import React from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { EmptyState } from "@/components";
import { useTheme } from "@/theme";

export default function BookmarksScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Bookmarks" }} />
      <EmptyState
        icon="🔖"
        title="Your Bookmarks"
        subtitle="Saved suttas will appear here for quick offline access."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
