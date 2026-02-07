/**
 * Design tokens matching the Motif. design language.
 * Dark mode with pastel accents. Premium, editorial feel.
 * Mobile-first, accessible.
 */
export const designTokens = {
  colors: {
    // Core palette - Dark mode
    bg: '#0e0e11',
    surface: '#18181c',
    text: '#e8e8ec',
    muted: '#8a8a94',
    line: '#35353d',

    // Primary Accent - Pink
    accent: '#ef476f',
    accentLight: '#f26b8a',
    accentDark: '#c4304f',

    // Secondary Accent - Green
    accentSecondary: '#06d6a0',
    accentSecondaryLight: '#3de8b8',
    accentSecondaryDark: '#05b384',

    // Color Palette
    coral: '#ef476f',
    mint: '#06d6a0',
    lime: '#3de8b8',

    // Functional
    success: '#06d6a0',
    info: '#06d6a0',
    warn: '#ef476f',
    error: '#ef476f',
  },

  fonts: {
    sans: "var(--font-sans)",
    serif: "var(--font-serif)",
  },

  // Mobile-first type scale (base 18px)
  typography: {
    h1: {
      size: '2.5rem',
      weight: 400,
      lineHeight: 1.15,
      letterSpacing: '0.02em',
    },
    h2: {
      size: '1.75rem',
      weight: 400,
      lineHeight: 1.2,
      letterSpacing: '0.02em',
    },
    h3: {
      size: '1.5rem',
      weight: 400,
      lineHeight: 1.25,
    },
    body: {
      size: '1rem',
      weight: 400,
      lineHeight: 1.6,
    },
    caption: {
      size: '0.8125rem',
      weight: 400,
      lineHeight: 1.4,
      letterSpacing: '0.02em',
    },
    micro: {
      size: '0.6875rem',
      weight: 400,
      lineHeight: 1.3,
      letterSpacing: '0.06em',
    },
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    screenPadding: '1.25rem',
    screenPaddingSm: '1.75rem',
  },

  radius: {
    sm: '8px',
    md: '14px',
    lg: '18px',
  },

  shadows: {
    card: '0 4px 12px rgba(0, 0, 0, 0.2)',
    cardHover: '0 6px 20px rgba(0, 0, 0, 0.25)',
  },

  transitions: {
    fast: '120ms ease-out',
    base: '200ms ease-out',
    slow: '320ms ease-out',
  },
} as const;

export type DesignTokens = typeof designTokens;
