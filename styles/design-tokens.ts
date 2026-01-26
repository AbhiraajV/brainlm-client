/**
 * Design tokens matching the Motif. design language.
 * Warm, calm neutrals + teal/copper accent. Premium, editorial feel.
 * Mobile-first, accessible.
 */
export const designTokens = {
  colors: {
    // Core palette
    bg: '#F6F4F2',           // Warm off-white background
    surface: '#FFFFFF',       // Pure white for cards
    text: '#222425',          // Soft charcoal for body
    muted: '#6D6F71',         // Secondary text, captions
    line: '#E6E4E2',          // Dividers, subtle borders

    // Primary Accent - Teal (buttons, links, focus rings)
    accent: '#0D9488',
    accentLight: '#14B8A6',
    accentDark: '#0F766E',

    // Secondary Accent - Copper (highlights, callouts, insights)
    accentSecondary: '#C2410C',
    accentSecondaryLight: '#EA580C',
    accentSecondaryDark: '#9A3412',

    // Functional
    success: '#0D9488',
    warn: '#D97706',
    error: '#DC2626',
  },

  fonts: {
    sans: "var(--font-inter), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    serif: "var(--font-playfair), Georgia, serif",
  },

  // Mobile-first type scale (base 16px)
  typography: {
    h1: {
      size: '1.75rem',      // 28px
      weight: 600,
      lineHeight: 1.15,
      letterSpacing: '-0.01em',
    },
    h2: {
      size: '1.25rem',      // 20px
      weight: 600,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h3: {
      size: '1.125rem',     // 18px
      weight: 600,
      lineHeight: 1.25,
    },
    body: {
      size: '1rem',         // 16px
      weight: 400,
      lineHeight: 1.6,
    },
    caption: {
      size: '0.8125rem',    // 13px
      weight: 400,
      lineHeight: 1.4,
      letterSpacing: '0.02em',
    },
    micro: {
      size: '0.6875rem',    // 11px
      weight: 400,
      lineHeight: 1.3,
      letterSpacing: '0.06em',
    },
  },

  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    screenPadding: '1.25rem',  // 20px mobile
    screenPaddingSm: '1.75rem', // 28px tablet+
  },

  radius: {
    sm: '8px',
    md: '14px',
    lg: '18px',
  },

  shadows: {
    card: '0 6px 18px rgba(34, 36, 37, 0.06)',
    cardHover: '0 8px 24px rgba(34, 36, 37, 0.1)',
  },

  transitions: {
    fast: '120ms ease-out',
    base: '200ms ease-out',
    slow: '320ms ease-out',
  },
} as const;

export type DesignTokens = typeof designTokens;
