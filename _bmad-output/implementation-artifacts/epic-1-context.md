# Epic 1 Context: Accessible investigation foundation

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the accessible, offline-first investigation workspace that the Young validation slice and later cases depend on. Players must be able to work through an authored evidence loop—inspect trustworthy contextual sources, make and record observations, compare evidence, form a bounded conclusion, respond to critique, and retain or share their work—without a canvas-only path, a network dependency, or punitive failure states.

## Stories

- Story 1.1: Project bootstrap and verification harness
- Story 1.2: Minimal Young case contract and authored loop
- Story 1.3: Accessible dual-surface laboratory controls
- Story 1.4: Measurement notebook and run comparison
- Story 1.5: Curated Record and source labels
- Story 1.6: Evidence-to-conclusion theory board
- Story 1.7: Consultations, peer review, and revision history
- Story 1.8: Offline progress, export, import, and print
- Story 1.9: Inclusive feedback and inquiry recognition

## Requirements & Constraints

- The first playable case follows the finite flow `context → prediction → experiment → synthesis → review → debrief`. It includes an opening dispute, Curated Record, bounded lab setup, two to four experiment cycles, theory-board review, historical debrief, and optional replay. Progression must be controlled by evidence readiness, not scene history or UI visibility.
- Case content is authored and bounded: controls, valid values, confounds, outcomes, model assumptions, sources, consultation prompts, review rules, debrief material, and assets are defined as content. Do not introduce a freeform physics sandbox.
- Require two contextual artifacts and a prediction before substantive experimentation. Each case has an inspectable, reset-solvable confound or misleading result that can be resolved through replication, a control change, or source comparison.
- Curated Record entries identify title, creator or context, source type, provenance, rights status, and relationship to the case. Clearly distinguish primary material, reconstruction, later interpretation, and deliberate fiction in text and with a non-colour cue. An unavailable or insufficiently rights-reviewed source must show a neutral, safe fallback rather than appear as verified evidence.
- A recorded observation preserves the actual controls, calculated result, timestamp/order, model version, and linked evidence. Players can inspect semantic notebook entries, compare any two saved runs side by side, and save comparison notes. Saved historical results must never be silently recalculated against a newer model.
- The theory board lets players connect their observations, inspected sources, prediction, conclusion, and at least one limitation or alternative explanation. The conclusion evaluator reports missing evidence explicitly and allows revision; it neither discards work nor creates a hard fail.
- Consultations may point only to an observable, source, alternative test, or limitation. Peer review identifies missing evidence, unsupported claims, or overreach in neutral language and supports unlimited revision while preserving prior conclusions, feedback, and timestamps as decision history.
- Persist versioned player progress locally, including runs, inspected sources, theory work, review history, and recognition. Offline reload restores previously loaded work without network access. Export only the portable player case record as versioned JSON; validate and migrate imports explicitly, preserving the last valid local progress when an import fails. Print through a semantic CSS view containing settings, observations, sources, notes, conclusion, and limitations.
- Essential meaning, controls, and scientific values must remain available through semantic text, labels, units, keyboard access, focus management, and announcements. Colour, sound, animation, canvas pixels, hover, and drag cannot be the sole carrier or input path. Optional audio needs captions/text equivalents and independent controls.
- Reward careful investigation, replication, source inspection, optional-variable testing, and well-calibrated claims without ranking, speed pressure, scoring, currency, gated progression, or rewards for overclaiming. Errors and weak conclusions need recoverable guidance, never raw error text or a red failure treatment.

## Technical Decisions

- Phaser 4.2.1 provides the visual laboratory; semantic HTML is authoritative for essential controls, values, instructions, source inspection, notebook work, theory board, conclusion entry, focus, and announcements. Both HTML and Phaser normalize interactions into the same typed store intent; neither directly mutates the other layer or application state.
- Use a project-owned immutable TypeScript store with typed actions, selectors, subscriptions, and post-transition `noun.verb` domain events. Phaser scenes only mirror the authoritative case phase. Renderer factories own Phaser object lifecycle and clean subscriptions and display objects on shutdown.
- Keep `src/domain/` pure TypeScript. Deterministic experiment calculations, run records, evidence readiness, source/provenance rules, consultation selection, peer review, and recognition must be independently testable without Phaser, DOM, IndexedDB, or browser APIs. Browser effects belong in adapters through constructor-injected dependencies.
- Load versioned case JSON only through repositories, validate it with Zod at the boundary, and return typed `Result` failures for expected problems. Shipped case definitions and assets are immutable; player decisions and generated observations are separate local progress. Case content must be reusable for future cases without duplicating the evidence loop.
- Use IndexedDB through `idb` for versioned progress and explicit migrations. Browser persistence, export/import, and content loading remain adapters. Preserve valid in-memory and stored work after save, source-load, or import failures, explain recovery semantically, and do not log learner-entered conclusion text by default.
- Release as a static hosted application with a minimal boot shell and complete case-scoped bundles before lab play. No account, telemetry, advertising, cloud save, remote configuration, or critical-play network request. Target current desktop Chrome, Firefox, Safari, and Edge; tablets retain equivalent outcomes and phones are reading-only initially.
- Test public actions, selectors, semantic roles, and labels rather than renderer internals. Cover pure domain transitions and schemas with Vitest; verify DOM/Phaser intent parity, accessibility, export/import recovery, and offline reload with browser tests across Chromium, Firefox, and WebKit. Manual keyboard, screen-reader, focus-recovery, and non-colour checks remain required.

## UX & Interaction Patterns

- Organize the workspace around the Curated Record, prediction, laboratory, Measurement Notebook, Theory Board, consultation, peer review, historical debrief, and local case record. Use progressive prompts that state the next actionable step without solving the case.
- Preserve a calm, precise, invitational voice. Explain evidence and scope rather than player performance; use short actionable microcopy. Do not label a conclusion right or wrong or use generic, celebratory, or score-oriented feedback.
- Present source cards with an explicit provenance label, named category, and icon or pattern. Pair each visual experiment result with readable values, units, labels, and model-assumption explanation. Present feedback and persistence status as semantic notifications, reserving error styling for system or input problems, not scientific reasoning.
- Support keyboard, mouse, pointer, and touch with equivalent outcomes. Use visible focus, logical reading order, labelled controls, announced state changes, at least 44 by 44 CSS pixel touch targets where touch is available, responsive labelled drawers or sequential regions on tablets, reduced-motion-safe feedback, and WCAG 2.2 AA text contrast.
- Make reset immediate and recoverable without deleting saved observations or decision history. Empty records, incomplete evidence, invalid imports, persistence failures, and unavailable sources should explain the state and route to a safe next action without implying player failure.

## Cross-Story Dependencies

- The bootstrap and test harness support all foundation stories and establish the static/offline verification path.
- The validated Young case contract and phase machine underpin controls, source inspection, run recording, readiness evaluation, consultation/review, and persistence.
- Dual-surface controls create the authoritative experiment state consumed by immutable run records and the notebook; inspected source IDs feed the notebook, theory board, consultations, and review.
- The evidence-to-conclusion evaluator consumes saved runs, inspected sources, conclusion text, and a limitation; review and later debrief depend on its authoritative result.
- Persistence, export/import, and printing depend on stable progress schemas for runs, sources, theory work, review history, and recognition; they must not store or alter immutable case content.
