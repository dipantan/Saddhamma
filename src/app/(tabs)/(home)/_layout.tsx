import { useTheme } from "@/theme";
import { Stack } from "expo-router/stack";
import { Platform } from "react-native";

export default function HomeLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        // Large titles and transparency are more stable on iOS. 
        // On Android, they can trigger the ColorSchemeCoordinator crash.
        headerLargeTitle: Platform.OS === 'ios',
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: Platform.OS === 'ios' ? "regular" : undefined,
        headerTintColor: colors.headerText,
        headerStyle: {
          backgroundColor: Platform.OS === 'android' ? colors.headerBackground : 'transparent',
        },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Saddhamma",
        }}
      />
    </Stack>
  );
}
