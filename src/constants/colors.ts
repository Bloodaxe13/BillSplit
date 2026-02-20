/**
 * BillSplit color palette — dark theme with vibrant accents.
 *
 * The palette is designed for high contrast on OLED screens and
 * accessibility-friendly color pairings.
 */
export const Colors = {
  // ── Backgrounds ───────────────────────────────────────────
  background: '#0A0A0F',
  surfacePrimary: '#141420',
  surfaceSecondary: '#1C1C2E',
  surfaceTertiary: '#252540',

  // ── Text ──────────────────────────────────────────────────
  textPrimary: '#F0F0F5',
  textSecondary: '#9A9AB0',
  textTertiary: '#5C5C73',
  textInverse: '#0A0A0F',

  // ── Accent — Split Green ──────────────────────────────────
  accent: '#00E676',
  accentMuted: '#00C864',
  accentSurface: 'rgba(0, 230, 118, 0.10)',

  // ── Semantic ──────────────────────────────────────────────
  positive: '#00E676',
  negative: '#FF5252',
  warning: '#FFB74D',
  info: '#448AFF',

  // ── Borders & Dividers ────────────────────────────────────
  border: '#2A2A42',
  borderLight: '#1E1E34',
  divider: '#1A1A2E',

  // ── Tab bar ───────────────────────────────────────────────
  tabBarBackground: '#0F0F18',
  tabBarBorder: '#1A1A2E',
  tabIconDefault: '#5C5C73',
  tabIconSelected: '#00E676',

  // ── Overlays ──────────────────────────────────────────────
  overlay: 'rgba(0, 0, 0, 0.60)',
  scrim: 'rgba(10, 10, 15, 0.85)',

  // ── Misc ──────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof Colors;
