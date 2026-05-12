import { Stack } from "expo-router/stack";

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          title: "Search",
          presentation: 'modal',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
