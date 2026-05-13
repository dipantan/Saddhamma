/**
 * Design tokens for the Saddhamma app.
 * Centralises all spacing, radius, typography, and color values.
 * Every screen/component should reference these tokens instead of
 * hard-coding colors or dimensions.
 */

// ─── Spacing scale (4-point grid) ───────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

// ─── Border radius ──────────────────────────────────────────────
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

// ─── Typography presets (Jetpack Compose style keys) ────────────
// These map to Material3 Typography keys used by @expo/ui Text
export const typography = {
  displayLarge: "displayLarge",
  displayMedium: "displayMedium",
  displaySmall: "displaySmall",
  headlineLarge: "headlineLarge",
  headlineMedium: "headlineMedium",
  headlineSmall: "headlineSmall",
  titleLarge: "titleLarge",
  titleMedium: "titleMedium",
  titleSmall: "titleSmall",
  bodyLarge: "bodyLarge",
  bodyMedium: "bodyMedium",
  bodySmall: "bodySmall",
  labelLarge: "labelLarge",
  labelMedium: "labelMedium",
  labelSmall: "labelSmall",
} as const;

// ─── Color palettes ─────────────────────────────────────────────
// Carefully chosen for readability, calm feel, and a11y contrast.

export const palette = {
  // Warm saffron / ochre accent — evokes traditional Theravāda robes
  saffron50: "#FFF8E1",
  saffron100: "#FFECB3",
  saffron200: "#FFD54F",
  saffron400: "#FFCA28",
  saffron600: "#F9A825",
  saffron700: "#F57F17",

  // Serene teal accent — calm, focused
  teal50: "#E0F2F1",
  teal100: "#B2DFDB",
  teal200: "#80CBC4",
  teal400: "#26A69A",
  teal600: "#00897B",
  teal700: "#00796B",

  // Brand blue (from existing splash/tab tint)
  brand: "#208AEF",
  brandLight: "#5EABF5",
  brandDark: "#1565C0",

  // Neutrals
  white: "#FFFFFF",
  black: "#000000",
  grey50: "#FAFAFA",
  grey100: "#F5F5F5",
  grey200: "#EEEEEE",
  grey300: "#E0E0E0",
  grey400: "#BDBDBD",
  grey500: "#9E9E9E",
  grey600: "#757575",
  grey700: "#616161",
  grey800: "#424242",
  grey850: "#303030",
  grey900: "#212121",
  grey950: "#171717",

  // Semantic
  error: "#D32F2F",
  errorLight: "#EF5350",
  success: "#2E7D32",
  successLight: "#4CAF50",
  warning: "#F9A825",
} as const;

// ─── Themed color maps ──────────────────────────────────────────

export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceVariant: string;
  card: string;
  cardBorder: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textPali: string;
  textLink: string;

  // Interactive
  primary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  accent: string;

  // Semantic
  error: string;
  errorContainer: string;
  success: string;

  // Divider & borders
  divider: string;
  border: string;
  outline: string;

  // Header
  headerBackground: string;
  headerText: string;

  // Icon
  icon: string;
  iconSecondary: string;

  // Status bar
  statusBarStyle: "light" | "dark" | "auto";
}

export const lightColors: ThemeColors = {
  background: "#F8F6F2",       // Warm off-white — easy on the eyes
  surface: palette.white,
  surfaceVariant: palette.grey100,
  card: palette.white,
  cardBorder: palette.grey200,

  textPrimary: "#1A1A1A",
  textSecondary: "#5A5A5A",
  textTertiary: "#8A8A8A",
  textInverse: palette.white,
  textPali: "#7B6B4A",          // Warm brown for Pāli text
  textLink: palette.brand,

  primary: palette.brand,
  primaryContainer: "#E3F2FD",
  onPrimaryContainer: palette.brandDark,
  accent: palette.teal600,

  error: palette.error,
  errorContainer: "#FFEBEE",
  success: palette.success,

  divider: "rgba(0,0,0,0.08)",
  border: palette.grey300,
  outline: palette.grey400,

  headerBackground: palette.white,
  headerText: "#1A1A1A",

  icon: "#4A4A4A",
  iconSecondary: palette.grey500,

  statusBarStyle: "dark",
};

export const darkColors: ThemeColors = {
  background: "#121212",
  surface: "#1E1E1E",
  surfaceVariant: "#2A2A2A",
  card: "#1E1E1E",
  cardBorder: "#333333",

  textPrimary: "#E8E6E1",      // Warm off-white
  textSecondary: "#A8A8A8",
  textTertiary: "#707070",
  textInverse: "#1A1A1A",
  textPali: "#C4A96A",          // Warm gold for Pāli in dark mode
  textLink: palette.brandLight,

  primary: palette.brandLight,
  primaryContainer: "#1A3A5C",
  onPrimaryContainer: "#B3D7FF",
  accent: palette.teal200,

  error: palette.errorLight,
  errorContainer: "#3B1C1C",
  success: palette.successLight,

  divider: "rgba(255,255,255,0.08)",
  border: "#3A3A3A",
  outline: "#555555",

  headerBackground: "#1E1E1E",
  headerText: "#E8E6E1",

  icon: "#B0B0B0",
  iconSecondary: "#707070",

  statusBarStyle: "light",
};
