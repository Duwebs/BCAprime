---
name: condensed-typography
description: Comprehensive production-grade A-to-Z condensed typography design system for BCAPrime web application.
---

# BCAPrime — Condensed Typography Design System

This skill defines the official, production-grade condensed typography architecture for **BCAPrime**. All screens, cards, modals, navigation bars, bottom sheets, buttons, and form inputs must strictly adhere to these typographic standards across both **Dark Mode** and **Light Mode**.

---

## 1. Primary & Secondary Font Families

BCAPrime uses an intentional, high-craft condensed font hierarchy to deliver a native mobile app look with tight, editorial precision:

1. **Barlow Condensed** (`'Barlow Condensed', -apple-system, BlinkMacSystemFont, sans-serif`):
   - **Weights**: `600` (SemiBold), `700` (Bold).
   - **Character**: Bold, punchy, architectural condensed grotesque font.
   - **Usage**: Hero titles, page headings, brand wordmark, card titles, section banners, modal/sheet headers, bottom navigation labels, and pill badges.
   - **Weight Rule**: Always use **SemiBold (`600`)** for hero and main headings (`"Welcome back."`, `"Welcome to your study desk."`). Never use heavy `800–900` weights for display headings.

2. **Roboto Condensed** (`'Roboto Condensed', -apple-system, BlinkMacSystemFont, sans-serif`):
   - **Weights**: `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold).
   - **Character**: Highly legible, crisp humanist condensed sans-serif with natural open apertures.
   - **Usage**: Body copy, descriptions, subtitles, form inputs, placeholders, helper text, and secondary action buttons.

3. **Monospace Stacks** (`'JetBrains Mono', 'Space Mono', monospace`):
   - **Weights**: `500`, `600`.
   - **Usage**: Strictly reserved for code snippets, semester badges (e.g. `SEM 01`), and semantic build/version tags (e.g. `v3.4.0`).

---

## 2. Exact Element-by-Element Mapping

| Element | Font Family | Weight | Size | Line Height | Tracking | Transform |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero & Display Headings (`h1`, `h2`, Auth)** | `Barlow Condensed` | `600` (SemiBold) | `26px – 34px` | `1.05 – 1.15` | `-0.025em` | Normal |
| **Card Titles & Modal Headers (`h3`, Sheets)** | `Barlow Condensed` | `600` / `700` | `18px – 22px` | `1.15 – 1.20` | `-0.015em` | Normal |
| **Bottom Navbar Labels** | `Barlow Condensed` | `700` (Bold) | `10px – 11px` | `1.0` | `+0.06em – +0.08em` | `uppercase` |
| **Eyebrow Tags & Status Badges** | `Barlow Condensed` | `700` (Bold) | `10px – 12px` | `1.0` | `+0.05em – +0.08em` | `uppercase` |
| **Primary Action Buttons (CTAs)** | `Roboto Condensed` | `600` / `700` | `15px – 16px` | `1.0` | `+0.01em` | Normal |
| **Form Inputs & Placeholders** | `Roboto Condensed` | `500` | `16px` (mobile min) | `1.25` | `normal` | Normal |
| **Body Paragraphs & Descriptions** | `Roboto Condensed` | `400` | `14px – 15px` | `1.45 – 1.50` | `normal` | Normal |
| **Muted Metadata & Footnotes** | `Roboto Condensed` | `400` / `500` | `12px – 13px` | `1.35` | `normal` | Normal |
| **Code & Semester Tags (`SEM 01`)** | `JetBrains Mono` / Monospace | `600` | `11px – 12px` | `1.0` | `+0.04em` | `uppercase` |

---

## 3. Thickness (Weight), Height & Contrast Rules

### Rule A: Never Use Ultra-Thin Weights in Dark Mode
- Never render weights `< 400` (e.g., `300` Light / `200` Thin) anywhere in Dark Mode. On deep matte-black backgrounds (`#0D0D0F`), ultra-thin glyphs suffer severe subpixel rasterization degradation, causing fringing and illegibility.
- Standard body text must be minimum `Roboto Condensed` `400` (with high-contrast `rgba(255, 255, 255, 0.9)` or `#FFFFFF`).
- Secondary text must never dip below `rgba(255, 255, 255, 0.65)`.

### Rule B: Headings Must Be Tall, Sharp & Refined (SemiBold 600, Avoid Bulky 800–900)
- **Always pair tall condensed display fonts (`Barlow Condensed`) with SemiBold (`600`)** (or `700` maximum for compact uppercase pill badges) rather than heavy `800–900` weights. This keeps hero headings (`"Welcome back."`, `"Welcome to your study desk."`, page banners) tall, razor-sharp, and refined without appearing overly thick, heavy, or chunky.
- **Tight Line Height & Tracking**: Maintain a tight line height (`1.05 – 1.15`) with clean tight letter-spacing (`-0.025em`).
- **Softer High-Contrast Tones**: Render in slightly softer off-white (`#F3F4F6`) in Dark Mode and crisp deep slate (`#111827`) in Light Mode for high-craft editorial poise.
- **Continuous Living Reference**: Always keep updating this skill file whenever typography preferences are refined so future screens and components automatically adhere to this exact aesthetic taste.

### Rule C: Body Text Must Breathe
- Because condensed typefaces compress horizontal glyph width, multi-line body paragraphs and help texts require a comfortable vertical line height (`1.45 – 1.50`) and relaxed margins. This maintains optimal scanning speed without feeling crowded.

### Rule D: Mobile Input Zoom Prevention
- Form input fields on touch devices (`input`, `textarea`, `select`) must have a minimum `font-size: 16px` (`text-[16px]`). This prevents iOS Safari and Android Chrome from performing unwanted automatic viewport zooms on focus.

### Rule E: Dark Mode & Light Mode Parity
- All typographic hierarchies, weights, and letter-spacings must be visually identical between Dark Mode and Light Mode.
- Light Mode uses `#111827` / `#1E293B` for high-contrast primary text, `#64748B` for secondary text, and `#94A3B8` for subtle placeholders.

---

## 4. CSS Variables Reference

BCAPrime exposes central typography CSS variables in `styles.css`:

```css
:root {
  --font-condensed-heading: 'Barlow Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-condensed-body: 'Roboto Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Space Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

### Direct Class Usage

- **Headings & Titles**: `font-condensed-heading font-semibold` or `font-['Barlow_Condensed'] font-semibold`
- **Body & Inputs**: `font-condensed-body` or `font-['Roboto_Condensed']`
- **Mono Badges**: `font-mono tracking-wider font-semibold`
