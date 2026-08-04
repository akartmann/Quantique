---
name: Quantique
description: Game visual-identity spine for Quantique.
status: final
sources:
  - ../../gdds/gdd-Quantique-2026-08-04/gdd.md
  - ../../research/domain-historical-science-investigation-games-research-2026-08-04.md
created: 2026-08-04
updated: 2026-08-04
colors:
  surface-base: '#EFF4F5'
  surface-panel: '#E0EFF0'
  surface-notebook: '#FCFCF8'
  surface-note: '#F5E4A8'
  ink-primary: '#102229'
  ink-secondary: '#42636B'
  instrument: '#1A343B'
  focus: '#275D68'
  signal: '#F7D66D'
  border: '#A5C4C7'
  error: '#A33131'
typography:
  display:
    fontFamily: 'Georgia, serif'
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.1'
  heading:
    fontFamily: 'system-ui, sans-serif'
    fontSize: 22px
    fontWeight: '700'
    lineHeight: '1.2'
  body:
    fontFamily: 'system-ui, sans-serif'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: 'system-ui, sans-serif'
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: '0.08em'
  numeric:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: 16px
    fontWeight: '700'
    lineHeight: '1.3'
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
components:
  apparatus-control:
    surface: '{colors.surface-panel}'
    border: '{colors.border}'
    value-font: '{typography.numeric}'
    radius: '{rounded.md}'
  experiment-result:
    surface: '{colors.surface-notebook}'
    signal: '{colors.signal}'
    border: '{colors.border}'
    radius: '{rounded.md}'
  notebook-observation:
    surface: '{colors.surface-note}'
    ink: '{colors.ink-primary}'
    radius: '{rounded.sm}'
  source-card:
    surface: '{colors.surface-notebook}'
    provenance-ink: '{colors.ink-secondary}'
    border: '{colors.border}'
    radius: '{rounded.md}'
  theory-board-link:
    ink: '{colors.instrument}'
    focus: '{colors.focus}'
  consultation:
    surface: '{colors.surface-panel}'
    border: '{colors.border}'
    radius: '{rounded.md}'
  peer-review:
    surface: '{colors.surface-notebook}'
    border: '{colors.instrument}'
    radius: '{rounded.md}'
  button:
    primary-fill: '{colors.instrument}'
    primary-text: '{colors.surface-notebook}'
    focus: '{colors.focus}'
    radius: '{rounded.md}'
  dialog:
    surface: '{colors.surface-notebook}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
  notification:
    surface: '{colors.surface-panel}'
    error: '{colors.error}'
    radius: '{rounded.md}'
---

# Quantique — Design Spine

## Brand & Style

Quantique combines the analytical clarity of a precision instrument with the provisional humanity of a field notebook. The laboratory makes values, units, and assumptions exact; the notebook makes the learner's observations visibly theirs. It is neither a generic dashboard nor a spectacle-first physics sandbox. Scientific legibility takes priority over decorative density.

→ Visual-direction exploration: [mockups/direction-exploration.html](mockups/direction-exploration.html). DESIGN.md and EXPERIENCE.md win on conflict with every mockup or import.

## Colors

`surface-base` and `surface-panel` establish the cool instrument field; `surface-notebook` and `surface-note` introduce the warm, learner-authored record. `ink-primary` is the only default reading ink. `instrument` provides decisive structural contrast, while `signal` is reserved for a measured pattern or non-textual highlight—never for text that must be read. `focus` is the visible keyboard focus indicator. `error` marks an input or persistence problem, never an incorrect scientific conclusion.

Text on `surface-base`, `surface-panel`, `surface-notebook`, and `surface-note` must meet at least 4.5:1 contrast. Any distinction among source categories, results, or states is reinforced by an explicit label and a non-colour cue.

## Typography

`display` is reserved for case titles and significant historical prompts. `heading` organizes working surfaces. `body` carries instructions, source extracts, and learner writing. `label` is uppercase with tracking for units, provenance, and compact control names; never use it for a paragraph. `numeric` is used for readouts, parameter values, units, timestamps, and measured results so values remain stable while changing. Browser text scaling must not hide essential controls.

## Layout & Spacing

Desktop browser is primary. A laboratory case combines a visual apparatus with semantic controls, readouts, evidence, notebook, theory board, consultation, and conclusion surfaces. Use the 4px spacing scale, with `spacing.4` as the default control gap and `spacing.6` between work regions. Layout must preserve a readable main experiment while allowing all essential actions through semantic HTML.

At tablet widths, secondary panels collapse into labelled drawers or sequential regions; touch targets and controls remain equivalent to keyboard and pointer use.

## Elevation & Depth

Depth is tonal rather than theatrical: `surface-panel` distinguishes instrument controls from `surface-base`; `surface-notebook` creates the reading and reasoning plane; a lightly offset `surface-note` holds a learner observation. Borders do most of the work. Dialogs are rare, one level deep, and never obscure unsaved reasoning without warning.

## Shapes

Use `rounded.sm` for notebook notes and tight readouts, `rounded.md` for controls and cards, and `rounded.lg` for major workspace surfaces. Do not use pill-shaped content containers. Controls must be visibly interactive and sufficiently large for touch; the visual apparatus must not be the sole affordance for an essential action.

## Components

| Component | Visual specification |
| --- | --- |
| Apparatus control | `surface-panel`, `border`, compact `label`, and `numeric` value/readout. A 2px `focus` outline is always visible for keyboard focus. |
| Experiment result | `surface-notebook` reading field; measured pattern may use `signal`, always paired with a labelled value and unit. |
| Notebook observation | Small `surface-note` card, `ink-primary`, and `rounded.sm`; preserves a clearly handwritten-but-legible learner-record feel without imitating handwriting in body text. |
| Source card | `surface-notebook` with `border`; provenance label uses `label` plus a named category and icon/pattern. |
| Theory-board link | `instrument` connector and plain-language relation label; focused link uses `focus`, never colour alone. |
| Consultation | `surface-panel` with an understated structural border; it reads as a prompt to inspect, not a solution reveal. |
| Peer review | `surface-notebook` card with `instrument` edge; feedback separates missing evidence from scope revision without red failure treatment. |
| Button | Rectangular `rounded.md` control with `instrument` fill and `surface-notebook` text for the primary action; secondary buttons are surface-only with an `instrument` border. |
| Dialog | `surface-notebook`, `rounded.lg`, clear heading and action row; never stack dialogs. |
| Notification | Compact `surface-panel` message with text and icon; persistence errors may use `error`, never science-review feedback. |

→ Component and composition references: [Measurement Notebook](mockups/measurement-notebook.html), [Theory Board](mockups/theory-board.html), and [Curated Record](mockups/curated-record.html).

## Do's and Don'ts

- Do make values, units, assumptions, and evidence provenance inspectable.
- Do preserve the learner's recorded settings, observations, and decision history.
- Do make keyboard, pointer, and touch paths equivalent for essential laboratory actions.
- Don't treat colour, sound, canvas hotspots, or drag gestures as the only carrier of information or input path.
- Don't use failure, urgency, speed, or visual spectacle to pressure a conclusion.
- Don't blur historical record, reconstruction, interpretation, and fiction.
- Don't use the luminous `signal` colour as a general accent, a score, or an answer indicator.
