/**
 * BCAPrime Central UI Configuration
 * Defines design tokens, timing, radius, spacing, and haptic feedback
 * All reusable UI components derive their values from this configuration.
 */

export const UI_CONFIG = {
  // Animation duration (200ms as required)
  animation: {
    duration: 200, // milliseconds
    durationCss: '200ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)', // smooth spring-like curve
    easingOut: 'cubic-bezier(0.2, 0, 0, 1)',
  },

  // Border radius scale
  radius: {
    none: '0px',
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '18px',
    '2xl': '24px',
    full: '9999px',
  },

  // Spacing scale
  spacing: {
    '2xs': '2px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
  },

  // Pressable scale factor
  pressable: {
    scale: 0.97,
    hapticMs: 10, // Light haptic vibration in ms
  },

  // Toast settings
  toast: {
    defaultDuration: 2500, // 2-3 seconds default
    minDuration: 1500,
    maxDuration: 5000,
  },

  // Z-index hierarchy
  zIndex: {
    toast: 99999,
    bottomSheet: 9990,
    backdrop: 9989,
  },

  // Design theme colors
  colors: {
    canvas: '#FFFFFF',
    surface: '#F8F9FA',
    border: '#E5E7EB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    backdrop: 'rgba(0, 0, 0, 0.45)',
    shimmerBase: '#E5E7EB',
    shimmerHighlight: '#F3F4F6',
    success: '#10B981',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    errorBorder: '#FECACA',
    info: '#3B82F6',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',
  },
};

/**
 * Injects CSS variables onto :root based on UI_CONFIG
 * Keeps CSS stylesheet in 100% sync with JS configuration.
 */
export function injectUIConfigCssVariables(config = UI_CONFIG) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--bca-anim-duration', config.animation.durationCss);
  root.style.setProperty('--bca-anim-easing', config.animation.easing);
  root.style.setProperty('--bca-press-scale', String(config.pressable.scale));

  // Radius
  Object.entries(config.radius).forEach(([key, val]) => {
    root.style.setProperty(`--bca-radius-${key}`, val);
  });

  // Spacing
  Object.entries(config.spacing).forEach(([key, val]) => {
    root.style.setProperty(`--bca-space-${key}`, val);
  });

  // Z-indexes
  Object.entries(config.zIndex).forEach(([key, val]) => {
    root.style.setProperty(`--bca-z-${key}`, String(val));
  });

  // Colors
  Object.entries(config.colors).forEach(([key, val]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(`--bca-color-${cssKey}`, val);
  });
}

// Auto-inject CSS variables when running in browser
if (typeof window !== 'undefined') {
  injectUIConfigCssVariables(UI_CONFIG);
  if (!window.BCA_UI) window.BCA_UI = {};
  window.BCA_UI.config = UI_CONFIG;
}
