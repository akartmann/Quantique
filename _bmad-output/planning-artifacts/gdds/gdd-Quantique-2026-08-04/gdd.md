---
title: "Fracture of Certainty: Cases from the Quantum Age"
game_type: "puzzle"
platforms:
  - "Desktop web browsers"
created: "2026-08-04"
updated: "2026-08-04"
status: "ready"
---

# Fracture of Certainty: Cases from the Quantum Age — Game Design Document

**Author:** Alexis  
**Game Type:** Puzzle — historical-science investigation  
**Target Platform(s):** Desktop web browsers  
**Engine constraint:** Phaser

## Executive Summary

### Core Concept

*Fracture of Certainty* is a browser-based anthology of four historical laboratory mysteries. The player leads a fictional scientific team through apparatus assembly, measurement, anomalous results, critique, and revision. Historical outcomes remain fact-bound; player agency lies in determining what the available evidence supports, including a defensible limited conclusion.

Each case follows the **Apparatus → Anomaly → Revision** loop. The first playable delivery is a 20–30 minute case inspired by Thomas Young's double-slit interference work; it validates the reusable case framework before the remaining cases are built. In the eventual campaign, the thermal-drift tutorial precedes Young; production and campaign order are intentionally different.

### Target Audience

- Primary: science-curious learners aged 16–25 with no assumed physics background.
- Secondary: educators, self-directed adult learners, and physics students seeking a historical companion.
- Sessions: 20–45 minutes per case; the four-case campaign targets 6–10 hours including optional investigation and replay.

### Unique Selling Points

- Evidence is player-generated: conclusions cite the player's own measurements and inspected sources.
- Failure, replication, and critique create knowledge rather than a hard fail state.
- Historical sources, interpretation, and deliberate fiction are labelled separately.
- A tactile visual laboratory teaches the observation before optional formal theory.

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

1. **Evidence earns the conclusion.** The player records measurements and sources, then states only what they can defend.
2. **Productive uncertainty.** A failed run, replication, or teammate challenge is new evidence, not punishment.
3. **History with receipts.** Every historical claim and asset exposes provenance; reconstruction, interpretation, and fiction remain distinct.
4. **Legible collaborative experimentation.** Controllable variables visibly affect results, and teammates help the player inspect—not bypass—the reasoning.

### Core Gameplay Loop

1. Receive a disputed observation or historical claim.
2. Inspect two or more contextual artifacts and state a prediction.
3. Assemble and calibrate a bounded apparatus.
4. Run an experiment, record measurements, and compare predicted and observed patterns.
5. Consult teammates, test an alternative, or replicate a result.
6. Revise the theory board and issue a conclusion with evidence and stated limits.
7. Receive a neutral historical comparison, layered explanation, and recognition for rigorous inquiry.

### Win/Loss Conditions

- A case completes when the player submits a conclusion supported by required observations and sources.
- There is no hard failure, game-over, score penalty, or irreversible wrong choice. A weak conclusion receives peer-review feedback and can be revised indefinitely.
- Recognition rewards replication, source checking, testing an optional variable, and appropriately bounded claims. It is non-competitive and never gates completion.

## Game Mechanics

### Primary Mechanics

| Mechanic | Player action | Rules and measurable targets |
|---|---|---|
| Apparatus calibration | Adjust a case's authored controls. | Young case: slit spacing 0.10–0.50 mm in 0.05 mm steps; screen distance 1.0–4.0 m in 0.25 m steps. Values and units are always visible. |
| Experimental run | Run the configured apparatus and inspect its visual output. | A Young run resolves in ≤3 seconds; reset is immediate. The initial model uses fixed 550 nm light. Wavelength comparison is optional advanced content. |
| Measurement notebook | Save settings, two or more observations, and comparison notes. | Records actual settings, timestamp/order, observed fringe spacing, and linked evidence. Player can compare any two saved runs and export/print a case record. |
| Theory board | Connect observation, source, prediction, and conclusion. | A completion claim requires ≥2 recorded observations and ≥2 contextual sources. It must identify one limitation or alternative explanation. |
| Team consultation | Ask a builder, experimentalist, analyst, or communicator for a prompt. | Consultations are unlimited and adapt to missing evidence or the current decision history. Each points to an observable, source, or test; none provides the final conclusion verbatim. |
| Peer review | Submit and revise a conclusion. | Feedback identifies unsupported claims, missing evidence, or overreach. Revision preserves the decision history. |

### Controls and Input

- Desktop mouse and keyboard are first-class inputs. Touch/pointer equivalence is required for tablet readiness.
- Every drag interaction has a tap/select plus stepper or labelled number-input alternative.
- Controls expose semantic labels, current value, units, keyboard adjustment, and announced state changes. Colour is never the sole carrier of experimental information.
- The apparatus field must not be canvas-only: equivalent controls, readouts, instructions, and conclusions remain accessible in semantic UI.

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

- Progressive prompts: an in-play observation prompt, a plain-language explanation, and an optional technical/source-detail layer.
- Unlimited consultations, reset, run comparison, decision-history review, and neutral auto-summaries.
- No mandatory skip in the first case; every puzzle has a structured hint path that preserves the player's final conclusion. Accessibility accommodations may reveal the next actionable step without auto-solving.

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

Theatrical historical laboratories use authentic-looking instruments, clear readable diagrams, and an imperfect luminous interference pattern. The team is present through focused silhouettes, work surfaces, artifacts, and expressive but restrained character moments. Scientific legibility takes priority over visual spectacle.

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
- Responsive tablet-ready layout with pointer, touch, and keyboard parity. Phones support reading notes only until laboratory usability is proven.
- Local progress only; provide explicit export/import or printable observation record.

### Asset Requirements

- One reusable case framework; the GDD specifies player-facing behavior, not a data/schema implementation.
- Each case requires a sourced artifact ledger with named primary and secondary sources, scholarly reviewer, educator context sheet, accessible lab controls, and a rights/replacement plan.
- Phaser feasibility is a Young-slice gate: semantic HTML controls and a non-canvas-only accessibility model must meet the stated input-equivalence requirements before the engine constraint is considered validated.
- Avoid 3D navigation, WebGPU/ray-tracing requirements, multiplayer, cloud saves, UGC, LLM dialogue, and external critical-play dependencies.

## Development Epics

### Epic Structure

The build sequence and detailed high-level stories are in [epics.md](epics.md). The campaign is delivered in this order: foundation and accessibility → Young validation slice → case framework hardening → thermal-drift case → relativity case → entanglement case → educator/release readiness. No later case begins full production until its historical, accessibility, and learning gates are met.

## Success Metrics

### Technical Metrics

- Keyboard-only, pointer-first, and touch-first paths can all reach a defensible case conclusion.
- Manual accessibility acceptance verifies semantic controls, non-colour-only patterns, labelled values, no flashing hazards, and usable state announcements.
- Low-end laptop and offline-reload tests pass before classroom-facing release.

### Gameplay Metrics

- In 15–30 moderated, no-telemetry learner sessions, ≥60% of players cite a recorded observation or setting when explaining their conclusion in their own words.
- In the same moderated sessions, ≥60% of players voluntarily test at least one variable beyond the minimum path.
- At least five educator reviewers would share or use the first case.
- A scholarly reviewer validates every source-backed claim and asset before a case ships; a reviewed source/rights ledger and educator handout are required before public validation of Young.
- The second case can be authored without duplicating core case behavior.

## Out of Scope

- Freeform physics sandbox, broad historical archive, full optics course, or unrestricted 3D exploration.
- Multiplayer, chat, accounts, cloud saves, UGC, adaptive assessment, LLM dialogue, telemetry, advertisements, in-game purchases, and premium learning gates.
- Native mobile laboratory controls, localization, relativity/entanglement implementation in the first validation release, and high-fidelity full animation.

## Assumptions and Dependencies

- [ASSUMPTION: A permissive code license and a separate historical-material policy will be selected before public release.]
- [ASSUMPTION: A physics/historical reviewer and an archivist or rights-review process will be available for each case.]
- [ASSUMPTION: Phaser can meet the stated browser, accessibility, and local-save requirements; this is validated during the Young slice.]
- [NOTE FOR DESIGNER: Define the fictional teams, complete source corpus, and fictionalization boundaries for all four cases during narrative design and historical review.]
- [NOTE FOR DESIGNER: Distribution—hosted web, downloadable build, or both—remains to be decided before release planning.]
