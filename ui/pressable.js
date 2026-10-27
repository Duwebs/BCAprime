/**
 * PressableScale Component
 * Wraps any element to add a smooth 0.97 scale press effect and light haptic feedback.
 */

import { UI_CONFIG } from './config.js';

/**
 * Triggers light haptic feedback if supported by browser/device.
 */
export function triggerLightHaptic(ms = UI_CONFIG.pressable.hapticMs) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch (e) {
    // Silently ignore if haptics are not allowed/supported
  }
}

/**
 * Attaches PressableScale behavior to an existing element or selector.
 * 
 * @param {HTMLElement|string} target - DOM Element or selector to make pressable
 * @param {Object} [options]
 * @param {number} [options.scale] - Target scale factor (defaults to 0.97)
 * @param {boolean} [options.haptic] - Whether to fire light haptic (defaults to true)
 * @param {Function} [options.onPress] - Callback on press down
 * @param {Function} [options.onRelease] - Callback on press release
 * @param {Function} [options.onClick] - Callback on click
 * @returns {HTMLElement} The element with pressable behavior attached
 */
export function PressableScale(target, options = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) {
    console.warn('[PressableScale] Target element not found:', target);
    return null;
  }

  const scale = options.scale !== undefined ? options.scale : UI_CONFIG.pressable.scale;
  const enableHaptic = options.haptic !== false;

  // Add pressable class and inline transition timing from config
  el.classList.add('bca-pressable');
  el.style.transition = `transform ${UI_CONFIG.animation.durationCss} ${UI_CONFIG.animation.easing}`;

  let isPressed = false;

  const handlePressStart = (e) => {
    // Only respond to primary mouse button if pointer event
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    isPressed = true;
    el.style.transform = `scale(${scale})`;
    el.classList.add('is-pressed');

    if (enableHaptic) {
      triggerLightHaptic(UI_CONFIG.pressable.hapticMs);
    }

    if (typeof options.onPress === 'function') {
      options.onPress(e);
    }
  };

  const handlePressEnd = (e) => {
    if (!isPressed) return;
    isPressed = false;
    el.style.transform = 'scale(1)';
    el.classList.remove('is-pressed');

    if (typeof options.onRelease === 'function') {
      options.onRelease(e);
    }
  };

  el.addEventListener('pointerdown', handlePressStart);
  el.addEventListener('pointerup', handlePressEnd);
  el.addEventListener('pointercancel', handlePressEnd);
  el.addEventListener('pointerleave', handlePressEnd);

  if (typeof options.onClick === 'function') {
    el.addEventListener('click', options.onClick);
  }

  // Cleanup helper attached to the element
  el._destroyPressable = () => {
    el.removeEventListener('pointerdown', handlePressStart);
    el.removeEventListener('pointerup', handlePressEnd);
    el.removeEventListener('pointercancel', handlePressEnd);
    el.removeEventListener('pointerleave', handlePressEnd);
    if (options.onClick) el.removeEventListener('click', options.onClick);
  };

  return el;
}

/**
 * Creates a new wrapper container with PressableScale behavior.
 * 
 * @param {Object} [options]
 * @param {string} [options.tag='div'] - HTML tag name (e.g. 'div', 'button', 'span')
 * @param {string|HTMLElement|Array<HTMLElement>} [options.content=''] - Child content or HTML string
 * @param {string} [options.className=''] - Additional CSS classes
 * @param {Function} [options.onClick] - Click handler
 * @returns {HTMLElement} The created pressable element
 */
export function createPressable(options = {}) {
  const {
    tag = 'div',
    content = '',
    className = '',
    onClick = null,
    scale = UI_CONFIG.pressable.scale,
    haptic = true,
  } = options;

  const el = document.createElement(tag);
  if (className) el.className = className;

  if (typeof content === 'string') {
    el.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    el.appendChild(content);
  } else if (Array.isArray(content)) {
    content.forEach((child) => child && el.appendChild(child));
  }

  return PressableScale(el, { scale, haptic, onClick });
}

// Global exposure
if (typeof window !== 'undefined') {
  if (!window.BCA_UI) window.BCA_UI = {};
  window.BCA_UI.PressableScale = PressableScale;
  window.BCA_UI.createPressable = createPressable;
  window.BCA_UI.triggerLightHaptic = triggerLightHaptic;
}
