# BCAPrime — UI Architecture & Design System Rules

> **IMPORTANT FOR AGENTS**: Read this file before creating, modifying, or refactoring any user interface or screen in BCAPrime. All interfaces must adhere strictly to these rules to deliver an authentic, high-performance native mobile app experience.

---

## Core UI Component Library Reference

All core UI components and tokens reside in the `ui/` directory:
- **Central Config & Tokens**: `ui/config.js` & `ui/ui.css`
- **PressableScale**: `ui/pressable.js` (`PressableScale`, `createPressable`, `triggerLightHaptic`)
- **BottomSheet**: `ui/bottomSheet.js` (`BottomSheet`)
- **Skeleton**: `ui/skeleton.js` (`Skeleton`, `SkeletonCard`)
- **EmptyState**: `ui/emptyState.js` (`EmptyState`)
- **Toast**: `ui/toast.js` (`Toast`, `showToast`)

In non-module browser scripts, these are also accessible via `window.BCA_UI`.

---

## The 10 Mandatory UI Rules

### Rule 1: Use Established Reusable Components
Before building any new interface or widget, check and reuse the foundational UI components in `ui/`:
- `PressableScale`
- `BottomSheet`
- `Skeleton`
- `EmptyState`
- `Toast`

Do **NOT** construct duplicate components, reinvent wheels, or inject raw unstyled elements in place of these standardized primitives.

---

### Rule 2: Every Tappable Element Must Use PressableScale
Every button, card, list item, filter pill, chip, and icon trigger must have `PressableScale` attached or be built using `createPressable()`.
- Provides an active `scale(0.97)` physical compression on press.
- Delivers a subtle 10ms light haptic feedback (`navigator.vibrate(10)`).
- Smoothly springs back to `scale(1)` in 200ms using the central timing curve.

---

### Rule 3: BottomSheet for All Selectors, Menus, Dialogs & Dropdowns
Never use browser-native `<select>` dropdowns, standard OS confirmation popups, or floating desktop-style menus.
- Always use `BottomSheet` (`ui/bottomSheet.js`).
- Include a drag handle, backdrop dimming, 200ms slide-up animation, and swipe-down-to-dismiss gesture support.

---

### Rule 4: Skeleton Shimmer Placeholders on Loading (No Spinners)
When fetching data or awaiting asynchronous operations, always render content-shaped `Skeleton` or `SkeletonCard` (`ui/skeleton.js`) with shimmer wave animations.
- Never show blocking spinners, activity indicators, or blank flickering layouts.

---

### Rule 5: Dedicated EmptyState for Every List & Feed
Every list, collection, filter view, search result, or bookmarked feed must have an `EmptyState` (`ui/emptyState.js`) fallback.
- Must feature a contextual icon, clear title, explanatory description, and a recovery action button (e.g., "Reset Filters", "Upload Note", or "Browse All") wrapped with `PressableScale`.

---

### Rule 6: Action Confirmation via Toast
Every user-initiated mutation or event (saving, uploading, bookmarking, deleting, requesting, copying links) must trigger an immediate `Toast` notification (`ui/toast.js`).
- Support appropriate toast variants: `success`, `error`, or `info`.
- Dismisses automatically after 2.5–3 seconds with slide-out animation.

---

### Rule 7: Live Real-Time Filtering & Search (No Find/Submit Buttons)
Search inputs and filter controls must update the DOM dynamically in real time using debouncing (250ms).
- Never require the user to press a "Find", "Search", or "Submit/Apply" button to trigger search or filter results.

---

### Rule 8: Tokens from Central UI Config (No Hardcoded Values)
Never hardcode arbitrary pixel radius values, bespoke spacing, or random animation timings in styles.
- **Animation timing**: Derive strictly from `UI_CONFIG.animation` or `var(--ui-anim-duration)` (`200ms cubic-bezier(0.16, 1, 0.3, 1)`).
- **Border radius**: Use `UI_CONFIG.radius` or `var(--ui-radius-*)` (`xs`: 4px, `sm`: 6px, `md`: 10px, `lg`: 14px, `xl`: 18px, `2xl`: 24px, `full`: 9999px).
- **Spacing**: Use `UI_CONFIG.spacing` or `var(--ui-space-*)` (`2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`).

---

### Rule 9: Minimum 44px Touch Target Size
All interactive elements (buttons, pill chips, bottom tabs, icon triggers, list items) must strictly maintain a minimum touch target bounding box of **44px × 44px** to ensure seamless mobile touch ergonomics.

---

### Rule 10: Pre-Completion Verification & Rule Audit
Before finishing any task, feature implementation, or UI refactoring:
1. Audit the modified code against these 10 rules.
2. Verify that all interactive elements and states conform to the design system.
3. Explicitly state in the final response which rules were applied and satisfied.
