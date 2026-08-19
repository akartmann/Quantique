---
project_name: 'Quantique'
user_name: 'Alexis'
date: '2026-08-06'
revision: '2.4 — the case contract is shared, not Young-shaped'
supersedes: '2.1 (2026-08-06, playable Phaser surface); 2.0 (2026-08-05, Phaser guided adventure); 1.0 (2026-08-04, dual-surface accessibility-first)'
pivot_reference: 'planning-artifacts/sprint-change-proposal-2026-08-05.md'
correction_reference: 'planning-artifacts/sprint-change-proposal-2026-08-06.md'
sections_completed: ['technology_stack', 'engine_specific_rules', 'guided_adventure_rules', 'i18n_rules', 'performance_rules', 'organization_rules', 'testing_rules', 'platform_build_rules', 'critical_dont_miss_rules']
existing_patterns_found: 14
status: 'complete'
rule_count: 73
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns AI agents must follow when implementing game code here. Focus is on unobvious details agents would otherwise miss._

> **Read this before trusting any artifact dated before 2026-08-05.** The project pivoted from an accessibility-first dual-surface investigation tool to a **Phaser-only guided adventure**. Older GDD/UX/story text still asserts the retired contract (semantic HTML authority, DOM parity, a11y gates). This file and `game-architecture.md` v1.2 are current.
>
> **Correction of 2026-08-06 (revision 2.1).** The pivot's stories were verified against store contracts, not against canvas reachability, so nine of fourteen player intents shipped dispatchable **only** from the retired `src/ui/*` panels — and `LibraryScene` / `DebriefScene` remained placeholders while their owning stories were marked done. Epic 2 reopened with Stories 2.7–2.12. **ADR-011** (canvas intent completeness) and **ADR-012** (direct-manipulation instruments, player-started light) are the durable rules; both are stated in full below. Any story marked `done` before this date may have satisfied its acceptance criteria without delivering a canvas surface — check before building on it.

---

## Technology Stack & Versions

- **Engine:** Phaser 4.2.1 — the **sole interactive presentation surface**.
- **Language:** TypeScript ~5.7.2. **Build:** Vite 8.1.5 (`vite/config.dev.mjs`, `vite/config.prod.mjs`). Node.js 20.18.1+; the lockfile is committed to pin exact patches.
- **Entry point:** `src/main.ts` (boot shell + store wiring), which starts Phaser via `src/game/main.ts`.
- **Local persistence:** `idb` 8.0.3 over IndexedDB. **Validation:** Zod 4.4.3.
- **Tests:** Vitest 4.1.10, Playwright 1.61.1.
- `@axe-core/playwright` 4.12.1 is still installed but is **no longer a release gate** (ADR-008).
- **No webfont, deliberately** — see i18n rules.

## Critical Implementation Rules

### Engine-Specific Rules (Phaser is the surface — ADR-001 v1.1)

- Phaser scenes own all interactive presentation. The **only** non-Phaser surface is the portable record: `src/ui/print/CaseRecordPrintView.ts` + `src/adapters/export/` (ADR-007).
- **Never add a semantic HTML control to mirror a Phaser gesture.** The DOM-parity requirement was retired 2026-08-05.
- **Canvas completeness (ADR-011): a feature is not done until the canvas can dispatch its intent.** Before marking any story complete, grep for every dispatcher of every action it touches. If the only dispatcher is under `src/ui/`, the story is unfinished no matter how green its unit tests are — this is exactly how nine of fourteen player intents ended up reachable only from retired panels (correction of 2026-08-06). The one exemption is `CaseRecordPrintView`, which dispatches nothing.
- **`src/ui/` holds exactly three modules, and that is the whole non-Phaser surface set** (Story 2.12, 2026-08-07). The eleven interactive presentation panels are **deleted**, along with their `index.html` roots and their CSS. What remains: `print/CaseRecordPrintView.ts` (ADR-007's portable record, which dispatches nothing), `BootShell.ts` (the boot frame and the status line NFR12's failed-save message speaks from), and `ValidationSessionDisclosure.ts` (the moderated route's facilitator statement). **Do not add a fourth.** A DOM element created, used and disposed inside an adapter is not a surface and is permitted — `exportCaseRecord`'s transient `<a>` and `pickRecordFile`'s transient `<input type="file">` are the two instances, and both are file-system boundaries a canvas cannot cross.
- **The canvas is the page, and the DOM is a gate in front of it or invisible behind it** (Story 2.12, 2026-08-07). `#game-container` is fixed at the full viewport at every width; there is no column beside it and no document scroll. Exactly three DOM elements sit outside it, and each is either transient or unseen: the **boot frame**, which covers the canvas and is dismissed on entry; **`#boot-status`**, a fixed bar that is `:empty`-hidden and shows only when it carries a message; and the **printable record**, visually hidden by the standard clip and revealed only by `@media print`. Two consequences bind future work. **Placement is Phaser's** — the config sets `autoCenter: Scale.CENTER_BOTH`, so a CSS `place-items: center` on the container centres it a *second* time and silently offsets the canvas; this was invisible for two epics because the old parent was narrow enough that Phaser's computed margin was near zero. And **covering the canvas does not disable it**: Phaser binds pointer listeners above the document, so a DOM overlay is hit-tested through and the scene underneath receives the click. Any modal DOM layer must set `game.input.enabled = false` as well as cover the surface, and must prove it against a *recorded consequence* rather than against a screenshot.
- **Anything the DOM draws over the canvas is in a canvas screenshot.** `page.screenshot({ clip })` captures the composited page, so a transient overlay — the entry notice is the live instance — changes the pixels of a band it overlaps. A spec that compares canvas pixels must wait the overlay out and say so, or the comparison is measuring the browser rather than the renderer.
- `src/game/scenes/{Boot,Game,GameOver,MainMenu,Preloader}.ts` are **orphaned Phaser-template leftovers referenced nowhere**. They are not the scene layer. Do not wire, extend, or imitate them. Real scenes live in `src/adapters/phaser/scenes/`.
- **Never introduce a placeholder scene without a story in the same epic that replaces it.** `LibraryScene` and `DebriefScene` sat as placeholders across two epics while their owning stories were marked done, on a shared `PhasePlaceholderScene` shell. Stories 2.8 and 2.11 replaced both and 2.11 deleted the shell, so there is no base class to subclass now — the rule is about the *practice*, not the class: a scene that ships as a marker is a scene nobody has scheduled, and Story 2.7 had to mount a real advance control and a localized refusal on that shell to keep two transitions reachable at all, which is what the delay actually cost.
- The store is authoritative: scenes read through selectors and write only typed actions through `dispatch`. No direct state mutation, and **no scene→scene reach-in**. (The existing `LectureBookScene`→`LaboratoryScene` coupling is a story-owned deferral, not a pattern to copy.)
- **Narrow viewports suppress nothing** (Story 2.12, D7). The bench used to gate its step controls, its advance control and its reference shelf on `(max-width: 767px)` while every other host gated nothing. With no DOM fallback left, a suppressed advance control strands the player in a phase — the failure ADR-011 exists to prevent — and the flag had grown to block *reading*, which NFR4 makes the one thing a phone is for. The rule is now stated once and applied everywhere: every affordance stays available at every width. Do not reintroduce a viewport gate without an authored, localized message explaining it.
- **SceneRouter (ADR-009):** the case's `scenarioScript` owns the phase→scene map; the router only obeys it. Scenes **mirror** phase `context → prediction → experiment → synthesis → review → debrief` and must never define, infer, or advance it. The router is read-only over the store and never dispatches.
- A routing failure must never escape the store subscriber. The router runs inside `notify` inside `dispatch`, and Phaser starts scenes synchronously — an escaping throw would advance the phase, skip later subscribers, and break `dispatch`'s `Result` contract.
- **Renderer contract:** classes in `src/adapters/phaser/renderers/` exposing `create()` / `render(state)` / `destroy()`. The renderer owns every display object, tween, timer, and listener it creates, and `destroy()` releases all of them — including tweens whose target is the renderer itself.
- **Never author player-facing copy in `create()`.** It runs once and the locale can change. Create text empty, populate in `render(state)` through `createTranslator(locale)`.
- **Sticky canvas:** refresh `this.scale.updateBounds()` from a *passive* `window` scroll listener registered and removed by the scene lifecycle — Phaser caches bounds in document coordinates. Browser tests must scroll before exercising in-canvas controls.
- **Honour `prefers-reduced-motion`** in every animated renderer: subscribe to the media query, register no update loop when `reduce` is set, and have `render()` paint a static frame. This is the retained no-flashing / photosensitivity guard, and it survives the a11y de-scope.
- **The apparatus is unlit until the player starts it (ADR-012).** No animation loop may register from `create()` for the experiment's light. `syncAnimationLoop`-style gating gates on a player-initiated run, not on scene lifecycle. Idle animation that nobody asked for is both a design defect and an NFR1 cost.
- **Drag input snaps to the authored step before dispatch (ADR-012).** Convert pointer travel to a stepped value in a Phaser-free module and unit-test it at both range ends and across every step. Never dispatch a raw drag value and let the domain normalize it — that makes the normalization rule visible as the value jumping under the cursor. Every draggable instrument also keeps a discrete step affordance and keyboard stepping, and the two paths must produce identical run records.
- **Character staging must not be able to read the defensible set.** A staging renderer gets the cast, the speaker, and the accent colour. Nothing more. Same rule as `ColleagueRenderer`, and for the same reason (ADR-006).
- No Arcade or Matter physics for scientific results — deterministic, versioned domain calculation only (ADR-004). Direct-manipulation drag is an input mapping, not a physics body.
- Archival book: one leaf is one authored printed page from the same pure source-page pagination; fit body type once on redraw rather than splitting a source page. Reading, paging, and closing stay ephemeral — they never inspect evidence or alter progression.

### Guided-Adventure & Gating Rules

- **Everything is authored; nothing is freeform.** Scene order, dialogue beats, apparatus bounds, valid values, confounds, and outcomes all come from case data.
- **The shared contract holds only what every case shares; per-case invariants live in a refinement branched on `id`** (Story 3.1). Young's exact FR7 bounds, its fixed 550 nm, its 2/2/2 requirement counts and its 2-to-4 cycle range are all enforced inside `if (definition.id === YOUNG_CASE_ID)` in `CaseDefinitionSchema`'s top-level `superRefine` — not as `z.literal`s in the shape, which would drag every later case into Young's specifics. At two cases a branch is the whole mechanism; **do not build a plugin or registry layer** for case-specific rules.
- **When you relax a schema shape, find out what it was silently holding and re-state it.** The removed `z.tuple([PC, PC])` on `primaryControls` was the only thing keeping a third control off the wavelength chooser and duplicate control ids out of `activeControlValues`; both are now explicit (`MAX_PRIMARY_CONTROLS`, a uniqueness rule), and `MAX_PRIMARY_CONTROLS` is asserted against the real bench geometry so the bound and its justification fail together. What cannot be re-stated goes in `deferred-work.md` as newly reachable, with an owner.
- **No authored content may leave a gate unsatisfiable.** Ask of every new field: *can an author fill this in a way that makes the case unfinishable?* If yes, refine it — at load, with the offending path named. The `colleagueHints` floor/order rules, the `reviewed`-needs-a-rendition rule and the "context readiness must be able to become ready" rule are all this one question, asked three times.
- **The neutral auto-summary states what the player did and never evaluates it** (FR23). Counts, configurations, sources read — no "correct", no defensibility, no proposal ranking (ADR-006, UX-DR5). Its placeholder vocabulary is closed and validated at load, because `interpolate` leaves an unknown `{token}` verbatim and would print it into the player's record.
- Prediction **and** conclusion are each a choice of **1 of 4 colleague proposals**. Schemas use `.length(4)`, not `.min(4)` — the count is the design.
- Choices are revisable: re-choosing must never fail on "already chosen".
- Choosing a proposal sets **both** the proposal ID and the canonical text; any free-text path must **clear** the ID. Record validation enforces that a present ID matches its proposal's text.
- **Defensibility is evaluator/critique-only.** Never expose a proposal as "correct" up front, and never leak a defensibility field into a display projection.
- The evidence evaluator is the **sole completion authority**; it also reports which conclusion proposals are defensible and the significant-measure count. Never hard-code completion in a scene or dialogue branch.
- The conclusion unlocks on **≥2 significant measures**; otherwise a colleague delivers hints in-fiction.
- The rival lab (Mr. Arthur Bell) critiques an unsupported claim and routes back to revision. He is **narrative dressing, never a fail state** — no score, game-over, or penalty — and he is **not** a member of `colleagues[]`.
- Consultations and hints point at missing evidence, a source, an observable, or a test. They never supply the answer.
- No hard-fail states, irreversible wrong choices, speed rewards, or rewards for overclaiming.
- **Every forward transition has an in-scene affordance.** The scenario advances from the scene the player is standing in. A transition reachable only from outside the canvas does not exist. Complete set: `context → prediction`, `prediction → experiment`, `experiment → synthesis`, `synthesis → review`, `review → debrief`, and post-debrief replay.
- Authored copy must not name a scene, phase, or route (the `encodesPath` check) — including an advance affordance's label, which names what the player is moving *toward in fiction*.
- **A refused action always says why, and the message survives until a real state change replaces it.** A gate the player can act on is answered by the authored colleague hint; anything else by the localized error. Never a raw error, never silence, never erased by an unrelated redraw.

### Internationalization Rules (ADR-010, NFR19)

- **EN + FR from launch.** Locale is detected from the browser (`resolveBrowserLocale`), held in the store, and persisted in settings. **There is no player-facing language selector.**
- **Every new content surface inherits the EN+FR requirement as part of its own acceptance criteria — not as follow-up i18n work.** This is the project's most-repeated defect: chrome gets localized and content does not. Surfaces to check each time: UI chrome, curated records, book content, reference summaries, colleague dialogue, proposal text, hint text, rival-lab critiques, sources, debrief.
- Prose the player reads is `LocalizedText`, resolved with `resolveLocalizedText`. Interface strings go through `translate` / `createTranslator`. Proper nouns stay plain strings.
- Zod validates locale completeness at case load; English fallback logs an `i18n.missingKey` dev warning.
- Scientific run values are **canonical across locales**; localize only for display, via `formatNumber` / `formatMeasurement` / `formatRecordedValue`.
- **Do not add a webfont.** `UI_FONT_STACK`, `BOOK_FONT_STACK`, and `MONO_FONT_STACK` end in a generic family and already resolve to fonts covering the French repertoire (Latin-1 accents, `œ`/`Œ`, `«`/`»`). A download would cost NFR2's cached five-second first interaction and add an offline-gate asset for coverage the platform already provides.
- **Never give `locale` an optional parameter with a `DEFAULT_LOCALE` fallback.** It converts a forgotten call site from a `tsc` error into a French player silently reading English.

### Performance Rules

- Target 60 FPS at 1280×720 on a representative low-end school laptop; profile the Young lab before adding polish.
- Keep `update()` minimal — prefer store subscriptions, Phaser events, and timers over per-frame work.
- No logging, JSON parsing, IndexedDB access, DOM manipulation, or transient allocation in render/update hot paths.
- Animate on elapsed time so motion is frame-rate independent; never on frame counters.
- Load a minimal boot shell, then the complete selected case bundle before laboratory play. Do not stream critical in-lab assets.
- Pool only after profiling proves allocation pressure. Prefer atlases and pre-rendered assets over regenerating `Graphics` geometry each frame.
- Cap text resolution at `min(devicePixelRatio, 2)`; beyond that texture cost outweighs any visible gain.
- Scientific calculation is pure and deterministic, and is not run per frame.

### Code Organization Rules

- Follow the domain-driven hybrid structure in `game-architecture.md`. Do not add a generic `services/`, `managers/`, or `helpers/` catch-all.
- `src/domain/` is pure TypeScript: no Phaser, DOM, `fetch`, IndexedDB, browser APIs — **and no Zod**. Phaser objects exist only under `src/adapters/phaser/`. `src/core/` holds the store, i18n, errors, and `Result`. `src/schemas/` owns every Zod schema. `src/adapters/` owns all side effects. The dependency direction never reverses.
- Only repositories fetch and validate case JSON; only persistence adapters touch IndexedDB.
- Case definitions and shared assets are immutable under `public/cases/` and `public/assets/`; player progress lives only in IndexedDB. **Edit only `public/cases/…`** — `dist/` is build output and `.claude/worktrees/**` is a stale copy.
- Bump `CaseDefinition.version` on any contract change, and keep the record-compatibility allowlist honest rather than widening it on the assumption that canonical strings are byte-identical.
- **Never recalculate a saved historical run against a newer experiment model.** Every run record preserves its controls, calculated output, timestamp, and model version.
- Case content carries the provenance and rights status of every historical asset and claim. Do not add an unreviewed one.
- Every Zod object is `.strict()`.
- Fallible operations return `Result<T, ResultError>` rather than throwing; error codes resolve to localized copy.
- Naming: `PascalCase` for classes/components and their files, `camelCase` for non-class modules/functions/properties, `UPPER_SNAKE_CASE` for constants, `kebab-case` for case IDs and assets. Domain events are `noun.verb`; typed actions are `domain.verbPastTense` (`prediction.proposalChosen`); JSON fields are `camelCase`.

### Testing Rules

- Unit-test all pure domain logic with Vitest: calculators, reducers, validators, migrations, readiness and defensibility evaluation, significance rules, peer-review rules, proposal support predicates. Use fixtures for case definitions and records — **never require Phaser or a browser to test scientific logic**.
- To test Phaser-adjacent logic, inject the structural slice you need rather than a real `Phaser.Game` — Vitest has no canvas. `SceneRouterTarget` is the reference pattern.
- Layout is `tests/unit`, `tests/integration`, `tests/e2e`. Playwright runs with `PLAYWRIGHT_BROWSERS_PATH=0`.
- Release-relevant e2e coverage: the Young completion path, import/export, offline reload, and cross-browser.
- axe and manual accessibility acceptance are **no longer gates** (ADR-008). Keep the reduced-motion / no-flashing check. Do not add new a11y-parity assertions — and do not delete the existing a11y specs either; they are de-scoped, not wrong.
- **The chromium e2e suite is green as of Story 2.12** — the seven carried retired-DOM failures are closed, because the panels those specs drove are deleted and every spec was re-pointed at the canvas rather than trimmed. What is left to observe from the DOM is `#game-container[data-active-scene]` and the retained printable record; **canvas text cannot be read from a spec**, so a string assertion belongs in a `sceneSlice`-driven unit test or in `french-typography.spec.ts`.
- **The canvas walks are frame-timed and load-sensitive.** Judge a failure on an idle machine before attributing it to a change; `npm run test:e2e:cross-browser` runs three engines at once and is the worst case. Wait on the thing the gesture was supposed to achieve (`startTheLightUntilRecorded`, `dragDesignUntil`, `clickUntilScene`), never on a fixed sleep.
- Invalid case content and imports must surface as expected `Result` failures; valid local progress must survive a failed import or save.
- Assert public actions, selectors, and rendered text — not Phaser private fields or incidental pixels.
- Never assert a magic number that a test shares with source unless both read one exported constant.

### Platform & Build Rules

- Ship as a static hosted web application targeting current desktop Chrome, Firefox, Safari, and Edge. No account, analytics, cloud save, remote configuration, or network request may block core play.
- **Offline reload is a release gate:** locally saved case progress must restore with no network after a prior successful load.
- Use the Vite production build with cache-versioned static assets. No backend for MVP gameplay.
- Export/import stays versioned JSON; print uses the semantic CSS print view — the retained portable record. Do not replace it with a canvas-only capture.
- Never expose a raw error to the player, and never log learner-entered conclusions by default.
- Verify with `npm run typecheck`, `npm test`, and `npm run test:e2e`.

### Critical Don't-Miss Rules

_Quick index of the highest-cost mistakes. Each is stated in full in the section named._

| Never | Why it is costly | Section |
|---|---|---|
| Ship a feature whose only dispatcher is under `src/ui/` | The store is correct and the game is unplayable — this caused the 2026-08-06 correction | Engine |
| Author a case field that nothing reads | Shipped-and-dead content, the same defect class as an unreachable intent | Guided-Adventure |
| Relax a schema shape without asking what it was holding | The guarantee moves to nowhere and a renderer crash becomes reachable in silence | Guided-Adventure |
| Write a case constant (`550`, a control id, a count) into code twice | Two copies of one rule drift, and the surface then paints a state the reducer refuses | Guided-Adventure |
| Register an animation loop for the experiment's light in `create()` | The light runs unattended and costs NFR1 budget for nothing | Engine |
| Leave a transition reachable only from outside the canvas | The player reaches a phase they cannot leave | Guided-Adventure |
| Add semantic HTML to reach parity with a Phaser control | Rebuilds the contract retired 2026-08-05 | Engine |
| Add a fourth module to `src/ui/`, or treat `src/game/scenes/*` as the scene layer | Rebuilds the surface set Story 2.12 retired, or lands work in orphaned code | Engine |
| Let a scene define, infer, or advance the phase, or reach into another scene | Breaks the single source of truth for progression | Engine |
| Author player-facing copy in `create()` | Silently ignores a locale change | Engine |
| Leave tweens, listeners, or display objects alive after `destroy()` | Writes to torn-down objects | Engine |
| Hard-code completion, or mark a proposal "correct" outside the evaluator | Bypasses the sole completion authority | Guided-Adventure |
| Create a hard fail, irreversible choice, score, or speed reward | Contradicts the design — the rival lab included | Guided-Adventure |
| Ship a content surface in English only | The project's most-repeated defect | i18n |
| Add a webfont, or a silently-defaulted `locale` | Costs the boot budget / hides a missing locale | i18n |
| Mutate shipped case definitions, or mix them with player progress | Corrupts immutable content | Organization |
| Optimize with pooling, streaming, or middleware before profiling | Complexity for an unproven need | Performance |

---

## Usage Guidelines

**For AI Agents:** Read this file before implementing game code. Follow all rules; when guidance conflicts or is incomplete, choose the more restrictive option and update this file when a durable new pattern is agreed. Where an older artifact contradicts this file, this file and `game-architecture.md` v1.2 win.

**For Humans:** Keep this focused on project-specific agent guidance. Update it when the stack or architectural rules change; remove rules that become obvious or obsolete.

**Last Updated:** 2026-08-19 (revision 2.4 — Story 3.1: the case contract is shared rather than Young-shaped. `id`, the control set, the wavelength, the artifact count and the requirement counts are no longer pinned in the shape; Young's own numbers are enforced in a refinement branched on its `id`. `case.json` is 1.17.0 and adds the neutral auto-summary, read in the printable record. `CaseRecordSchema`'s `caseId` and both control shapes are relaxed — record `schemaVersion` stays 3 and `migrateCaseRecord.ts` is untouched)

**Previous:** 2026-08-07 (revision 2.3 — Story 2.12: the DOM presentation panels are deleted, three non-Phaser modules remain, the sub-768px suppression is gone, and the canvas is the whole page behind an entry gate that disables Phaser input as well as covering it)
