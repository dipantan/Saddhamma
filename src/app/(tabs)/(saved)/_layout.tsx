import { Stack } from "expo-router/stack";

export default function BookmarksLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Bookmarks",
        }}
      />
    </Stack>
  );
}
