/**
 * BottomSheet Component
 * Provides a native mobile bottom sheet with drag handle, title, backdrop dim,
 * slide-up 200ms animation, swipe-down gesture to dismiss, and flexible content slot.
 */

import { UI_CONFIG } from './config.js';
import { triggerLightHaptic } from './pressable.js';

export class BottomSheet {
  /**
   * @param {Object} options
   * @param {string} [options.title=''] - Sheet header title
   * @param {string|HTMLElement} [options.content=''] - Content (HTML string or DOM Node)
   * @param {boolean} [options.showCloseButton=true] - Whether to show the header '✕' button
   * @param {boolean} [options.dismissOnBackdrop=true] - Close when backdrop is tapped
   * @param {boolean} [options.dismissOnSwipe=true] - Close on swipe down gesture
   * @param {Function} [options.onOpen] - Callback after opening
   * @param {Function} [options.onClose] - Callback after closing
   */
  constructor(options = {}) {
    this.options = {
      title: '',
      content: '',
      showCloseButton: true,
      dismissOnBackdrop: true,
      dismissOnSwipe: true,
      onOpen: null,
      onClose: null,
      ...options,
    };

    this.isOpen = false;
    this.isDragging = false;
    this.startY = 0;
    this.currentY = 0;
    this.deltaY = 0;

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    // Backdrop
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'bca-bottom-sheet-backdrop';
    this.backdropEl.setAttribute('aria-hidden', 'true');

    // Sheet container
    this.sheetEl = document.createElement('div');
    this.sheetEl.className = 'bca-bottom-sheet';
    this.sheetEl.setAttribute('role', 'dialog');
    this.sheetEl.setAttribute('aria-modal', 'true');
    this.sheetEl.style.transition = `transform ${UI_CONFIG.animation.durationCss} ${UI_CONFIG.animation.easing}`;

    // 1. Drag Handle
    this.handleWrapEl = document.createElement('div');
    this.handleWrapEl.className = 'bca-bottom-sheet-handle-wrap';
    this.handleWrapEl.innerHTML = '<div class="bca-bottom-sheet-handle"></div>';

    // 2. Header
    this.headerEl = document.createElement('div');
    this.headerEl.className = 'bca-bottom-sheet-header';

    this.titleEl = document.createElement('h3');
    this.titleEl.className = 'bca-bottom-sheet-title';
    this.titleEl.textContent = this.options.title || '';

    this.headerEl.appendChild(this.titleEl);

    if (this.options.showCloseButton) {
      this.closeBtnEl = document.createElement('button');
      this.closeBtnEl.className = 'bca-bottom-sheet-close-btn';
      this.closeBtnEl.setAttribute('aria-label', 'Close');
      this.closeBtnEl.innerHTML = '&times;';
      this.closeBtnEl.addEventListener('click', () => this.close());
      this.headerEl.appendChild(this.closeBtnEl);
    }

    // 3. Content Area
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'bca-bottom-sheet-content';
    this.setContent(this.options.content);

    // Assemble Sheet
    this.sheetEl.appendChild(this.handleWrapEl);
    this.sheetEl.appendChild(this.headerEl);
    this.sheetEl.appendChild(this.contentEl);

    // Append to document.body
    document.body.appendChild(this.backdropEl);
    document.body.appendChild(this.sheetEl);
  }

  _bindEvents() {
    // Backdrop Tap Close
    if (this.options.dismissOnBackdrop) {
      this.backdropEl.addEventListener('click', () => this.close());
    }

    // Swipe down gesture handlers
    if (this.options.dismissOnSwipe) {
      const targetArea = this.handleWrapEl;

      targetArea.addEventListener('pointerdown', (e) => this._onDragStart(e));
      window.addEventListener('pointermove', (e) => this._onDragMove(e));
      window.addEventListener('pointerup', (e) => this._onDragEnd(e));
      window.addEventListener('pointercancel', (e) => this._onDragEnd(e));
    }
  }

  _onDragStart(e) {
    if (!this.isOpen) return;
    this.isDragging = true;
    this.startY = e.clientY;
    this.deltaY = 0;
    this.sheetEl.classList.add('is-dragging');
  }

  _onDragMove(e) {
    if (!this.isDragging) return;
    this.currentY = e.clientY;
    this.deltaY = Math.max(0, this.currentY - this.startY);

    // Track user's finger downward
    this.sheetEl.style.transform = `translateY(${this.deltaY}px)`;
  }

  _onDragEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.sheetEl.classList.remove('is-dragging');

    // Threshold: swipe down more than 75px dismisses sheet
    if (this.deltaY > 75) {
      this.close();
    } else {
      // Snap back up
      this.sheetEl.style.transform = 'translateY(0)';
    }
    this.deltaY = 0;
  }

  /**
   * Sets or updates the sheet title
   * @param {string} text 
   */
  setTitle(text) {
    this.options.title = text;
    if (this.titleEl) {
      this.titleEl.textContent = text;
    }
  }

  /**
   * Replaces sheet body content with HTML string or DOM node
   * @param {string|HTMLElement} content 
   */
  setContent(content) {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = '';
    if (typeof content === 'string') {
      this.contentEl.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.contentEl.appendChild(content);
    }
  }

  /**
   * Slides up and opens the bottom sheet
   */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    triggerLightHaptic();

    // Trigger backdrop
    this.backdropEl.classList.add('is-visible');

    // Reset transform style & trigger slide up
    this.sheetEl.style.transform = '';
    // Force browser reflow
    void this.sheetEl.offsetHeight;
    this.sheetEl.classList.add('is-open');

    // Prevent body background scroll
    document.body.style.overflow = 'hidden';

    if (typeof this.options.onOpen === 'function') {
      this.options.onOpen();
    }
  }

  /**
   * Slides down and closes the bottom sheet
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    // Slide sheet down
    this.sheetEl.classList.remove('is-open');
    this.sheetEl.style.transform = 'translateY(100%)';

    // Fade backdrop out
    this.backdropEl.classList.remove('is-visible');

    // Restore body scroll
    document.body.style.overflow = '';

    setTimeout(() => {
      if (typeof this.options.onClose === 'function') {
        this.options.onClose();
      }
    }, UI_CONFIG.animation.duration);
  }

  /**
   * Removes elements from DOM completely
   */
  destroy() {
    this.close();
    setTimeout(() => {
      if (this.backdropEl && this.backdropEl.parentNode) {
        this.backdropEl.parentNode.removeChild(this.backdropEl);
      }
      if (this.sheetEl && this.sheetEl.parentNode) {
        this.sheetEl.parentNode.removeChild(this.sheetEl);
      }
    }, UI_CONFIG.animation.duration + 50);
  }
}

// Global exposure
if (typeof window !== 'undefined') {
  if (!window.BCA_UI) window.BCA_UI = {};
  window.BCA_UI.BottomSheet = BottomSheet;
}
