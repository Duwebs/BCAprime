# BCAPrime Reusable UI Components

Centralized, token-driven, native mobile-feel UI component library for BCAPrime.

All components derive animation timing, border radius scale, and spacing scale from `ui/config.js` and `ui/ui.css`.

---

## 1. Central Config (`ui/config.js` & `ui/ui.css`)
Central source of truth for:
- **Animation Duration**: `200ms` (`cubic-bezier(0.16, 1, 0.3, 1)`)
- **Border Radius Scale**: `none`, `xs` (4px), `sm` (6px), `md` (10px), `lg` (14px), `xl` (18px), `2xl` (24px), `full` (9999px)
- **Spacing Scale**: `2xs` (2px), `xs` (4px), `sm` (8px), `md` (12px), `lg` (16px), `xl` (20px), `2xl` (24px), `3xl` (32px), `4xl` (40px)
- **Haptic Duration**: `10ms`

### Usage Example:
```javascript
import { UI_CONFIG } from './ui/config.js';

console.log(UI_CONFIG.animation.durationCss); // '200ms'
console.log(UI_CONFIG.radius.lg);             // '14px'
console.log(UI_CONFIG.spacing.md);            // '12px'
```

---

## 2. PressableScale (`ui/pressable.js`)
Wraps any element so that pressing it triggers a smooth `scale(0.97)` transition and light haptic feedback. Releases back to `scale(1)` smoothly in 200ms.

### Usage Example:
```javascript
import { PressableScale, createPressable } from './ui/pressable.js';

// Option A: Wrap an existing DOM element
const myButton = document.querySelector('#my-cta-btn');
PressableScale(myButton, {
  onClick: () => console.log('Tapped!')
});

// Option B: Programmatically create a new pressable card/button
const actionCard = createPressable({
  tag: 'button',
  className: 'p-4 rounded-xl bg-white shadow-sm border',
  content: '<span>Tap Me</span>',
  onClick: () => console.log('Pressed with haptic!')
});
document.body.appendChild(actionCard);
```

---

## 3. BottomSheet (`ui/bottomSheet.js`)
Modal bottom sheet with drag handle, title, backdrop dim, 200ms slide-up animation, backdrop tap dismiss, and real-time swipe-down gesture dismissal.

### Usage Example:
```javascript
import { BottomSheet } from './ui/bottomSheet.js';

const sheet = new BottomSheet({
  title: 'Select Semester',
  content: `
    <div class="flex flex-col gap-2">
      <button class="p-3 text-left rounded-lg hover:bg-gray-100">Semester 1</button>
      <button class="p-3 text-left rounded-lg hover:bg-gray-100 font-semibold">Semester 2 ✓</button>
    </div>
  `,
  onClose: () => console.log('Sheet closed')
});

// Open the sheet
sheet.open();

// Update content dynamically
sheet.setContent('<p>New content loaded!</p>');

// Close programmatically
// sheet.close();
```

---

## 4. Skeleton (`ui/skeleton.js`)
Configurable shimmer placeholder for any shape using width, height, and radius tokens. Includes a pre-built `SkeletonCard` variant.

### Usage Example:
```javascript
import { Skeleton, SkeletonCard } from './ui/skeleton.js';

// 1. Custom Shape (e.g. Circular Avatar)
const avatarSkeleton = Skeleton({
  width: 48,
  height: 48,
  radius: 'full'
});

// 2. Custom Text Line
const lineSkeleton = Skeleton({
  width: '80%',
  height: 16,
  radius: 'sm'
});

// 3. Ready-to-use SkeletonCard (cover + title + subtitle + badges)
const cardSkeleton = SkeletonCard({
  hasCover: true,
  lines: 2,
  hasFooter: true
});

document.querySelector('#feed-container').appendChild(cardSkeleton);
```

---

## 5. EmptyState (`ui/emptyState.js`)
Displays a clean, centered placeholder with an icon, title, message, and an optional action button wrapped in `PressableScale`.

### Usage Example:
```javascript
import { EmptyState } from './ui/emptyState.js';

const emptyView = EmptyState({
  title: 'No Notes Found',
  message: 'We could not find any notes matching your selected semester or filters.',
  action: {
    label: 'Reset Filters',
    onClick: () => {
      console.log('Resetting filters...');
    }
  }
});

document.querySelector('#results-container').appendChild(emptyView);
```

---

## 6. Toast (`ui/toast.js`)
Lightweight notifications that slide up from the bottom with haptic feedback and automatically dismiss after 2–3 seconds. Supports `success`, `error`, and `info` variants.

### Usage Example:
```javascript
import { Toast } from './ui/toast.js';

// Quick helper methods
Toast.success('Saved to your downloads!');
Toast.error('Failed to connect. Check your internet.');
Toast.info('New PYQ available for Semester 2.');

// Custom options
Toast.show({
  message: 'Custom duration toast',
  variant: 'success',
  duration: 3000,
  onClose: () => console.log('Toast finished')
});
```
