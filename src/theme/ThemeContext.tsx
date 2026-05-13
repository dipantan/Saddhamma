import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useColorScheme as useSystemScheme } from "react-native";
import { lightColors, darkColors, type ThemeColors } from "./tokens";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  /** Currently-resolved colors (never "system" — always concrete). */
  colors: ThemeColors;
  /** The user-selected preference. */
  mode: ThemeMode;
  /** Whether the resolved scheme is dark. */
  isDark: boolean;
  /** Switch theme mode. */
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  mode: "system",
  isDark: false,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemScheme();
  const [mode, setMode] = useState<ThemeMode>("system");

  const resolved = useMemo(() => {
    if (mode === "system") return systemScheme === "dark" ? "dark" : "light";
    return mode;
  }, [mode, systemScheme]);

  const isDark = resolved === "dark";
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({ colors, mode, isDark, setMode }),
    [colors, mode, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Hook to access theme colors and mode in any component. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
