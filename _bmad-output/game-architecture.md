---
title: 'Game Architecture'
project: 'Quantique'
date: '2026-08-04'
author: 'Alexis'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
engine: 'Phaser 4.2.1'
platform: 'Desktop web browsers'

# Source Documents
gdd: '/Users/akartmann/Documents/Projects/Quantique/_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md'
epics: '/Users/akartmann/Documents/Projects/Quantique/_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/epics.md'
brief: '/Users/akartmann/Documents/Projects/Quantique/_bmad-output/planning-artifacts/briefs/brief-Quantique-2026-08-04/brief.md'
---

# Game Architecture

## Executive Summary

**Fracture of Certainty: Cases from the Quantum Age** is a desktop-web historical-science investigation game built with Phaser 4.2.1, TypeScript, and Vite. Phaser delivers the tactile laboratory renderer; semantic HTML and a lightweight TypeScript store remain authoritative for accessible controls, evidence, conclusions, and local progress.

**Key Architectural Decisions:**

- Use a store-mediated boundary between Phaser and semantic HTML, with equivalent typed interaction intents.
- Keep case content as versioned JSON validated by Zod; use deterministic, versioned experiment records and an evidence-to-conclusion evaluator.
- Persist offline in IndexedDB, support JSON export/import and CSS printing, and release as a static hosted web application without accounts, telemetry, or a network-critical play path.

**Project Structure:** Domain-driven hybrid organization with dedicated domains for cases, apparatus, evidence, sources, theory, review, and recognition.

**Implementation Patterns:** Dual-surface interaction, evidence-to-conclusion gating, deterministic experiment records, typed actions/events, renderer factories, finite case phases, and validated repositories ensure consistent AI-agent implementation.

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
- All essential lab controls and scientific results require semantic HTML alternatives; canvas cannot be the sole interface.
- Pointer, keyboard, and touch paths must lead to equivalent outcomes.
- Data must support reusable authored cases without duplicating the core evidence loop.
- Local export/import or printable case records are required.

### Complexity Drivers

- The game needs two coordinated UI layers: Phaser for tactile visual laboratory presentation, and semantic HTML for accessible controls, readouts, notes, and conclusions.
- Experiment outputs must be authored and inspectable while remaining scientifically legible—not an unconstrained physics sandbox.
- Evidence, sources, observations, claims, limitations, feedback, and recognition must persist as a coherent decision history.
- Dialogue and consultation need to react to evidence state but converge on fixed, historically bounded outcomes.
- Historical provenance and asset rights need first-class case data, auditability, and release gates.
- The reusable framework must prove itself with a second-case spike before campaign-scale production.

### Technical Risks

- Phaser accessibility validation is a hard Young-slice gate; a canvas-led implementation could fail input equivalence or screen-reader requirements.
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
| Input | Phaser pointer, touch, keyboard APIs | Used for optional/direct lab manipulation; semantic HTML provides equivalent essential controls |
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
- Specify accessibility behavior, keyboard support, focus management, announcements, and non-colour visual encoding.
- Define automated and manual test layers, including cross-browser, offline, performance, and accessibility gates.
- Define production/deployment, cache, and no-network-critical-play behavior.

## Architectural Decisions

### Decision Summary

| Category | Decision | Version | Rationale |
|---|---|---:|---|
| Application state | Lightweight TypeScript store with immutable updates and subscriptions | Project-owned | One testable source of truth across UI, Phaser, and persistence |
| UI/render boundary | Store-mediated typed adapters | Project-owned | Prevents Phaser and semantic HTML from directly mutating each other |
| Persistence | IndexedDB through `idb` | 8.0.3 | Offline-first structured local records with explicit migrations |
| Content validation | JSON case definitions validated by Zod | 4.4.3 | Reusable, inspectable cases with safe loading and authoring errors |
| UI | Vanilla TypeScript DOM components | Platform APIs | Semantic accessible controls, notes, and conclusions without framework overhead |
| Asset loading | Boot shell then case-scoped bundles | Phaser Loader | Fast first interaction and clean campaign-scale boundaries |
| Experiment model | Deterministic authored calculations | Project-owned | Scientific behavior is inspectable and reproducible; no runtime physics required |
| Dialogue and peer review | Data-driven rules and predicates | Project-owned | Evidence-responsive but historically convergent content |
| Export/import | Versioned JSON plus CSS print view | Platform APIs | Offline backup, classroom printing, and no account requirement |
| Networking | None | N/A | No multiplayer, cloud dependency, or critical-play network requirement |
| Audio | Phaser native audio | Phaser 4.2.1 | Sufficient for restrained music and tactile feedback |
| Physics | None by default | N/A | The apparatus is a visual/interaction model, not a physics sandbox |

### State Management

**Approach:** A lightweight TypeScript store is the authoritative application state. It exposes read-only state, typed intent dispatch, and subscriptions. State changes are pure, immutable transitions; side effects—save, asset request, audio playback, or scene command—run through explicit adapters.

Phaser scenes render projections of store state and send interaction intents. Semantic DOM components do the same. Neither layer directly changes the other’s objects or state.

### Data Persistence

**Save System:** IndexedDB via `idb` 8.0.3.

Persist versioned records for settings, case progress, runs, observations, inspected sources, theory-board links, peer-review history, and recognition. Database migrations and imported-record migrations are explicit and tested. Failed save or import validation leaves the last valid local state intact.

### Content Model

**Approach:** Versioned JSON case definitions, validated at load time with Zod 4.4.3.

A case definition owns its apparatus controls, allowed values, deterministic experiment rules, sources and provenance, evidence prerequisites, dialogue/consultation rules, peer-review conditions, debrief material, and asset manifest. Runtime state stores only player decisions and generated observations; it never mutates the shipped case definition.

### User Interface and Rendering Boundary

Semantic HTML is authoritative for essential controls, measured values, instructions, notebook, theory board, source records, conclusion entry, and announcements. Phaser renders the laboratory tableau, apparatus animation, spatial visual output, non-essential direct manipulation, and theatrical transitions.

Adapters map store state into each layer and normalize pointer, keyboard, touch, and DOM controls into the same typed intents. All essential Phaser interactions must have an equivalent semantic control path.

### Asset Management

**Loading Strategy:** Load a minimal boot shell first, then a declared asset bundle for the selected case.

The boot shell includes only the application frame, accessibility UI, loading feedback, and minimum launch assets. Each case manifest declares the images, audio, fonts, and source media needed before its lab begins. Phaser’s loader owns visual/audio loading; the application reports progress semantically and never leaves a critical control unavailable without explanation.

### Dialogue and Peer Review

Consultations and review feedback are case data: predicates inspect the authoritative evidence state and select prompts, missing-evidence guidance, alternative-test suggestions, or bounded feedback. Rules can vary lines and guidance but cannot change a case’s historical outcome or bypass required observations, sources, and limitations.

### Export and Print

Export a validated, versioned JSON case record. Import validates against the current schema and runs migrations before replacing or merging local data. A dedicated semantic print view, styled with CSS, presents settings, observations, sources, comparison notes, conclusion, and stated limitations.

### Architecture Decision Records

- **ADR-001 — Store-mediated HTML/Phaser integration:** Maintain one authoritative state and typed adapters; prohibit direct cross-layer mutation.
- **ADR-002 — Offline local persistence:** IndexedDB is the local primary store; no cloud-save or network dependency is introduced.
- **ADR-003 — Validated data-driven cases:** Case content is versioned JSON validated at runtime; core logic is reusable across cases.
- **ADR-004 — Deterministic experiment model:** Produce reproducible, inspectable results through authored calculation rules rather than physics simulation.
- **ADR-005 — Case-scoped loading:** Start with a minimal shell and load complete case bundles before laboratory play.
- **ADR-006 — Evidence-driven narrative rules:** Use data predicates for consultations and review while preserving fact-bound outcomes.
- **ADR-007 — Portable learner records:** Support validated JSON export/import and semantic CSS printing.

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
- Player settings store accessibility, audio, display, and input preferences.
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
│   │   │   ├── {createPhaserGame.ts,PhaserStoreAdapter.ts}
│   │   │   ├── scenes/{BootScene.ts,CaseLoadScene.ts,LaboratoryScene.ts,DebriefScene.ts}
│   │   │   └── renderers/{ApparatusRenderer.ts,ExperimentOutputRenderer.ts}
│   │   └── dom/{DomStoreAdapter.ts,announcements.ts,focusManagement.ts}
│   ├── ui/
│   │   ├── shell/{ApplicationShell.ts,CaseLayout.ts}
│   │   ├── apparatus/ApparatusControls.ts
│   │   ├── notebook/{NotebookPanel.ts,RunComparison.ts}
│   │   ├── theory/TheoryBoardPanel.ts
│   │   ├── sources/CuratedRecordPanel.ts
│   │   ├── review/ConclusionReviewPanel.ts
│   │   ├── settings/AccessibilitySettings.ts
│   │   └── print/CaseRecordPrintView.ts
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
| Notebook and evidence | `src/domain/evidence/`, `src/ui/notebook/` | Runs, observations, comparisons, semantic display |
| Sources and provenance | `src/domain/sources/`, `src/ui/sources/` | Source state and rights/provenance presentation |
| Theory board and conclusion | `src/domain/theory/`, `src/ui/theory/` | Claim validation and player reasoning |
| Consultations and review | `src/domain/review/`, `src/ui/review/` | Predicate-driven guidance and feedback |
| Browser persistence | `src/adapters/persistence/` | IndexedDB operations and migrations |
| Export, import, print | `src/adapters/export/`, `src/ui/print/` | Portable records and classroom print view |
| Phaser rendering | `src/adapters/phaser/` | Scenes, renderers, asset loading, direct manipulation |
| Semantic UI/accessibility | `src/ui/`, `src/adapters/dom/` | HTML controls, focus, announcements, accessible status |
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
- `ui/` and `adapters/phaser/` read state through selectors and dispatch typed actions; neither mutates state or the other layer directly.
- `adapters/` implement side effects and may depend inward on `domain/` and `core/`; domain code never imports adapters.
- `public/cases/` is authored immutable content, not a place for player progress.
- Zod validation happens at all content/import boundaries before data reaches domain logic.
- All tests use public actions and selectors, never private renderer state.

## Implementation Patterns

These patterns are mandatory for all AI-agent implementations.

### Novel Patterns

#### Dual-Surface Interaction

**Purpose:** Ensure a semantic HTML control and an equivalent Phaser gesture produce exactly the same state change.

```text
HTML control or Phaser gesture → typed intent → store reducer → state + domain events → both layers re-render
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

**Rule:** Neither DOM code nor Phaser code may update apparatus state directly. `origin` supports diagnostics only and cannot change results or progression.

#### Evidence-to-Conclusion Gate

**Purpose:** Make completion and peer-review feedback a pure, auditable result of evidence state rather than screen-specific logic.

```text
case definition + persisted evidence state → evaluator → readiness/missing requirements/feedback → theory board and review UI
```

```ts
function evaluateConclusionReadiness(
  definition: CaseDefinition,
  progress: CaseProgress,
): ConclusionReadiness {
  const missing: string[] = [];
  if (progress.runIds.length < definition.requirements.minimumRuns) missing.push('Record the required observations.');
  if (progress.inspectedSourceIds.length < definition.requirements.minimumSources) missing.push('Inspect the required contextual sources.');
  if (!progress.conclusion.limitation.trim()) missing.push('State one limitation or alternative explanation.');
  return missing.length === 0 ? { status: 'ready', missing: [] } : { status: 'incomplete', missing };
}
```

**Rule:** A case cannot infer completion from scene history or UI visibility. Only the evaluator determines readiness.

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
| Player interaction | Normalize to a typed store action | Test DOM and Phaser paths against identical state |
| Scientific results | Pure deterministic function + versioned run record | Unit fixtures and schema validation |
| Completion/review | Pure evaluator from definition and progress | Test every missing-evidence combination |
| Phaser lifecycle | Renderer factory owns create/update/destroy | Integration-test scene cleanup |
| Case content | Repository validates at the boundary | Reject invalid JSON before domain use |
| Side effects | Typed event after successful transition | Test action → event → adapter behavior |
| Dependencies | Constructor injection | Review rule: no global mutable service state |

## Architecture Validation

### Architecture Summary

Quantique is a static, desktop-first web game built with Phaser 4.2.1, TypeScript, and Vite 8.1.x. Phaser provides the tactile laboratory renderer; semantic HTML and a lightweight TypeScript store remain authoritative for accessible controls, evidence, conclusions, and persistence.

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
| Equivalent pointer, keyboard, and touch outcomes | Dual-surface typed intents and semantic DOM controls | PASS |
| Non-canvas-only accessibility | Semantic UI authority, focus/announcement adapters, axe checks | PASS |
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
- **Playwright 1.61.1** covers Chromium, Firefox, and WebKit end-to-end flows: Young completion, keyboard/pointer/touch parity, import/export, and offline reload.
- **axe-core/Playwright 4.12.1** runs automated semantic accessibility checks; manual acceptance remains required for screen-reader behavior, non-colour scientific encoding, and classroom-device usability.
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
4. Build the Young case as the validation slice, beginning with dual-surface slit-spacing and screen-distance controls, deterministic run records, and the evidence-to-conclusion gate.
