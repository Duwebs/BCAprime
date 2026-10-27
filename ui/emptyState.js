/**
 * EmptyState Component
 * Displays a friendly empty placeholder with icon, message, and optional action button.
 */

import { UI_CONFIG } from './config.js';
import { PressableScale } from './pressable.js';

// Default clean search/inbox outline SVG icon
const DEFAULT_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <line x1="8" y1="11" x2="14" y2="11"></line>
</svg>
`;

/**
 * Creates an EmptyState component.
 * 
 * @param {Object} props
 * @param {string|HTMLElement} [props.icon] - SVG string, emoji, or DOM node
 * @param {string} [props.title=''] - Heading text
 * @param {string} [props.message=''] - Descriptive message
 * @param {Object} [props.action] - Optional action button config
 * @param {string} [props.action.label] - Action button label
 * @param {Function} [props.action.onClick] - Action button click handler
 * @param {string} [props.action.variant='primary'] - 'primary' | 'secondary'
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {HTMLElement} The EmptyState DOM element
 */
export function EmptyState(props = {}) {
  const {
    icon = DEFAULT_ICON_SVG,
    title = '',
    message = '',
    action = null,
    className = '',
  } = props;

  const container = document.createElement('div');
  container.className = `bca-empty-state ${className}`.trim();

  // 1. Icon Bubble
  const iconWrap = document.createElement('div');
  iconWrap.className = 'bca-empty-state-icon-wrap';

  if (typeof icon === 'string') {
    // If it looks like HTML/SVG
    if (icon.trim().startsWith('<')) {
      iconWrap.innerHTML = icon;
    } else {
      // Plain text or emoji
      iconWrap.textContent = icon;
    }
  } else if (icon instanceof HTMLElement) {
    iconWrap.appendChild(icon);
  }
  container.appendChild(iconWrap);

  // 2. Title (Optional)
  if (title) {
    const titleEl = document.createElement('h4');
    titleEl.className = 'bca-empty-state-title';
    titleEl.textContent = title;
    container.appendChild(titleEl);
  }

  // 3. Message (Required/Main text)
  if (message) {
    const messageEl = document.createElement('p');
    messageEl.className = 'bca-empty-state-message';
    messageEl.textContent = message;
    container.appendChild(messageEl);
  }

  // 4. Action Button (Optional)
  if (action && action.label) {
    const button = document.createElement('button');
    button.className = 'bca-empty-state-action';
    button.textContent = action.label;

    if (action.variant === 'secondary') {
      button.style.backgroundColor = UI_CONFIG.colors.surface;
      button.style.color = UI_CONFIG.colors.textPrimary;
      button.style.borderColor = UI_CONFIG.colors.border;
    }

    // Wrap with PressableScale for 0.97 scale and haptics on press
    PressableScale(button, {
      onClick: action.onClick,
    });

    container.appendChild(button);
  }

  container.toHTML = () => container.outerHTML;

  return container;
}

// Global exposure
if (typeof window !== 'undefined') {
  if (!window.BCA_UI) window.BCA_UI = {};
  window.BCA_UI.EmptyState = EmptyState;
}
