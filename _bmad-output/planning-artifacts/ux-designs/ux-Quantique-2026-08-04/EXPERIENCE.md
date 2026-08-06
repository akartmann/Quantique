---
name: Quantique
description: Game experience spine for Quantique.
status: final
sources:
  - ../../gdds/gdd-Quantique-2026-08-04/gdd.md
  - ../../research/domain-historical-science-investigation-games-research-2026-08-04.md
created: 2026-08-04
updated: 2026-08-06
revision: "2.0 — reworked for the Phaser guided adventure"
supersedes: "1.0 (2026-08-04, accessibility-first dual surface)"
pivot_reference: "../../sprint-change-proposal-2026-08-06.md"
---

# Quantique — Experience Spine

## Foundation

Educational indie historical-science investigation for desktop web browsers. Keyboard and mouse are the primary input against the Phaser scenes; touch/pointer is a secondary tablet-readiness goal. **The Phaser scenes are the sole and sufficient interactive surface** — every control, value, instruction, source record, dialogue line, and conclusion choice lives in-canvas, and every player intent is dispatchable from it (ADR-001, ADR-011). The one non-Phaser surface is the semantic CSS print/export view, retained purely so the player's case record stays portable; it dispatches nothing. `DESIGN.md` is the visual-identity reference.

## Information Architecture

Each surface is a Phaser scene the router activates by mirroring the authoritative case phase (ADR-009). A scene is a **place the player is in**, not a panel they operate.

| Scene (phase) | Purpose |
| --- | --- |
| Library (`context`) | A reading room. Establish the disputed claim; take contextual artifacts off the shelf and read them with their provenance. |
| Colleagues (`prediction`) | Colleagues on stage voice four predictions; the player chooses one. |
| Laboratory (`experiment`) | Operate physical instruments, start the light to run the experiment, and keep the measurement notebook. |
| Theory Board (`synthesis`, `review`) | Review the gathered evidence; a colleague proposes each of four conclusions and the player chooses and submits one. |
| Rival Lab (state, not a phase) | Mr. Arthur Bell challenges an unsupported claim and routes back to a revisable choice. Never a fail state. |
| Debrief (`debrief`) | Compare the bounded conclusion with the historical record; recognition, layered explanation, provenance, and replay. |
| Case record (print view) | The one non-Phaser surface: export, import, or print locally saved observations and reasoning. |

Case flow: disputed observation → at least two contextual artifacts read in the library → prediction chosen from four → bounded instrument setup → light started and observations recorded → comparison/replication → theory board and conclusion → rival-lab critique and revision → historical debrief. **Every transition between these steps is advanced from within the scene the player is standing in.** Replays preserve the historical record while allowing counterfactual exploration clearly labelled as such.

→ The HTML files under [mockups/](mockups/) document the **retired** pre-pivot DOM model. They are kept for historical reference only and are superseded by the scene renderers; do not treat them as composition references. This spine wins on any conflict.

## Voice and Tone

Calm, precise, and invitational. Prompts focus attention without supplying an answer. Feedback describes evidence and scope, never the learner's intelligence or performance. Historical claims distinguish what is sourced, reconstructed, interpreted, or fictional.

Use short declarative microcopy: “Record a prediction,” “Compare observations,” and “State one limitation.” Prefer “This claim needs a recorded observation.” to a generic error. Never use score language, exclamation-led encouragement, or language that labels a conclusion right or wrong.

## Component Patterns

| Component | Behavioral contract |
| --- | --- |
| Apparatus instrument | A physical knob, dial, or slider in-scene. Drag travel is bounded by the authored range and snaps to the authored step; discrete step affordances and arrow keys move exactly one step, and both paths produce an identical run record. Current value, units, and valid range are legible beside the instrument. |
| Experiment run | The apparatus is unlit and idle until the player starts the light; starting it *is* the run. Visual output is paired with readable values, labels, and an explanation of the model's assumptions. The measurement resolves from the deterministic model, never from the animation. Under reduced motion the resolved frame appears immediately and the record is identical. |
| Character on stage | A colleague or the rival lab, staged as a vector silhouette from the authored accent colour. The current speaker is foregrounded by position, scale, and label together. Movement is short and restrained and never competes with the reading. Nothing about the staging can reveal which conclusion the evidence defends. |
| Step advance | One in-scene affordance per forward transition, labelled with what the player is moving toward in fiction — never a scene, phase, or route name. A refusal it cannot satisfy is answered by the authored colleague line for that gate; any other refusal by the localized error. Never silent, never a raw error. |
| Notebook observation | Saves actual settings, outcome, timestamp/order, learner note, and linked evidence; supports comparison of any two saved runs, in-scene. |
| Source object | A physical artifact in the reading room. Picking it up opens it and records the inspection. Shows provenance category and its source/rights context as readable text beside the object. |
| Conclusion proposal card | One of four, each attributed to the colleague who proposes it and visually connected to that character's figure. Bundles a claim and its stated limitation. Selection is indicated by more than colour alone and stays freely revisable. Choosing and submitting are separate acts. |
| Colleague hint | Unlimited; delivered in-fiction when a gate refuses. Points to an observable, source, or test and never supplies the final conclusion. |
| Rival-lab critique | Identifies the unsupported claim, missing evidence, or overreach in a pointed-but-fair voice and permits unlimited revision. Never a score, timer, setback, loss, or lockout. |
| In-scene control | Triggers one named action. The primary control advances the player's current work without implying a correct scientific conclusion; secondary controls do not compete with it. |
| Transient message | A refused action always says why, in the player's language, and the message survives until a real state change replaces it. Never a raw error, never silence, never erased by an unrelated redraw. |
| Notification | Reports a saved, import, or persistence state. Errors describe the recovery action and use `{colors.error}` only for system/input issues, never for a weak conclusion. |

**Layout contract for every in-scene surface.** The canvas is a fixed 1024×768 `Scale.FIT` surface that does not scroll, and French copy runs 15–25% longer than English. So a surface **measures** what sits above it and places itself against that measurement, never against a constant; unbounded prose grows into empty space rather than off the canvas; and where two objects share a vertical budget, the one that can grow is clamped. A control the player must click and cannot see is not a cosmetic fault — it is an uncompletable phase.

## State Patterns

| State | Treatment |
| --- | --- |
| First entry | Progressive guidance introduces the next actionable step without auto-solving. |
| Incomplete evidence | Explain what kind of evidence is missing and offer consultation; never block with a punitive error. |
| Saved observation | Confirm locally and preserve the exact historical run record. |
| Reset | Immediate, recoverable, and never deletes saved observations or decision history. |
| Weak conclusion | The rival lab identifies unsupported scope or missing evidence and routes back to revision. |
| Gate unmet | A colleague names in-fiction what is still missing — a reading, a distinguishing measurement — in the player's language. It points at the next observable action and never supplies the conclusion. |
| Apparatus idle | The source is dark, nothing propagates, and the screen is unlit. An in-scene line invites the player to start the light. |
| Offline reload | Restore previously loaded case progress locally; no network dependency blocks core play. |
| Audio unavailable | All essential information remains readable; captions and independent volume controls remain available. |
| Focus | A visible `{colors.focus}` treatment follows the active in-scene control without relying on hover. |
| Empty record | Explain that no observation has been recorded and route to the next available action; do not imply failure. |
| Invalid import | Reject the imported record as a recoverable system state; preserve valid local progress and explain the next action. |
| Persistence failure | Explain that a save could not complete, preserve in-memory work where possible, and offer retry/export without exposing raw errors. |
| Source-load failure | Keep the case context visible, state that the source is unavailable, and offer a retry or alternative linked item; never fabricate a source excerpt. |

## Interaction Primitives

- **Pointer (primary):** direct manipulation of in-scene objects — grasp and turn a knob, pick a book off a shelf, click a proposal card. Drag is always paired with a discrete step affordance so no value is reachable by drag alone.
- **Keyboard (primary):** a visible focus treatment on the active in-scene control, and arrow keys that move an instrument exactly one authored step. A pointer path and a keyboard path to the same value produce an identical run record.
- **Touch (secondary):** pointer-equivalent, with targets sized and spaced for direct manipulation; no drag-only requirement. Tablet readiness, not a release gate.
- **History:** reset, compare, revisit decisions, export/import, and print are explicit, recoverable actions.

## Experience Floor

_Retained from the pre-pivot accessibility floor. Accessibility **acceptance** is de-scoped from the MVP per ADR-008; the items below are what survived that de-scope because they are design quality, not compliance._

- **Diegetic never means hidden.** Every value carries its unit as legible text beside the object it belongs to; every instrument shows its current setting; every gate that refuses says why. An in-world affordance the player cannot find, read, or understand has failed.
- Respect `prefers-reduced-motion`: no update loop registers, transitions are immediate, and the experiment stays interpretable as a static resolved frame. This is the retained photosensitivity guard and it survives the a11y de-scope.
- No flashing hazards in any scene.
- Captions and independent audio controls are required; the game must remain fully playable without sound.
- Text is legible at 1280×720 and reflows without truncation, in **both** shipped languages.
- **English and French are the v1 interface languages, bilingual at launch.** Every content surface inherits this as part of its own acceptance criteria — UI chrome, curated records, book content, colleague dialogue, proposal text, hint text, rival-lab critiques, sources, and debrief. Locale is detected from the browser; there is no player-facing language selector. Localization beyond EN/FR is out of scope.
- Errors and refusals never expose raw error text, and learner-entered reasoning is never logged by default.

**De-scoped from the MVP (ADR-008), not judged wrong:** keyboard-only completion as a release gate, screen-reader names/roles/state announcements, non-colour-only scientific encoding, WCAG 2.2 AA acceptance, and 44 × 44 CSS px touch targets. The store/domain boundary is preserved so an accessible surface can be reintroduced post-MVP without re-architecture.

## HUD & Diegetic UI

The scene *is* the interface. Controls, measurement values, instructions, source records, dialogue, and the conclusion choice are all diegetic and in-canvas: the player turns a knob on an instrument, starts a light, picks a book off a shelf, and hears a colleague standing in the room. No non-diegetic semantic UI layer mirrors any of it. No combat-style persistent HUD is assumed.

Diegetic never means hidden. Every value carries its unit as legible text beside the object it belongs to; every instrument shows its current setting; every gate that refuses says why, in fiction, in the player's language. An in-world affordance that a player cannot find, read, or understand has failed — scientific legibility outranks atmosphere every time they conflict.

The historical atmosphere lives in the instrument field, the archival materials, and the staged characters. Character presence is required interaction — a colleague voices a proposal the player must choose between, and the rival lab challenges a claim — but it never conceals analytical information in-world or makes a required value reachable only through a conversation.

## Input Schemes

Keyboard/mouse is primary against the Phaser canvas. Touch/pointer is a secondary tablet-readiness goal. Context and focus indicators adapt to active input, but button-glyph systems are not applicable unless a future controller surface is added. No essential interaction relies on hover or on drag **alone** — every instrument that can be dragged can also be stepped.

## Game Feel & Juice

Feedback should make adjustment, measurement, archival discovery, comparison, and a well-supported revision feel tangible without falsely signalling one uniquely correct answer. Quiet tactile audio is optional and captioned; visual and motion feedback must be reducible or disableable without losing meaning.

Turning an instrument receives immediate tactile confirmation — the indicator moves, the value steps, the previewed pattern responds. Starting the light is the scene's one moment of real spectacle: the source ignites, light travels, the pattern resolves. A completed measurement receives a quiet confirmation and a saved record. Picking up a source receives a restrained transition into the reading surface. A colleague's hint and the rival lab's critique both use no celebratory burst and no red failure treatment. No haptic feedback is required for the desktop-browser release.

## Responsive & Platform

Desktop browser is the primary layout. The canvas is a fixed 1024×768 `Scale.FIT` surface that scales as a whole and does not scroll, so there are no collapsing panels or drawers — a surface that outgrows its band is a layout defect to fix, not a responsive state to design. Tablet readiness preserves equivalent pointer, touch, and keyboard outcomes. Phones are reading-only until full laboratory usability is proven; note that narrow-viewport control suppression must not be the reason a transition becomes unreachable. Current Chrome, Firefox, Safari, and Edge are the desktop acceptance set.

## Inspiration & Anti-patterns

- Prefer: tactile but bounded scientific investigation, source-led inquiry, instruments that feel operated rather than configured, characters who carry the reasoning, and a calm evidence notebook.
- Avoid: freeform physics sandboxes, competitive scoring, speed rewards, irreversible errors, opaque scientific animation, generic dashboards, unlabelled archival imagery, accounts, tracking, ads, and critical external dependencies.
- Also avoid, as of 2026-08-06: **placeholder scenes** presented as delivered surfaces; a transition reachable only from outside the scene the player is standing in; an animation that runs because a scene loaded rather than because the player acted; and an affordance whose only dispatcher lives outside the canvas.
- No longer an anti-pattern: canvas-only controls. They are now the design (ADR-001, ADR-011) — provided the Experience Floor above holds.

## Key Flows

### Leo investigates a Young interference claim

_Not one DOM interaction appears in this flow. That is the point of the rework._

1. Leo enters the Young case on a disputed observation and finds himself **in the library**. He takes the Opticks reference off the shelf, and it opens on the reading surface with its provenance and rights status legible beside it. He reads it, then the second required artifact.
2. He walks out of the library. Had he tried to leave early, a colleague would have named the artifact he had not yet read — in fiction, in his language, with nothing lost.
3. **Four colleagues are standing in the room.** Each voices a prediction; the speaker is foregrounded as they talk. Leo picks the one he finds most plausible — revisably, and with no hint anywhere on stage as to which the evidence will favour.
4. In the laboratory the apparatus sits **dark**. Leo grasps the slit-spacing knob and turns it; the value snaps through the authored 0.05 mm steps and reads out beside the instrument. He presses to **start the light**: the source ignites, wavefronts travel to the slits, and the fringe pattern resolves on the screen. The measurement is recorded.
5. He changes the screen distance and starts the light again. The notebook now holds two observations he can compare side by side.
6. When he tries to leave for the theory board too early, a colleague points at what still needs varying — never at the conclusion.
7. **Climax:** at the theory board a colleague proposes each of four conclusions, each bundling a claim and its stated limitation. Leo chooses one and submits it.
8. **Mr. Arthur Bell challenges it.** The rival lab names the overreach in a pointed-but-fair voice, and routes Leo straight back to a revisable choice — no score, no setback, no lockout. Leo revises.
9. The historical debrief compares Leo's bounded claim to the record, shows his revision as inquiry rather than failure, and offers a replay that leaves the recorded history intact.
