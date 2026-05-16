// QuickDART mobile design system.
// Confident, trustworthy, calm — built for someone reporting a disaster under
// stress. Depth and a clear brand identity, without visual noise.

export const colors = {
  // Backgrounds
  bg: '#EEF2F8',          // app canvas (cool light)
  bgElevated: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E3E8F0',
  borderStrong: '#CBD5E1',

  // Brand (deep navy → indigo)
  brand: '#0F2A4A',
  brandMid: '#1E3A8A',
  brandText: '#FFFFFF',

  // Primary action (vivid blue)
  primary: '#2563EB',
  primaryBright: '#3B82F6',
  primaryDark: '#1D4ED8',
  primarySoft: '#EAF1FE',

  // Text
  text: '#0B1A2F',
  textMuted: '#5A6B82',
  textFaint: '#94A3B8',
  onPrimary: '#FFFFFF',
  onBrand: '#E7EEF8',

  // Semantic
  success: '#0E9F6E',
  successSoft: '#E6F6F0',
  warning: '#D97706',
  warningSoft: '#FEF4E6',
  danger: '#E02424',
  dangerSoft: '#FDECEC',
};

export const gradients = {
  brand: ['#0F2A4A', '#1E3A8A', '#2547A6'] as const, // hero / headers
  primary: ['#3B82F6', '#2563EB'] as const,           // primary button
  success: ['#10B981', '#0E9F6E'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 44,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const typography = {
  hero: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  display: { fontSize: 25, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.4 },
  title: { fontSize: 19, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 14.5, color: colors.textMuted, lineHeight: 21 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 12, color: colors.textFaint },
};

// Layered elevation scale.
export const elevation = {
  e1: {
    shadowColor: '#0B1A2F',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  e2: {
    shadowColor: '#0B1A2F',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  e3: {
    shadowColor: '#0B1A2F',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
};
