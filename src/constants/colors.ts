/**
 * BillSplit color palette — light theme, Wise/Revolut style.
 *
 * Professional minimal palette with emerald green accent.
 */
export const Colors = {
  // ── Backgrounds ───────────────────────────────────────────
  background: '#FFFFFF',
  surfacePrimary: '#F8F9FA',
  surfaceSecondary: '#F0F2F5',
  surfaceTertiary: '#E8EAF0',

  // ── Text ──────────────────────────────────────────────────
  textPrimary: '#1A1A2E',
  textSecondary: '#4A4A68',
  textTertiary: '#8A8AA0',
  textInverse: '#FFFFFF',

  // ── Accent — Emerald Green ────────────────────────────────
  accent: '#10B981',
  accentMuted: '#059669',
  accentSurface: 'rgba(16, 185, 129, 0.08)',

  // ── Semantic ──────────────────────────────────────────────
  positive: '#10B981',
  negative: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // ── Borders & Dividers ────────────────────────────────────
  border: '#E8E8EE',
  borderLight: '#F0F0F5',
  divider: '#F0F2F5',

  // ── Tab bar ───────────────────────────────────────────────
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E8E8EE',
  tabIconDefault: '#8A8AA0',
  tabIconSelected: '#10B981',

  // ── Overlays ──────────────────────────────────────────────
  overlay: 'rgba(0, 0, 0, 0.30)',
  scrim: 'rgba(0, 0, 0, 0.50)',

  // ── Misc ──────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof Colors;
