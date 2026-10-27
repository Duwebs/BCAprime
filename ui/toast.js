/**
 * Toast Component
 * Displays lightweight floating notification toasts anchored at the bottom.
 * Supports 'success', 'error', and 'info' variants with 200ms slide-up and 2-3s auto-dismiss.
 */

import { UI_CONFIG } from './config.js';
import { triggerLightHaptic } from './pressable.js';

// Icons for variants
const ICONS = {
  success: `
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
    </svg>
  `,
  error: `
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
    </svg>
  `,
  info: `
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
    </svg>
  `,
};

class ToastManager {
  constructor() {
    this.container = null;
    this.activeToasts = new Set();
  }

  _ensureContainer() {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }
    this.container = document.createElement('div');
    this.container.className = 'bca-toast-container';
    document.body.appendChild(this.container);
    return this.container;
  }

  /**
   * Shows a toast message
   * 
   * @param {Object} options
   * @param {string} options.message - The text message
   * @param {'success'|'error'|'info'} [options.variant='info'] - Visual variant
   * @param {number} [options.duration=2500] - Duration in ms before auto dismiss (2-3s)
   * @param {Function} [options.onClose] - Callback when toast is dismissed
   * @returns {HTMLElement} The toast element
   */
  show(options = {}) {
    const {
      message = '',
      variant = 'info',
      duration = UI_CONFIG.toast.defaultDuration,
      onClose = null,
    } = options;

    const container = this._ensureContainer();

    // Trigger haptic feedback
    triggerLightHaptic();

    // Create Toast Element
    const toast = document.createElement('div');
    toast.className = `bca-toast bca-toast--${variant}`;
    toast.setAttribute('role', 'alert');
    toast.style.transition = `transform ${UI_CONFIG.animation.durationCss} ${UI_CONFIG.animation.easing}, opacity ${UI_CONFIG.animation.durationCss} ease`;

    // Icon
    const iconEl = document.createElement('div');
    iconEl.className = 'bca-toast-icon';
    iconEl.innerHTML = ICONS[variant] || ICONS.info;

    // Message
    const msgEl = document.createElement('div');
    msgEl.className = 'bca-toast-message';
    msgEl.textContent = message;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bca-toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss toast');
    closeBtn.innerHTML = '&times;';

    toast.appendChild(iconEl);
    toast.appendChild(msgEl);
    toast.appendChild(closeBtn);

    container.appendChild(toast);
    this.activeToasts.add(toast);

    // Slide up animation trigger on next frame
    requestAnimationFrame(() => {
      toast.classList.add('is-showing');
    });

    let dismissTimer = null;

    const dismiss = () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      toast.classList.remove('is-showing');
      toast.classList.add('is-hiding');

      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        this.activeToasts.delete(toast);
        if (typeof onClose === 'function') onClose();
      }, UI_CONFIG.animation.duration);
    };

    closeBtn.addEventListener('click', dismiss);

    // Auto dismiss after specified duration (2-3s default)
    if (duration > 0) {
      dismissTimer = setTimeout(dismiss, duration);
    }

    toast.dismiss = dismiss;
    return toast;
  }

  success(message, duration = UI_CONFIG.toast.defaultDuration) {
    return this.show({ message, variant: 'success', duration });
  }

  error(message, duration = UI_CONFIG.toast.defaultDuration) {
    return this.show({ message, variant: 'error', duration });
  }

  info(message, duration = UI_CONFIG.toast.defaultDuration) {
    return this.show({ message, variant: 'info', duration });
  }

  clearAll() {
    this.activeToasts.forEach((toast) => {
      if (toast && typeof toast.dismiss === 'function') {
        toast.dismiss();
      }
    });
  }
}

export const Toast = new ToastManager();

// Global exposure
if (typeof window !== 'undefined') {
  if (!window.BCA_UI) window.BCA_UI = {};
  window.BCA_UI.Toast = Toast;
}
