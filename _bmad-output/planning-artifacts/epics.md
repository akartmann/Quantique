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

## Requirements Inventory

### Functional Requirements

FR1: Players can inspect contextual artifacts and make a prediction before using an apparatus.
FR2: Players can use bounded, authored apparatus controls with visible values and units.
FR3: Pointer, touch, keyboard, and semantic HTML control paths produce equivalent apparatus outcomes.
FR4: Players can run an authored deterministic experiment, inspect its output, and reset it.
FR5: Players can save observations with settings, timestamp/order, measured result, and linked evidence.
FR6: Players can compare saved runs, add comparison notes, and export or print a case record.
FR7: Players can distinguish primary artifacts, reconstruction, interpretation, and fiction.
FR8: Players can connect observations, sources, predictions, and a bounded conclusion on a theory board.
FR9: Completion requires recorded observations, contextual sources, and a stated limitation or alternative explanation.
FR10: Players can consult evidence-responsive teammates without receiving the final answer.
FR11: Players can submit, receive feedback on, and revise a conclusion while preserving decision history.
FR12: Players receive non-competitive recognition for rigorous inquiry rather than speed or correctness.
FR13: The Young case supports authored slit-spacing and screen-distance controls, records fringe spacing, and enables two-run comparison.
FR14: Cases provide a sourced historical debrief and optional deeper theory after review.
FR15: Case definitions can author controls, evidence prerequisites, feedback, debrief content, sources, provenance, and assets without duplicating core behavior.
FR16: Case content supports a source/rights ledger, scholarly review, educator context, and a replacement plan for uncertain rights.
FR17: Player progress is stored locally and restores after an offline reload.
FR18: Players can export and import versioned local case records safely.
FR19: Each case can provide captions, independent audio controls, and non-audio equivalents for essential information.
FR20: Cases unlock in campaign order and remain replayable without changing the historical record.
FR21: The Morley–Miller case teaches thermal drift versus orientation-dependent signal with a bounded conclusion.
FR22: The Hafele–Keating case separates kinematic and gravitational contributions and communicates uncertainty.
FR23: The Delft case makes reliability, safeguards, finite statistics, and a bounded CHSH conclusion legible.
FR24: Educators can use a concise context sheet, learning objective, duration, prerequisites, and debrief for a case.

### NonFunctional Requirements

NFR1: Sustain 60 FPS at 1280×720 on a representative low-end school laptop during a 10-minute lab loop.
NFR2: Reach first meaningful interaction within five seconds after a cached launch.
NFR3: Support current desktop Chrome, Firefox, Safari, and Edge; tablet interactions retain input parity.
NFR4: Phones are reading-only until laboratory usability is proven.
NFR5: No account, telemetry, advertising, cloud save, remote configuration, or network dependency may block core play.
NFR6: Essential interactions must never be canvas-only; semantic controls expose labels, values, units, keyboard adjustment, and announcements.
NFR7: Colour and sound are never the sole carriers of scientific information.
NFR8: The game has no hard fail, irreversible wrong choice, speed reward, or reward for overclaiming.
NFR9: Scientific results are deterministic, inspectable, reproducible, and preserve their model version.
NFR10: Shipped case definitions and assets are immutable; player progress is separate local data.
NFR11: Historical claims and assets require provenance and rights review before release.
NFR12: Local progress survives failed imports and save failures without silent loss.
NFR13: Automated coverage includes unit, browser E2E, cross-browser, offline-reload, and accessibility checks; manual accessibility acceptance remains required.
NFR14: A case first-play session takes 20–45 minutes; the Young slice targets 20–30 minutes.
NFR15: The product is a static hosted web application with cache-versioned production assets.
NFR16: No freeform physics sandbox, multiplayer, UGC, LLM dialogue, or external critical-play integration is introduced.
NFR17: The framework must allow a second case to be authored without duplicating core behavior.
NFR18: Learner-entered conclusions are not exposed through raw errors or default logging.

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

No standalone UX design specification was found. The following UX requirements are sourced from the GDD and architecture and must be preserved in story design:

UX-DR1: Provide semantic, labelled controls with values, units, keyboard adjustment, focus behavior, and announcements for every essential lab action.
UX-DR2: Ensure pointer, touch, keyboard, and DOM paths invoke identical authoritative actions and results.
UX-DR3: Provide accessible notebook, theory board, source inspection, conclusion, and feedback interfaces; Phaser is a visual companion, not their sole surface.
UX-DR4: Provide non-colour scientific encodings, captioned/non-audio feedback, and explicit loading or recovery explanations.
UX-DR5: Use structured progressive prompts and consultations that preserve player agency and never auto-solve the case.
UX-DR6: Provide a semantic print view and responsive desktop-first layout with tablet-equivalent outcomes.

### FR Coverage Map

FR1: Epic 2 — Contextual artifact inspection and prediction in the Young slice.
FR2: Epic 1 — Bounded, authored apparatus controls with visible values and units.
FR3: Epic 1 — Equivalent pointer, touch, keyboard, and semantic control outcomes.
FR4: Epic 2 — Deterministic Young experiment execution, inspection, and reset.
FR5: Epic 1 — Saved observation records with scientific context and evidence links.
FR6: Epic 1 — Run comparison, notes, export, and print-ready learner record.
FR7: Epic 1 — Source-type labelling and provenance visibility.
FR8: Epic 1 — Theory board linking evidence, prediction, and conclusion.
FR9: Epic 1 — Evidence-to-conclusion readiness and bounded-claim requirements.
FR10: Epic 1 — Evidence-responsive consultations that preserve learner agency.
FR11: Epic 1 — Peer review, revisable conclusions, and preserved decision history.
FR12: Epic 1 — Non-competitive recognition for rigorous inquiry.
FR13: Epic 2 — Young slit-spacing, screen-distance, fringe-spacing, and comparison experience.
FR14: Epic 2 — Historical debrief and optional deeper theory.
FR15: Epic 3 — Data-driven reusable case authoring framework.
FR16: Epic 3 — Auditable source, rights, review, and replacement records.
FR17: Epic 1 — Offline local progress persistence and restoration.
FR18: Epic 1 — Safe, versioned export and import.
FR19: Epic 1 — Captions, independent audio controls, and non-audio essential information.
FR20: Epic 2 — Campaign unlock ordering and historical-record-preserving replay.
FR21: Epic 4 — Morley–Miller thermal-drift tutorial case.
FR22: Epic 5 — Hafele–Keating relativity case.
FR23: Epic 6 — Hensen et al. entanglement case.
FR24: Epic 7 — Educator context, learning objective, duration, prerequisites, and debrief materials.

## Epic List

### Epic 1: Accessible investigation foundation

Players can operate an accessible investigation workspace, record and compare evidence, inspect sources, revise evidence-bounded conclusions, and retain their progress locally.

**FRs covered:** FR2, FR3, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR17, FR18, FR19.

### Epic 2: Young validation slice

Players can complete a 20–30 minute double-slit investigation: inspect context, make a prediction, run experiments, compare measurements, issue a bounded conclusion, and receive a historical debrief.

**FRs covered:** FR1, FR4, FR13, FR14, FR20.

### Epic 3: Reusable case authoring and provenance

Content authors and reviewers can create fact-bound, auditable cases with authored scientific rules, sources, rights records, assets, feedback, and debrief material without rebuilding the core loop.

**FRs covered:** FR15, FR16.

### Epic 4: Morley–Miller tutorial case

Players can distinguish thermal drift from an orientation-dependent ether signal through authored evidence and issue a bounded conclusion.

**FRs covered:** FR21.

### Epic 5: Hafele–Keating relativity case

Players can assess competing clock predictions, uncertainty, and an independent skeptic’s critique before reaching a bounded conclusion.

**FRs covered:** FR22.

### Epic 6: Hensen et al. entanglement case

Players can weigh setup safeguards, finite evidence, and the limits of a CHSH-based conclusion.

**FRs covered:** FR23.

### Epic 7: Classroom release readiness

Educators can use a reviewed, accessible, classroom-ready case with clear activity materials and debrief support.

**FRs covered:** FR24.

## Epic 1: Accessible investigation foundation

Players can operate an accessible investigation workspace, record and compare evidence, inspect sources, revise evidence-bounded conclusions, and retain their progress locally.

### Story 1.1: Accessible dual-surface laboratory controls

As a player,
I want to adjust an authored laboratory control through semantic HTML, keyboard, pointer, or touch,
So that I can perform experiments regardless of my input method.

**Acceptance Criteria:**

**Given** a newly generated Phaser Vite + TypeScript application,
**When** the application starts,
**Then** it renders a semantic application shell and a Phaser laboratory surface,
**And** the generated lockfile is committed with the project setup.

**Given** an authored numeric apparatus control with a label, unit, allowed range, and step,
**When** the laboratory loads,
**Then** semantic HTML exposes its name, current value, unit, instructions, and a keyboard-operable value input or stepper,
**And** no essential action depends solely on the Phaser canvas.

**Given** a player changes the control through its semantic HTML input, Phaser pointer/touch gesture, or keyboard interaction,
**When** the change is accepted,
**Then** every path dispatches the same typed `apparatus.controlSet` intent to the authoritative store,
**And** the resulting stored value and visible readouts are identical regardless of input origin.

**Given** a requested value is below the minimum, above the maximum, or off the configured step,
**When** the player submits it,
**Then** the domain layer applies the documented validation or normalization rule deterministically,
**And** the semantic UI announces the resulting value without relying on colour or sound.

**Given** the Phaser laboratory surface is rendered from state,
**When** the authoritative control value changes,
**Then** the renderer mirrors the new value without owning or directly mutating application state,
**And** scene shutdown removes its subscriptions and display objects.

**Given** the control implementation,
**When** automated tests run,
**Then** unit tests cover validation and the pure state transition,
**And** an integration test proves DOM and Phaser intent paths result in the same authoritative state.

### Story 1.2: Measurement notebook and run comparison

As a player,
I want to save observations from my experiment and compare two recorded runs,
So that I can use my own evidence to reason about a scientific claim.

**Acceptance Criteria:**

**Given** an authored experiment definition and validated apparatus controls,
**When** I record a run,
**Then** the pure domain calculation produces an immutable run record containing an ID, case ID, controls, calculated result, timestamp, and experiment-model version,
**And** the record does not depend on Phaser, DOM, or browser APIs.

**Given** a recorded run,
**When** I open the semantic notebook,
**Then** I can read its settings, values and units, timestamp/order, observed result, and linked evidence,
**And** all information is available without interpreting colour or canvas pixels.

**Given** at least two saved runs,
**When** I select any two runs for comparison,
**Then** the notebook displays their settings and results side-by-side,
**And** I can save an associated comparison note.

**Given** I reset or alter the current apparatus after recording a run,
**When** I revisit that record,
**Then** it retains the original controls, result, timestamp, and model version,
**And** it is never recalculated from a newer model implicitly.

**Given** a save request fails or the record is invalid,
**When** the error is handled,
**Then** valid in-memory evidence remains available,
**And** the player receives a neutral semantic recovery message rather than raw error text.

**Given** the notebook and comparison capability,
**When** tests run,
**Then** unit tests cover deterministic run creation and comparison selection,
**And** integration tests assert the notebook through public semantic controls and selectors.

### Story 1.3: Curated Record and source labels

As a player,
I want to inspect contextual sources with clear provenance labels,
So that I can distinguish evidence from reconstruction, interpretation, and fiction before using it in a conclusion.

**Acceptance Criteria:**

**Given** authored case content,
**When** it is loaded,
**Then** each source record is validated with Zod before reaching domain logic,
**And** invalid content is returned as a typed, recoverable failure.

**Given** a source in the Curated Record,
**When** I inspect it through the semantic interface,
**Then** I can identify its title, creator or originating context, source type, provenance, rights status, and relevant case relationship,
**And** the same information is not available only as a Phaser visual.

**Given** source content that is primary material, reconstruction, later interpretation, or deliberate fiction,
**When** it is presented,
**Then** its category is explicit in text and through a non-colour-only visual treatment,
**And** category labels remain understandable without sound.

**Given** I inspect a source,
**When** the inspection is recorded,
**Then** the authoritative evidence state stores the source ID through a typed action,
**And** the source can later be referenced by notebook, theory-board, consultation, and review features.

**Given** a source has incomplete rights information or cannot be loaded,
**When** I attempt to inspect it,
**Then** the interface gives a neutral semantic explanation and a safe fallback state,
**And** it never presents unreviewed historical material as verified evidence.

**Given** the Curated Record,
**When** tests run,
**Then** unit tests cover source validation and provenance rules,
**And** integration tests verify semantic labels and the inspected-source state through public controls.

### Story 1.4: Evidence-to-conclusion theory board

As a player,
I want to connect my observations, sources, prediction, and a stated limitation into a conclusion,
So that I can make only the scientific claim that my evidence supports.

**Acceptance Criteria:**

**Given** recorded runs and inspected sources,
**When** I open the semantic theory board,
**Then** I can select and review the observations and sources that support my prediction and conclusion,
**And** I can enter a conclusion and at least one limitation or alternative explanation.

**Given** a case definition with minimum evidence requirements,
**When** conclusion readiness is evaluated,
**Then** a pure domain evaluator checks required runs, required sources, and a non-empty limitation,
**And** it returns explicit missing requirements without inspecting scene state or UI visibility.

**Given** my conclusion is incomplete,
**When** I attempt to enter review,
**Then** the semantic interface explains which evidence is missing and provides a next-action path,
**And** it does not permanently block, punish, or discard my work.

**Given** my conclusion meets the defined readiness requirements,
**When** I submit it for review,
**Then** the store transitions through the defined case phase using a typed domain action,
**And** Phaser only mirrors the resulting phase.

**Given** I change supporting evidence, the conclusion text, or its limitation,
**When** readiness is evaluated again,
**Then** the result reflects the authoritative current evidence state,
**And** the evaluator remains deterministic and independently unit-testable.

**Given** the theory board implementation,
**When** tests run,
**Then** unit tests cover every missing-evidence combination and valid readiness,
**And** integration tests use semantic roles, labels, public actions, and selectors rather than Phaser internals.

### Story 1.5: Consultations, peer review, and revision history

As a player,
I want evidence-responsive guidance and revisable peer feedback,
So that I can improve my reasoning without being given the answer or losing my decision history.

**Acceptance Criteria:**

**Given** a case definition with consultation and peer-review rules,
**When** it is loaded,
**Then** the rules are validated case data with explicit predicates and feedback content,
**And** they do not encode a scene-specific completion path.

**Given** my current evidence state,
**When** I request a consultation,
**Then** the selected prompt points to a missing observation, source, alternative test, or limit,
**And** it never supplies the final conclusion verbatim.

**Given** I submit a conclusion for peer review,
**When** the review rules evaluate it,
**Then** feedback identifies unsupported claims, missing evidence, or overreach in neutral language,
**And** it offers a revision path rather than a hard-fail state.

**Given** I revise a reviewed conclusion,
**When** I save the revision,
**Then** the authoritative progress retains the prior conclusion, review feedback, revision timestamp, and current version as decision history,
**And** a revision never overwrites or silently discards earlier reasoning.

**Given** a consultation or review rule cannot be evaluated,
**When** the system handles that failure,
**Then** the player receives a recoverable semantic message and keeps their valid work,
**And** raw errors and learner-entered conclusion text are not logged by default.

**Given** consultation and review behavior,
**When** tests run,
**Then** unit tests cover predicate selection, unsupported-claim feedback, and revision-history preservation,
**And** integration tests verify the semantic consultation and revision flow through public actions.

### Story 1.6: Offline progress, export, import, and print

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

### Story 1.7: Inclusive feedback and inquiry recognition

As a player,
I want accessible feedback and recognition for careful investigation,
So that I am encouraged to test, replicate, and make appropriately limited claims rather than rush to a “correct” answer.

**Acceptance Criteria:**

**Given** a player action, completed run, source inspection, or review result,
**When** feedback is presented,
**Then** essential meaning is available through semantic text and accessible state announcements,
**And** colour, animation, and sound are never the sole carrier of that meaning.

**Given** I replicate a run, inspect sources, test an optional variable, or make a well-calibrated claim,
**When** recognition is evaluated,
**Then** I receive non-competitive recognition based on those inquiry actions,
**And** it neither gates completion nor rewards speed, perfect answers, or overclaiming.

**Given** optional adjustment, measurement, or archival audio is available,
**When** I use the application,
**Then** captions or text equivalents are available and I can independently control that audio,
**And** no essential scientific information is lost when sound is unavailable.

**Given** focus moves after an action, error, or feedback update,
**When** the semantic UI changes,
**Then** focus recovery and announcements preserve keyboard-only navigation,
**And** release acceptance includes manual screen-reader and non-colour-encoding checks.

## Epic 2: Young validation slice

Players can complete a 20–30 minute double-slit investigation: inspect context, make a prediction, run experiments, compare measurements, issue a bounded conclusion, and receive a historical debrief.

### Story 2.1: Young contextual record and prediction

As a player,
I want to inspect the Young case context and record a prediction before experimentation,
So that my later conclusion begins with a testable expectation.

**Acceptance Criteria:**

**Given** the Young case is selected,
**When** its context phase loads,
**Then** I can inspect at least two required contextual artifacts before recording a prediction,
**And** the phase, source inspections, and prediction are stored through typed actions.

**Given** I have not met the context requirement,
**When** I attempt to enter experimentation,
**Then** the semantic UI identifies the missing context action,
**And** it preserves all valid work and offers no hard fail.

### Story 2.2: Young double-slit experiment

As a player,
I want to set slit spacing and screen distance and observe the resulting fringe spacing,
So that I can test how each variable affects the interference pattern.

**Acceptance Criteria:**

**Given** the Young case definition,
**When** the laboratory loads,
**Then** slit spacing permits 0.10–0.50 mm in 0.05 mm steps and screen distance permits 1.0–4.0 m in 0.25 m steps,
**And** each control is available through the dual-surface interaction path.

**Given** a valid configuration,
**When** I run the apparatus,
**Then** a deterministic 550 nm model produces and records fringe spacing within three seconds,
**And** reset is immediate and does not erase saved observations.

**Given** DOM and Phaser interactions,
**When** they set the same Young configuration,
**Then** the resulting run record is identical,
**And** unit and integration tests cover the calculation and input parity.

### Story 2.3: Young synthesis, debrief, and replay

As a player,
I want to compare Young runs, submit a limited conclusion, and read a sourced debrief,
So that I understand both what interference evidence supports and its limits.

**Acceptance Criteria:**

**Given** I have two recorded Young configurations, required sources, and a stated limitation,
**When** I submit my conclusion,
**Then** the evidence evaluator permits review and the debrief phase,
**And** feedback distinguishes supported inference from overclaiming.

**Given** the debrief is displayed,
**When** I read it,
**Then** it provides a sourced historical comparison and optional deeper theory,
**And** it does not rewrite historical outcomes around player choices.

**Given** I complete Young,
**When** I replay it,
**Then** previous completion remains recorded while a new investigation can be run,
**And** recognition reflects inquiry actions rather than speed.

## Epic 3: Reusable case authoring and provenance

Content authors and reviewers can create fact-bound, auditable cases with authored scientific rules, sources, rights records, assets, feedback, and debrief material without rebuilding the core loop.

### Story 3.1: Validated reusable case definition

As a content author,
I want to define a complete case in versioned JSON,
So that controls, evidence rules, sources, review, and debrief can be authored without changing core behavior.

**Acceptance Criteria:**

**Given** a case definition,
**When** its JSON is loaded,
**Then** Zod validates its schema version, controls, experiment rule, sources, requirements, consultations, review rules, debrief, and asset manifest,
**And** invalid content returns a typed `Result` before reaching domain logic.

**Given** valid case content,
**When** a repository loads it,
**Then** it yields an immutable domain definition,
**And** player progress cannot mutate shipped case content.

### Story 3.2: Second-case authoring spike

As a content author,
I want to author a representative second-case spike using the shared framework,
So that we prove a new case can be built without duplicating the Young loop.

**Acceptance Criteria:**

**Given** the case schema and shared domains,
**When** a second-case spike is authored,
**Then** it supplies distinct controls, evidence rules, sources, feedback, and assets as data,
**And** it reuses the same store, evaluator, notebook, review, and persistence behavior.

**Given** the spike is reviewed,
**When** its implementation is compared with Young,
**Then** no case-specific copy of core behavior is required,
**And** documented authoring gaps become backlog items rather than ad-hoc duplication.

### Story 3.3: Source and rights ledger

As a reviewer,
I want to audit each case claim and asset through a source and rights ledger,
So that only reviewed material reaches a public case.

**Acceptance Criteria:**

**Given** a case’s sources and assets,
**When** a reviewer opens its ledger,
**Then** each item identifies provenance, claim or use, rights status, reviewer state, and replacement plan,
**And** incomplete rights status is visibly blocked from release approval.

**Given** a historical claim is marked reviewed,
**When** it appears in case content,
**Then** its source reference remains traceable,
**And** unreviewed claims and assets cannot be represented as verified.

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

### Story 4.2: Thermal-drift investigation tutorial

As a player,
I want to rotate an interferometer, observe temperature trend, and repeat a stable-window measurement,
So that I can distinguish a time-dependent confound from the predicted orientation signal.

**Acceptance Criteria:**

**Given** valid authored Morley–Miller controls,
**When** I rotate, log observations, and test a stable window,
**Then** the deterministic model makes thermal drift and orientation evidence separately inspectable,
**And** reset, notebook, and dual-surface controls work through the shared framework.

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
**And** it is available through semantic UI.

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
**Then** detector completeness, random-setting choice, timing, and their relevance are represented clearly,
**And** source provenance and historical limits remain visible.

### Story 6.2: CHSH reliability and finite-trial investigation

As a player,
I want to explore reliability and run-count trade-offs in an accessible CHSH interaction,
So that I can see why finite evidence supports only bounded claims.

**Acceptance Criteria:**

**Given** authored controls for setup reliability and valid trials,
**When** I adjust them and run the experiment,
**Then** the deterministic model makes trial count, safeguards, and CHSH evidence legible through semantic and Phaser paths,
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

### Story 7.2: Accessibility and cross-browser release verification

As an accessibility reviewer,
I want repeatable evidence that the case works through equivalent input and non-visual paths,
So that classroom users are not excluded by the laboratory presentation.

**Acceptance Criteria:**

**Given** a release-candidate case,
**When** verification runs,
**Then** Playwright and axe cover semantic flows across Chromium, Firefox, and WebKit,
**And** manual acceptance verifies keyboard-only completion, screen-reader announcements, focus recovery, touch/pointer parity, and non-colour scientific encoding.

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
