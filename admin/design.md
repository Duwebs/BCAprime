# BCAPrime Admin — Design System

> Clean. Minimal. Functional.

## 1. Color Palette

| Variable     | Light            | Dark              | Use                |
|-------------|------------------|-------------------|--------------------|
| `--bg`      | `#f5f7fa`        | `#05080b`         | Page background     |
| `--surface` | `#ffffff`        | `#0d141a`         | Panel / card bg     |
| `--surface2`| `#eef2f6`        | `#141d24`         | Inputs / alt panels |
| `--ink`     | `#172230`        | `#eef5f7`         | Primary text        |
| `--muted`   | `#687789`        | `#9cafba`         | Secondary text      |
| `--line`    | `#dce4ec`        | `#263640`         | Borders / dividers  |
| `--brand`   | `#0d7892`        | `#67c9dc`         | Teal (primary)      |
| `--good`    | `#167653`        | `#70d1a9`         | Green (success)     |
| `--danger`  | `#b83d4b`        | `#ff8c98`         | Red (destructive)   |
| `--shadow`  | `0 14px 32px rgba(25,45,65,.08)` | `0 14px 34px rgba(0,0,0,.3)` | Panel shadow |

## 2. Typography

| Element       | Font Family        | Size / Weight         |
|---------------|--------------------|-----------------------|
| Body          | DM Sans            | 15px / 400            |
| Headings (h1) | Space Grotesk      | `clamp(28px, 5vw, 42px)` / 600 |
| Panel headings (h2) | Space Grotesk | 20px / 600            |
| Section labels (h3, .eyebrow) | DM Sans | 11px / 700 uppercase |
| Stat numbers  | Space Grotesk      | 27px / 600            |
| Stat labels   | DM Sans            | 13px / 400 muted      |
| Table headers | DM Sans            | 12px / 700 uppercase muted |
| Captions / notes | DM Sans         | 11–12px / 400 muted   |

## 3. Spacing Scale

`4  8  12  16  20  24  28  32  42  48`

Base unit: **4px**. All padding/margins use multiples of 4.

## 4. Buttons

### Base `.button`
```
border: 1px solid var(--line)
border-radius: 9px
background: var(--surface)
color: var(--ink)
padding: 9px 14px
font: inherit
cursor: pointer
transition: all 0.18s ease
```

### `.button.primary`
```
background: var(--brand)
border-color: var(--brand)
color: #fff
font-weight: 700
```

### `.button.danger`
```
color: var(--danger)
border-color: var(--danger)
```
> Danger buttons use a subtle red border + red text (no solid background) for a minimal look. On hover, a light red tint appears.

### `.button:hover`
```
filter: brightness(1.06)
transform: translateY(-1px)
```

### `.button:active`
```
transform: translateY(0)
```

### `.button:disabled`
```
opacity: 0.45
cursor: not-allowed
```

## 5. Inputs & Selects

```
border: 1px solid var(--line)
border-radius: 8px
background: var(--surface2)
color: var(--ink)
padding: 9px 12px
outline: 0
transition: border-color 0.18s ease
```
Focus state: `border-color: var(--brand)`

## 6. Cards / Panels (`.panel`)

```
background: var(--surface)
border: 1px solid var(--line)
border-radius: 12px
box-shadow: var(--shadow)
padding: 18px
```

### Panel toolbar
```
display: flex
justify-content: space-between
align-items: center
gap: 10px
margin-bottom: 15px
```
On mobile (<700px): `flex-direction: column; align-items: stretch`

## 7. Stats Grid (`.stats`)

```
display: grid
grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))
gap: 12px
margin-bottom: 24px
```
Each `.stat`:
- `padding: 17px`
- `strong` → 27px Space Grotesk, centered
- `span` → 13px muted, centered

## 8. Tables

```
width: 100%
border-collapse: collapse
min-width: 640px
```
- **Header**: 12px, uppercase, muted, 700 weight
- **Cells**: `padding: 12px 10px`, `border-top: 1px solid var(--line)`, `vertical-align: middle`
- **Row actions**: `display: flex; gap: 6px` — icon + text buttons

## 9. Badges

```
display: inline-block
padding: 3px 9px
border-radius: 999px
font-size: 11px
font-weight: 700
text-transform: uppercase
```
- Approved: green tint background + green text
- Archived: red tint background + red text

## 10. Layout

```
.shell {
  max-width: 1180px;
  margin: auto;
  padding: 0 24px 48px;
}
```

### Topbar
```
min-height: 72px
display: flex
justify-content: space-between
align-items: center
border-bottom: 1px solid var(--line)
```

## 11. Responsive Breakpoints

| Breakpoint  | Changes                                  |
|------------|------------------------------------------|
| ≤700px     | Stats → 2 columns, toolbar → vertical, panel padding → 13px |
| ≤600px     | Auth card padding → 22px, shell padding → 16px, table min-width → auto |
| ≤520px     | Notification targets → 1 column           |

## 12. Spacing Conventions

- Panel padding: `18px 18px 0` (toolbar space on top)
- Panel → toolbar: `gap: 10px`, `margin-bottom: 15px`
- Stats gap: `12px`
- Table cell: `12px 10px`
- Buttons in `.row-actions`: `gap: 6px`
- Section spacing: `32px` margin-top between panels

## 13. Animation / Transition Policy

- All interactive elements: `transition: all 0.18s ease`
- Button hover: `brightness(1.06) + translateY(-1px)`
- Button active: `translateY(0)`
- Avatar hover: `scale(1.08) rotate(3deg)`
- Bar chart: `height .5s cubic-bezier(.22,.9,.32,1)`
