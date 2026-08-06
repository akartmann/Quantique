---
title: "Fracture of Certainty: Cases from the Quantum Age"
game_type: "narrative-adventure / puzzle"
platforms:
  - "Desktop web browsers"
created: "2026-08-04"
updated: "2026-08-06"
status: "revised-pivot"
change_log:
  - "2026-08-05 — pivot to Phaser guided adventure (sprint-change-proposal-2026-08-05.md)"
  - "2026-08-06 — playable Phaser surface: physical instruments, player-started light, in-scene transitions, art-free cast (sprint-change-proposal-2026-08-06.md)"
---

# Fracture of Certainty: Cases from the Quantum Age — Game Design Document

**Author:** Alexis  
**Game Type:** Puzzle — historical-science investigation  
**Target Platform(s):** Desktop web browsers  
**Engine constraint:** Phaser

## Executive Summary

### Core Concept

*Fracture of Certainty* is a browser-based **guided narrative adventure** through four historical laboratory mysteries. The player is led, scene by scene, through a fully scenarized investigation with a cast of fictional colleagues: reading the reference in the library, debating predictions with the team, running authored experiments in the lab, and defending a conclusion against a rival lab. Historical outcomes remain fact-bound; player agency lies in **judging which of the colleagues' proposed conclusions the generated evidence best supports**. There is no freeform exploration — every beat is authored.

Each case runs a scripted **Library → Colleagues → Lab → Theory Board → Debrief** flow layered over a preserved gated progression engine. The interface is delivered primarily through Phaser scenes rather than semantic HTML. The first playable delivery is a 20–30 minute case inspired by Thomas Young's double-slit interference work; it validates the reusable case framework before the remaining cases are built. In the eventual campaign, the thermal-drift tutorial precedes Young; production and campaign order are intentionally different.

### Target Audience

- Primary: science-curious learners aged 16–25 with no assumed physics background.
- Secondary: educators, self-directed adult learners, and physics students seeking a historical companion.
- Sessions: 20–45 minutes per case; the four-case campaign targets 6–10 hours including optional investigation and replay.

### Unique Selling Points

- Players run authored experiments, then judge which of four colleague-proposed conclusions their own measurements support.
- A fully scenarized, cinematic Phaser laboratory with a cast of colleagues and a rival lab that keeps the pressure on without ever punishing the player.
- Failure, replication, and critique create knowledge rather than a hard fail state.
- Historical sources, interpretation, and deliberate fiction are labelled separately.

## Goals and Context

### Project Goals

- Make the distinction between observation, model, and conclusion playable.
- Deliver a historically credible, open-source, classroom-friendly, no-login browser game.
- Establish a reusable case structure without turning the game into a freeform physics sandbox.
- Ship cases sequentially, starting with Young's interference case, and test learning, accessibility, and educator fit before expanding.

### Background and Rationale

The game bridges approachable physical experimentation, evidence-led investigation, and contemplative scientific observation. It excludes freeform exploration, fantastical lore, and single-revelation puzzle solutions. Fictional teams provide dramatic agency without rewriting historical outcomes.

## Core Gameplay

### Game Pillars

1. **Evidence earns the choice of conclusion.** The player records measurements and sources, then chooses only the colleague conclusion they can defend.
2. **Productive uncertainty.** A failed run, replication, or a rival-lab challenge is new evidence, not punishment; the rival lab never triggers a hard fail.
3. **History with receipts.** Every historical claim and asset exposes provenance; reconstruction, interpretation, and fiction remain distinct.
4. **Legible collaborative experimentation.** Controllable variables visibly affect results, and colleagues help the player interpret—not bypass—the reasoning.
5. **Guided, cinematic scenario.** Every case is a fully authored, scene-by-scene story with no freeform exploration; the Phaser scenes and the colleague cast carry the experience.

### Core Gameplay Loop

The case plays as a scripted sequence of Phaser scenes over the preserved gated engine:

1. **Library.** Go to the library and read the reference to establish the disputed observation or historical claim (gate: inspect the required contextual sources).
2. **Colleagues — prediction.** Talk with the team about what will happen and **choose one of four colleague predictions** (gate: prediction recorded).
3. **Lab — setup & measurement.** Go to the lab, set up the authored apparatus, and take **two measurements** (gate: two runs recorded).
4. **Synthesis.** The conclusion unlocks once **two significant measurements** exist; otherwise a colleague offers an in-fiction hint pointing at what to measure next.
5. **Theory Board — conclusion.** A colleague **proposes each conclusion; the player chooses one of four**, each bundling a claim and its stated limitation.
6. **Rival lab / revision.** If the chosen conclusion is not supported by the evidence, a competitive rival lab critiques it (dramatic, never a hard fail) and the player revises the choice.
7. **Debrief.** Receive a neutral historical comparison, layered explanation, and recognition for rigorous inquiry.

### Win/Loss Conditions

- A case completes when the player selects a colleague conclusion supported by the required observations and sources.
- There is no hard failure, game-over, score penalty, or irreversible wrong choice. Choosing an unsupported conclusion triggers a rival-lab critique that routes back to revision indefinitely; the rival lab is a dramatic device, never a penalty or lockout.
- Recognition rewards replication, source checking, testing an optional variable, and appropriately bounded claims. It is non-competitive and never gates completion.

## Game Mechanics

### Primary Mechanics

| Mechanic | Player action | Rules and measurable targets |
|---|---|---|
| Prediction choice | Choose one of four colleague predictions in the Colleagues scene. | Each proposal is a distinct, authored expectation voiced by a colleague. The choice is recorded and revisable; it never blocks progress. |
| Apparatus calibration | Adjust a case's authored controls in the lab scene. | Young case: slit spacing 0.10–0.50 mm in 0.05 mm steps; screen distance 1.0–4.0 m in 0.25 m steps. Values and units are always visible in the scene. |
| Experimental run | Run the configured apparatus and inspect its visual output. | A Young run resolves in ≤3 seconds; reset is immediate. The initial model uses fixed 550 nm light. Wavelength comparison is optional advanced content. |
| Measurement notebook | Save settings, two or more observations, and comparison notes. | Records actual settings, timestamp/order, observed fringe spacing, and linked evidence. Player can compare any two saved runs and export/print a case record. |
| Significant-measure gate | Take two meaningfully distinct measurements to unlock the conclusion. | The conclusion unlocks only after ≥2 *significant* measurements (per the case's authored significance rule). If unmet, a colleague offers an in-fiction hint pointing at what to measure next. |
| Theory board choice | Choose one of four colleague-proposed conclusions. | Each proposal bundles a claim and its stated limitation. The evaluator determines which proposals the recorded evidence supports; an unsupported choice routes to the rival-lab critique. |
| Colleague consultation | A colleague offers an unlimited in-fiction prompt when help is needed. | Prompts adapt to missing evidence or the current decision history; each points to an observable, source, or test and never supplies the final conclusion verbatim. |
| Rival-lab critique | A competitive lab challenges an unsupported conclusion, then the player revises. | Critique identifies unsupported claims, missing evidence, or overreach in a pointed-but-fair voice. It is never a score, game-over, or lockout, and revision preserves the decision history. |

### Controls and Input

- Desktop mouse and keyboard are the primary inputs, handled by the Phaser scenes. Touch/pointer support is a secondary goal for tablet readiness.
- Interactive controls live in the Phaser scene as physical instruments — knobs, dials, and sliders the player grasps and moves directly — and each exposes its current value and units on-screen so the setting is always legible. Instrument travel is bounded by the authored range and snaps to the authored step, so direct manipulation never produces a value the case did not author.
- The experiment does not run unattended. The apparatus sits unlit and idle until the player starts the light; starting the light is the act of running the experiment, and the measurement resolves from the deterministic model rather than from anything the animation computes.
- Every step of the scenario is advanced from within the scene the player is standing in. No transition between steps lives outside the Phaser surface.
- The apparatus field, controls, readouts, and the conclusion choice are presented in-scene through Phaser.
- A semantic CSS print/export record is retained as the only non-Phaser surface, purely for portability of the player's case record.

> **Accessibility note (pivot, 2026-08-05):** keyboard-only completion, screen-reader support, and non-colour-only encoding are **de-scoped from the MVP**. The store/domain boundary is preserved, so an accessible surface can be reintroduced post-MVP without re-architecture. See Out of Scope.

## Puzzle Game Specific Design

### Core Puzzle Mechanics

The player solves authored causal puzzles, not optimization puzzles. In the Young case, slit spacing and screen distance interact to change predicted fringe spacing; the player uses the result to test a claim about the nature of light. The critical path requires two measured configurations and one intentional comparison. An optional wavelength comparison deepens, but does not complicate, the first solution.

Each case contains one authored confound or initially misleading result. The player must identify it through replication, control change, or source comparison. Every required puzzle has a reachable solution from a reset state, and all physical-model assumptions are inspectable.

### Puzzle Progression

| Case | Learning/puzzle focus | Delivery gate |
|---|---|---|
| 1. Morley–Miller ether-drift tutorial (1907) | Separate time-dependent thermal drift from a predicted orientation-dependent ether signal; learn notebook, reset, and peer review. | Rotate the interferometer, log fringe change and temperature trend, repeat a stable-window observation, and submit an upper-bounded conclusion. |
| 2. Young's interference | Relate slit spacing and screen distance to fringe spacing; defend an interference-based claim. | First fully playable validation slice; release/test before building case 3. |
| 3. Hafele–Keating divergent-clocks case (1971) | Reconcile eastbound and westbound atomic-clock readings with separate kinematic and gravitational predictions across an independent skeptical collaboration. | Calibrate clock ensembles; inspect route, altitude, and time logs; predict before reading results; then compare outcomes and their error bars. |
| 4. Hensen et al. loophole-free Bell test (Delft, 2015) | Balance setup reliability and measurement safeguards against the statistical certainty gained from more valid trials. | Link two diamond-spin labs 1.3 km apart; audit detector efficiency, fast random basis selection, spacelike timing, and a finite CHSH dataset before reporting a bounded conclusion. |

Difficulty rises from guided observation, to one-variable causal reasoning, to competing models and evidence trade-offs. Each case introduces its central mechanism alone before combining it with source interpretation and peer review.

The Morley–Miller tutorial's Curated Record includes the 1907 final report and the 1887 Michelson–Morley paper. It explains that a small or near-null displacement constrains a particular expected effect; it does not present the result as a perfectly zero reading, a standalone disproof of ether, or proof of special relativity.

The Hafele–Keating Curated Record includes the 1972 prediction and observation papers. The case explains that the flights test combined special-relativistic kinematic and general-relativistic gravitational time effects. Its conclusion is limited to consistency with the predictions within uncertainty; it does not claim a single experiment proves relativity.

The Delft Curated Record includes the 2015 Hensen et al. result and its methodological notes. The player collects a limited, event-ready dataset and compares its CHSH score against the local-realist ceiling of 2. The historical result of 245 trials, \(S = 2.42 \pm 0.20\), and \(p \le 0.039\) is presented as statistically significant evidence against the local-realist null under stated assumptions—not proof of quantum mechanics, entanglement, or faster-than-light communication.

### Level Structure

- Four self-contained theatrical historical laboratories, each with a new fictional lead, team, and visual identity.
- Each case contains: opening dispute, Curated Record inspection, lab setup, two to four experiment cycles, theory-board review, historical debrief, and optional counterfactual replay. The Curated Record distinguishes primary artifacts, contemporary disagreement, later consensus, interpretation, and fiction.
- Cases unlock in campaign order. Completed cases remain replayable; replay never changes the historical record.

### Player Assistance

- Colleagues deliver help in-fiction: when the two-significant-measure gate is unmet, a colleague points at what to measure next in plain language, with an optional technical/source-detail layer.
- Unlimited colleague consultations, reset, run comparison, decision-history review, and neutral auto-summaries.
- No mandatory skip in the first case; every puzzle has a structured colleague-hint path that preserves the player's final conclusion choice without auto-solving.

### Replayability

- Alternate apparatus configurations, counterfactual paths, optional variable testing, and different evidence-collection orders.
- Recognition badges for replication, variable curiosity, source discipline, and calibrated conclusions—not speed, score, or perfect play.
- A replay may explore "what would this evidence support?" but explicitly distinguishes counterfactual result from recorded history.

## Progression and Balance

### Player Progression

Progression is knowledge and confidence, not character power. The tutorial introduces notebook, source labels, and revision; later cases increase the number of competing explanations and the need to articulate limitations. No resource grinding, inventory, or stat system exists.

### Difficulty Curve

- Case 1: guided measurement and one visible confound.
- Case 2: two coupled variables and an optional advanced comparison.
- Case 3: conflicting interpretations and a skeptical collaborator.
- Case 4: reliability-versus-certainty trade-offs across repeated results.

### Economy and Resources

There is no currency, energy system, premium gate, advertising, paid mechanic, or randomized reward. Time is represented narratively only; experiment runs and revisions remain freely available.

## Level Design Framework

### Level Types

- **Artifact space:** exactly two required contextual clues before the first substantive test.
- **Laboratory space:** one authored apparatus with one to two primary controls.
- **Reasoning space:** notebook, theory board, consultations, and conclusion drafting.
- **Debrief space:** historical comparison, provenance, and optional deeper theory.

### Level Progression

Each case must be completable in 20–45 minutes on a first playthrough. The Young validation slice targets 20–30 minutes: 3–5 minutes of context, 10–15 minutes of experimentation, 5–8 minutes of synthesis, and optional replay after debrief.

## Art and Audio Direction

### Art Style

Theatrical historical laboratories use authentic-looking instruments, clear readable diagrams, and an imperfect luminous interference pattern. Because the experience is now a guided narrative, the colleague cast and the rival lab are first-class on-screen characters — present through portraits or silhouettes, dialogue, work surfaces, and expressive but restrained moments — carrying the scene-to-scene story. Scientific legibility still takes priority over visual spectacle.

Every asset carries a source/rights status. Visual conventions distinguish primary artifact, reconstruction, interpretation, and fiction. Ambiguous permissions require a link or replacement—not unverified use.

### Audio and Music

Quiet tactile audio marks adjustment, measurement, and archival discovery. Music supports concentration and breakthrough without signalling a single "correct" answer. All essential information is available without sound; captions and independent volume controls are required.

## Technical Specifications

### Performance Requirements

- Phaser is the required MVP engine; architecture choices beyond that are out of scope for this GDD.
- Sustain 60 FPS on a representative low-end school laptop at 1280×720 during a 10-minute lab loop.
- First meaningful interaction reachable within 5 seconds after a cached launch; a locally saved case restores after offline reload.
- No account, analytics/tracking dependency, or network dependency may block core play.

### Platform-Specific Details

- Desktop browser first; current Chrome, Firefox, Safari, and Edge receive manual acceptance testing.
- Mouse/keyboard is the primary input against the Phaser scenes; touch/pointer support is a secondary tablet-readiness goal. Phones are out of scope for the laboratory experience.
- **Bilingual at launch:** the game ships in English and French; all player-facing text (UI, scene text, case content, print view) is localized, and the Young slice is complete in both languages. Broader localization is deferred.
- Local progress only; provide explicit export/import or printable observation record.

### Asset Requirements

- One reusable case framework; the GDD specifies player-facing behavior, not a data/schema implementation. Each case now also authors a **colleague cast**, a **scenario script** (scene order, per-scene cast presence, and dialogue beats), **four prediction proposals**, **four conclusion proposals** (each with a support rule), a **significance rule**, and **rival-lab critique lines**.
- The cast ships **without commissioned art**. A colleague is staged as a vector silhouette drawn from an authored accent colour, so the cast carries no image asset, no loader budget, and no rights-ledger entry. Painted portrait art is a possible later enhancement, not a requirement for a case to ship.
- Each case requires a sourced artifact ledger with named primary and secondary sources, scholarly reviewer, educator context sheet, and a rights/replacement plan.
- Phaser feasibility is a Young-slice gate: the scenarized scene flow (library → colleagues → lab → theory board → debrief) must run at target performance and deliver the guided experience before the engine constraint is considered validated.
- Avoid 3D navigation, WebGPU/ray-tracing requirements, multiplayer, cloud saves, UGC, LLM dialogue, and external critical-play dependencies.

## Development Epics

### Epic Structure

The build sequence and detailed high-level stories are in [epics.md](epics.md). The campaign is delivered in this order: Phaser guided-adventure foundation → Young validation slice → case framework hardening → thermal-drift case → relativity case → entanglement case → educator/release readiness. No later case begins full production until its historical and learning gates are met (accessibility gates are de-scoped from MVP; see Out of Scope).

## Success Metrics

### Technical Metrics

- The mouse/keyboard path through the scenarized Phaser flow reaches a defensible case conclusion.
- Low-end laptop and offline-reload tests pass before release.
- No flashing hazards in the Phaser scenes (basic photosensitivity safety is retained even though full accessibility acceptance is de-scoped from MVP).

### Gameplay Metrics

- In 15–30 moderated, no-telemetry learner sessions, ≥60% of players can explain *why* they chose their conclusion by referencing a measurement they saw in the lab.
- In the same moderated sessions, ≥60% of players voluntarily test at least one variable beyond the minimum path.
- At least five educator reviewers would share or use the first case.
- A scholarly reviewer validates every source-backed claim and asset before a case ships; a reviewed source/rights ledger and educator handout are required before public validation of Young.
- The second case can be authored without duplicating core case behavior.

## Out of Scope

- Freeform physics sandbox, broad historical archive, full optics course, or unrestricted 3D exploration.
- Multiplayer, chat, accounts, cloud saves, UGC, adaptive assessment, LLM dialogue, telemetry, advertisements, in-game purchases, and premium learning gates.
- Native mobile laboratory controls, localization **beyond English and French**, relativity/entanglement implementation in the first validation release, and high-fidelity full animation — meaning cinematic cutscenes, full character animation rigs, and frame-by-frame art. It does **not** exclude direct-manipulation instrument controls, a player-started light source, or restrained character staging and reaction, all of which are required (see Controls and Input, and Art Style).
- **Deferred post-MVP (pivot 2026-08-05):** accessibility as a release gate — keyboard-only completion, screen-reader support, non-colour-only scientific encoding, and a semantic-HTML-authoritative interface. The store/domain boundary is preserved so this can be reintroduced later without re-architecture.

## Assumptions and Dependencies

- [ASSUMPTION: A permissive code license and a separate historical-material policy will be selected before public release.]
- [ASSUMPTION: A physics/historical reviewer and an archivist or rights-review process will be available for each case.]
- [ASSUMPTION: Phaser can deliver the scenarized scene flow at target browser performance with local save; this is validated during the Young slice. Accessibility is no longer part of this gate (see Out of Scope).]
- [NOTE FOR DESIGNER: For every case, author the colleague cast, the four prediction proposals, the four conclusion proposals with their support rules, the significance rule, and the rival-lab critique lines, alongside the source corpus and fictionalization boundaries, during narrative design and historical review.]
- [NOTE FOR DESIGNER: Distribution—hosted web, downloadable build, or both—remains to be decided before release planning.]
