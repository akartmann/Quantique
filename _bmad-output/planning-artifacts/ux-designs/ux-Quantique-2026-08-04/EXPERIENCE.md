---
name: Quantique
description: Game experience spine for Quantique.
status: final
sources:
  - ../../gdds/gdd-Quantique-2026-08-04/gdd.md
  - ../../research/domain-historical-science-investigation-games-research-2026-08-04.md
created: 2026-08-04
updated: 2026-08-04
---

# Quantique — Experience Spine

## Foundation

Educational indie historical-science investigation for desktop web browsers. Keyboard/mouse and touch/pointer are first-class and equivalent for essential play; tablet readiness is required. Phaser renders the visual laboratory, while semantic HTML owns essential controls, values, instructions, notebook work, theory board, source inspection, conclusion entry, focus, and announcements. `DESIGN.md` is the visual-identity reference.

## Information Architecture

| Surface | Purpose |
| --- | --- |
| Case entry | Establish the disputed observation or historical claim and begin or resume a case. |
| Curated Record | Inspect contextual artifacts and their provenance before substantive testing. |
| Prediction | State an initial, revisable expectation. |
| Laboratory | Configure authored apparatus controls, run an experiment, and inspect accessible results. |
| Measurement Notebook | Preserve settings, observations, comparison notes, and linked evidence. |
| Theory Board | Connect sources, predictions, observations, limitations, and conclusion claims. |
| Consultation | Request a role-based prompt that points to missing evidence, a source, an observable, or a test. |
| Peer Review | Receive actionable feedback on missing evidence, unsupported claims, or overreach; revise without penalty. |
| Historical Debrief | Compare the learner's bounded conclusion with the historical record and reveal layered explanation and provenance. |
| Case record | Export, import, or print locally saved observations and reasoning. |

Case flow: disputed observation → at least two contextual artifacts → prediction → bounded apparatus setup → experiment and recorded observations → comparison/replication → theory board and conclusion → peer review/revision → historical debrief. Replays preserve the historical record while allowing counterfactual exploration clearly labelled as such.

→ Composition references: [Curated Record](mockups/curated-record.html), [Measurement Notebook](mockups/measurement-notebook.html), and [Theory Board](mockups/theory-board.html). The spines win on conflict.

## Voice and Tone

Calm, precise, and invitational. Prompts focus attention without supplying an answer. Feedback describes evidence and scope, never the learner's intelligence or performance. Historical claims distinguish what is sourced, reconstructed, interpreted, or fictional.

Use short declarative microcopy: “Record a prediction,” “Compare observations,” and “State one limitation.” Prefer “This claim needs a recorded observation.” to a generic error. Never use score language, exclamation-led encouragement, or language that labels a conclusion right or wrong.

## Component Patterns

| Component | Behavioral contract |
| --- | --- |
| Apparatus control | Every visual gesture has a labelled semantic control and a keyboard-adjustable alternative. Current value, units, valid range, and state change are exposed; keyboard focus uses `{colors.focus}`. |
| Experiment result | Visual output is paired with readable values, labels, and an explanation of the model's assumptions. The `{colors.signal}` pattern is never its only meaning carrier. |
| Notebook observation | Saves actual settings, outcome, timestamp/order, learner note, and linked evidence; supports comparison of any two saved runs. |
| Source card | Shows provenance category and links the record to its source/rights context through label, icon/pattern, and text. |
| Theory-board link | Connects a claim to learner-generated observations and inspected sources; exposes a limitation or alternative explanation. Focus uses `{colors.focus}`. |
| Consultation | Unlimited; points to an observable, source, or test without supplying the final conclusion. |
| Peer review | Identifies gaps and permits unlimited revision; never creates a hard fail, loss, or irreversible wrong choice. |
| Button | Triggers one named action. The primary action advances the learner's current work without implying a correct scientific conclusion; secondary actions do not compete with it. |
| Dialog | Used only for a focused, recoverable decision. It never stacks and warns before an action could hide unsaved reasoning. |
| Notification | Announces a saved, import, or persistence state. Errors describe the recovery action and use `{colors.error}` only for system/input issues, not a weak conclusion. |

The linked Measurement Notebook and Theory Board mockups illustrate these patterns; their layout never overrides the behavioral contract.

## State Patterns

| State | Treatment |
| --- | --- |
| First entry | Progressive guidance introduces the next actionable step without auto-solving. |
| Incomplete evidence | Explain what kind of evidence is missing and offer consultation; never block with a punitive error. |
| Saved observation | Confirm locally and preserve the exact historical run record. |
| Reset | Immediate, recoverable, and never deletes saved observations or decision history. |
| Weak conclusion | Peer review identifies unsupported scope or missing evidence and routes back to revision. |
| Offline reload | Restore previously loaded case progress locally; no network dependency blocks core play. |
| Audio unavailable | All essential information remains readable; captions and independent volume controls remain available. |
| Focus | A visible `{colors.focus}` treatment follows keyboard focus without relying on hover. |
| Empty record | Explain that no observation has been recorded and route to the next available action; do not imply failure. |
| Invalid import | Reject the imported record as a recoverable system state; preserve valid local progress and explain the next action. |
| Persistence failure | Explain that a save could not complete, preserve in-memory work where possible, and offer retry/export without exposing raw errors. |
| Source-load failure | Keep the case context visible, state that the source is unavailable, and offer a retry or alternative linked item; never fabricate a source excerpt. |

## Interaction Primitives

- Pointer: direct selection and drag where helpful, always paired with tap/select and labelled numeric or stepper alternatives.
- Keyboard: visible focus, logical reading-order traversal, semantic buttons/inputs, adjustable values, and announced state changes.
- Touch: pointer-equivalent controls with targets sized and spaced for direct manipulation; no drag-only requirement.
- History: reset, compare, revisit decisions, export/import, and print are explicit, recoverable actions.

## Accessibility Floor

- Essential outcomes and controls live in semantic HTML, with typed actions shared by the visual laboratory and accessible controls.
- Values, units, instructions, state changes, and conclusions are labelled and announced appropriately.
- Colour and sound never carry scientific information alone; avoid flashing hazards.
- Support keyboard-only, pointer-first, and touch-first paths to a defensible conclusion.
- Captions and independent audio controls are required; UI must remain usable without sound.
- Browser zoom/text scaling and responsive tablet layout must not make essential controls unavailable.
- Meet WCAG 2.2 AA for text contrast and keyboard operation. Touch targets are at least 44 × 44 CSS px when touch is available.
- Respect `prefers-reduced-motion`: transitions become immediate and the experiment remains interpretable without motion.
- Screen-reader names, roles, values, and state announcements use the same scientific terms visible in the UI. English is the v1 interface language; localization is out of scope for the first release.

## HUD & Diegetic UI

The apparatus visualisation is an explanatory laboratory object, not an authoritative UI layer. It may communicate the physical setup and outcome, but controls, measurement values, instructions, and conclusions remain non-diegetic semantic UI. No combat-style persistent HUD is assumed.

The historical atmosphere lives in the instrument field, archival materials, and restrained team silhouettes. It never turns team presence into a required UI interaction or hides analytical information in-world.

## Input Schemes

Keyboard/mouse is primary. Touch/pointer equivalence is required for tablet readiness. Context and focus indicators adapt to active input, but button-glyph systems are not applicable unless a future controller surface is added. No essential interaction relies on hover, drag, or canvas targeting alone.

## Game Feel & Juice

Feedback should make adjustment, measurement, archival discovery, comparison, and a well-supported revision feel tangible without falsely signalling one uniquely correct answer. Quiet tactile audio is optional and captioned; visual and motion feedback must be reducible or disableable without losing meaning.

Adjustments receive a short visual confirmation; a completed measurement receives a quiet confirmation and a saved-record announcement; a source inspection receives a restrained focus transition. Peer-review feedback uses no celebratory burst or red failure treatment. No haptic feedback is required for the desktop-browser release.

## Responsive & Platform

Desktop browser is the primary layout. Tablet readiness preserves equivalent pointer, touch, and keyboard outcomes; secondary panels may collapse into labelled drawers. Phones are reading-only until full laboratory usability is proven. Current Chrome, Firefox, Safari, and Edge are the desktop acceptance set.

## Inspiration & Anti-patterns

- Prefer: tactile but bounded scientific investigation, source-led inquiry, accessible browser-native controls, and a calm evidence notebook.
- Avoid: freeform physics sandboxes, canvas-only controls, competitive scoring, speed rewards, irreversible errors, opaque scientific animation, generic dashboards, unlabelled archival imagery, accounts, tracking, ads, and critical external dependencies.

## Key Flows

### Leo investigates a Young interference claim

1. Leo enters the Young case through a disputed observation and inspects two contextual artifacts in the Curated Record.
2. He records a tentative prediction before changing the apparatus.
3. He adjusts an authored variable through the visual lab or its keyboard/touch-equivalent control, then runs the experiment.
4. He saves two observations and compares their settings and outcomes in the notebook.
5. When he is ready to overstate the result, a consultation or peer-review prompt directs Leo to identify a limitation rather than supplying the answer.
6. **Climax:** Leo connects his own evidence and one stated limitation on the theory board, then submits a defensible conclusion.
7. The historical debrief compares Leo's bounded claim to the record; he may revise or replay without penalty.
