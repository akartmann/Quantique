---
title: 'Game Architecture'
project: 'Quantique'
date: '2026-08-06'
author: 'Alexis'
version: '1.2'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
engine: 'Phaser 4.2.1'
platform: 'Desktop web browsers'

# Source Documents
gdd: '/Users/akartmann/Documents/Projects/Quantique/_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md'
epics: '/Users/akartmann/Documents/Projects/Quantique/_bmad-output/planning-artifacts/epics.md'
brief: '/Users/akartmann/Documents/Projects/Quantique/_bmad-output/planning-artifacts/briefs/brief-Quantique-2026-08-04/brief.md'
---

# Game Architecture

## Executive Summary

**Fracture of Certainty: Cases from the Quantum Age** is a desktop-web historical-science **guided narrative adventure** built with Phaser 4.2.1, TypeScript, and Vite. Phaser scenes are the sole presentation surface (library, colleagues, lab, theory board, debrief); a lightweight TypeScript store and pure domain layer remain authoritative for evidence, conclusions, and local progress.

> **Pivot note (v1.1, 2026-08-05):** This document was revised for the pivot to a Phaser guided adventure. The store/domain boundary is unchanged; the previously dual-surface (semantic-HTML-authoritative) presentation layer is now a **single Phaser surface**, and accessibility is de-scoped from the MVP. See ADR-001 and the User Interface & Rendering Boundary section.
>
> **Correction note (v1.2, 2026-08-06):** ADR-001 v1.1 made Phaser the sole surface but stated no *completeness* obligation, so nine of fourteen player intents shipped dispatchable only from the retired DOM panels. **ADR-011** closes that gap; **ADR-012** adds direct-manipulation instruments and a player-started light. No layer below presentation changes. See `planning-artifacts/sprint-change-proposal-2026-08-06.md`.

**Key Architectural Decisions:**

- Use a store-mediated boundary between the Phaser presentation surface and the authoritative store, with typed interaction intents dispatched from Phaser.
- Keep case content as versioned JSON validated by Zod; use deterministic, versioned experiment records and an evidence-to-conclusion evaluator that also judges which colleague conclusions the evidence supports.
- Persist offline in IndexedDB, support JSON export/import and CSS printing (the only non-Phaser surface, for record portability), and release as a static hosted web application without accounts, telemetry, or a network-critical play path.

**Project Structure:** Domain-driven hybrid organization with dedicated domains for cases, apparatus, evidence, sources, theory, review, and recognition.

**Implementation Patterns:** Phaser-surface interaction, evidence-to-conclusion gating (extended for defensible-conclusion selection and significant-measure counting), deterministic experiment records, typed actions/events, renderer factories, finite case phases, and validated repositories ensure consistent AI-agent implementation.

**Ready for:** Young validation-slice implementation and aligned epic/story planning.

## Document Status

This architecture document was created through the GDS Architecture Workflow.

**Steps Completed:** 9 of 9 (Complete)

---

_Architecture is complete and ready to guide implementation._

## Project Context

### Game Overview

**Fracture of Certainty: Cases from the Quantum Age** is a browser-based historical-science investigation anthology. Players calibrate authored apparatus, generate and record evidence, inspect sources, respond to critique, and submit conclusions bounded by what their evidence supports.

### Technical Scope

**Platform:** Desktop web browsers (Chrome, Firefox, Safari, Edge); tablet-ready interaction; phones support reading-only initially  
**Genre:** Historical-science puzzle / evidence investigation  
**Project Level:** Medium-high for the Young validation slice; high for the eventual four-case anthology

### Core Systems

| System | Complexity | GDD reference |
|---|---|---|
| Accessible apparatus interaction | High | Controls and Input |
| Authored experiment simulation and results | High | Primary Mechanics / Puzzle Mechanics |
| Notebook, saved-run comparison, export/print | Medium-high | Measurement Notebook |
| Theory board and evidence validation | High | Theory Board / Win Conditions |
| Evidence-responsive consultations and peer review | High | Team Consultation / Narrative branching |
| Curated Record, provenance, and source/rights ledger | High | Art & Asset Requirements |
| Case framework and data-driven authoring | High | Asset Requirements / Epic 3 |
| Local persistence and offline restoration | Medium | Technical Specifications |
| Responsive semantic interface around Phaser | High | Controls and Input |
| Audio, captions, and state feedback | Medium | Art and Audio Direction |

### Technical Requirements

- Phaser is the required MVP engine.
- Sustain 60 FPS at 1280×720 on a representative low-end school laptop.
- Cached launch reaches first interaction within five seconds; local saves restore after offline reload.
- No account, analytics dependency, or network dependency can block play.
- The Phaser scenes are the interface for all interactive play; a semantic CSS print/export view is the only non-Phaser surface (record portability only). Accessibility parity is de-scoped from MVP.
- Mouse/keyboard is the primary input against the Phaser scenes; touch/pointer is a secondary tablet-readiness goal.
- Data must support reusable authored cases (including colleague casts, scenario scripts, and proposal sets) without duplicating the core evidence loop.
- Local export/import or printable case records are required.

### Complexity Drivers

- The game is presented through a single Phaser surface organized as a scripted sequence of scenes (library, colleagues, lab, theory board, debrief) driven by the authoritative store.
- Experiment outputs must be authored and inspectable while remaining scientifically legible—not an unconstrained physics sandbox.
- Evidence, sources, observations, claims, limitations, feedback, and recognition must persist as a coherent decision history.
- Dialogue and consultation need to react to evidence state but converge on fixed, historically bounded outcomes.
- Historical provenance and asset rights need first-class case data, auditability, and release gates.
- The reusable framework must prove itself with a second-case spike before campaign-scale production.

### Technical Risks

- Delivering a cohesive scenarized Phaser flow (scene routing, colleague dialogue/choice UI, rival-lab critique) is the main Young-slice risk now that accessibility is de-scoped; the scene router and choice UI are new surfaces to prove.
- The solo-developer scope makes a polished reusable vertical slice more valuable than early multi-case production.
- Scientific accuracy, rights tracking, and educator review require an external review process that the product must accommodate.
- Cross-browser rendering, offline persistence, and print/export behavior need early manual acceptance coverage.
- The architecture must avoid coupling case content to rendering or branching logic, or later cases will duplicate work.

## Engine & Framework

### Selected Engine

**Phaser 4.2.1** with TypeScript and Vite.

**Rationale:** Phaser is a web-native 2D engine suited to the tactile, real-time laboratory experience. Its rendering, scenes, asset loading, audio, camera, tween, and input systems cover the visual lab layer, while TypeScript and Vite support a maintainable browser application. Semantic HTML remains the authoritative interface for critical controls, readouts, notebook work, and conclusions.

### Project Initialization

Use Phaser’s official project generator and select the **Vite + TypeScript** template:

```bash
npm create @phaserjs/game@latest
```

### Engine-Provided Architecture

| Component | Solution | Notes |
|---|---|---|
| Rendering | WebGL with Canvas fallback | Phaser renderer for the laboratory tableau and visual experiment output |
| Scene management | Phaser scenes | Use scene lifecycle for boot, asset loading, lab, and debrief presentation |
| Input | Phaser pointer, touch, keyboard APIs | Handle all interactive play across the scene flow; mouse/keyboard primary, touch/pointer secondary |
| Audio | Phaser audio system | Non-essential tactile feedback and music; captions/text alternatives remain available |
| Asset loading | Phaser Loader | Loads visual and audio assets with a defined preload lifecycle |
| Animation and feedback | Phaser tweens and animation systems | Supports apparatus motion, result reveals, and restrained cinematic tableaus |
| Physics | None by default | The Young slice uses deterministic authored experiment calculations, not runtime physics simulation |
| Build system | Vite | Fast TypeScript development and production browser bundling |

### Development Documentation Tooling

**Context7 MCP** (`@upstash/context7-mcp`) will be included for current documentation lookup during AI-assisted development.

- **Install type:** Node.js MCP server
- **Requirements:** Node.js 20.18.1 or later; an API key is optional for higher rate limits
- **Role:** retrieve current Phaser, Vite, and related library documentation and examples
- **Boundary:** documentation assistance only; it does not alter the game or replace project tests

### Remaining Architectural Decisions

- Define a strict boundary between Phaser rendering and semantic HTML application UI.
- Establish the authoritative case/evidence state model and reactive UI synchronization.
- Specify case, apparatus, observation, source, theory-board, feedback, and provenance schemas.
- Choose browser persistence, migration, export/import, and print-record strategies.
- Define deterministic experiment-result calculations and validation rules.
- Set scene composition, lifecycle ownership, asset loading, and cleanup conventions.
- Specify the scene-router flow, colleague dialogue/choice UI, and rival-lab critique presentation. (Accessibility behavior — keyboard/focus/announcements/non-colour encoding — is de-scoped from the MVP per ADR-008.)
- Define automated and manual test layers, including cross-browser, offline, performance, and accessibility gates.
- Define production/deployment, cache, and no-network-critical-play behavior.

## Architectural Decisions

### Decision Summary

| Category | Decision | Version | Rationale |
|---|---|---:|---|
| Application state | Lightweight TypeScript store with immutable updates and subscriptions | Project-owned | One testable source of truth across UI, Phaser, and persistence |
| UI/render boundary | Store-mediated typed adapters | Project-owned | Phaser scenes render store projections and dispatch typed intents; they never mutate state directly |
| Persistence | IndexedDB through `idb` | 8.0.3 | Offline-first structured local records with explicit migrations |
| Content validation | JSON case definitions validated by Zod | 4.4.3 | Reusable, inspectable cases with safe loading and authoring errors |
| UI | Phaser scenes + renderer factories | Phaser 4.2.1 | Library, colleagues, lab, theory-board, and debrief scenes are the sole **and sufficient** interactive surface — every player intent is dispatchable from the canvas (ADR-011); a CSS print view is the only DOM surface (record export) |
| Asset loading | Boot shell then case-scoped bundles | Phaser Loader | Fast first interaction and clean campaign-scale boundaries |
| Experiment model | Deterministic authored calculations | Project-owned | Scientific behavior is inspectable and reproducible; no runtime physics required |
| Dialogue and peer review | Data-driven rules and predicates | Project-owned | Evidence-responsive but historically convergent content |
| Export/import | Versioned JSON plus CSS print view | Platform APIs | Offline backup, classroom printing, and no account requirement |
| Networking | None | N/A | No multiplayer, cloud dependency, or critical-play network requirement |
| Audio | Phaser native audio | Phaser 4.2.1 | Sufficient for restrained music and tactile feedback |
| Physics | None by default | N/A | The apparatus is a visual/interaction model, not a physics sandbox. Direct-manipulation drag input (ADR-012) is an input mapping, not a physics body |

### State Management

**Approach:** A lightweight TypeScript store is the authoritative application state. It exposes read-only state, typed intent dispatch, and subscriptions. State changes are pure, immutable transitions; side effects—save, asset request, audio playback, or scene command—run through explicit adapters.

Phaser scenes render projections of store state and send interaction intents. Semantic DOM components do the same. Neither layer directly changes the other’s objects or state.

### Data Persistence

**Save System:** IndexedDB via `idb` 8.0.3.

Persist versioned records for settings, case progress, runs, observations, inspected sources, theory-board links, peer-review history, and recognition. Database migrations and imported-record migrations are explicit and tested. Failed save or import validation leaves the last valid local state intact.

### Content Model

**Approach:** Versioned JSON case definitions, validated at load time with Zod 4.4.3.

A case definition owns its apparatus controls, allowed values, deterministic experiment rules, sources and provenance, evidence prerequisites, dialogue/consultation rules, debrief material, and asset manifest. The pivot adds the following authored fields:

- `colleagues[]` — the named case cast (id, role, portrait/silhouette asset).
- `predictionProposals[]` — four colleague-voiced predictions the player chooses between.
- `conclusionProposals[]` — four colleague-voiced conclusions, each bundling a claim, a stated limitation, and a `supportPredicate` the evaluator uses to decide whether the recorded evidence defends it.
- `significanceRule` — defines when a measurement counts as "significant" (e.g. a run that meaningfully differs on the critical path); the ≥2-significant-measure gate uses it.
- `rivalLabCritiques[]` — dramatic, non-punitive critique lines shown when the player selects an unsupported conclusion.
- `scenarioScript` — the ordered scene flow (library → colleagues → lab → theory board → debrief) and its dialogue beats.

**Added v1.2 (2026-08-06).** Two optional authoring fields let a case stage its own characters and instruments:

- `scenarioScript.scenes[].cast?` — the colleague IDs present in that scene, defaulting to the full cast. Lets a case stage who is in the room without scene code.
- `apparatus.primaryControls[].affordance?` — `knob` | `dial` | `slider`, defaulting to `knob`. Selects the instrument the scene draws; the authored range, step, and validation are unchanged.

Both are optional and additive, so existing case content parses unchanged. Adding them bumps `CaseDefinition.version`, and the record-compatibility allowlist is extended only across versions whose canonical strings are verified byte-identical.

Runtime state stores only player decisions and generated observations; it never mutates the shipped case definition.

**Internationalization (EN + FR, v1.1).** The game ships bilingual. All player-facing strings — UI/scene chrome and every authored case string (dialogue beats, colleague names/roles, the prediction and conclusion proposals with their limitations, colleague hints, rival-lab critiques, source labels, and debrief) — resolve through an i18n layer with `en` and `fr` locale resources; no display string is hard-coded in scenes, widgets, or the print view. Localizable case strings carry both locales, and Zod validates locale completeness at load. The active locale lives in the store (persisted in player settings); a missing key falls back to English with a dev-only `i18n.missingKey` warning. Phaser fonts must include the full French glyph set/diacritics. Recorded scientific run values stay canonical regardless of locale.

### User Interface and Rendering Boundary

Phaser scenes are the sole interactive surface. Each phase of the case is a scene — library (reference reading), colleagues (prediction choice), laboratory (apparatus + measurement), theory board (conclusion choice + rival-lab critique), and debrief — presented in the scripted `scenarioScript` order. Scenes render controls, measured values, instructions, source records, and the conclusion choice in-canvas; they read store projections and dispatch typed intents.

The TypeScript store and pure domain layer remain authoritative: scenes never mutate state directly, and the domain never imports Phaser. A single **SceneRouter** maps the authoritative case phase to the active scene (a scene transition mirrors the phase; it never defines it). The only non-Phaser surface is the semantic CSS print/export view, retained purely so a player's case record stays portable. Accessibility parity (keyboard-only completion, screen-reader support, non-colour-only encoding) is de-scoped from the MVP; the preserved store/domain boundary keeps a future accessible surface feasible without re-architecture.

**Surface completeness (v1.2).** Being the sole surface is not the same as being a sufficient one. Every player intent required to reach a case conclusion must be dispatchable from the canvas. A feature whose only dispatcher is a non-Phaser surface is incomplete regardless of how well its store contract is tested — the store may be correct while the game is unplayable. The retained CSS print/export view is the one exemption and dispatches nothing. See ADR-011.

**Interaction fidelity (v1.2).** Apparatus controls are direct-manipulation instruments, and the experiment is player-initiated: the light source is dark and no propagation loop runs until the player starts it. See ADR-012.

### Asset Management

**Loading Strategy:** Load a minimal boot shell first, then a declared asset bundle for the selected case.

The boot shell includes only the application frame, accessibility UI, loading feedback, and minimum launch assets. Each case manifest declares the images, audio, fonts, and source media needed before its lab begins. Phaser’s loader owns visual/audio loading; the application reports progress semantically and never leaves a critical control unavailable without explanation.

### Dialogue, Colleague Proposals, and Rival-Lab Critique

Colleague dialogue, prediction/conclusion proposals, consultations, and rival-lab critique are all case data. Predicates inspect the authoritative evidence state to: select an in-fiction colleague hint when the significant-measure gate is unmet; decide (via each conclusion proposal’s `supportPredicate`) which of the four conclusions the recorded evidence defends; and select the dramatic rival-lab critique shown when the player picks an unsupported conclusion. Rules can vary lines and guidance but cannot change a case’s historical outcome or bypass required observations and sources. The rival-lab critique always routes back to a revisable choice — never a score, game-over, or lockout.

### Export and Print

Export a validated, versioned JSON case record. Import validates against the current schema and runs migrations before replacing or merging local data. A dedicated semantic print view, styled with CSS, presents settings, observations, sources, comparison notes, conclusion, and stated limitations.

### Architecture Decision Records

- **ADR-001 — Store-mediated Phaser-surface integration (revised v1.1):** Maintain one authoritative store; Phaser scenes are the sole presentation surface and dispatch typed intents; prohibit direct state mutation from scenes. *Supersedes the original dual-surface (semantic-HTML-authoritative) decision.*
- **ADR-002 — Offline local persistence:** IndexedDB is the local primary store; no cloud-save or network dependency is introduced.
- **ADR-003 — Validated data-driven cases:** Case content is versioned JSON validated at runtime; core logic is reusable across cases.
- **ADR-004 — Deterministic experiment model:** Produce reproducible, inspectable results through authored calculation rules rather than physics simulation.
- **ADR-005 — Case-scoped loading:** Start with a minimal shell and load complete case bundles before laboratory play.
- **ADR-006 — Evidence-driven narrative rules:** Use data predicates for colleague proposals, consultations, and rival-lab critique while preserving fact-bound outcomes; the evaluator judges which conclusion proposals the evidence defends.
- **ADR-007 — Portable learner records:** Support validated JSON export/import and semantic CSS printing (the only non-Phaser surface).
- **ADR-008 — Accessibility de-scoped from MVP (new v1.1):** Keyboard-only completion, screen-reader support, and non-colour-only encoding are not MVP release gates. The preserved store/domain boundary keeps a future accessible surface feasible without re-architecture.
- **ADR-009 — Scene-router adventure flow (new v1.1):** A single SceneRouter maps the authoritative case phase to the active Phaser scene per the case's `scenarioScript`; scenes mirror phase, never define it.
- **ADR-010 — Bilingual (EN + FR) i18n foundation (new v1.1):** All player-facing text resolves through an i18n layer with `en`/`fr` resources; case strings carry both locales (Zod-validated), locale lives in the store and persists in settings, and Phaser fonts include the French glyph set. This is an early foundation concern built before scene text work; localization beyond EN/FR is out of scope.
- **ADR-011 — Canvas intent completeness (new v1.2):** Every player intent required to complete a case must be dispatchable from the Phaser canvas; no non-Phaser surface may be the sole dispatcher of any intent. ADR-001 v1.1 established Phaser as the sole *presentation* surface but stated no completeness obligation, which allowed six stories to be verified complete while nine of fourteen player intents remained reachable only through DOM panels the pivot had retired. A story that introduces or gates an intent is not done until the canvas can issue it. The CSS print/export view (ADR-007) is the sole exemption and dispatches nothing.
- **ADR-012 — Direct-manipulation instruments over stepper controls (new v1.2):** Apparatus controls are drawn as physical instruments the player grasps and moves; drag input is converted to a value that snaps to the authored step before dispatch, so no off-step value ever reaches the store. This is an **input mapping, not physics** — ADR-004 stands unchanged and no Arcade or Matter body is introduced. Discrete step affordances and keyboard stepping remain alongside the drag so that pointer and keyboard produce identical run records. Corollary: the experiment run is player-initiated; the light source is dark and no propagation loop runs until the player starts it, which also removes a continuous idle animation cost from the NFR1 baseline.

## Cross-cutting Concerns

These patterns apply to every system and are mandatory for all implementations.

### Error Handling

**Strategy:** Use typed `Result` values for expected/recoverable failures and one application-level error boundary for unexpected failures.

- **Recoverable:** invalid import, unavailable storage, corrupt optional asset, or an incomplete player action. Preserve valid state, explain what happened in semantic UI, and provide retry/reset/export recovery.
- **Unexpected:** invariant violation or unhandled adapter failure. Capture structured diagnostic context, show a neutral recovery view, and never silently discard player progress.
- **Never:** throw inside store reducers, mutate state after failure, or expose raw exception text as player-facing copy.

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'invalid-import' | 'storage-unavailable'; message: string };

async function importCaseRecord(raw: unknown): Promise<Result<CaseRecord>> {
  const parsed = CaseRecordSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid-import',
      message: 'This record is not compatible with the current game version.',
    };
  }

  return { ok: true, value: parsed.data };
}
```

### Logging

**Format:** Structured development logs written only to the browser console.  
**Destination:** Local developer browser tools; no telemetry, remote logging, or learner-data transmission.

| Level | Use |
|---|---|
| `error` | Unexpected failure requiring investigation |
| `warn` | Handled degradation, rejected import, migration fallback |
| `info` | Case load, save completion, scene transition, test milestone |
| `debug` | Development-only state, rule evaluation, asset timing |
| `trace` | Disabled by default; detailed diagnostic flow only |

```ts
logger.warn('persistence.importRejected', {
  caseId: 'young-interference',
  reason: result.code,
  schemaVersion: raw.schemaVersion,
});
```

No per-frame logs are permitted. Logs must use stable event names in `domain.action` form and omit player-entered conclusion text unless a developer explicitly enables local diagnostics.

### Configuration

**Approach:** Layered, versioned configuration.

```text
src/config/           typed build/runtime defaults
public/cases/         versioned JSON case definitions
src/schemas/          Zod schemas and migration functions
IndexedDB/settings    player preferences only
```

- Typed defaults hold feature flags, build metadata, and platform-safe limits.
- Case JSON owns authored scientific and narrative content.
- Player settings store language (EN/FR), audio, display, and input preferences.
- Remote configuration is prohibited for core play.

### Event System

**Pattern:** Typed synchronous domain events emitted after successful store transitions.

Events notify adapters of completed facts; they must not become a second state store, mutate domain state, or trigger another reducer directly. Names use `noun.verb` format.

```ts
type DomainEvent =
  | { type: 'run.recorded'; runId: string; caseId: string }
  | { type: 'source.inspected'; sourceId: string }
  | { type: 'case.saveFailed'; reason: string };

store.subscribe((transition) => {
  for (const event of transition.events) {
    eventBus.emit(event);
  }
});

eventBus.on('run.recorded', (event) => {
  persistence.queueSave(event.caseId);
  audio.play('measurement-recorded');
});
```

### Debug Tools

**Available in development builds only:**

- State snapshot and action/event timeline
- Current-case selector, reset, and seeded fixture loader
- Deterministic experiment-result inspector
- Evidence-rule and peer-review predicate inspector
- Asset-load timings and Phaser frame-time counters
- Keyboard/focus and accessibility-announcement diagnostics

**Activation:** Development build only, through an explicit `?debug=1` query flag or local development setting. Debug commands, mock content, and diagnostic UI are excluded from production builds.

## Project Structure

### Organization Pattern

**Pattern:** Domain-driven hybrid.

**Rationale:** Stable platform layers handle bootstrapping, state, adapters, and presentation. Domain modules own reusable scientific-investigation behavior. Case content remains data outside implementation code, so later cases do not duplicate the Young slice.

### Directory Structure

```text
Quantique/
├── public/
│   ├── cases/
│   │   ├── young-interference/
│   │   │   ├── case.json
│   │   │   ├── sources.json
│   │   │   └── assets.json
│   │   └── _schemas/case.schema.json
│   └── assets/
│       ├── shared/{art,audio,fonts}/
│       └── cases/young-interference/{art,audio,documents}/
├── src/
│   ├── app/{bootstrap.ts,createApplication.ts,applicationErrorBoundary.ts}
│   ├── config/{buildConfig.ts,featureFlags.ts,platformLimits.ts}
│   ├── core/
│   │   ├── store/{AppState.ts,AppAction.ts,createStore.ts,selectors.ts}
│   │   ├── events/{DomainEvent.ts,createEventBus.ts}
│   │   ├── errors/Result.ts
│   │   └── logging/logger.ts
│   ├── domain/
│   │   ├── cases/{CaseDefinition.ts,CaseProgress.ts,caseReducer.ts}
│   │   ├── apparatus/{ApparatusControl.ts,ExperimentRule.ts,calculateExperimentResult.ts}
│   │   ├── evidence/{Observation.ts,RunRecord.ts,evidenceRules.ts}
│   │   ├── sources/{SourceRecord.ts,provenanceRules.ts}
│   │   ├── theory/{TheoryBoard.ts,conclusionRules.ts}
│   │   ├── review/{ConsultationRule.ts,peerReviewRules.ts}
│   │   └── recognition/recognitionRules.ts
│   ├── schemas/
│   │   ├── {CaseDefinitionSchema.ts,CaseRecordSchema.ts}
│   │   └── migrations/{migrateCaseDefinition.ts,migrateCaseRecord.ts}
│   ├── adapters/
│   │   ├── persistence/{IndexedDbRepository.ts,caseRecordRepository.ts}
│   │   ├── content/loadCaseDefinition.ts
│   │   ├── export/{exportCaseRecord.ts,importCaseRecord.ts}
│   │   ├── audio/PhaserAudioAdapter.ts
│   │   ├── phaser/
│   │   │   ├── {createPhaserGame.ts,PhaserStoreAdapter.ts,SceneRouter.ts}
│   │   │   ├── scenes/{BootScene.ts,CaseLoadScene.ts,LibraryScene.ts,ColleaguesScene.ts,LaboratoryScene.ts,TheoryBoardScene.ts,RivalLabScene.ts,DebriefScene.ts}
│   │   │   ├── ui/{DialogueBox.ts,ProposalChoice.ts,SceneNav.ts}   # Phaser-native dialogue & choice widgets
│   │   │   └── renderers/{ApparatusRenderer.ts,ExperimentOutputRenderer.ts,LectureBookRenderer.ts,ColleagueRenderer.ts}
│   │   └── dom/CaseRecordPrintView bridge   # RETIRED (pivot): DomStoreAdapter/announcements/focusManagement no longer used
│   ├── ui/                        # RETIRED as authoritative surface (pivot) — panels below superseded by Phaser scenes
│   │   ├── shell/BootShell.ts      # kept: minimal boot frame that mounts the Phaser game
│   │   ├── apparatus/ApparatusControls.ts        # retired -> LaboratoryScene
│   │   ├── notebook/{NotebookPanel.ts,RunComparison.ts}  # retired -> LaboratoryScene/notebook widget
│   │   ├── theory/TheoryBoardPanel.ts            # retired -> TheoryBoardScene
│   │   ├── sources/CuratedRecordPanel.ts         # retired -> LibraryScene
│   │   ├── review/ConclusionReviewPanel.ts       # retired -> TheoryBoardScene + RivalLabScene
│   │   └── print/CaseRecordPrintView.ts          # KEPT: only non-Phaser surface (record export/print)
│   ├── styles/{tokens.css,application.css,print.css}
│   ├── test-support/{fixtures/,createTestStore.ts}
│   └── main.ts
├── tests/
│   ├── unit/{domain,schemas,core}/
│   ├── integration/{adapters,ui}/
│   └── e2e/{young-case.spec.ts,accessibility.spec.ts,offline-reload.spec.ts}
├── docs/{architecture,content-authoring,source-rights,educator}/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### System Location Mapping

| System | Location | Responsibility |
|---|---|---|
| Application composition | `src/app/` | Starts the store, adapters, semantic shell, and Phaser instance |
| State, actions, selectors | `src/core/store/` | Authoritative immutable application state |
| Events and logging | `src/core/events/`, `src/core/logging/` | Post-transition effects and local diagnostics |
| Case framework | `src/domain/cases/`, `public/cases/` | Case behavior and authored definitions |
| Experiment model | `src/domain/apparatus/` | Deterministic scientific calculation |
| Notebook and evidence | `src/domain/evidence/`, `LaboratoryScene` | Runs, observations, comparisons, in-scene display |
| Sources and provenance | `src/domain/sources/`, `LibraryScene` | Source state and rights/provenance presentation |
| Theory board and conclusion | `src/domain/theory/`, `TheoryBoardScene` | Conclusion-proposal choice and defensibility evaluation |
| Colleague proposals, hints & rival lab | `src/domain/review/`, `ColleaguesScene`/`RivalLabScene` | Predicate-driven proposals, hints, and critique |
| Browser persistence | `src/adapters/persistence/` | IndexedDB operations and migrations |
| Export, import, print | `src/adapters/export/`, `src/ui/print/` | Portable records and print view (only DOM surface) |
| Phaser presentation | `src/adapters/phaser/` | SceneRouter, scenes, dialogue/choice UI, renderers, asset loading |
| Scene routing | `src/adapters/phaser/SceneRouter.ts` | Maps authoritative case phase to the active scene |
| Case and shared assets | `public/assets/` | Immutable browser-served media and documents |
| Test tooling | `src/test-support/`, `tests/` | Fixtures and automated acceptance coverage |
| Content/reviewer guidance | `docs/content-authoring/`, `docs/source-rights/` | Case authoring and provenance processes |

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Class and component files | `PascalCase.ts` | `LaboratoryScene.ts` |
| Non-class module files | `camelCase.ts` | `createStore.ts` |
| Classes and types | `PascalCase` | `CaseDefinition` |
| Functions/properties | `camelCase` | `calculateExperimentResult` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_SAVED_RUNS` |
| Case IDs and assets | `kebab-case` | `young-interference`, `slit-screen.png` |
| JSON fields | `camelCase` | `schemaVersion` |
| Domain events | `noun.verb` | `run.recorded` |

### Architectural Boundaries

- `domain/` may depend only on TypeScript types and other domain/core modules; it must not import Phaser, DOM, IndexedDB, or browser APIs.
- `adapters/phaser/` scenes read state through selectors and dispatch typed actions; they never mutate state directly. `ui/` retains only the CSS print/export view (the sole DOM surface).
- `adapters/` implement side effects and may depend inward on `domain/` and `core/`; domain code never imports adapters.
- `public/cases/` is authored immutable content, not a place for player progress.
- Zod validation happens at all content/import boundaries before data reaches domain logic.
- All tests use public actions and selectors, never private renderer state.

## Implementation Patterns

These patterns are mandatory for all AI-agent implementations.

### Novel Patterns

#### Phaser-Surface Interaction

**Purpose:** Ensure every in-scene gesture flows through the authoritative store rather than mutating scene state, so play stays reproducible and testable.

```text
Phaser gesture → typed intent → store reducer → state + domain events → scenes re-render from state
```

```ts
type ApparatusIntent = {
  type: 'apparatus.controlSet';
  controlId: string;
  value: number;
  origin: 'dom' | 'phaser';
};

function setSlitSpacing(value: number, origin: ApparatusIntent['origin']): void {
  store.dispatch({ type: 'apparatus.controlSet', controlId: 'slit-spacing-mm', value, origin });
}
```

**Rule:** Phaser scene code may never update apparatus state directly. `origin` supports diagnostics only and cannot change results or progression. (The `'dom'` origin is retained in the type for the print/export bridge and future accessible surfaces, but no interactive DOM control dispatches it in the MVP.)

#### Evidence-to-Conclusion Gate

**Purpose:** Make the significant-measure gate, which conclusion proposals are defensible, and the rival-lab trigger a pure, auditable result of evidence state rather than scene-specific logic.

```text
case definition + persisted evidence state → evaluator → { readiness + significant-measure count, defensible conclusion IDs } → theory-board & rival-lab scenes
```

```ts
function evaluateConclusionReadiness(
  definition: CaseDefinition,
  progress: CaseProgress,
): ConclusionReadiness {
  const significantRuns = progress.runIds.filter((id) =>
    isSignificantMeasure(definition.significanceRule, progress.runs[id], progress),
  );
  const missing: string[] = [];
  if (significantRuns.length < definition.requirements.minimumSignificantRuns) {
    missing.push('Take another significant measurement.'); // surfaced in-fiction as a colleague hint
  }
  if (progress.inspectedSourceIds.length < definition.requirements.minimumSources) {
    missing.push('Read the required references in the library.');
  }
  // Which of the four colleague conclusions does the evidence actually defend?
  const defensibleConclusionIds = definition.conclusionProposals
    .filter((c) => c.supportPredicate(progress))
    .map((c) => c.id);
  return missing.length === 0
    ? { status: 'ready', missing: [], significantRuns: significantRuns.length, defensibleConclusionIds }
    : { status: 'incomplete', missing, significantRuns: significantRuns.length, defensibleConclusionIds };
}
```

**Rule:** A case cannot infer completion or a "correct" conclusion from scene history or UI visibility. Only the evaluator decides readiness and defensibility; a chosen conclusion whose ID is not in `defensibleConclusionIds` triggers the rival-lab critique and routes back to a revisable choice (never a hard fail).

#### Deterministic Experiment Record

**Purpose:** Preserve a reproducible scientific record for comparison, review, reload, export, and debugging.

```text
validated controls + experiment model version → calculateExperimentResult() → immutable RunRecord → notebook, renderer, persistence, export, review
```

```ts
function recordExperimentRun(
  definition: CaseDefinition,
  controls: ApparatusConfiguration,
  timestamp: string,
): RunRecord {
  return {
    id: crypto.randomUUID(),
    caseId: definition.id,
    experimentModelVersion: definition.experiment.modelVersion,
    controls,
    result: calculateExperimentResult(definition.experiment, controls),
    timestamp,
  };
}
```

**Rule:** Store the calculated result and model version with every run. Never recalculate a historical run using an unrecorded newer model.

### Communication Patterns

**Pattern:** Constructor-injected dependencies inside adapters; typed store actions and typed post-transition domain events across boundaries.

```ts
class CaseRecordRepository {
  constructor(private readonly database: Database, private readonly logger: Logger) {}
  async save(record: CaseRecord): Promise<Result<void>> {
    return this.database.put('case-records', record);
  }
}
```

**Rule:** Do not use service locators, global mutable singletons, or stringly typed event payloads.

### Phaser Object Patterns

**Creation:** Renderer factories create and own Phaser display objects. Object pooling is introduced only after profiling demonstrates allocation pressure.

```ts
class ApparatusRenderer {
  create(scene: Phaser.Scene, definition: ApparatusVisualDefinition): ApparatusView {
    const root = scene.add.container();
    const screen = scene.add.image(0, 0, definition.screenAssetKey);
    root.add(screen);
    return { root, screen };
  }
}
```

**Rule:** Domain models never extend Phaser classes. Renderer factories own Phaser object lifecycle and cleanup.

### State Patterns

**Pattern:** Explicit finite state machine for case phases: `context → prediction → experiment → synthesis → review → debrief`.

```ts
function transitionCasePhase(state: CaseProgress, next: CasePhase): Result<CaseProgress> {
  if (next === 'review' && !evaluateConclusionReadiness(state.definition, state).isReady) {
    return { ok: false, code: 'requirements-incomplete', message: 'More evidence is needed.' };
  }
  return { ok: true, value: { ...state, phase: next } };
}
```

**Rule:** Phase transitions occur through domain actions only. A Phaser scene transition mirrors the resulting phase; it never defines it.

### Data Patterns

**Access:** Validated content repository per boundary.

```ts
class CaseContentRepository {
  async load(caseId: string): Promise<Result<CaseDefinition>> {
    const response = await fetch(`/cases/${caseId}/case.json`);
    const parsed = CaseDefinitionSchema.safeParse(await response.json());
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, code: 'invalid-case-definition', message: 'Case content could not be loaded.' };
  }
}
```

**Rule:** Only repositories fetch or parse browser-served content. Callers receive validated domain objects or a `Result` failure.

### Consistency Rules

| Pattern | Convention | Enforcement |
|---|---|---|
| Player interaction | Normalize every scene gesture to a typed store action | Test that scene intents produce the expected authoritative state |
| Scientific results | Pure deterministic function + versioned run record | Unit fixtures and schema validation |
| Completion/review | Pure evaluator from definition and progress | Test every missing-evidence combination |
| Phaser lifecycle | Renderer factory owns create/update/destroy | Integration-test scene cleanup |
| Case content | Repository validates at the boundary | Reject invalid JSON before domain use |
| Side effects | Typed event after successful transition | Test action → event → adapter behavior |
| Dependencies | Constructor injection | Review rule: no global mutable service state |

## Architecture Validation

### Architecture Summary

Quantique is a static, desktop-first web game built with Phaser 4.2.1, TypeScript, and Vite 8.1.x. Phaser scenes are the sole interactive presentation surface (a scripted library → colleagues → lab → theory board → debrief flow); a lightweight TypeScript store and pure domain layer remain authoritative for evidence, conclusions, and persistence.

The architecture is offline-first: validated case JSON and case-scoped static assets load through repositories and Phaser; IndexedDB stores player progress; JSON export/import and CSS printing preserve learner records without accounts, telemetry, or a critical-play network dependency.

### Validation Summary

| Check | Result | Notes |
|---|---|---|
| Decision compatibility | PASS | Phaser, semantic HTML, store-mediated adapters, IndexedDB, and data-driven cases have compatible boundaries |
| GDD coverage | PASS | All core mechanics, accessibility requirements, local/offline behavior, and Young-slice constraints have architectural support |
| Pattern completeness | PASS | Communication, creation, state, data access, errors, events, persistence, and novel evidence patterns are defined |
| Epic mapping | PASS | Foundation through classroom release readiness map to domains, adapters, content, and test layers |
| Document completeness | PASS | Engine/version, starter, decisions, structure, naming, cross-cutting rules, examples, and validation are present |

### Coverage Report

**Systems Covered:** 12/12  
**Patterns Defined:** 10 standard and novel patterns  
**Decisions Made:** 14

### GDD Coverage

| Requirement | Architecture Support | Status |
|---|---|---|
| Guided scenarized flow through Phaser scenes | SceneRouter maps phase → scene per `scenarioScript` | PASS |
| Colleague prediction/conclusion choice + rival-lab critique | Case-data proposals with `supportPredicate`; evaluator returns defensible IDs | PASS |
| Equivalent pointer, keyboard, and touch outcomes | ~~Dual-surface typed intents~~ | **De-scoped (post-MVP)** — accessibility dropped from MVP (ADR-008) |
| Non-canvas-only accessibility | ~~Semantic UI authority, axe checks~~ | **De-scoped (post-MVP)** — accessibility dropped from MVP (ADR-008) |
| 60 FPS at 1280×720 | Phaser renderer boundary, case-scoped bundles, profiling/debug counters | PASS |
| Cached launch and offline reload | Static hosted assets, boot shell, IndexedDB persistence, offline-reload E2E coverage | PASS |
| Measurement notebook and comparison | Evidence domain, immutable run records, notebook UI | PASS |
| Evidence-gated conclusion and revision | Pure conclusion evaluator, theory domain, peer-review rules | PASS |
| Source and rights provenance | Source domain, versioned case content, reviewer documentation location | PASS |
| Reusable second-case authoring | Validated case definitions, content repository, case-scoped asset manifests | PASS |
| No account, analytics, or network blocker | Static deployment; local-only logging and persistence | PASS |
| Export/import and printable record | Validated JSON adapters and CSS print view | PASS |

### Test and Release Readiness

- **Static hosted web application** is the chosen MVP release target. Downloadable/offline packaging is explicitly deferred.
- **Vitest 4.1.10** covers pure domain, reducer, schema, migration, and scientific-calculation tests.
- **Playwright 1.61.1** covers Chromium, Firefox, and WebKit end-to-end flows: the full Young scene flow (library → colleagues → lab → theory board → debrief), conclusion choice + rival-lab revision, import/export, and offline reload.
- **axe-core/Playwright 4.12.1** and manual accessibility acceptance are **de-scoped from the MVP** (ADR-008). Retain a basic no-flashing/photosensitivity check on the Phaser scenes. Domain-level Vitest coverage of the evaluator (significant-measure gate, defensible-conclusion selection) remains required.
- Vite is tracked on its current supported 8.1 line; the project lockfile will pin the exact patch installed by the official starter generator.

### Issues Resolved

- Chose a static hosted web MVP release target.
- Chose a layered automated test stack with explicit browser and accessibility coverage.
- Added a concise architecture summary and a cache/offline verification path.

## Development Environment

### Prerequisites

- Node.js 20.18.1 or later
- npm
- A current desktop browser for development; Playwright-managed Chromium, Firefox, and WebKit for automated tests
- Access to browser developer tools for performance and accessibility verification

### AI Tooling

| MCP Server | Purpose | Install Type |
|---|---|---|
| Context7 (`@upstash/context7-mcp`) | Retrieves current Phaser, Vite, and library documentation for AI-assisted development | Node.js MCP server |

Configure the MCP client to run:

```bash
npx -y @upstash/context7-mcp
```

An API key is optional for higher rate limits. Context7 is documentation-only; it does not inspect or mutate the game project.

### Setup Commands

```bash
npm create @phaserjs/game@latest
# Select the official Vite + TypeScript template.

npm install idb@8.0.3 zod@4.4.3
npm install -D vitest@4.1.10 @playwright/test@1.61.1 @axe-core/playwright@4.12.1
npx playwright install
```

### First Steps

1. Generate the official Phaser Vite + TypeScript project and commit the generated lockfile to pin the exact Vite patch.
2. Create the approved directory structure, then implement `src/core/store/`, `src/schemas/`, and `src/domain/apparatus/` before presentation layers.
3. Configure Context7 for current API lookups and add the Vitest/Playwright/axe test commands.
4. Build the Young case as the validation slice: stand up the SceneRouter and the scene flow (reuse `LectureBookRenderer` as the LibraryScene and the existing LaboratoryScene), then wire the colleague prediction/conclusion proposals, the significant-measure gate, and the rival-lab critique through the extended evidence-to-conclusion evaluator.
