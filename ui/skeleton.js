/**
 * Skeleton Component & SkeletonCard Variant
 * Renders placeholders with smooth shimmering animation.
 * Configurable via width, height, and border-radius tokens.
 */

import { UI_CONFIG } from './config.js';

/**
 * Normalizes CSS size values (e.g., converts 24 -> '24px').
 */
function normalizeSize(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return `${val}px`;
  return String(val);
}

/**
 * Resolves radius value from UI_CONFIG scale or returns raw CSS value.
 */
function resolveRadius(radius) {
  if (!radius) return UI_CONFIG.radius.md;
  if (UI_CONFIG.radius[radius]) return UI_CONFIG.radius[radius];
  if (typeof radius === 'number') return `${radius}px`;
  return radius;
}

/**
 * Creates a Skeleton element with shimmer animation.
 * 
 * @param {Object} [props]
 * @param {string|number} [props.width='100%'] - Width (e.g. '100%', 80, '64px')
 * @param {string|number} [props.height='16px'] - Height (e.g. 20, '40px')
 * @param {string|number} [props.radius='md'] - Radius key from UI_CONFIG or CSS length
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {Object} [props.style={}] - Additional inline styles
 * @returns {HTMLElement} The shimmer skeleton DOM element
 */
export function Skeleton(props = {}) {
  const {
    width = '100%',
    height = '16px',
    radius = 'md',
    className = '',
    style = {},
  } = props;

  const el = document.createElement('div');
  el.className = `bca-skeleton ${className}`.trim();

  const resolvedW = normalizeSize(width);
  const resolvedH = normalizeSize(height);
  const resolvedR = resolveRadius(radius);

  if (resolvedW) el.style.width = resolvedW;
  if (resolvedH) el.style.height = resolvedH;
  if (resolvedR) el.style.borderRadius = resolvedR;

  // Apply extra inline styles if any
  Object.assign(el.style, style);

  // Helper method for HTML string generation
  el.toHTML = () => el.outerHTML;

  return el;
}

/**
 * Generates an HTML string for a Skeleton without requiring immediate DOM creation.
 * 
 * @param {Object} props 
 * @returns {string} HTML string
 */
export function skeletonHTML(props = {}) {
  const el = Skeleton(props);
  return el.outerHTML;
}

/**
 * Pre-configured Card Skeleton Variant.
 * Renders a full card placeholder with cover, title, subtitle, and badges.
 * 
 * @param {Object} [props]
 * @param {boolean} [props.hasCover=true] - Whether to show the top image/banner skeleton
 * @param {number} [props.lines=2] - Number of text lines
 * @param {boolean} [props.hasFooter=true] - Whether to show footer badges
 * @param {string} [props.className=''] - Additional class names
 * @returns {HTMLElement} The card skeleton element
 */
export function SkeletonCard(props = {}) {
  const {
    hasCover = true,
    lines = 2,
    hasFooter = true,
    className = '',
  } = props;

  const card = document.createElement('div');
  card.className = `bca-skeleton-card ${className}`.trim();
  card.style.borderRadius = UI_CONFIG.radius.xl;

  // Optional cover banner
  if (hasCover) {
    const cover = Skeleton({
      width: '100%',
      height: '110px',
      radius: 'lg',
      className: 'bca-skeleton-card-cover',
    });
    card.appendChild(cover);
  }

  // Title line
  const title = Skeleton({
    width: '75%',
    height: '18px',
    radius: 'sm',
    className: 'bca-skeleton-card-title',
  });
  card.appendChild(title);

  // Text lines
  for (let i = 0; i < lines; i++) {
    const lineWidth = i === lines - 1 ? '50%' : '90%';
    const line = Skeleton({
      width: lineWidth,
      height: '14px',
      radius: 'xs',
      className: 'bca-skeleton-card-subtitle',
    });
    card.appendChild(line);
  }

  // Optional footer tags / badges
  if (hasFooter) {
    const footer = document.createElement('div');
    footer.className = 'bca-skeleton-card-footer';

    const badge1 = Skeleton({
      width: '64px',
      height: '22px',
      radius: 'full',
      className: 'bca-skeleton-badge',
    });
    const badge2 = Skeleton({
      width: '84px',
      height: '22px',
      radius: 'full',
      className: 'bca-skeleton-badge',
    });

    footer.appendChild(badge1);
    footer.appendChild(badge2);
    card.appendChild(footer);
  }

  card.toHTML = () => card.outerHTML;

  return card;
}

// Global exposure
if (typeof window !== 'undefined') {
  if (!window.BCA_UI) window.BCA_UI = {};
  window.BCA_UI.Skeleton = Skeleton;
  window.BCA_UI.skeletonHTML = skeletonHTML;
  window.BCA_UI.SkeletonCard = SkeletonCard;
}
