# Story 1.10: Scene router and adventure flow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the case to move me through its scenes in a scripted order,
so that the investigation plays as a guided adventure rather than a free-form workspace.

## Acceptance Criteria

Verbatim from `epics.md` (Story 1.10), numbered for traceability:

1. **Given** a case definition with a `scenarioScript` (ordered scenes and dialogue beats),
   **When** the case loads,
   **Then** a `SceneRouter` maps the authoritative case phase (`context → prediction → experiment → synthesis → review → debrief`) to the corresponding Phaser scene,
   **And** a scene transition mirrors the phase; it never defines or advances the phase itself.

2. **Given** the store transitions the case phase through a typed domain action,
   **When** the router observes the new phase,
   **Then** it activates the matching scene and cleans up the previous scene's subscriptions and display objects,
   **And** an interrupted or reloaded session restores to the scene matching the persisted phase.

3. **Given** the scene flow,
   **When** tests run,
   **Then** unit tests cover the phase→scene mapping,
   **And** an E2E test walks the full Young scene sequence end to end.

## Scope and implementation decisions

This is the **first pivot-implementation story**: the codebase today is still the pre-pivot dual-surface build (DOM panels are authoritative in `src/main.ts`; the only Phaser scene is `LaboratoryScene`). Story 1.10 introduces the **routing mechanism and the multi-scene shell** — not the rich content of each scene. Keep this boundary sharp:

- **IN scope (1.10):**
  - A `SceneRouter` that reads the authoritative phase from the store, resolves the target scene **from the case's `scenarioScript`** (content-driven, per ADR-009), activates it, stops/cleans up the previous scene, and does so **from the initial (possibly persisted) phase** at boot.
  - Add a minimal, forward-compatible `scenarioScript` to the `CaseDefinition` type, the Zod `CaseDefinitionSchema`, and the Young `case.json`.
  - Register a multi-scene Phaser game: reuse the existing `LaboratoryScene` for `experiment`; add **minimal placeholder scenes** `LibraryScene`, `ColleaguesScene`, `TheoryBoardScene`, `DebriefScene`. Placeholders render their phase label and nothing more; their real content is later stories.
  - Wire the router into the app bootstrap so the routed Phaser game is the surface whose active scene follows the phase.
  - Unit tests for the phase→scene resolution and router activation/cleanup; an E2E test asserting the active scene follows the phase across the full Young sequence.

- **OUT of scope (later stories — do NOT build here):**
  - Real scene content and in-scene controls: **LibraryScene** reference reading (Story 2.1), **ColleaguesScene** prediction proposals + **colleague cast/proposal system** (Story 1.11), **TheoryBoardScene** conclusion-proposal choice (Story 1.6 rework / 2.3), Phaser **dialogue & choice widgets** (Story 1.12), **RivalLabScene** critique (Story 2.5), significant-measure gate + colleague hints (Story 2.3 / 2.6).
  - **Retiring the `src/ui/*` DOM panels.** They are retired incrementally as each scene reaches parity in the stories above. In 1.10 the DOM panels **remain** and continue to be how phase gates are satisfied; the E2E advances the flow through those existing controls and asserts the router's scene-follows-phase behavior. Do not delete DOM panels or reimplement their interactions in placeholder scenes.
  - `BootScene` / `CaseLoadScene` from the architecture's target tree — case loading already happens in `src/main.ts` before the game starts; keep that and defer those scenes.

- **Decision — `synthesis` phase → scene (the one genuinely ambiguous mapping).** The architecture enumerates five scenes for six phases (library, colleagues, laboratory, theory board, debrief); `synthesis` (the "conclusion-unlock gate / colleague hints" moment) has no dedicated scene. **Default: map `synthesis → TheoryBoardScene`** (it will render the locked/hints state before `review` unlocks the conclusion choice). This keeps the conclusion flow in one scene and gives the router a **total, deterministic** map. Flagged for confirmation in Open Questions — the significant-measure-gate story (2.3/2.6) may prefer `synthesis → LaboratoryScene`. Because the mapping is content-driven via `scenarioScript`, changing it later is a one-line content edit, not a code change.

- **Decision — router is content-driven, not a hardcoded switch.** Per ADR-009 the router resolves phase→scene **from `scenarioScript`**. A `scenarioScript` that does not cover all six phases is rejected at load by Zod (typed `Result` failure), so the map is always total. Unit tests assert both the resolution and the schema rejection.

## Tasks / Subtasks

- [ ] **Task 1 — Add `scenarioScript` to the content contract (AC: 1)**
  - [ ] Extend `CaseDefinition` (`src/domain/cases/CaseDefinition.ts`) with `scenarioScript`. Minimal shape: `{ scenes: readonly { phase: CasePhase; sceneKey: SceneKey }[] }`. Add a `SceneKey` union: `'Library' | 'Colleagues' | 'Laboratory' | 'TheoryBoard' | 'Debrief'`. Leave a place (optional `dialogueBeats?`) for Story 1.11 without requiring it now.
  - [ ] Extend `CaseDefinitionSchema` (`src/schemas/CaseDefinitionSchema.ts`): a `.strict()` object; `phase` from the `CasePhase` enum, `sceneKey` from the `SceneKey` enum. Add a `superRefine` that rejects the script unless it covers **all six** phases **exactly once** (mirror the existing validation style, e.g. `PrimaryControlSchema`).
  - [ ] Add the `scenarioScript` block to `public/cases/young-interference/case.json` with the mapping from the decision above (`context→Library`, `prediction→Colleagues`, `experiment→Laboratory`, `synthesis→TheoryBoard`, `review→TheoryBoard`, `debrief→Debrief`). Keep `dist/` untouched (build output).
  - [ ] Unit test in `tests/unit/CaseDefinition.test.ts` (or a new `ScenarioScript.test.ts`): valid script parses; a script missing a phase, duplicating a phase, or using an unknown `sceneKey` is rejected.

- [ ] **Task 2 — SceneRouter phase→scene resolution (AC: 1, 3)**
  - [ ] Create `src/adapters/phaser/SceneRouter.ts`. Export a pure resolver `resolveSceneKey(scenarioScript, phase): SceneKey` (no Phaser import) so it is trivially unit-testable.
  - [ ] Unit test `tests/unit/SceneRouter.test.ts`: every `CasePhase` resolves to the `scenarioScript`'s `sceneKey`; the resolution is total over all six phases.

- [ ] **Task 3 — Placeholder scenes + multi-scene game (AC: 1, 2)**
  - [ ] Add minimal scene classes under `src/adapters/phaser/scenes/`: `LibraryScene`, `ColleaguesScene`, `TheoryBoardScene`, `DebriefScene`. Each extends `Phaser.Scene`, keys itself with its `SceneKey`, and in `create()` renders only a phase label (placeholder). Follow the existing `LaboratoryScene` lifecycle pattern: register `this.events.once('shutdown', ...)` and free anything created. Keep `LaboratoryScene` as-is for `experiment`.
  - [ ] Update the Phaser game factory (`src/game/main.ts`, currently `StartGame`) to register **all** phase scenes as **non-auto-starting** (do not rely on Phaser's default first-scene auto-start), so the router owns the initial start. Preserve the existing `onLectureBookReady` wiring for `LaboratoryScene`.

- [ ] **Task 4 — Router activation, cleanup, and reload restore (AC: 2)**
  - [ ] In `SceneRouter.ts` add the controller: `createSceneRouter(game, store, scenarioScript)`. On init it starts the scene for the **current** store phase (this satisfies reload-restore, since the persisted phase is already in the initial state — see `createAppStateFromCaseRecord`). It `store.subscribe(...)`s; when the resolved `sceneKey` differs from the active one, it `scene.stop(prev)` then `scene.start(next)`, relying on each scene's `shutdown` to release subscriptions/objects. Guard against redundant restarts (same phase / same scene) and against starting a scene that is already active.
  - [ ] Return an unsubscribe/dispose handle; ensure the router's own store subscription is torn down on dispose.
  - [ ] Integration test `tests/integration/SceneRouter.test.ts`: drive the store through `case.phaseAdvance` actions and assert the router starts the matching scene and stops the previous one, and that a store initialized at a non-`context` phase starts that phase's scene first (reload-restore). Use a Phaser stub/mock for `scene.start`/`scene.stop` if a headless Phaser game is impractical in Vitest (see Testing notes).

- [ ] **Task 5 — Wire the router into bootstrap (AC: 1, 2)**
  - [ ] In `src/main.ts`, after the store and game are created, construct the `SceneRouter` with the loaded `caseDefinition.scenarioScript`. The Phaser game becomes the routed surface. Do **not** remove the DOM panel mounts in this story (scope boundary).

- [ ] **Task 6 — E2E walk of the Young scene sequence (AC: 3)**
  - [ ] Add `tests/e2e/scene-router.spec.ts`: from `/`, advance the case through the full Young flow using the existing on-page controls (as the current `young-experiment` / `theory-board` E2E specs do), and at each phase assert the correct Phaser scene is active. Expose the active scene key for assertions via a stable, test-only signal (e.g. the router sets `data-active-scene` on `#game-container`, or emits a `scene.transition` on a known emitter). Prefer a DOM data-attribute so Playwright can assert without reaching into Phaser internals.
  - [ ] Keep it a `chromium`-only spec (matches `npm run test:e2e`); it need not be part of the cross-browser matrix for this story.

- [ ] **Task 7 — Verify (AC: 1–3)**
  - [ ] `npm run typecheck`, `npm run test` (unit + integration), and `npm run test:e2e` all pass. Confirm no existing spec regressed (the DOM flow and existing scenes still work).

## Dev Notes

### Current implementation: preserve and extend

Read these before writing code — they are the exact surfaces 1.10 touches:

- **Phase machine is authoritative and pure.** `src/domain/cases/caseReducer.ts` defines `NEXT_CASE_PHASE` (`context → prediction → experiment → synthesis → review → debrief`, terminal at `debrief`). `CasePhase` lives in `src/domain/cases/CaseProgress.ts`. Phase only changes through domain actions (`case.phaseAdvance`, `case.debriefCompleted`, `case.replayStarted`). **The router must never dispatch phase changes or infer phase from scene state** (ADR-001, ADR-009, and the State-Pattern rule "A Phaser scene transition mirrors the resulting phase; it never defines it").
- **Reading the phase.** `selectCasePhase(state)` in `src/core/store/selectors.ts` returns the current phase. Subscribe via `store.subscribe(listener)` (fires on every transition); read `store.getState()` inside the listener (see `LaboratoryScene.create`).
- **Reload restore is already handled by the store.** `createAppStateFromCaseRecord` (`src/core/store/AppState.ts`) sets `phase: record.phase` from persisted progress; `src/main.ts` restores saved records before `createStore`. So AC2's "restore to the scene matching the persisted phase" requires only that the router **start from the current store phase at init** rather than assuming `context`. No new persistence work.
- **Scene lifecycle / cleanup pattern to copy.** `src/adapters/phaser/scenes/LaboratoryScene.ts` is the reference: it stores `unsubscribe`, registers `this.events.once('shutdown', this.shutdown, this)`, and in `shutdown()` calls `unsubscribe()` and destroys renderers. Placeholder scenes and the router's stop/start must preserve this so no subscription or display object leaks across transitions (Consistency Rule: "Phaser lifecycle — Renderer factory owns create/update/destroy; Integration-test scene cleanup").
- **Store→Phaser bridge.** `src/adapters/phaser/PhaserStoreAdapter.ts` is the read/dispatch bridge scenes use; scenes never touch state directly. The router only needs `getState` + `subscribe`; it dispatches nothing.
- **Game factory today.** `src/game/main.ts` `StartGame(parent, store, onLectureBookReady)` builds a `new Game({... scene: [new LaboratoryScene(store, onLectureBookReady)] })` at 1024×768, `Scale.FIT`. Extend the `scene` array to register all phase scenes as non-auto-starting; keep the config otherwise unchanged.
- **Bootstrap today.** `src/main.ts` loads the case (`loadCaseDefinition('young-interference')`), restores/creates state, `createStore`, mounts DOM panels, then `StartGame(...)`. Add the router construction after `StartGame`, passing `caseResult.value.scenarioScript`.
- **Content contract shape.** `CaseDefinition` (`src/domain/cases/CaseDefinition.ts`) is a `Readonly<{...}>`; the matching `CaseDefinitionSchema` (`src/schemas/CaseDefinitionSchema.ts`) is composed of `.strict()` `z.object`s with `superRefine` for cross-field rules. Add `scenarioScript` to **both** and to `case.json`, keeping the type and schema in lockstep (the loader `loadCaseDefinition.ts` parses with `CaseDefinitionSchema.safeParse` and returns a typed `Result`).

### Architecture compliance (must follow)

- **ADR-001 (revised v1.1):** one authoritative store; Phaser scenes are the sole *interactive* presentation surface and dispatch typed intents; no direct state mutation from scenes. (DOM panels are being retired across later stories; not this one.)
- **ADR-009 (new v1.1):** "A single `SceneRouter` maps the authoritative case phase to the active Phaser scene per the case's `scenarioScript`; scenes mirror phase, never define it." This story *is* ADR-009.
- **Directory placement:** `src/adapters/phaser/SceneRouter.ts` and scenes under `src/adapters/phaser/scenes/` (matches both the architecture target tree and the existing `src/adapters/phaser/` layout). Naming: `PascalCase.ts` for classes/scenes.
- **Purity:** keep `src/domain/` free of Phaser/DOM. The `scenarioScript` *type* lives in the pure domain (`CaseDefinition.ts`), but `SceneKey` is content/router vocabulary — defining it alongside `CaseDefinition` is acceptable since it is plain data, but do not import Phaser into the domain. The router (which imports Phaser) lives in the adapter layer.

### Project Structure Notes

- **Naming drift (architecture vs. current code):** the architecture target tree shows `src/app/`, `src/adapters/phaser/createPhaserGame.ts`, `BootScene`, `CaseLoadScene`. The current code uses `src/main.ts` (bootstrap) + `src/game/main.ts` (`StartGame`) and has no `src/app/`. **Do not restructure the app for 1.10.** Add `SceneRouter.ts` under the existing `src/adapters/phaser/`, extend the existing `StartGame` factory in place, and wire from the existing `src/main.ts`. A larger app-layout alignment (introducing `createPhaserGame.ts` / `src/app/`) is not this story's job; note any divergence you leave behind in the Dev Agent Record.
- **`dist/` is build output** — edit only `public/cases/young-interference/case.json`; `dist/` is regenerated by `npm run build`.
- **Ignore `.claude/worktrees/**`** — a stale worktree copy of the case content exists there; it is not the active source.

### Testing standards

- **Runners:** Vitest for `tests/unit/**` and `tests/integration/**` (`npm run test`); Playwright for `tests/e2e/**` (`npm run test:e2e`, chromium-only by default; the E2E web server runs `npm run build && npm run preview` on `127.0.0.1:4173`).
- **Test the public surface, not renderer internals** (architecture Consistency Rules). For the router: assert phase→scene resolution (pure), and that a phase transition drives `scene.start`/`scene.stop` (integration), and that the active scene follows the phase through a real flow (E2E).
- **Phaser in Vitest:** Vitest runs in Node without a canvas, so instantiating a real `Phaser.Game` in unit/integration tests is fragile. Keep `resolveSceneKey` a **pure function** (no Phaser) for the unit test. For the router integration test, inject a **minimal fake** of the Phaser scene-manager surface the router uses (`{ start, stop, isActive/getScenes }`) plus a real `createStore`, and assert calls — this mirrors the constructor-injection convention and avoids a headless-canvas dependency. Do not add jsdom/canvas shims for this.
- **E2E active-scene signal:** expose the active scene key through a stable DOM hook (recommended: router writes `data-active-scene="<SceneKey>"` on the `#game-container` element on each activation) so Playwright asserts via `getByTestId`/attribute rather than Phaser internals. Model the flow-advancing steps on the existing `tests/e2e/young-experiment.spec.ts`, `tests/e2e/theory-board.spec.ts`, and `tests/e2e/youngExperimentHelpers.ts`.
- Existing specs that must still pass unchanged: `validation-route`, `young-experiment`, `theory-board`, `context-prediction`, `offline-reload`, etc. The router is additive.

### Internationalization note (foundation ordering)

Per the pivot (NFR19 / ADR-010) and `sprint-status.yaml`, **Story 1.1b (EN+FR i18n foundation) is sequenced before scene text** and is still `backlog`. Story 1.10's placeholder scenes should carry **no meaningful player-facing copy** (a phase label placeholder is fine and will be replaced). Do **not** hard-code localized strings in scenes here; real scene text arrives after 1.1b and through 1.11/1.12. If a label is unavoidable, keep it a neutral placeholder clearly marked for replacement.

### Project context rules

No `project-context.md` exists in this repo (the persistent-fact glob resolved empty), so there are no additional project-wide rule overrides beyond the architecture and epics cited here.

### Previous-story intelligence and git patterns

- Recent commits are all Phaser reference-book work: `Change course`, `Improve Animation`, `Improve reference`, `add local Opticks archive book`, `animate Phaser lecture book`, `route Phaser book controls through scene input`, `refresh Phaser input bounds on scroll`. Takeaways that matter for 1.10:
  - The `LaboratoryScene` already learned two Phaser gotchas worth preserving in new scenes: **canvas input bounds go stale on document scroll** (it listens to `window` `scroll` and calls `this.scale.updateBounds()`), and **book controls must route through scene input** rather than DOM. Placeholder scenes have no input yet, but reuse the `LaboratoryScene` cleanup discipline.
  - `LectureBookRenderer` is the reference-reading renderer the future **LibraryScene** will reuse (architecture §"Build the Young case…"). Not needed for the 1.10 placeholder, but name the placeholder `LibraryScene` so 2.1 fills it in without a rename.
- No prior story file covers routing; the closest patterns are the store/scene wiring in `1-3` (dual-surface controls) and the persistence/restore behavior in `1-8`.

### Traceability note

Story 1.10 covers **FR17** (Young slit/screen ranges — *the epics FR-coverage map assigns FR17 to 1.10, but the actual apparatus ranges are authored/enforced in `calculateYoungFringeSpacing` + `ApparatusControl` and exercised by Story 2.2*) and **FR28** (quiet audio with captions/independent volume). Neither FR is materially advanced by the routing mechanism. Treat the FR17/FR28 assignments as *the scene flow that will host* those behaviors rather than work items for this story; audio (FR28) is not built here. Flagged in Open Questions.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.10: Scene router and adventure flow] — ACs (verbatim).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.11 / 1.12] — adjacent pivot stories that supply scene content (colleague/proposal system; dialogue & choice UI).
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-05.md#2.1] — guided-adventure step ↔ phase ↔ gate table (the routing intent).
- [Source: _bmad-output/game-architecture.md#User Interface & Rendering Boundary (§203–205)] — SceneRouter maps phase→scene per `scenarioScript`; scenes mirror phase.
- [Source: _bmad-output/game-architecture.md#ADR-001, ADR-009, ADR-010] — single Phaser surface; scene-router adventure flow; i18n foundation.
- [Source: _bmad-output/game-architecture.md#Directory structure (§388–392) & System Location Mapping] — `src/adapters/phaser/SceneRouter.ts`, scenes list, retirement of `src/ui/*`.
- [Source: _bmad-output/game-architecture.md#Content Model (§194–195)] — `scenarioScript` and `rivalLabCritiques[]` as new `CaseDefinition` fields.
- [Source: src/domain/cases/caseReducer.ts] — phase machine (`NEXT_CASE_PHASE`).
- [Source: src/domain/cases/CaseProgress.ts] — `CasePhase` union.
- [Source: src/core/store/selectors.ts#selectCasePhase] — phase read.
- [Source: src/core/store/AppState.ts#createAppStateFromCaseRecord] — persisted-phase restore.
- [Source: src/adapters/phaser/scenes/LaboratoryScene.ts] — scene lifecycle/cleanup reference.
- [Source: src/game/main.ts, src/main.ts] — game factory and bootstrap to extend.
- [Source: src/domain/cases/CaseDefinition.ts, src/schemas/CaseDefinitionSchema.ts, public/cases/young-interference/case.json] — content contract to extend with `scenarioScript`.
- [Source: tests/e2e/young-experiment.spec.ts, tests/e2e/theory-board.spec.ts, tests/e2e/youngExperimentHelpers.ts] — E2E flow-advancing patterns to reuse.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date       | Version | Description                              | Author |
|------------|---------|------------------------------------------|--------|
| 2026-08-05 | 0.1     | Initial story draft created (gds-create-story) | Alexis |

## Open Questions (for author confirmation — do not block dev)

1. **`synthesis` → scene mapping.** Defaulted to `TheoryBoardScene` (locked/hints state). The significant-measure-gate story (2.3/2.6) may prefer `synthesis → LaboratoryScene` (stay in the lab to gather more significant measures). Because it is content-driven in `scenarioScript`, confirm the intended scene and adjust one line in `case.json` if needed.
2. **`scenarioScript` shape vs. Story 1.11/3.4.** 1.10 adds a **minimal** `scenarioScript` (per-phase `sceneKey` only). Story 1.11 (colleague cast) and 3.4 (scenario/dialogue authoring) will add `dialogueBeats`, `colleagues[]`, and proposal content. Confirm the minimal `{ scenes: [{ phase, sceneKey }] }` shape is acceptable as the foundation the later stories extend (vs. defining the full dialogue-beat schema now).
3. **FR17/FR28 traceability.** The epics FR-coverage map assigns FR17 (apparatus ranges) and FR28 (captioned audio) to Story 1.10, but neither is a routing concern (FR17 lives in the experiment model/Story 2.2; FR28 audio is unbuilt). Confirm these FR assignments are the *host scene flow* intent, not deliverables of 1.10, or re-map them in `epics.md`.
4. **DOM-panel retirement timing.** 1.10 keeps the DOM panels and routes alongside them (E2E advances via existing controls). Confirm retirement stays deferred to the per-scene rework stories (2.1 Library, 1.11 Colleagues, 1.6-rework/2.3 Theory Board, 1.12 dialogue/choice) rather than starting here.
