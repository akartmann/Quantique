---
title: 'Fracture of Certainty: Cases from the Quantum Age'
status: draft
created: '2026-08-04'
updated: '2026-08-04'
---

# Game Brief: Fracture of Certainty: Cases from the Quantum Age

## Executive Summary

*Fracture of Certainty: Cases from the Quantum Age* is a desktop-first, open-source browser game in which players lead historical laboratories through evidence-driven scientific mysteries. Its longer-term vision is a focused 6–10-hour anthology in which players assemble apparatus, choose measurements, run experiments, interpret anomalies, and revise their setups or explanations. The first playable investigation uses light through apertures to make quantum interference felt before it is formally explained; later cases widen the frame to relativity and entanglement.

The game makes scientific breakthrough playable without treating history as a puzzle with a single clever answer. Real outcomes and the documented record remain fixed; fictional lab teams, conversations, and counterfactual replays give players agency within those historical constraints. Productive failure, failed replications, competing claims, and peer critique are evidence—not punishment.

## Vision

**Core fantasy:** Be the meticulous lead experimentalist who turns a crack in certainty into defensible knowledge.

**Elevator pitch:** A cinematic laboratory-management detective game where players reconstruct landmark physics experiments, learn from anomalies, and decide what the evidence can honestly support.

Players should leave curious, capable, and appropriately humble: intuition has limits, models are not observations, and collaboration plus negative results are part of discovery.

## Target Players & Positioning

**Primary:** science-curious students and early university learners (roughly 16–25) who enjoy narrative investigation, hands-on simulation, or historical science, but may not arrive with physics knowledge. Sessions suit 20–45 minute case segments.

**Secondary:** educators, self-directed adult learners, and physics students seeking an accessible historical companion rather than a problem-set replacement.

**Release model:** open source. The project should be easy to inspect, localize, contribute to, and use in classrooms. [ASSUMPTION: a permissive code license and a clearly separated license/attribution policy for historical-source material will be chosen before public release.]

**Platform priority:** desktop web first; tablet second; mobile only after the interaction model has proved itself. A mouse-first apparatus workspace is a deliberate early constraint, not a missing feature.

## Core Fundamentals

**Genre:** historical laboratory-management simulation + detective investigation + layered science learning.

**Core loop — Apparatus → Anomaly → Revision:**

1. Assemble or calibrate a period-authentic apparatus.
2. Choose what to measure and make a prediction.
3. Run the experiment; read tactile and visual patterns before equations.
4. Compare rival explanations, record the result, and consult teammates.
5. Refine the setup, constrain the conclusion, or test a new hypothesis.

**Pillars:**

- **Evidence has consequences.** Environmental drift, unreliable instruments, and failed replications create usable leads; none is a simple fail screen.
- **Accessible first, rigorous on demand.** Uncertainty appears through visual patterns and physical feedback. Optional interactive models and a separate thinking space expose the formal theory without diluting it.
- **History is a source, not scenery.** Authentic instruments, curated artifacts, and sourced historical notes distinguish documented fact, contemporary interpretation, later consensus, and fiction.
- **Critique is play.** A fully voiced lab cast offers competing scientific perspectives. The player may seek unlimited consultations, while peer review and rival results test whether a claim is warranted.

**Player experience:** anticipation while a run develops; curiosity at an unexpected pattern; triumph when a claim survives challenge. Every chapter ends with a short reflective debrief that connects player evidence to the underlying science.

## Scope & MVP

**Team:** one developer; no fixed timeline. Scope therefore favours a reusable case framework and a small, polished vertical slice before a four-case campaign.

**MVP hypothesis:** Players with no prior physics will enjoy and understand the evidence loop when a tactile experiment produces a surprising, interpretable pattern.

**MVP:** one 20–30 minute desktop-web light-interference investigation with:

- a single apparatus-assembly and calibration interaction;
- aperture-spacing measurement choices and a visible interference result;
- one environmental/measurement confound and a meaningful failed first run;
- three voiced teammate perspectives, consultation prompts, and a theory board;
- one brief, sourced artifact and a concise scientific debrief;
- an objective decision record and one replayable alternate experimental path.

**Out of MVP:** later relativity/entanglement cases, extensive historical archive, full animation set, mobile controls, localization, and broad institutional-politics systems.

**Technical [ASSUMPTION]:** use a web-native engine/framework with accessible input, save-state, content-data separation, and offline-friendly deployment. Treat high-fidelity character animation and full voice acting as scalable content layers, not prototype prerequisites.

## Content & Direction

The longer-term campaign contains four fact-bound cases, each in a wholly new laboratory with a new fictional lead scientist and cast. Collaboration, critique, and careful recordkeeping connect them.

- A classical negative-result tutorial: diagnose thermal drift and turn a failed experiment into a record.
- Light interference: vary aperture spacing, observe pattern change, and separate observation from explanation.
- Divergent clocks: confront relativity with clocks that disagree after different journeys.
- A much later entanglement case: balance engineering reliability against statistical certainty.

Direction is theatrical and cinematic but materially grounded: animated characters, authentic environments, luminous interference patterns with hand-observed imperfections, quiet clicks/paper/glass/machinery, and music reserved for breakthroughs. A curated archive provides identified sources for notebook pages, instrument diagrams, letters, and contemporary excerpts.

### Creative References & Differentiation

Take the deduction-from-evidence cadence of *The Case of the Golden Idol*, approachable physical experimentation from *The Last Clockwinder*, and contemplative scientific observation from *Outer Wilds*. Do **not** adopt their freeform world exploration, fantastical lore, or solution-by-one-revelation structure. This is a bounded laboratory inquiry whose answers must be evidenced.

The differentiators are playable landmark experiments; failure and replication as progression; historical outcomes that cannot be rewritten; and optional, inspectable science layers for learners without prior physics.

## Risks & Open Questions

- **Solo scope:** four fully voiced, historically rigorous cases can become a multi-year content project. Mitigate by validating the first case and authoring pipeline before committing to the anthology.
- **Scientific accuracy:** each experiment needs named primary/secondary sources and expert review; fiction must be visibly labeled.
- **Learning validity:** test the MVP with learners for whether they can distinguish an observation from a model after play.
- **Open-source sustainability:** decide governance, licensing, contributor standards, and the policy for archival rights early.
- **Open questions:** exact historical experiments and dates; engine/framework; accessibility requirements; source-review partners; target distribution (hosted web, downloadable build, or both).
