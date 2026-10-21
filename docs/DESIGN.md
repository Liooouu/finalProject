# TrackED — UI/UX Redesign Brief (Aurora Calm 2026)

**Prepared for:** Dean review · **Date:** October 2026
**Scope of this phase:** design foundation, application shell, and the Admin dashboard pilot.

## 1. Why the redesign

The signed-in side of TrackED had drifted into three parallel design languages: the legacy
`BaseCard`/`StatusPill` components, hand-rolled card markup on newer pages, and a newer
`PageHeader`/`KpiCard`/`StatusChip` set. Three different status components rendered the same
state. Every panel used the same border, radius and shadow, so nothing guided the eye, tables
were unstyled HTML, key student metrics sat below two content rows, and charts ignored the
theme entirely (`darkMode` was read from a context that only exposes `isDark`). The result was
functional but visually flat — inconsistent rather than intentionally minimal.

## 2. Direction: Aurora Calm 2026

An evolution of the identity already earned by the auth page, not a rebrand.

- **Calm enterprise, not decorative.** Deep-space dark surfaces, a single indigo→violet→cyan
  accent ramp, glass only where it adds depth.
- **Bento information design.** A 12-column dashboard grid where each panel earns its size:
  trend, mix, queue, schedule, activity, table.
- **Editorial numerals.** `Inter Tight` for headings and metrics, `Inter` for body, tabular
  numerals so numbers align and scan.
- **Quiet motion.** 120–220 ms transitions, a single rise-in for page sections, full
  `prefers-reduced-motion` coverage.
- **One primitive per job.** One `Card`, one `StatTile`, one `StatusChip`, one button system.

## 3. Design system

| Token | Light | Dark |
| --- | --- | --- |
| Surface / card | `#ffffff` | `#141a29` |
| Canvas | `#f5f7fc` | `#070a12` |
| Brand | `#4f46e5` | `#a5b4fc` |
| Success / warning / danger | `#047857` / `#b45309` / `#be123c` | `#6ee7b7` / `#fcd34d` / `#fda4af` |
| Info / excused | `#1d4ed8` / `#0369a1` | `#93c5fd` / `#7dd3fc` |

- **Type scale:** 10 (micro labels) · 12 · 13 · 14 · 16 · 18 · 24 · 30+ (display numerals).
- **Shape:** 10 px controls, 16 px cards, 20 px overlays; hairlines instead of heavy borders.
- **Elevation:** three levels, each with an inner top highlight in dark mode.
- **Status is never colour-only:** every chip carries a label (and an icon where space allows).

## 4. What changed in the pilot

1. **Foundation** (`index.css`): added the brand/semantic/chart ramps, display font, elevation,
   AA-safe status colours, motion utilities and shared surface classes. All legacy tokens were
   kept, so the other pages render unchanged.
2. **Primitives:** `Card`, `StatTile` (sparkline), `ChartCard`, `Timeline`, `ProgressRing`,
   `SegmentedControl`, `Tabs`, `Breadcrumbs`, `CommandPalette`, plus a refreshed `Button` and
   `EmptyState`.
3. **Shell:**
   - Grouped navigation (Overview / Management / Security / Account) with pending-count
     badges, active rail, collapse-to-rail (remembered), and a focus-trapped mobile drawer.
   - Top bar with breadcrumbs, page context, `Ctrl+K` navigation palette, themed bell/theme
     controls and a richer account menu.
4. **Admin dashboard:** greeting hero, four KPI tiles with real sparklines, a 14-day
   attendance trend, a five-status doughnut, a "Needs attention" queue (face appeals, PIN
   resets, live events), today's schedule, an activity timeline, and a recent-attendance table.
5. **Reports fix:** charts now follow the active theme and include `late` and `excused` instead
   of silently dropping them.

## 5. Accessibility and quality

- WCAG AA text contrast in both themes; status colour pairs re-tuned for light mode.
- Visible `:focus-visible` ring on every interactive element; keyboard-operable command menu
  and tabs; breadcrumb `aria-current`; table headers scoped.
- Focus trap and Escape handling in the mobile drawer and command palette.
- Full reduced-motion support; decorative layers marked `aria-hidden`.
- No API, route, or business-logic changes in this phase; `npm run lint` and `npm run build`
  pass.

## 6. Rollout

Pilot approved → apply the same primitives to the Student and Organizer dashboards (progress
ring toward service hours, next-event hero, live check-in panel), then the data-heavy surfaces
(events, attendees, users, reports, excuses) and finally settings/security. The system is
already tokenised, so subsequent pages are composition, not redesign.
