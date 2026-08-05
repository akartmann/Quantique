---
title: "Sprint Change Proposal — Pivot to Phaser Guided Adventure"
project: Quantique
game: "Fracture of Certainty: Cases from the Quantum Age"
author: Alexis
date: 2026-08-05
change_scope: Major
review_mode: Batch
status: approved
approved_by: Alexis
approved_date: 2026-08-05
---

# Sprint Change Proposal — Pivot to a Phaser Guided Adventure

## Section 1 — Issue Summary

**Trigger (category: strategic pivot).** After building and testing the Young validation slice — most recently moving the reference-reading surface into Phaser (the "Opticks archive book" / animated lecture book) — Alexis wants to change the product's direction from an *open, accessibility-first investigation tool* to a *linear, fully-scenarized guided adventure* whose interface lives primarily in Phaser.

**What Alexis wants (verbatim intent):**

- Transform the game into a **guided adventure**, keeping the existing **gated progression logic**.
- Move **most of the UI out of semantic HTML and into Phaser**.
- Scenarize a fixed flow: **Library** (read the reference) → **Colleagues** (discuss predictions; choose **1 of 4** colleague proposals) → **Lab** (set up, take **2 measurements**) → **conclusion unlocks** once **2 significant measures** exist (otherwise a colleague gives **hints**) → **Theory Board** (a colleague **proposes the conclusion; the player chooses**) → on an unsupported choice, a **competitive rival lab delivers negative feedback**.
- **No freeform** — everything is scenarized.

**Decisions taken during change navigation (2026-08-05):**

| # | Decision point | Chosen direction |
|---|---|---|
| A | UI in Phaser vs. accessibility mandate | **Full Phaser; drop accessibility as an MVP goal** (revisitable post-MVP) |
| B | Prediction/conclusion authoring | **Fully choice-based** — pick 1 of 4 colleague proposals for both prediction and conclusion |
| C | Rival-lab "negative feedback" | **Narrative dressing, no hard fail** — critiques an unsupported claim, then routes back to revision |

**Evidence base.** GDD, epics, game architecture, and UX experience spine (all dated 2026-08-04) were reviewed against the current `main`/feature-branch source tree. Implementation of Epics 1–2 is well advanced on the current dual-surface architecture; recent commits (`Improve Animation`, `Improve reference`, `animate Phaser lecture book`, `add local Opticks archive book`) confirm a working Phaser reference-reading surface already exists.

---

## Section 2 — Impact Analysis

### 2.1 Headline finding — the gated engine survives the pivot

The requested adventure flow maps almost 1:1 onto the **existing finite phase machine** `context → prediction → experiment → synthesis → review → debrief` and its **pure evidence evaluator**. "Keep the gated logic" is fully achievable: the gates are reused, only the *surface* and *player agency* change.

| Guided-adventure step | Existing phase | Gate (retained) |
|---|---|---|
| Library — read the reference | `context` | ≥ 2 sources inspected |
| Colleagues — discuss & choose 1 of 4 predictions | `prediction` | prediction recorded |
| Lab — set up & take 2 measures | `experiment` | ≥ 2 runs recorded |
| Conclusion unlocks / else colleague hints | `synthesis` | evidence evaluator + consultations |
| Theory Board — pick 1 of 4 colleague conclusions | `review` | conclusion selected (+ bundled limitation) |
| Rival-lab critique on an unsupported pick | `review` feedback | peer-review rules (reframed narratively) |
| Debrief | `debrief` | — |

**Conclusion:** this is a *reskin + reflow + reduce-agency* change on a preserved core — not a teardown.

### 2.2 Epic impact

| Epic | Impact | Action |
|---|---|---|
| **Epic 1 — Accessible investigation foundation** | Title/goal invalidated (accessibility dropped); DOM-panel stories superseded by Phaser scenes | **Redefine** → "Phaser guided-adventure foundation" |
| **Epic 2 — Young validation slice** | Flow becomes scenarized; prediction/conclusion become choice-based | **Modify** stories 2.1/2.3; add scene-flow |
| **Epic 3 — Reusable case authoring** | Case JSON must now carry colleague proposals, scenario script, "significance" rules, rival-lab lines | **Extend** contract/schema |
| **Epic 4/5/6 — Morley, Hafele–Keating, Hensen** | Inherit the new authoring surface; content-only impact | **Defer** — re-baseline after Young re-validates |
| **Epic 7 — Classroom release readiness** | Accessibility & cross-browser a11y gates de-scoped from MVP | **Reduce** — retain static/offline + educator materials; drop a11y gates |

### 2.3 Story impact (Epic 1–2, the active work)

- **Story 1.3 (dual-surface accessible controls):** rewritten to Phaser apparatus controls; DOM-parity acceptance criteria removed.
- **Stories 1.4–1.7 & 1.9 (notebook, curated record, theory board, consultations/review, recognition):** presentation moves from `src/ui/*` DOM panels into Phaser scenes; **domain logic unchanged**.
- **Story 1.6 (theory board):** conclusion becomes a **selection from colleague proposals**; evaluator extended to judge which proposals the evidence supports.
- **Story 2.1 (context + prediction):** prediction becomes **1-of-4 colleague proposals**.
- **Story 2.3 (synthesis/debrief):** "2 significant measures" gate defined; rival-lab critique added to review.
- **Story 2.4 (validation gate):** success metrics revised (see §2.4 risk) — "cites own observation" no longer applies to an authored conclusion.
- **New stories required:** scene router/adventure flow; colleague-proposal system; rival-lab feedback; scenario/dialogue scripting; Phaser-native choice & dialogue UI.

### 2.4 Artifact conflicts (what must change and why)

- **GDD:** Core Concept, USP list, Pillars (accessibility/"legible collaborative experimentation"), Controls & Input, Player Assistance, Success Metrics, Out-of-Scope, and Technical Specs (canvas-only prohibition) all reference the accessibility-first, player-authored model. **Requires a revision, not a patch.**
- **Architecture:** `ADR-001` (store-mediated *dual*-surface) → **single Phaser surface** reading the same store. The store/domain boundary is *kept* (good engineering); the `src/ui/*` DOM layer is retired as the authoritative surface. Evaluator gains a "which conclusions are defensible" responsibility.
- **UX (`EXPERIENCE.md`):** "Accessibility Floor" and "HUD & Diegetic UI" sections **invert** — diegetic Phaser UI becomes authoritative. New component contracts needed: colleague-proposal choice, rival-lab critique, scene navigation.
- **Requirements:** `NFR6, NFR7, NFR13` and `UX-DR1–DR6` de-scoped from MVP; `FR12, FR13, FR14, FR22` reworked for choice-based flow.

### 2.5 Technical / code impact

| Verdict | Code |
|---|---|
| ✅ **Keep** | `src/core/store/*`, `src/domain/*` (cases, apparatus, evidence, theory, review, recognition), `src/schemas/*`, `src/adapters/persistence/*`, `content/`, `export/`, phase machine, evidence evaluator, `calculateYoungFringeSpacing`, typed-intent dispatch |
| 🔧 **Extend** | Evaluator (judge defensible conclusions + "significant measure"); `CaseDefinition` schema (colleague proposals, scenario script, significance rules, rival-lab lines) |
| ♻️ **Reuse into scenes** | `LectureBookRenderer` / Opticks book → **LibraryScene**; `LaboratoryScene` → guided 2-measure lab |
| 🗄️ **Retire as authoritative** | `src/ui/*` DOM panels (Notebook, TheoryBoard, ConclusionReview, Consultation, CuratedRecord, ApparatusControls, DecisionHistory, InquiryRecognition, context/CaseContextAndPrediction). Keep `CaseRecordPrintView` for export/record only |
| 🆕 **New** | Scene router/adventure flow; ColleaguesScene; TheoryBoardScene (proposal picker); RivalLab feedback; Phaser dialogue/choice UI; colleague portraits/silhouettes |

---

## Section 3 — Recommended Approach

**Selected path: Hybrid — MVP Review + Direct Adjustment + partial Rollback.**

- **MVP Review (primary):** the MVP *definition itself* changes — accessibility dropped, guided-adventure + choice-based reasoning added. This is unavoidable at the GDD level.
- **Direct Adjustment:** reuse the domain engine; rewrite presentation/flow stories inside redefined Epics 1–2.
- **Partial Rollback:** retire the `src/ui/*` semantic-DOM layer as the authoritative surface (it becomes dead/print-only code).

**Why not the alternatives alone:**
- *Direct Adjustment only* can't absorb a GDD-identity change (accessibility is a stated pillar/metric).
- *Full rollback* is wrong — the domain/store/evaluator/persistence are correct and reusable; only the presentation layer is superseded.

**Effort: High. Risk: Medium-High.**

**Trade-offs recorded (Decision A):** dropping accessibility as an MVP gate removes the "classroom-friendly, keyboard-only, screen-reader" identity that motivated several GDD goals and educator success metrics. Educator/classroom adoption and the moderated-learning success metrics (§Success Metrics) are the most exposed. Mitigations: the store/domain boundary is preserved, so accessibility can be re-introduced post-MVP without re-architecting; keep the semantic print/export record as a residual accessible artifact.

**Sequencing:** (1) approve GDD + architecture + UX edits → (2) re-baseline Epics 1–2 → (3) build scene router + reuse Library/Lab scenes → (4) colleague-proposal + evaluator extension → (5) rival-lab critique → (6) re-run a (non-a11y) Young validation.

---

## Section 4 — Detailed Change Proposals (Batch)

### 4.1 GDD (`gdds/gdd-Quantique-2026-08-04/gdd.md`)

**Core Concept** — OLD: "A tactile visual laboratory teaches the observation before optional formal theory … player agency lies in determining what the available evidence supports, including a defensible limited conclusion."
**NEW:** reframe as a *guided narrative adventure* through scripted lab scenes; player agency lies in *choosing* which colleague prediction/conclusion the generated evidence best supports.

**Unique Selling Points** — OLD USP #1 "Evidence is player-generated: conclusions cite the player's own measurements."
**NEW:** "Players run authored experiments, then judge which of four colleague conclusions their own measurements support" + "A fully scenarized, cinematic Phaser lab with a cast of colleagues and a rival lab."
Remove the "tactile accessible visual laboratory" USP.

**Game Pillars** — Pillar 4 "Legible collaborative experimentation" reworded to drop the "inspect via semantic UI" clause; add a pillar: **"Guided, cinematic scenario"** (no freeform; every beat is authored). Keep Pillars 1–3 (evidence, productive uncertainty, history-with-receipts) — note Pillar 1 now reads "evidence earns the *choice of* conclusion."

**Core Gameplay Loop** — replace the 7-step open loop with the scenarized Library → Colleagues → Lab → Synthesis → Theory Board → Rival-lab/Revision → Debrief flow (§2.1 table).

**Primary Mechanics table** — "Theory board" row: OLD "Connect observation, source, prediction, and conclusion … requires ≥2 observations and ≥2 sources … must identify one limitation." NEW: "Select one of four colleague-proposed conclusions; selection unlocks after ≥2 significant measures; each proposal bundles a claim + limitation; an unsupported pick triggers rival-lab critique and revision." Add "Prediction" row: "Choose 1 of 4 colleague predictions."

**Controls and Input / Technical Specs** — remove the canvas-only prohibition and semantic-HTML-equivalence requirements. NEW: "The Phaser scene is the primary interface; a semantic print/export record is retained for portability."

**Player Assistance** — hints now delivered **in-fiction by a colleague** when the 2-significant-measure gate is unmet.

**Success Metrics** — remove keyboard-only/screen-reader/non-colour acceptance and the "cites own observation" 60% metric. NEW gameplay metrics: e.g. "≥60% of players can explain *why* they chose their conclusion by referencing a measurement they saw," and educator metrics retained where accessibility-independent.

**Out of Scope** — remove "no freeform sandbox" redundancy (now covered by scenario); **move accessibility (keyboard-only, screen-reader, non-colour parity) into Out-of-Scope / Deferred-post-MVP.**

### 4.2 Architecture (`game-architecture.md`)

- **ADR-001** — OLD "Store-mediated HTML/Phaser integration … dual-surface." NEW "Store-mediated **Phaser-surface** integration: the store/domain remains authoritative; **Phaser scenes are the sole presentation layer**; the DOM layer is retired (print/export only)."
- **User Interface & Rendering Boundary** section — rewrite: Phaser owns all interactive presentation; no semantic-HTML authority requirement.
- **State Patterns** — keep the phase machine verbatim (it already fits). Extend `evaluateConclusionReadiness` to also return **which conclusion proposals are defensible** and a **significant-measure** count.
- **Content Model** — `CaseDefinition` gains: `colleagues[]`, `predictionProposals[]`, `conclusionProposals[]` (each with a `supportPredicate`), `scenarioScript` (scene order + dialogue beats), `significanceRule`, `rivalLabCritiques[]`.
- **GDD Coverage / Validation tables** — flip the two accessibility rows from PASS to **De-scoped (post-MVP)**.
- **Directory structure** — mark `src/ui/*` interactive panels as retired; add `src/adapters/phaser/scenes/{LibraryScene,ColleaguesScene,TheoryBoardScene,RivalLabScene,SceneRouter}.ts` and Phaser dialogue/choice components.

### 4.3 UX (`ux-designs/.../EXPERIENCE.md`)

- **Foundation & Accessibility Floor** — remove the "semantic HTML owns essential controls" and WCAG/keyboard/screen-reader floor; replace with a "Phaser-first presentation; retained print/export record" note.
- **HUD & Diegetic UI** — invert: diegetic Phaser UI *is* the authoritative surface; colleagues and the rival lab are first-class interactive presences.
- **Component Patterns** — add: **Colleague-proposal card** (pick 1 of 4), **Rival-lab critique** (dramatic, non-punitive, routes to revision), **Scene navigation**. Rework Apparatus/Notebook/Theory-board contracts to Phaser.
- **Voice & Tone** — keep calm/precise; add rival-lab voice guidance ("pointed but fair; never a score or game-over").
- **Anti-patterns** — remove "avoid canvas-only controls"; keep "avoid competitive *scoring*, speed rewards, irreversible errors" (the rival lab must respect these).

### 4.4 Epics (`epics.md`)

- **Epic 1** retitled **"Phaser guided-adventure foundation."** Rewrite Stories 1.3–1.7, 1.9 to Phaser scenes; drop DOM-parity/a11y acceptance criteria; keep domain-test criteria.
- **Epic 2** — Story 2.1 prediction → choice-of-4; Story 2.3 → "2 significant measures" gate + colleague-proposed conclusion + rival-lab critique; Story 2.4 metrics revised.
- **Epic 3** — Story 3.1 contract hardening extended with colleague proposals, scenario script, significance rule, rival-lab lines.
- **Epic 7** — Story 7.2 (accessibility/cross-browser a11y verification) **de-scoped from MVP**; retain 7.1 (educator materials) and 7.3 (static/offline release).
- **New stories (Epic 1/2):** `SceneRouter & adventure flow`, `Colleague cast & proposal system`, `Rival-lab critique`, `Scenario/dialogue scripting`, `Phaser dialogue & choice UI`.
- **Requirements inventory:** de-scope `NFR6, NFR7, NFR13`, `UX-DR1–DR6`; rework `FR12–FR14, FR22`.

---

## Section 5 — Implementation Handoff

**Scope classification: MAJOR** (fundamental replan touching GDD identity, architecture, UX, and epics).

Because Quantique is solo-developed, Alexis wears the PM/Architect/Designer hats for the artifact edits, then hands to the Developer flow for implementation.

| Recipient (role) | Responsibility | Deliverable |
|---|---|---|
| **Designer/PM (Alexis)** | Approve GDD + UX identity changes | Revised `gdd.md`, `EXPERIENCE.md` |
| **Architect (Alexis)** | Approve ADR-001 change + schema/evaluator extension | Revised `game-architecture.md` |
| **PO/Dev** | Re-baseline Epics 1–2, add new stories, de-scope a11y stories | Revised `epics.md`, `sprint-status.yaml` |
| **Developer** (`gds-dev-story` / `gds-quick-dev`) | Build scene router, reuse Library/Lab, colleague-proposal + evaluator extension, rival-lab | Working Phaser adventure slice |

**Success criteria for the pivot:**
1. Young playable end-to-end as a scenarized Phaser adventure (Library → Debrief) with no DOM-authoritative UI.
2. Existing gated logic intact (phase machine + evaluator, extended for significance + defensible-conclusion).
3. Prediction and conclusion are 1-of-4 colleague choices; unsupported conclusion triggers a non-punitive rival-lab critique + revision.
4. "2 significant measures" gate unlocks the conclusion; colleague hints otherwise.
5. Domain/store/persistence tests still pass; retired `src/ui/*` removed from the active path.

**Next-step recommendation:** on approval, start with the GDD + architecture edits (they unblock everything), then re-baseline Epics 1–2 and run `gds-sprint-planning`.

---

## Addendum A — Bilingual (English + French) from launch (2026-08-05)

Added after approval, at Alexis's request. This reverses the prior GDD/UX exclusion of localization ("English is the v1 interface language").

- **Decision:** the game ships **bilingual (EN + FR)** from the first release; the Young slice is complete in both locales. Localization beyond EN/FR stays out of scope.
- **Why early:** i18n dictates how *every* string is authored (UI, Phaser scene text, and all case content — dialogue, proposals, hints, critiques, sources, debrief). Retrofitting after scenes render text is expensive, so it is a **foundation** story built immediately after bootstrap and before any scene text work.
- **Artifacts updated:** new **Story 1.1b — Internationalization foundation (EN + FR)** in Epic 1 (`epics.md`); **NFR19**; **ADR-010** and a Content-Model i18n paragraph (`game-architecture.md`); GDD Out-of-Scope carve-out + bilingual-at-launch note; UX spine language line; `sprint-status.yaml` (`1-1b`, sequenced right after `1-1`).
- **Key implementation notes:** `en`/`fr` locale resources; locale in the store, persisted in settings; Zod validates locale completeness on case load; English fallback with a `i18n.missingKey` dev warning; **Phaser fonts must include the French glyph set/diacritics**; scientific run values remain canonical across locales.
