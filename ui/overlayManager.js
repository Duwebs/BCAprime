/**
 * BCAPrime Overlay History Manager
 * Synchronizes open bottom sheets, drawers, modals, and the PDF reader with
 * window.history.pushState / popstate so pressing the Android hardware Back (<) button
 * cleanly closes the active overlay instead of exiting the PWA.
 */

const overlayStack = [];
let isPoppingFromHistory = false;
let ignoreNextPopState = false;

export const OverlayManager = {
  /**
   * Register an open overlay (sheet, modal, drawer, or viewer).
   * Pushes history state on the first overlay.
   * @param {string|object} id - Unique identifier or element reference
   * @param {Function} closeFn - Function to execute when dismissed via Back button
   */
  push(id, closeFn) {
    const existingIdx = overlayStack.findIndex(item => item.id === id);
    if (existingIdx !== -1) {
      overlayStack.splice(existingIdx, 1);
    }

    const wasEmpty = overlayStack.length === 0;
    overlayStack.push({ id, closeFn });

    if (wasEmpty) {
      try {
        history.pushState({ bcaOverlay: true }, '');
      } catch (e) {}
    }
  },

  /**
   * Remove an overlay when closed via UI (close button, backdrop, swipe down).
   * Pops history state if all overlays are now closed.
   * @param {string|object} id
   */
  remove(id) {
    const idx = overlayStack.findIndex(item => item.id === id);
    if (idx !== -1) {
      overlayStack.splice(idx, 1);
      if (overlayStack.length === 0 && !isPoppingFromHistory) {
        ignoreNextPopState = true;
        try {
          history.back();
        } catch (e) {
          ignoreNextPopState = false;
        }
      }
    }
  },

  /**
   * Clears all open overlays (e.g. on closeModals).
   */
  clear() {
    const hadOverlays = overlayStack.length > 0;
    overlayStack.length = 0;
    if (hadOverlays && !isPoppingFromHistory) {
      ignoreNextPopState = true;
      try {
        history.back();
      } catch (e) {
        ignoreNextPopState = false;
      }
    }
  },

  get count() {
    return overlayStack.length;
  }
};

// Listen for Android hardware Back button / popstate
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignoreNextPopState) {
      ignoreNextPopState = false;
      return;
    }

    if (overlayStack.length > 0) {
      const top = overlayStack.pop();
      isPoppingFromHistory = true;
      try {
        if (top && typeof top.closeFn === 'function') {
          top.closeFn();
        }
      } finally {
        isPoppingFromHistory = false;
      }

      // If deeper overlays are still open, re-push history state
      // so the next Android back press will pop the next one!
      if (overlayStack.length > 0) {
        try {
          history.pushState({ bcaOverlay: true }, '');
        } catch (err) {}
      }
    } else {
      // Fallback: check if any modal is visibly open
      const openModals = Array.from(document.querySelectorAll('.modal.open:not(#deviceGateModal)'));
      if (openModals.length > 0) {
        const topModal = openModals[openModals.length - 1];
        if (topModal.id === 'readerModal') {
          if (typeof window.closeReader === 'function') window.closeReader();
          else topModal.classList.remove('open');
        } else {
          if (typeof window.closeModals === 'function') window.closeModals();
          else topModal.classList.remove('open');
        }
      }
    }
  });

  window.bcaOverlay = OverlayManager;
}
