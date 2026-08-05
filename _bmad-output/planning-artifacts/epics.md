---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md
  - _bmad-output/game-architecture.md
  - _bmad-output/project-context.md
---

# Quantique - Epic Breakdown

## Overview

This document decomposes the requirements for *Fracture of Certainty: Cases from the Quantum Age* into implementable game-development stories. It uses the GDD, game architecture, and project context. No standalone UX design document is currently available.

> **Sprint Change — Pivot to a Phaser guided adventure (approved 2026-08-05).** See `sprint-change-proposal-2026-08-05.md`. The case now plays as a scripted Phaser scene flow (Library → Colleagues → Lab → Theory Board → Debrief). Predictions and conclusions are 1-of-4 colleague proposals; a rival lab critiques an unsupported conclusion (never a hard fail); the conclusion unlocks after ≥2 *significant* measurements. The store/domain/evaluator/persistence layers are **kept**; the semantic-HTML presentation layer is **retired** (print/export only); **accessibility is de-scoped from the MVP**. Stories marked **[reworked — pivot]** changed materially and must be re-baselined; stories marked **[new — pivot]** are additions.

## Requirements Inventory

### Functional Requirements

FR1: Provide a browser anthology of the four historical laboratory mysteries: Morley–Miller, Young, Hafele–Keating, and Hensen et al. Delft.
FR2: Deliver Young as the first fully playable validation slice while retaining Morley–Miller as the first campaign case.
FR3: Run every case through the Apparatus → Anomaly → Revision loop: dispute, artifacts/prediction, bounded lab, experiment/measurement, comparison/consultation/replication, theory-board conclusion, and debrief.
FR4: Require two contextual artifacts or sources and a prediction before the first substantive test.
FR5: Distinguish primary artifacts, contemporary disagreement, later consensus, interpretation, reconstruction, and fiction in the Curated Record.
FR6: Provide authored, bounded apparatus controls, never a freeform physics sandbox.
FR7: Young uses 0.10–0.50 mm slit spacing in 0.05 mm steps, 1.0–4.0 m screen distance in 0.25 m steps, fixed 550 nm initially, and optional advanced wavelength comparison.
FR8: Run the apparatus and present visual output; Young resolves within three seconds and resets immediately.
FR9: Save settings, timestamp/order, observed fringe spacing, comparison notes, and linked evidence in a measurement notebook.
FR10: Retain at least two observations and compare any two saved runs.
FR11: Provide export or print of a case/observation record.
FR12: **[reworked — pivot]** Provide a theory-board scene where the player chooses one of four colleague-proposed conclusions; the evaluator determines which proposals the recorded evidence defends.
FR13: **[reworked — pivot]** Unlock the conclusion choice only after ≥2 *significant* measurements and the required sources; each conclusion proposal bundles a claim and its limitation. Choosing an unsupported proposal triggers the rival-lab critique and routes back to a revisable choice.
FR14: **[reworked — pivot]** Provide unlimited in-fiction colleague hints (delivered when the significant-measure gate is unmet) that point only to an observable, source, or test — never the final conclusion.
FR15: Provide revisable peer review and preserve decision history.
FR16: Give weak conclusions revision feedback instead of hard failure, penalty, or irreversible wrong choice.
FR17: Give non-competitive recognition for rigorous inquiry without gating completion.
FR18: Give every case one discoverable confound or misleading result, a reset-solvable required puzzle, and inspectable model assumptions.
FR19: Implement Morley–Miller rotation, fringe and temperature logging, stable-window replication, and upper-bounded conclusion.
FR20: Implement Hafele–Keating calibration, route/altitude/time inspection, prediction before results, and outcome/error-bar comparison.
FR21: Implement Delft’s two labs 1.3 km apart, detector efficiency, fast random basis selection, spacelike timing, finite CHSH data, and bounded conclusion.
FR22: **[reworked — pivot]** Deliver in-play observation prompts, plain-language explanation, and an optional technical/source-detail layer through colleague dialogue in-scene.
FR23: Provide unlimited reset, comparison, decision-history review, neutral auto-summaries, and non-auto-solving hints.
FR24: Support alternate configurations, counterfactual replay explicitly distinct from history, optional-variable testing, and varied evidence order.
FR25: Structure every case with opening dispute, Curated Record, lab setup, two-to-four cycles, theory-board review, debrief, optional replay, campaign unlocks, and history-preserving replay.
FR26: Maintain a sourced artifact ledger with named primary/secondary sources, scholarly reviewer, educator context sheet, accessible controls, and a rights/replacement plan for each case.
FR27: Label claims/assets with provenance and rights status; replace or link ambiguous-permission assets.
FR28: Provide quiet adjustment, measurement, and archival-discovery audio with captions and independent volume controls; no essential sound-only information.
FR29: Keep progression as knowledge/confidence without currency, energy, inventory, stats, premium gates, ads, or randomized rewards.

### NonFunctional Requirements

NFR1: Sustain 60 FPS at 1280×720 on a representative low-end school laptop during a 10-minute lab loop.
NFR2: Reach first meaningful interaction within five seconds after a cached launch.
NFR3: Support current desktop Chrome, Firefox, Safari, and Edge (mouse/keyboard primary); tablet touch support is a secondary goal.
NFR4: Phones are reading-only until laboratory usability is proven.
NFR5: No account, telemetry, advertising, cloud save, remote configuration, or network dependency may block core play.
NFR6: ~~Essential interactions must never be canvas-only; semantic controls expose labels, values, units, keyboard adjustment, and announcements.~~ **[de-scoped — pivot]** Interactive play is Phaser-canvas; on-screen controls show current value and units.
NFR7: ~~Colour and sound are never the sole carriers of scientific information.~~ **[de-scoped — pivot]** (non-colour-only encoding revisited post-MVP; basic no-flashing safety retained).
NFR8: The game has no hard fail, irreversible wrong choice, speed reward, or reward for overclaiming.
NFR9: Scientific results are deterministic, inspectable, reproducible, and preserve their model version.
NFR10: Shipped case definitions and assets are immutable; player progress is separate local data.
NFR11: Historical claims and assets require provenance and rights review before release.
NFR12: Local progress survives failed imports and save failures without silent loss.
NFR13: Automated coverage includes unit, browser E2E, cross-browser, and offline-reload checks. **[reworked — pivot]** Accessibility (axe) checks and manual accessibility acceptance are de-scoped from MVP; the E2E flow now exercises the Phaser scene sequence and rival-lab revision.
NFR14: A case first-play session takes 20–45 minutes; the Young slice targets 20–30 minutes.
NFR15: The product is a static hosted web application with cache-versioned production assets.
NFR16: No freeform physics sandbox, multiplayer, UGC, LLM dialogue, or external critical-play integration is introduced.
NFR17: The framework must allow a second case to be authored without duplicating core behavior.
NFR18: Learner-entered conclusions are not exposed through raw errors or default logging.
NFR19: **[new — pivot]** The game ships bilingual (English and French) from the first release; all player-facing text (UI, Phaser scene text, case content, print view) is localized, and the Young slice includes complete EN and FR content. Localization beyond EN/FR remains out of scope.

### Additional Requirements

- Initialize from Phaser's official Vite + TypeScript template; use Phaser 4.2.1, TypeScript, Vite 8.1.x, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1, and `@axe-core/playwright` 4.12.1.
- Commit the generated lockfile to pin the exact Vite patch.
- Use a project-owned immutable TypeScript store and typed actions as the sole authority for application state.
- Route semantic DOM and Phaser interactions through the same typed intents; neither layer mutates the other or state directly.
- Keep `src/domain/` pure: no Phaser, DOM, fetch, IndexedDB, or browser APIs.
- Restrict browser effects to adapters; repositories alone fetch and validate case JSON.
- Validate case content and imports at boundaries with Zod and return typed `Result` failures for expected errors.
- Persist versioned progress and migrations in IndexedDB; preserve valid data after rejected imports.
- Record deterministic experiment outputs with controls, timestamp, and experiment model version; never recalculate historical runs against a newer model.
- Use the finite case phase machine `context → prediction → experiment → synthesis → review → debrief`; only the evidence evaluator controls readiness.
- Keep consultations and peer review data-driven and fact-bound; they may identify missing evidence but cannot bypass it.
- Use case-scoped asset bundles after a minimal boot shell; avoid per-frame domain work, browser IO, DOM work, or logging.
- Use renderer factories for Phaser object lifecycle and clean scene subscriptions on shutdown.
- Export/import versioned JSON and render a semantic CSS print view.
- Follow the specified domain-driven folder structure, naming conventions, typed `noun.verb` events, constructor injection, public-action testing, and static-host deployment.

### UX Design Requirements

**[reworked — pivot]** The UX spine (`ux-designs/.../EXPERIENCE.md`) is being revised for the Phaser guided adventure. The accessibility-first UX requirements below are **de-scoped from the MVP**; the agency-preserving requirement is retained and reworked:

UX-DR1: ~~Semantic, labelled controls with keyboard adjustment/announcements for every essential lab action.~~ **[de-scoped — pivot]** Controls live in the Phaser scene and show value + units on-screen.
UX-DR2: ~~Pointer, touch, keyboard, and DOM paths invoke identical actions.~~ **[de-scoped — pivot]** Mouse/keyboard primary, touch secondary; all through the Phaser scenes.
UX-DR3: ~~Accessible notebook, theory board, source, conclusion, feedback interfaces; Phaser is a companion.~~ **[de-scoped — pivot]** Phaser scenes are the sole interactive surface.
UX-DR4: ~~Non-colour encodings, captioned feedback~~ **[de-scoped — pivot]** (revisit post-MVP; explicit loading/recovery explanations still expected in-scene).
UX-DR5: **[kept — reworked]** Colleague dialogue, hints, and proposal choices preserve player agency and never auto-solve the case.
UX-DR6: ~~Semantic print view + responsive tablet-equivalent layout.~~ **[reworked — pivot]** Keep the CSS print/export view (record portability); desktop-first Phaser canvas, tablet secondary.

### FR Coverage Map

FR1: Epics 2, 4, 5, and 6 — four named case slices.
FR2: Epics 1–2 — Young-first production and validation; Epic 4 — Morley-first campaign unlock.
FR3: Epic 1 Story 1.2; Epics 2 and 4–6 — explicit full loop and two-to-four-cycle acceptance.
FR4: Epic 2 Story 2.1; Epics 4–6 context stories.
FR5: Epic 1 Story 1.5; Epics 2 and 4–6 Curated Records.
FR6: Epic 1 Story 1.3; Epic 3 Story 3.1.
FR7: Epic 2 Story 2.2.
FR8: Epic 2 Story 2.2.
FR9: Epic 1 Story 1.4; Epic 2 Story 2.3.
FR10: Epic 1 Story 1.4; Epic 2 Story 2.3.
FR11: Epic 1 Story 1.9.
FR12: Epic 1 Story 1.6.
FR13: Epic 1 Story 1.6; Epics 2 and 4–6 conclusion stories.
FR14: Epic 1 Story 1.7.
FR15: Epic 1 Story 1.7.
FR16: Epic 1 Stories 1.6–1.7.
FR17: Epic 1 Story 1.10.
FR18: Epic 1 Story 1.2; Epics 2 and 4–6 case-loop criteria.
FR19: Epic 3 Story 3.2; Epic 4 Story 4.2.
FR20: Epic 5 Story 5.2.
FR21: Epic 6 Story 6.2.
FR22: Epic 1 Story 1.7.
FR23: Epic 1 Stories 1.6–1.7.
FR24: Epic 2 Story 2.3; Epics 4–6 conclusion/replay criteria.
FR25: Epic 1 Story 1.2; Epics 2 and 4–6 case-loop criteria.
FR26: Epic 3 Story 3.3 — ledger fields: named primary/secondary sources, scholarly reviewer, educator context sheet, accessible-controls reference, and rights/replacement plan.
FR27: Epic 1 Story 1.5; Epic 3 Story 3.3.
FR28: Epic 1 Story 1.10.
FR29: Epic 1 Story 1.9.

## Epic List

### Epic 1: Phaser guided-adventure foundation

Players can move through a scripted Phaser scene flow — reading the reference in the library, choosing a prediction with colleagues, running and recording experiments in the lab, choosing a colleague conclusion at the theory board, and receiving a rival-lab critique — with progress retained locally. The store/domain/evaluator/persistence layers are reused; the presentation is Phaser-first.

**FRs covered:** FR2, FR3, FR5, FR9–FR18, FR22–FR25, FR27–FR29 (FR6 accessibility clause de-scoped; FR12–FR14/FR22 reworked per pivot).

### Epic 2: Young validation slice

Players can complete a 20–30 minute double-slit investigation: inspect context, make a prediction, run experiments, compare measurements, issue a bounded conclusion, and receive a historical debrief.

**FRs covered:** FR1, FR2, FR4, FR7, FR8, FR10, FR13, FR16–FR18, FR24, FR25.

### Epic 3: Reusable case authoring and provenance

Content authors and reviewers can create fact-bound, auditable cases with authored scientific rules, sources, rights records, assets, feedback, and debrief material without rebuilding the core loop.

**FRs covered:** FR3, FR6, FR18, FR25–FR27.

### Epic 4: Morley–Miller tutorial case

Players can distinguish thermal drift from an orientation-dependent ether signal through authored evidence and issue a bounded conclusion.

**FRs covered:** FR1, FR2, FR3, FR18, FR19, FR24, FR25.

### Epic 5: Hafele–Keating relativity case

Players can assess competing clock predictions, uncertainty, and an independent skeptic’s critique before reaching a bounded conclusion.

**FRs covered:** FR1, FR3, FR18, FR20, FR24, FR25.

### Epic 6: Hensen et al. entanglement case

Players can weigh setup safeguards, finite evidence, and the limits of a CHSH-based conclusion.

**FRs covered:** FR1, FR3, FR18, FR21, FR24, FR25.

### Epic 7: Classroom release readiness

Educators can use a reviewed, accessible, classroom-ready case with clear activity materials and debrief support.

**FRs covered:** FR26, FR29.

## Epic 1: Phaser guided-adventure foundation

Players can move through a scripted Phaser scene flow — library, colleagues, lab, theory board, rival-lab critique — with progress retained locally. The store/domain/evaluator/persistence layers are reused; the presentation is Phaser-first and the semantic-HTML surface is retired (print/export only).

### Story 1.1: Project bootstrap and verification harness

As a delivery team,
I want a reproducible browser-game starter and verification harness,
So that the Young validation slice can be built and tested without bundling setup into an interaction story.

**Acceptance Criteria:**

**Given** a greenfield repository,
**When** bootstrap is complete,
**Then** it is initialized from Phaser’s official Vite + TypeScript template with the approved dependencies and a committed generated lockfile pinning the exact Vite patch,
**And** production-build, unit, browser-E2E, offline-reload, cross-browser, and accessibility test commands are available.

**Given** the boot shell,
**When** it loads from cached production assets,
**Then** the first meaningful interaction is reachable within five seconds,
**And** the app remains a static hosted web application with no account, telemetry, advertising, cloud save, remote configuration, or network-critical play dependency.

### Story 1.1b: Internationalization foundation — English + French [new — pivot]

> **BUILD ORDER:** an *early* foundation story — build immediately after Story 1.1 and before any scene renders player-facing text. Suffixed `1.1b` (rather than renumbering) to preserve the IDs of already-built stories 1.2–1.9.

As a player,
I want to play in English or French from the first release,
So that both English- and French-speaking learners can use the game.

**Acceptance Criteria:**

**Given** the application boots,
**When** it initializes,
**Then** every player-facing string resolves through an i18n layer backed by `en` and `fr` locale resources (no hard-coded display strings in scenes, widgets, or the print view),
**And** the active locale is read from the authoritative store.

**Given** a language selector is available early (boot/menu and in-game settings),
**When** I switch language,
**Then** the active locale updates through a typed action, every open scene re-renders its text from the new locale, and the choice persists in IndexedDB settings and survives offline reload.

**Given** a case definition's authored text (dialogue beats, colleague names/roles, the four prediction and four conclusion proposals with their limitations, colleague hints, rival-lab critiques, source labels, and debrief),
**When** it is loaded,
**Then** each localizable string provides both `en` and `fr`,
**And** Zod rejects a case missing a required locale before domain logic.

**Given** French text is rendered in a Phaser scene,
**When** it displays,
**Then** the chosen font(s) include the full French glyph set and diacritics (é è ê ë à â ç î ï ô û ù œ « »),
**And** accented text renders without missing glyphs or clipping at 1280×720.

**Given** a translation key is missing at runtime,
**When** text is resolved,
**Then** it falls back to English and logs a dev-only `i18n.missingKey` warning,
**And** the player never sees a raw key or an empty string.

**Given** player-facing numbers and units,
**When** displayed,
**Then** they use locale-aware formatting where appropriate,
**And** the recorded scientific run values remain canonical and unchanged.

**Given** the i18n foundation,
**When** tests run,
**Then** a unit test asserts locale-resource completeness (every key present in both `en` and `fr`) and English fallback,
**And** an integration test verifies that the selector switches language, persists it, and re-renders scene text.

_Young-slice note: EN and FR content for the Young case ships complete, and the Story 2.4 validation gate covers both locales._

### Story 1.2: Minimal Young case contract and authored loop

As a Young content author,
I want the smallest validated contract needed for the first playable case,
So that Young content and its case loop exist before dependent foundation features without pre-building every later-case field.

**Acceptance Criteria:**

**Given** the initial Young case contract,
**When** it is loaded through a repository,
**Then** Zod validates only its case ID/version, two required contextual artifacts, prediction requirement, bounded Young control definitions, deterministic experiment-model version, minimum evidence requirements, sourced debrief, and immutable asset manifest,
**And** invalid content returns a typed recoverable `Result` before domain logic.

**Given** a fresh Young case,
**When** the player proceeds through it,
**Then** the finite phase machine is `context → prediction → experiment → synthesis → review → debrief`,
**And** the case requires opening dispute, Curated Record, lab setup, two-to-four experiment cycles, theory-board review, historical debrief, and optional replay.

**Given** every required case puzzle including Young,
**When** it begins from reset,
**Then** it has one authored confound or initially misleading result discoverable by replication, a control change, or source comparison,
**And** its reset-solvable path and physical-model assumptions are inspectable.

### Story 1.3: Phaser laboratory controls [reworked — pivot]

As a player,
I want to adjust an authored laboratory control in the lab scene with my mouse or keyboard,
So that I can set up and run experiments inside the guided adventure.

**Acceptance Criteria:**

**Given** an authored numeric apparatus control with a label, unit, allowed range, and step,
**When** the LaboratoryScene loads,
**Then** the Phaser scene renders the control with its current value and unit visible on-screen,
**And** the control reads its value from the authoritative store.

**Given** a player changes the control through a Phaser pointer gesture or keyboard interaction,
**When** the change is accepted,
**Then** the scene dispatches the typed `apparatus.controlSet` intent to the store (it never mutates state directly),
**And** the stored value and the on-screen readout update from the resulting state.

**Given** a requested value is below the minimum, above the maximum, or off the configured step,
**When** it is submitted,
**Then** the domain layer applies the documented validation/normalization rule deterministically,
**And** the scene reflects the resulting value.

**Given** the LaboratoryScene is rendered from state,
**When** the authoritative control value changes,
**Then** the renderer mirrors the new value without owning or directly mutating application state,
**And** scene shutdown removes its subscriptions and display objects.

**Given** the control implementation,
**When** automated tests run,
**Then** unit tests cover validation and the pure state transition,
**And** an integration test proves the scene intent path produces the expected authoritative state.

### Story 1.4: Measurement notebook and run comparison [reworked — pivot]

As a player,
I want to save observations from my experiment and compare two recorded runs,
So that I can use my own evidence to reason about a scientific claim.

**Acceptance Criteria:**

**Given** an authored experiment definition and validated apparatus controls,
**When** I record a run,
**Then** the pure domain calculation produces an immutable run record containing an ID, case ID, controls, calculated result, timestamp, and experiment-model version,
**And** the record does not depend on Phaser, DOM, or browser APIs.

**Given** a recorded run,
**When** I open the notebook in the LaboratoryScene,
**Then** I can read its settings, values and units, timestamp/order, observed result, and linked evidence in-scene,
**And** each value is shown with its unit as readable text (not colour alone).

**Given** at least two saved runs,
**When** I select any two runs for comparison,
**Then** the notebook shows their settings and results side-by-side in-scene,
**And** I can save an associated comparison note.

**Given** I reset or alter the current apparatus after recording a run,
**When** I revisit that record,
**Then** it retains the original controls, result, timestamp, and model version,
**And** it is never recalculated from a newer model implicitly.

**Given** a save request fails or the record is invalid,
**When** the error is handled,
**Then** valid in-memory evidence remains available,
**And** the player receives a neutral in-scene recovery message rather than raw error text.

**Given** the notebook and comparison capability,
**When** tests run,
**Then** unit tests cover deterministic run creation and comparison selection,
**And** integration tests assert the notebook behavior through public store actions and selectors.

### Story 1.5: Library scene — Curated Record and source labels [reworked — pivot]

As a player,
I want to read contextual sources with clear provenance labels in the library scene,
So that I can distinguish evidence from reconstruction, interpretation, and fiction before choosing a conclusion.

_Implementation note: the LibraryScene reuses the existing `LectureBookRenderer` / Opticks archive book._

**Acceptance Criteria:**

**Given** authored case content,
**When** it is loaded,
**Then** each source record is validated with Zod before reaching domain logic,
**And** invalid content is returned as a typed, recoverable failure.

**Given** a source in the Curated Record,
**When** I inspect it in the LibraryScene,
**Then** I can identify its title, creator or originating context, source type, provenance, rights status, and relevant case relationship,
**And** the category is shown as readable text (not colour alone).

**Given** source content that is primary material, reconstruction, later interpretation, or deliberate fiction,
**When** it is presented,
**Then** its category is explicit in text in-scene,
**And** labels remain understandable without sound.

**Given** I inspect a source,
**When** the inspection is recorded,
**Then** the authoritative evidence state stores the source ID through a typed action,
**And** the source can later be referenced by notebook, theory-board, consultation, and review features.

**Given** a source has incomplete rights information or cannot be loaded,
**When** I attempt to inspect it,
**Then** the scene gives a neutral in-scene explanation and a safe fallback state,
**And** it never presents unreviewed historical material as verified evidence.

**Given** the Curated Record,
**When** tests run,
**Then** unit tests cover source validation and provenance rules,
**And** integration tests verify the inspected-source state through public store actions and selectors.

### Story 1.6: Theory-board scene — choose a colleague conclusion [reworked — pivot]

As a player,
I want to review my evidence and choose one of four colleague-proposed conclusions,
So that I commit to the scientific claim my measurements actually support.

**Acceptance Criteria:**

**Given** recorded runs and inspected sources,
**When** I open the TheoryBoardScene,
**Then** I can review the observations and sources I have gathered in-scene,
**And** I am presented with four colleague-proposed conclusions, each bundling a claim and its stated limitation.

**Given** a case definition with a significance rule and minimum evidence requirements,
**When** conclusion readiness is evaluated,
**Then** the pure domain evaluator checks the ≥2-significant-measure count and required sources, and returns the set of conclusion proposals whose `supportPredicate` the evidence satisfies,
**And** it returns explicit missing requirements without inspecting scene state or UI visibility.

**Given** the significant-measure gate is unmet,
**When** I try to reach the conclusion choice,
**Then** a colleague explains in-fiction what still needs measuring and provides a next-action path,
**And** it does not permanently block, punish, or discard my work.

**Given** the gate is met and I choose a conclusion proposal,
**When** the choice is submitted,
**Then** the store records the chosen proposal ID and transitions the case phase using a typed domain action,
**And** the scene only mirrors the resulting phase.

**Given** the chosen proposal's ID is not in the evaluator's defensible set,
**When** the choice is evaluated,
**Then** it routes to the rival-lab critique (Story 2.5) rather than completing,
**And** the choice remains fully revisable with no hard fail.

**Given** the theory-board implementation,
**When** tests run,
**Then** unit tests cover the significance count, every defensible/indefensible proposal combination, and valid readiness,
**And** integration tests use public store actions and selectors rather than Phaser internals.

### Story 1.7: Colleague consultation, critique, and revision history [reworked — pivot]

As a player,
I want evidence-responsive colleague guidance and revisable critique,
So that I can improve my reasoning without being given the answer or losing my decision history.

**Acceptance Criteria:**

**Given** a case definition with consultation and critique rules,
**When** it is loaded,
**Then** the rules are validated case data with explicit predicates and dialogue content,
**And** they do not encode a scene-specific completion path.

**Given** my current evidence state,
**When** a colleague consultation is triggered,
**Then** the selected prompt points to a missing observation, source, alternative test, or limit,
**And** it never supplies the final conclusion verbatim.

**Given** I choose an unsupported conclusion,
**When** the critique rules evaluate it,
**Then** the rival lab identifies unsupported claims, missing evidence, or overreach in a pointed-but-fair voice,
**And** it offers a revision path rather than a hard-fail state.

**Given** I revise a critiqued conclusion choice,
**When** I save the revision,
**Then** the authoritative progress retains the prior chosen conclusion, the critique, the revision timestamp, and the current choice as decision history,
**And** a revision never overwrites or silently discards earlier reasoning.

**Given** a consultation or critique rule cannot be evaluated,
**When** the system handles that failure,
**Then** the player receives a recoverable in-scene message and keeps their valid work,
**And** raw errors and player-entered text are not logged by default.

**Given** a player needs help,
**When** a colleague prompt is requested,
**Then** the case provides an in-play observation prompt, a plain-language explanation, and an optional technical/source-detail layer,
**And** the structured hint path preserves the player’s final conclusion choice with no mandatory skip in the first case.

**Given** a player resumes investigation,
**When** they inspect assistance surfaces,
**Then** they can use unlimited colleague consultations, reset, run comparison, decision-history review, and neutral auto-summaries,
**And** those surfaces never punish or lock valid work.

**Given** consultation and critique behavior,
**When** tests run,
**Then** unit tests cover predicate selection, unsupported-claim critique, and revision-history preservation,
**And** integration tests verify the colleague-consultation and revision flow through public store actions.

### Story 1.8: Offline progress, export, import, and print

As a player,
I want my investigation progress to survive offline reloads and be portable as an export or print record,
So that I can safely continue, share, or retain my evidence without an account.

**Acceptance Criteria:**

**Given** valid case progress containing runs, inspected sources, theory-board work, review history, and recognition,
**When** a persistence adapter saves it,
**Then** it stores a versioned record in IndexedDB through `idb`,
**And** domain modules do not access IndexedDB or browser APIs directly.

**Given** a previously saved valid record,
**When** I reload the application offline after its case assets have been loaded once,
**Then** the application restores the record and its decision history,
**And** no network request is required to resume core play.

**Given** an exported record,
**When** I choose export,
**Then** the application produces versioned JSON containing the player’s portable case record,
**And** it excludes immutable case definitions and unrelated local data.

**Given** an imported record,
**When** I choose import,
**Then** it is validated with Zod and migrated explicitly when supported,
**And** an invalid or incompatible import leaves the last valid local progress intact with a neutral semantic explanation.

**Given** I choose to print my work,
**When** the print view is opened,
**Then** a semantic CSS print view presents settings, observations, sources, comparison notes, conclusion, and stated limitations,
**And** it does not depend on a canvas-only capture.

**Given** persistence and portability behavior,
**When** tests run,
**Then** unit tests cover record validation and migrations,
**And** Playwright covers export/import recovery and offline reload in Chromium, Firefox, and WebKit.

### Story 1.9: In-scene feedback and inquiry recognition [reworked — pivot]

As a player,
I want clear in-scene feedback and recognition for careful investigation,
So that I am encouraged to test, replicate, and choose appropriately limited claims rather than rush to a “correct” answer.

**Acceptance Criteria:**

**Given** a player action, completed run, source inspection, or critique result,
**When** feedback is presented,
**Then** essential meaning is conveyed as readable in-scene text,
**And** colour, animation, or sound is never the sole carrier of that meaning (basic no-flashing safety retained).

**Given** I replicate a run, read sources, test an optional variable, or choose a well-calibrated claim,
**When** recognition is evaluated,
**Then** I receive non-competitive recognition based on those inquiry actions,
**And** it neither gates completion nor rewards speed, perfect answers, or overclaiming.

**Given** optional adjustment, measurement, or archival audio is available,
**When** I play,
**Then** I can independently control that audio and no essential scientific information is lost when sound is unavailable.

**Given** progression and recognition rules,
**When** they are reviewed for release,
**Then** they model only knowledge and confidence with non-gating inquiry recognition,
**And** they contain no currency, energy, inventory, stat system, premium gate, advertising, or randomized reward.

_Accessibility acceptance (keyboard-only, screen-reader, focus recovery, non-colour encoding) is de-scoped from MVP per the pivot._

### Story 1.10: Scene router and adventure flow [new — pivot]

As a player,
I want the case to move me through its scenes in a scripted order,
So that the investigation plays as a guided adventure rather than a free-form workspace.

**Acceptance Criteria:**

**Given** a case definition with a `scenarioScript` (ordered scenes and dialogue beats),
**When** the case loads,
**Then** a SceneRouter maps the authoritative case phase (`context → prediction → experiment → synthesis → review → debrief`) to the corresponding Phaser scene,
**And** a scene transition mirrors the phase; it never defines or advances the phase itself.

**Given** the store transitions the case phase through a typed domain action,
**When** the router observes the new phase,
**Then** it activates the matching scene and cleans up the previous scene's subscriptions and display objects,
**And** an interrupted or reloaded session restores to the scene matching the persisted phase.

**Given** the scene flow,
**When** tests run,
**Then** unit tests cover the phase→scene mapping,
**And** an E2E test walks the full Young scene sequence end to end.

### Story 1.11: Colleague cast and proposal system [new — pivot]

As a player,
I want a cast of colleagues who offer predictions, hints, and conclusions,
So that the reasoning is delivered as an authored, character-driven experience.

**Acceptance Criteria:**

**Given** a case definition with `colleagues[]`, `predictionProposals[]`, and `conclusionProposals[]`,
**When** the content is loaded,
**Then** Zod validates each colleague (id, role, portrait/silhouette asset), each prediction proposal, and each conclusion proposal (claim, limitation, `supportPredicate`),
**And** invalid content returns a typed recoverable `Result` before domain logic.

**Given** the prediction phase,
**When** the ColleaguesScene presents the four predictions,
**Then** each is attributed to a colleague and the player's choice is recorded through a typed action,
**And** the choice is revisable and never blocks progress.

**Given** the evaluator's defensible-conclusion set,
**When** the theory board presents the four conclusions,
**Then** each conclusion is attributed to a colleague and selecting one records the chosen proposal ID,
**And** the proposal system exposes which proposals are defensible only to the evaluator/critique, never as an up-front "correct" marker.

**Given** the proposal system,
**When** tests run,
**Then** unit tests cover proposal validation and support-predicate evaluation,
**And** integration tests verify prediction/conclusion selection through public store actions.

### Story 1.12: Phaser dialogue and choice UI [new — pivot]

As a player,
I want readable dialogue and clear choice controls inside the scenes,
So that I can follow the story and make decisions without leaving the Phaser surface.

**Acceptance Criteria:**

**Given** a scene presenting colleague dialogue,
**When** it renders,
**Then** a reusable Phaser dialogue widget shows speaker, text, and an advance control,
**And** the text is legible at 1280×720 and reflows without truncation.

**Given** a scene presenting a 1-of-N choice (prediction or conclusion),
**When** it renders,
**Then** a reusable Phaser choice widget shows each option's text and records the selection as a typed intent,
**And** the selected option is visibly indicated by more than colour alone (label/state), with the choice remaining revisable.

**Given** the dialogue and choice widgets,
**When** tests run,
**Then** integration tests verify that selecting an option dispatches the expected intent and updates authoritative state.

## Epic 2: Young validation slice

Players can complete a 20–30 minute double-slit investigation: inspect context, make a prediction, run experiments, compare measurements, issue a bounded conclusion, and receive a historical debrief.

### Story 2.1: Young library reading and prediction choice [reworked — pivot]

As a player,
I want to read the Young reference in the library and choose a prediction with my colleagues,
So that my later conclusion choice begins with a testable expectation.

**Acceptance Criteria:**

**Given** the Young case is selected,
**When** its context phase loads the LibraryScene,
**Then** I can read at least two required contextual artifacts before the prediction is offered,
**And** the phase and source inspections are stored through typed actions.

**Given** I have read the required references,
**When** the ColleaguesScene presents four colleague predictions,
**Then** I choose one and the choice is recorded through a typed action,
**And** the choice is revisable and does not block progress.

**Given** I have not met the reading requirement,
**When** I attempt to move to the lab,
**Then** a colleague identifies the missing reading in-scene,
**And** it preserves all valid work and offers no hard fail.

### Story 2.2: Young double-slit experiment

As a player,
I want to set slit spacing and screen distance and observe the resulting fringe spacing,
So that I can test how each variable affects the interference pattern.

**Acceptance Criteria:**

**Given** the Young case definition,
**When** the laboratory loads,
**Then** slit spacing permits 0.10–0.50 mm in 0.05 mm steps and screen distance permits 1.0–4.0 m in 0.25 m steps,
**And** each control is operable in the LaboratoryScene.

**Given** a valid configuration,
**When** I run the apparatus,
**Then** a deterministic 550 nm model produces and records fringe spacing within three seconds,
**And** reset is immediate and does not erase saved observations.

**Given** I choose the optional advanced wavelength comparison after the minimum Young path,
**When** I select one of the authored wavelength values,
**Then** the value, result, and versioned deterministic model inputs are recorded with the run,
**And** wavelength remains optional and cannot alter the fixed 550 nm minimum-path history.

**Given** pointer and keyboard interactions in the scene,
**When** they set the same Young configuration,
**Then** the resulting run record is identical,
**And** unit and integration tests cover the calculation and the scene intent path.

### Story 2.3: Young synthesis, conclusion choice, debrief, and replay [reworked — pivot]

As a player,
I want to compare Young runs, choose a colleague conclusion, and read a sourced debrief,
So that I understand both what interference evidence supports and its limits.

**Acceptance Criteria:**

**Given** I have two *significant* Young measurements (per the case's significance rule) and the required sources,
**When** the theory board evaluates readiness,
**Then** the conclusion choice unlocks and the evaluator returns which of the four colleague conclusions the evidence defends,
**And** choosing a defensible conclusion permits the debrief phase while an indefensible choice routes to the rival-lab critique (Story 2.5).

**Given** the debrief is displayed,
**When** I read it,
**Then** it provides a sourced historical comparison and optional deeper theory,
**And** it does not rewrite historical outcomes around player choices.

**Given** I complete Young,
**When** I replay it,
**Then** previous completion remains recorded while a new investigation can be run,
**And** recognition reflects inquiry actions rather than speed.

**Given** a Young replay or alternate configuration,
**When** it explores a different variable or evidence-collection order,
**Then** it is explicitly labelled counterfactual and distinct from the recorded historical result,
**And** it preserves the completed historical record and campaign unlock state.

### Story 2.4: Young learning and educator validation gate [reworked — pivot]

As a release owner,
I want a moderated Young validation gate before later-case production,
So that later cases build on demonstrated learning, accessibility, and educator value rather than an untested slice.

**Acceptance Criteria:**

**Given** a Young release candidate,
**When** validation is scheduled before any Morley, Hafele–Keating, or Delft production work,
**Then** 15–30 moderated learner sessions are run with no product telemetry,
**And** a facilitator-owned observation rubric records only consented, de-identified session evidence outside player progress.

**Given** the completed moderated sessions,
**When** the gate is evaluated,
**Then** at least 60% of participants can explain *why* they chose their conclusion by referencing a measurement they saw in the lab,
**And** at least 60% voluntarily test at least one variable beyond the minimum path.

**Given** educator review of the Young candidate,
**When** the gate is evaluated,
**Then** at least five educators state they would share or use the case,
**And** the evidence artifacts name the session owner, rubric, de-identified aggregate, educator responses, accessibility findings, and release decision.

**Given** a learner needs validation access,
**When** the candidate is launched for a moderated session,
**Then** a non-campaign validation route grants Young access without changing campaign locks or player progression,
**And** it does not unlock, relock, or expose later cases.

**Given** any target, scholarly source/rights review, low-end-laptop 60-FPS 10-minute lab-loop check, or offline-reload check is unmet,
**When** the Young gate is reviewed,
**Then** later-case production and Young public validation are blocked with no waiver,
**And** the recorded release decision identifies the owner and required remediation. _(Accessibility acceptance is removed from this gate per the pivot.)_

### Story 2.5: Rival-lab critique and revision [new — pivot]

As a player,
I want a rival lab to challenge an unsupported conclusion,
So that the stakes feel real while I still get to revise my choice.

**Acceptance Criteria:**

**Given** I choose a conclusion whose proposal ID is not in the evaluator's defensible set,
**When** the choice is submitted,
**Then** the RivalLabScene presents an authored critique line that names the unsupported claim, missing evidence, or overreach in a pointed-but-fair voice,
**And** it routes me back to a revisable conclusion choice.

**Given** the rival-lab critique,
**When** it is shown,
**Then** it never applies a score, timer, setback, progress loss, or lockout,
**And** the decision history retains the rejected choice and the critique.

**Given** I revise to a defensible conclusion,
**When** the choice is re-evaluated,
**Then** the case proceeds to the debrief phase,
**And** recognition reflects the revision as inquiry, not failure.

**Given** the rival-lab behavior,
**When** tests run,
**Then** unit tests cover critique selection for each indefensible proposal,
**And** an integration test verifies the choose→critique→revise→proceed flow through public store actions.

### Story 2.6: Significant-measure gate and colleague hints [new — pivot]

As a player,
I want the conclusion to unlock only after two meaningful measurements, with a colleague nudging me otherwise,
So that I reach the conclusion having actually generated distinguishing evidence.

**Acceptance Criteria:**

**Given** the Young case's authored significance rule (e.g. two runs that differ meaningfully on the critical path),
**When** the evaluator counts significant measurements,
**Then** it returns the count deterministically from the recorded runs without inspecting scene state,
**And** the conclusion choice unlocks only at ≥2 significant measurements.

**Given** fewer than two significant measurements,
**When** I try to reach the conclusion,
**Then** a colleague hint points at what to measure or vary next in-fiction,
**And** it never supplies the conclusion and never hard-fails.

**Given** the significance rule and hint behavior,
**When** tests run,
**Then** unit tests cover significant vs. non-significant run combinations and hint selection,
**And** an integration test verifies the gate through public store actions.

## Epic 3: Reusable case authoring and provenance

Content authors and reviewers can create fact-bound, auditable cases with authored scientific rules, sources, rights records, assets, feedback, and debrief material without rebuilding the core loop.

### Story 3.1: Incremental reusable case-contract hardening [reworked — pivot]

As a content author,
I want to define a complete case in versioned JSON,
So that later cases can add only the fields they consume without changing core behavior.

**Acceptance Criteria:**

**Given** the already-shipped minimal Young contract,
**When** case-framework hardening is applied,
**Then** it incrementally adds only reusable fields needed by later cases: confound, inspectable assumptions, colleague hints, neutral auto-summary, counterfactual/replay labels, cycle rules, the significance rule, and case-specific bounded conclusion rules (including the four conclusion proposals with their support predicates),
**And** it does not make Young depend on a future all-purpose schema.

**Given** a hardened case definition,
**When** its JSON is loaded through the repository,
**Then** Zod validates the relevant incremental fields and yields an immutable domain definition,
**And** invalid content returns a typed `Result` before domain logic while player progress cannot mutate shipped case content.

### Story 3.2: Reviewable Morley–Miller prototype

As a content author,
I want to author a reviewable Morley–Miller prototype using the hardened framework,
So that scholarly and accessibility reviewers can verify second-case authoring without duplicating the Young loop.

**Acceptance Criteria:**

**Given** the hardened case contract and shared domains,
**When** the Morley–Miller prototype is authored,
**Then** it supplies distinct rotation, temperature/fringe observation, evidence, feedback, sources, and assets as reviewed data,
**And** it reuses the same store, evaluator, notebook, critique, persistence, and Phaser-scene behavior.

**Given** the prototype is reviewed by a content author, scholarly reviewer, and accessibility reviewer,
**When** it is compared with Young,
**Then** no case-specific copy of core behavior is required and the review produces a named prototype artifact,
**And** documented authoring gaps become backlog items rather than ad-hoc duplication.

### Story 3.3: Source and rights ledger

As a reviewer,
I want to audit each case claim and asset through a source and rights ledger,
So that only reviewed material reaches a public case.

**Acceptance Criteria:**

**Given** a case’s sources and assets,
**When** a reviewer opens its ledger,
**Then** it identifies named primary and secondary sources, scholarly reviewer, educator context sheet, accessible-controls reference, provenance, claim or use, rights status, reviewer state, and replacement plan,
**And** incomplete rights status is visibly blocked from release approval.

**Given** a historical claim is marked reviewed,
**When** it appears in case content,
**Then** its source reference remains traceable,
**And** unreviewed claims and assets cannot be represented as verified.

### Story 3.4: Scenario and proposal authoring contract [new — pivot]

As a content author,
I want to author a case's scenario script, colleague cast, and proposal sets as validated data,
So that new cases become guided adventures without touching engine code.

**Acceptance Criteria:**

**Given** the hardened case contract,
**When** an author defines a case,
**Then** they can specify a `scenarioScript` (ordered scenes and dialogue beats), a `colleagues[]` cast, four `predictionProposals[]`, four `conclusionProposals[]` with support predicates, a `significanceRule`, and `rivalLabCritiques[]` — all as versioned JSON,
**And** Zod validates each field and rejects an incomplete scenario before domain logic.

**Given** an authored scenario,
**When** it is loaded,
**Then** the SceneRouter can drive the full flow from the script without case-specific code,
**And** a second case can be authored reusing the same scenes, evaluator, and widgets.

**Given** the authoring contract,
**When** documentation is produced,
**Then** `docs/content-authoring/` describes how to author scenarios, proposals, significance rules, and rival-lab lines,
**And** an example fixture demonstrates a minimal valid scenario.

## Epic 4: Morley–Miller tutorial case

Players can distinguish thermal drift from an orientation-dependent ether signal through authored evidence and issue a bounded conclusion.

### Story 4.1: Morley–Miller historical case record

As a player,
I want to inspect the Morley–Miller dispute and its sourced record,
So that I understand the question before I interpret an instrument reading.

**Acceptance Criteria:**

**Given** the Morley–Miller case,
**When** I enter its context phase,
**Then** I can inspect reviewed 1907-report and 1887-source context with clear provenance labels,
**And** the case distinguishes near-null evidence from a claim of perfectly zero displacement.

**Given** the Morley–Miller case loop,
**When** it is reviewed before production,
**Then** it requires `context → prediction → experiment → synthesis → review → debrief`, opening dispute, Curated Record, lab setup, two-to-four cycles, theory-board conclusion, historical debrief, and optional replay,
**And** its confound, reset-solvable path, model assumptions, counterfactual labels, and history-preserving campaign replay are explicit.

**Given** campaign progression,
**When** the first campaign case is unlocked,
**Then** Morley–Miller precedes Young even though Young was the first production and validation slice,
**And** completing or validating Young never changes that campaign lock order.

### Story 4.2: Thermal-drift investigation tutorial

As a player,
I want to rotate an interferometer, observe temperature trend, and repeat a stable-window measurement,
So that I can distinguish a time-dependent confound from the predicted orientation signal.

**Acceptance Criteria:**

**Given** valid authored Morley–Miller controls,
**When** I rotate, log observations, and test a stable window,
**Then** the deterministic model makes thermal drift and orientation evidence separately inspectable,
**And** reset, notebook, and scene controls work through the shared framework.

**Given** I reach synthesis,
**When** I compare observations,
**Then** feedback directs me to replication or a missing variable when appropriate,
**And** it does not assert a conclusion for me.

### Story 4.3: Morley–Miller bounded conclusion and debrief

As a player,
I want to submit an upper-bounded conclusion and read the historical debrief,
So that I learn what the evidence constrains without treating it as standalone proof of relativity.

**Acceptance Criteria:**

**Given** the required Morley–Miller evidence,
**When** I submit a conclusion,
**Then** review requires an explicit limitation and rejects overclaiming with neutral revision feedback,
**And** the debrief explains the historical interpretation with sources.

## Epic 5: Hafele–Keating relativity case

Players can assess competing clock predictions, uncertainty, and an independent skeptic’s critique before reaching a bounded conclusion.

### Story 5.1: Hafele–Keating predictions and source record

As a player,
I want to inspect routes, altitude, time, and reviewed 1972 sources before seeing results,
So that I can make independent predictions about divergent atomic clocks.

**Acceptance Criteria:**

**Given** the Hafele–Keating context phase,
**When** I inspect its required artifacts,
**Then** I can record a prediction before result reveal,
**And** sources distinguish prediction, observation, and later interpretation.

**Given** the Hafele–Keating case loop,
**When** it is reviewed before production,
**Then** it requires `context → prediction → experiment → synthesis → review → debrief`, opening dispute, Curated Record, lab setup, two-to-four cycles, theory-board conclusion, historical debrief, and optional replay,
**And** its confound, reset-solvable path, model assumptions, counterfactual labels, and history-preserving campaign replay are explicit.

### Story 5.2: Clock-model and error-budget investigation

As a player,
I want to separate velocity and altitude contributions and inspect uncertainty,
So that I can compare eastbound and westbound clock results fairly.

**Acceptance Criteria:**

**Given** the authored clock model,
**When** I calibrate ensembles and inspect route, altitude, time, and error inputs,
**Then** kinematic and gravitational contributions are separately legible,
**And** the result model remains deterministic and versioned.

**Given** the independent critique,
**When** I inspect it,
**Then** its error-budget claim is represented as evidence to weigh rather than an answer,
**And** it is available in-scene.

**Given** I have inspected both predicted and observed clock evidence,
**When** I compare eastbound and westbound outcomes,
**Then** each outcome is displayed alongside its error bar and the separate kinematic and gravitational predictions,
**And** the comparison remains deterministic, versioned, and available without colour-only encoding.

### Story 5.3: Relativity conclusion and debrief

As a player,
I want to explain which prediction the observations are consistent with and what would change my mind,
So that I make a conclusion calibrated to uncertainty.

**Acceptance Criteria:**

**Given** sufficient Hafele–Keating evidence,
**When** I submit a conclusion,
**Then** review requires a stated limitation or uncertainty condition,
**And** the debrief says the observations are consistent with predictions within uncertainty rather than proving relativity.

## Epic 6: Hensen et al. entanglement case

Players can weigh setup safeguards, finite evidence, and the limits of a CHSH-based conclusion.

### Story 6.1: Hensen case record and experimental safeguards

As a player,
I want to inspect the 2015 Hensen record and the safeguards required for its test,
So that I can understand the claims before judging finite data.

**Acceptance Criteria:**

**Given** the Delft case context,
**When** I inspect reviewed sources,
**Then** two diamond-spin labs 1.3 km apart, detector efficiency, fast random basis selection, spacelike timing, and their relevance are represented clearly,
**And** source provenance and historical limits remain visible.

**Given** the Delft case loop,
**When** it is reviewed before production,
**Then** it requires `context → prediction → experiment → synthesis → review → debrief`, opening dispute, Curated Record, lab setup, two-to-four cycles, theory-board conclusion, historical debrief, and optional replay,
**And** its confound, reset-solvable path, model assumptions, counterfactual labels, and history-preserving campaign replay are explicit.

### Story 6.2: CHSH reliability and finite-trial investigation

As a player,
I want to explore reliability and run-count trade-offs in an accessible CHSH interaction,
So that I can see why finite evidence supports only bounded claims.

**Acceptance Criteria:**

**Given** authored controls for setup reliability and valid trials,
**When** I adjust them and run the experiment,
**Then** the deterministic model makes trial count, the two-lab 1.3 km separation, detector efficiency, fast random basis selection, spacelike timing, safeguards, and CHSH evidence legible through semantic and Phaser paths,
**And** invalid configurations explain their limitation without a hard fail.

**Given** an event-ready dataset,
**When** I inspect the outcome,
**Then** the historical reference of 245 trials, S = 2.42 ± 0.20, and p ≤ 0.039 is accurately sourced,
**And** the case distinguishes statistical evidence from proof of quantum mechanics or faster-than-light communication.

### Story 6.3: Entanglement conclusion and critique

As a player,
I want to retain or reject a local-realist null only to the strength supported by evidence,
So that I practice a calibrated statistical conclusion.

**Acceptance Criteria:**

**Given** the required Delft evidence and sources,
**When** I conclude the case,
**Then** the evaluator requires a limited claim and stated assumptions,
**And** peer review identifies overstatement, missing safeguards, or incomplete data neutrally.

## Epic 7: Classroom release readiness

Educators can use a reviewed, accessible, classroom-ready case with clear activity materials and debrief support.

### Story 7.1: Educator case materials

As an educator,
I want a concise case context sheet and debrief guide,
So that I can plan and facilitate a self-contained classroom activity.

**Acceptance Criteria:**

**Given** a release-candidate case,
**When** I open its educator materials,
**Then** I can find its learning objective, expected duration, prerequisites, context, activity flow, and debrief,
**And** materials state the distinction between history, interpretation, and fiction.

### Story 7.2: Cross-browser release verification [reworked — pivot; accessibility de-scoped]

As a QA/release lead,
I want repeatable evidence that the case runs across the target browsers,
So that a release candidate is not broken on a supported browser.

**Acceptance Criteria:**

**Given** a release-candidate case,
**When** verification runs,
**Then** Playwright covers the full Phaser scene flow (library → colleagues → lab → theory board → rival lab → debrief) across Chromium, Firefox, and WebKit,
**And** a basic no-flashing/photosensitivity check passes on the scenes.

_Accessibility acceptance (axe, keyboard-only completion, screen-reader announcements, focus recovery, touch/pointer parity, non-colour encoding) is **de-scoped from the MVP** per the pivot (ADR-008) and tracked for post-MVP reintroduction._

### Story 7.3: Static release and source-rights sign-off

As a release owner,
I want a static, offline-resilient release candidate with reviewed content,
So that educators can deploy it by URL without accounts or tracking.

**Acceptance Criteria:**

**Given** a release candidate,
**When** the production build is created,
**Then** it is static, cache-versioned, and has no account, analytics, cloud-save, or network-critical dependency,
**And** cached offline reload restores valid local progress.

**Given** a case is proposed for public release,
**When** release sign-off is evaluated,
**Then** educator, scholarly, source/rights, accessibility, performance, and offline-reload gates are recorded,
**And** an unmet gate prevents public-release approval.

### Delivery-evidence ownership checklist

| Evidence artifact | Accountable owner | Required evidence |
| --- | --- | --- |
| Moderated learner validation | Learning-validation lead | Consent-aware facilitator rubric, de-identified aggregate, and the Young gate decision. |
| Educator validation | Educator-review lead | Five educator responses and a recorded share/use decision. |
| Scholarly and source/rights review | Scholarly and rights reviewer | Reviewed source/rights ledger, claim/asset status, and remediation for any incomplete item. |
| Accessibility acceptance | ~~Accessibility reviewer~~ | **De-scoped from MVP (pivot)** — reintroduce post-MVP; basic no-flashing safety retained. |
| Cross-browser, performance, and offline verification | QA/release lead | Chromium, Firefox, and WebKit results; low-end-laptop 60-FPS 10-minute-loop result; and offline-reload result. |
| Public-release decision | Release owner | Gate checklist, owner evidence links, decision, and remediation for every unmet gate. |
