# Easydrivess — Design System

Derived from the Welno Health Tracker case study (Vektora Studio), made binding by the client brief. Tokens live in `css/tokens.css`; components in `css/ui.css` and `js/ui/kit.js`.

## Principle
One number, one sentence, then detail. Every screen follows the Welno anatomy:
1. **Score**: one hero value in dot-matrix numerals, with a soft glow under it.
2. **Sentence**: one plain sentence with inline dashed chips (`.chip`) for the key facts.
3. **Timeline / map**: the route, stop order or trend.
4. **Metric tiles**: a 2-column grid of small values.

Voice: calm, direct, warm. No exclamation marks.

## Colour
| Token | Value | Use |
|---|---|---|
| `--ink` | `#0B0B0F` | Ground |
| `--s1` / `--s2` / `--s3` | `#15151B` / `#1C1C24` / `#24242E` | Cards, controls, raised |
| `--line` | 8% white | Hairlines |
| `--majorelle` | `#6246EA` | Rides, primary brand |
| `--periwinkle` | `#8F8CF2` | Routes, focus, money |
| `--lavender` | `#E9E8FB` | Primary buttons, selected states |
| `--aqua` | `#5EF2C6` | Condition, healthy, savings |
| `--ember` | `#FF5A45` | SOS, alerts, overdue |

Glow is module-coded and used only behind hero values: rides (violet), condition (aqua), money (periwinkle), alert (ember).

## Type
Urbanist only. Display: weight 300, 34px, tight tracking, second line in `--fg-3`. Body 15px. Labels 12.5px `--fg-3`. Tabular numerals everywhere.

## Components
- **Dot-matrix numerals** (`dotNumber`, `scrollNumber`): 5×7 glyphs; neighbours faded either side where a range means something (fare classes, ETA).
- **Tick gauge** (`tickGauge`, `conditionMini`, `ticksBar`): condition score, onboarding score, fleet health.
- **Hero** (`.hero` + `.condition | .money | .alert`).
- **Chrome**: back, centred title, ⋮ menu; floating pill tab bar.
- **Pills** (`.pill`): uppercase status. **Chips** (`.chip`): dashed, inline in sentences.
- **Map** (`map()`): stylised Hyderabad, grid, dark roads, glowing route, numbered stops.
- **Ads** (`adCard`): tinted cards, labelled "Ad · advertiser"; never on live-trip, SOS or payment screens.
- **Web** (`.webapp`): sidebar, page head with two-tone title, panels, hairline tables.

## Icons and marks
One authored SVG set, 1.6px stroke, round caps (`icon()`). Car silhouettes per class (`carArt`). The Easydrivess mark is a stencil-cut E in the Welno mark's construction, a placeholder until the client's logo arrives.
