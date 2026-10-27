/**
 * BCAPrime Reusable UI Components Library
 * Central index exporting all components and configurations.
 */

import { UI_CONFIG, injectUIConfigCssVariables } from './config.js';
import { PressableScale, createPressable, triggerLightHaptic } from './pressable.js';
import { BottomSheet } from './bottomSheet.js';
import { Skeleton, skeletonHTML, SkeletonCard } from './skeleton.js';
import { EmptyState } from './emptyState.js';
import { Toast } from './toast.js';

// Auto-inject CSS custom properties if DOM is available
if (typeof window !== 'undefined') {
  injectUIConfigCssVariables(UI_CONFIG);

  window.BCA_UI = {
    config: UI_CONFIG,
    injectUIConfigCssVariables,
    PressableScale,
    createPressable,
    triggerLightHaptic,
    BottomSheet,
    Skeleton,
    skeletonHTML,
    SkeletonCard,
    EmptyState,
    Toast,
  };
}

export {
  UI_CONFIG,
  injectUIConfigCssVariables,
  PressableScale,
  createPressable,
  triggerLightHaptic,
  BottomSheet,
  Skeleton,
  skeletonHTML,
  SkeletonCard,
  EmptyState,
  Toast,
};
