/**
 * Design tokens matching the Motif. design language.
 * Dark mode with pastel accents. Premium, editorial feel.
 * Mobile-first, accessible.
 */
export const designTokens = {
  colors: {
    // Core palette - Dark mode, softer feel
    bg: '#1a1a1f',
    surface: '#252529',
    text: '#e8e8ec',
    muted: '#8a8a94',
    line: '#35353d',

    // Primary Accent - Coral
    accent: '#ee6055',
    accentLight: '#f17d74',
    accentDark: '#d94d42',

    // Secondary Accent - Mint
    accentSecondary: '#60d394',
    accentSecondaryLight: '#aaf683',
    accentSecondaryDark: '#4cb87d',

    // Color Palette
    coral: '#ee6055',
    mint: '#60d394',
    lime: '#aaf683',

    // Functional
    success: '#60d394',
    info: '#60d394',
    warn: '#ee6055',
    error: '#ee6055',
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
