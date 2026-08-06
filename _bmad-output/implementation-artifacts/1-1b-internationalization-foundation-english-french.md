---
baseline_commit: 128f1bf8f0ba540b69090cb45cb6d73cb5d75648
---

# Story 1.1b: Internationalization foundation — English + French

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to play in English or French from the first release,
so that both English- and French-speaking learners can use the game.

## Acceptance Criteria

Verbatim from `epics.md` (Story 1.1b), numbered for traceability:

1. **Given** the application boots,
   **When** it initializes,
   **Then** every player-facing string resolves through an i18n layer backed by `en` and `fr` locale resources (no hard-coded display strings in scenes, widgets, or the print view),
   **And** the active locale is read from the authoritative store.

2. **Given** a language selector is available early (boot/menu and in-game settings),
   **When** I switch language,
   **Then** the active locale updates through a typed action, every open scene re-renders its text from the new locale, and the choice persists in IndexedDB settings and survives offline reload.

3. **Given** a case definition's authored text (dialogue beats, colleague names/roles, the four prediction and four conclusion proposals with their limitations, colleague hints, rival-lab critiques, source labels, and debrief),
   **When** it is loaded,
   **Then** each localizable string provides both `en` and `fr`,
   **And** Zod rejects a case missing a required locale before domain logic.

4. **Given** French text is rendered in a Phaser scene,
   **When** it displays,
   **Then** the chosen font(s) include the full French glyph set and diacritics (é è ê ë à â ç î ï ô û ù œ « »),
   **And** accented text renders without missing glyphs or clipping at 1280×720.

5. **Given** a translation key is missing at runtime,
   **When** text is resolved,
   **Then** it falls back to English and logs a dev-only `i18n.missingKey` warning,
   **And** the player never sees a raw key or an empty string.

6. **Given** player-facing numbers and units,
   **When** displayed,
   **Then** they use locale-aware formatting where appropriate,
   **And** the recorded scientific run values remain canonical and unchanged.

7. **Given** the i18n foundation,
   **When** tests run,
   **Then** a unit test asserts locale-resource completeness (every key present in both `en` and `fr`) and English fallback,
   **And** an integration test verifies that the selector switches language, persists it, and re-renders scene text.

_Young-slice note (from epics): EN and FR content for the Young case ships complete, and the Story 2.4 validation gate covers both locales._

## Scope and implementation decisions

This is a **foundation story**, deliberately sequenced out of numeric order: it lands after Story 1.1 (bootstrap) and before any scene renders authored player text, so no later story has to retrofit i18n. The codebase is mid-pivot — the routed Phaser shell exists (Story 1.10) but four of its five scenes are placeholders, and the pre-pivot DOM panels under `src/ui/` are still the live surface for the flow. That mid-pivot state is what makes the scope boundary below the single most important part of this story.

### IN scope

- **The i18n layer itself** (`src/core/i18n/`): `Locale` type, `en`/`fr` resources, a `translate` / `t` lookup with English fallback and a dev-only `i18n.missingKey` warning, and locale-aware number formatting.
- **Locale in the authoritative store**: an `AppState.locale` field, a typed `settings.localeSet` action, a `selectLocale` selector.
- **Locale persistence**: IndexedDB `settings` object store (database version bump), a `SettingsRepository`, restore-on-boot, and survival across offline reload.
- **Two language selectors**: the DOM boot shell (the architecture keeps `BootShell` as the boot frame) and an in-canvas Phaser settings control. Both dispatch the same typed action.
- **Localized case contract**: a `LocalizedText` shape, Zod validation that rejects a case missing a locale, and the Young `case.json` authored in EN + FR for every localizable field (exact field list in Dev Notes).
- **Localizing the surfaces that survive the pivot**: the Phaser laboratory surface (`ApparatusRenderer`, `LectureBookRenderer` chrome), the boot shell + `index.html` static copy, the **print view** (explicitly named in AC1 and kept by ADR-007), and the `error.code → localized message` mapping at the presentation boundary.
- **Font stacks with verified French glyph coverage** and layout headroom for longer French strings.
- **Tests**: resource completeness + fallback (unit), selector switch/persist/re-render (integration), a French-render check at 1280×720, and locale-aware formatting (unit).
- **A short authoring note** (`docs/i18n-authoring.md`) so every later scene story adds strings through the layer rather than around it.

### OUT of scope — do NOT build here

- **Localizing the retiring `src/ui/*` DOM panels** (`apparatus/`, `notebook/`, `context/`, `sources/`, `theory/`, `review/*`, `persistence/`, `recognition/`, `debrief/`, `ValidationSessionDisclosure`). ~1600 lines that Stories 1.11, 1.12, 2.1, 2.3 and 2.5 delete as each Phaser scene reaches parity. Translating them is throwaway work and would double the FR copy that has to be re-reviewed. **The print view is the exception — it is kept and IS in scope.** Each retirement story localizes its scene as it builds it; that is what "foundation before scene text" means.
- **Authoring scene copy for placeholder scenes.** `PhasePlaceholderScene` renders a neutral development marker (`"Library (placeholder)\ncontext"`), not player copy. Leave it un-localized and leave the comment that points here. Library/Colleagues/TheoryBoard/Debrief copy belongs to Stories 2.1, 1.11, 1.6-rework/2.3, 1.12.
- **Translating the primary-source archival renditions.** See the decision below.
- **Locale detection from `navigator.language`.** Default is `en`; see Open Questions.
- **Any locale beyond EN and FR** (NFR19, GDD Out-of-Scope, ADR-010).
- **`src/game/scenes/{Boot,Game,GameOver,MainMenu,Preloader}.ts`** — unused Phaser-template leftovers; `src/game/main.ts` never registers them. Do not localize them, do not delete them here.
- **Accessibility work** (ADR-008, de-scoped from MVP).

### Decision — locale resources are TypeScript modules, not fetched JSON

Author `en`/`fr` under `src/core/i18n/locales/` as typed TS modules bundled by Vite. Rationale:

1. **Compile-time completeness.** `type TranslationKey = keyof typeof en` plus `const fr: Record<TranslationKey, string>` makes a missing French key a `tsc` error, not a runtime discovery. The AC7 runtime test then covers the reverse direction (extra keys) and the fallback path.
2. **Offline safety.** `public/sw.js` is a fetch-through worker with no atomic pre-cache; a locale JSON that has not been fetched yet is a 503 on reload. Deferred-work already tracks this exact class of bug for `case.json`/`asset-manifest.json`. Bundled resources cannot hit it.
3. **No new validation boundary.** App-owned strings are not untrusted input, so no Zod schema is needed. Case content stays JSON + Zod exactly as today.

### Decision — the primary-source archival rendition stays in its original language

`contextualArtifacts[].textualRendition.renditions` holds a transcription of Young's 1801 Bakerian Lecture (and the Opticks archive book) from a reviewed Wellcome Collection scan. It stays `en`-only:

- A translation of a historical primary source is itself a scholarly artifact and would need its own provenance and rights review (NFR11, FR26, FR27) — that is a content story, not a foundation story.
- Epic AC3 enumerates the localizable case strings and does not include the rendition body.
- The existing type already encodes this (`RenditionLocale = 'en'`, `renditions: z.tuple([...])` — a one-element tuple); leave the shape and update only its comment.

**What around the rendition IS localized:** `readerLabel`, `summary[]`, and `citation.reuseStatement`. Keep `citation.citationText` and `archiveUrl` canonical (they are the bibliographic citation of record). The reader should show a localized "presented in the original English" note in FR — add it as a UI key, not case content.

### Decision — the domain layer never learns about locale

`src/domain/` and the canonical record stay locale-free. Text crosses into the presentation layer as a **stable key or code**, and the presentation resolves it. This is not stylistic: three canonical values are equality-validated on load, so localizing them in place silently destroys saved progress. See **Canonical-value traps** in Dev Notes — read that section before writing any code.

## Tasks / Subtasks

- [ ] **Task 1 — The i18n core (AC: 1, 5, 6)**
  - [ ] Create `src/core/i18n/Locale.ts`: `export const LOCALES = ['en', 'fr'] as const; export type Locale = typeof LOCALES[number]; export const DEFAULT_LOCALE: Locale = 'en';`
  - [ ] Create `src/core/i18n/locales/en.ts` exporting a flat `const en = { ... } as const` object (dotted string keys, e.g. `'boot.title'`, `'lab.control.slitSpacingMm.label'`, `'error.unknown-apparatus-control'`). Flat, not nested — it makes the completeness test and the `keyof` type trivial.
  - [ ] Create `src/core/i18n/locales/fr.ts` typed `const fr: Record<TranslationKey, string>` so a missing key fails `npm run typecheck`.
  - [ ] Create `src/core/i18n/translate.ts`: `translate(locale, key, params?)`. Resolve from the active locale; on a miss fall back to `en`; if `en` also misses, return the key's last segment humanised — **never** a raw key or an empty string (AC5). Support `{name}`-style parameter interpolation. On any fallback, call a dev-only warning: `if (import.meta.env.DEV) console.warn('i18n.missingKey', { key, locale })`. Gate on `import.meta.env.DEV` (Vite) so production builds stay silent — this also satisfies NFR18/"do not expose raw errors".
  - [ ] Create `src/core/i18n/formatNumber.ts`: a locale-aware `formatMeasurement(locale, value, decimals, unit)` built on `Intl.NumberFormat`. FR must render `0,25 m` (comma decimal, narrow no-break space before the unit); EN renders `0.25 m`. `Intl` is a JS built-in, so this stays inside `core/` purity rules.
  - [ ] Unit tests `tests/unit/I18n.test.ts`: **(a)** every key in `en` exists in `fr` and vice versa (AC7 — assert both directions, since `tsc` only covers one); **(b)** no value is empty or whitespace in either locale; **(c)** a missing key in `fr` falls back to the English string; **(d)** an unknown key in both returns a non-empty, non-raw-key string; **(e)** `{param}` interpolation.
  - [ ] Unit tests for `formatMeasurement`: EN/FR separators and the no-break space; a value with trailing-zero decimals keeps its authored precision.

- [ ] **Task 2 — Locale in the authoritative store (AC: 1, 2)**
  - [ ] Add `locale: Locale` to `AppState` (`src/core/store/AppState.ts`) and thread it through `freezeState`, `createInitialAppState(caseDefinition, locale = DEFAULT_LOCALE)`, and `createAppStateFromCaseRecord(record, caseDefinition, locale)`.
  - [ ] **`createAppStateFromCaseRecord` must take the locale from the live session, never from the record.** An FR player's exported record must not flip an EN player's language on import.
  - [ ] **`reduceReplayStart` must preserve `locale`.** It resets almost everything; locale is a device setting, not case progress.
  - [ ] Add `SettingsLocaleSetAction = Readonly<{ type: 'settings.localeSet'; locale: Locale }>` to `src/core/store/AppAction.ts` and to the `AppAction` union. Add a `reduceLocaleSet` case: reject an unknown locale with a typed `Result` failure (`code: 'unsupported-locale'`); otherwise return `freezeState({ ...state, locale })`.
  - [ ] **The locale reducer must not clear `consultation` / `peerReview`.** Those are cleared when *evidence* changes; changing language is not an evidence change and must not silently discard an open review projection.
  - [ ] Add `selectLocale(state): Locale` to `src/core/store/selectors.ts`.
  - [ ] **Do not add `locale` to `CaseRecordSchema` or `createCaseRecordProjection`.** `CaseRecordSchema` is `.strict()`; the portable record is scientific progress, and the schema version must not change for a device preference.
  - [ ] Unit tests in `tests/unit/AppStore.test.ts` (or a new `LocaleStore.test.ts`): the action switches locale and notifies subscribers; an unsupported locale returns a `Result` failure and leaves state unchanged; replay preserves locale; the case-record projection contains no locale field.

- [ ] **Task 3 — IndexedDB settings persistence (AC: 2)**
  - [ ] Extend `src/adapters/persistence/IndexedDbRepository.ts`: bump `openDB('quantique-progress', 1 → 2)` and, in `upgrade`, create a `settings` object store if absent. Keep the existing `case-records` creation guard — an existing v1 database must upgrade **without losing case records**. Widen the `DatabaseConnection` store-name type to `'case-records' | 'settings'`.
  - [ ] Create `src/adapters/persistence/settingsRepository.ts` mirroring `caseRecordRepository.ts`: validate at the boundary with a Zod `PlayerSettingsSchema` (`{ schemaVersion: 1, locale: z.enum(LOCALES) }`, `.strict()`), return typed `Result`s, and constructor-inject storage so it is testable without IndexedDB.
  - [ ] **A settings read/write failure must never block boot or play.** On an unreadable or invalid settings record, fall back to `DEFAULT_LOCALE` and continue (NFR12: no silent loss of the *case* record, and a preference failure is not a progress failure).
  - [ ] In `src/main.ts`, load settings **before** `createStore` and pass the restored locale into the initial state, so the first paint is already in the right language and there is no visible EN→FR flash.
  - [ ] Persist on every `settings.localeSet` — subscribe once in `src/main.ts` (or wire it into the selector's dispatch path). Do not persist from inside a scene.
  - [ ] Unit test `tests/unit/SettingsRepository.test.ts`: round-trip; an invalid stored value yields the default rather than a throw; a write failure surfaces a `Result` failure without corrupting state.

- [ ] **Task 4 — Localized case contract + Zod locale validation (AC: 3)**
  - [ ] Add to `src/domain/cases/CaseDefinition.ts`: `export type LocalizedText = Readonly<{ en: string; fr: string }>;` and `export type LocalizedTextList = Readonly<{ en: readonly string[]; fr: readonly string[] }>;`
  - [ ] Add a pure resolver next to it (or in `src/core/i18n/`): `resolveLocalizedText(text, locale): string` with English fallback — the same fallback contract as `translate`.
  - [ ] Add `LocalizedTextSchema` / `LocalizedTextListSchema` to `src/schemas/CaseDefinitionSchema.ts`: `.strict()` objects requiring **both** `en` and `fr`, each trimmed and non-empty; the list variant must additionally require **equal array lengths** across locales (an `assumptions` list with 4 EN and 3 FR entries is a content defect). This is the "Zod rejects a case missing a required locale before domain logic" AC — test it directly.
  - [ ] Convert exactly these `case.json` fields to `LocalizedText` (list variant where noted). Update the TS types, the Zod schema, and `public/cases/young-interference/case.json` **in lockstep**:
    - `openingDispute`
    - `contextualArtifacts[].displayName`, `.caseRelationship`
    - `contextualArtifacts[].textualRendition.readerLabel`, `.summary[]` *(list)*, `.citation.reuseStatement`
    - `apparatus.primaryControls[].label`
    - `experiment.assumptions[]` *(list)*, `.confound.description`, `.resetPath.description`
    - `consultationRules[].layers.{observation, plainLanguage, technicalDetail}`, `.nextStep`
    - `peerReviewRules[].feedback`, `.revisionPath`, `.predicate.overreachPhrases[]` *(list — see the trap below)*
    - `debrief.summary`, `.historicalComparison.{title, text}`, `.deeperTheory.{title, text}`, `.replayLabel`
  - [ ] **Expect the domain to read `.en` explicitly** where a converted field crosses into it — `freezeIssue` becomes `rule.feedback.en` / `rule.revisionPath.en`, `hasEvaluableRules` becomes `rule.feedback.en.trim()`, `evaluateContextReadiness` maps `displayName.en`. That is the governing rule working as intended, not a leak: the domain reads the canonical locale, never the *active* one. Add a one-line comment at each site so a later reader does not "fix" it.
  - [ ] Leave these **canonical (single string)** and say so in a code comment: all `id`/`sourceId`/`controlId`/`sourceRefs`/`provenance.reference` values, `creatorOrOrigin`, `citation.citationText`, `archiveUrl`, `apparatus.primaryControls[].unit` (SI symbols are identical in French), `experiment.modelVersion`, and `textualRendition.renditions` (decision above).
  - [ ] **`overreachPhrases` are detection phrases, not display text.** Author the French list, and have `peerReviewRules.ts` match against **both locales' phrases unioned**, never against the active locale — see the exception note in the traps section. Test that the same conclusion text produces the same `PeerReviewIssue[]` under `en` and `fr`.
  - [ ] **Keep `evaluatePeerReview` emitting canonical `en` feedback** (trap 3). Do not change `PeerReviewIssue`'s shape or `CaseRecordSchema`'s `schemaVersion`; the review panel localizes by `ruleId`.
  - [ ] **Add `missingArtifactIds` to `ContextReadiness`** alongside the existing canonical `missingArtifactLabels`, so the presentation can resolve localized source names by id.
  - [ ] **Extend the `forbiddenPath` guard to both locales.** `CaseDefinitionSchema` rejects authored help text matching `/(?:\b(?:scene|phase|route)\b|→|->)/i`. Run it over the `fr` strings too. Note the French collision: *route* is an ordinary French word, and *phase* is spelled identically — expect false positives on legitimate French copy and adjust the rule (locale-specific word list) rather than mangling the translation. Cover both directions in a test.
  - [ ] Bump `case.json` `version` `1.4.0` → `1.5.0`, **and extend the compatibility allowance in `validateCaseRecordForDefinition`** (`src/schemas/CaseRecordSchema.ts:137-141`) so `1.4.0` records still load against `1.5.0`. Without this every saved investigation is rejected on upgrade — a direct NFR12 violation. Add a regression test that a `1.4.0` record loads.
  - [ ] **Bump `public/sw.js` `CACHE_NAME` to `quantique-bootstrap-v3`** with a comment matching the v2 precedent: the strict case schema now requires `fr`, so a stale cached `case.json` fails validation and boots into "content unavailable".
  - [ ] Unit tests in `tests/unit/CaseDefinition.test.ts`: a case with both locales parses; a case missing `fr` on any converted field is rejected; mismatched list lengths are rejected; the `forbiddenPath` rule fires on both locales.

- [ ] **Task 5 — Language selectors (AC: 2)**
  - [ ] **Boot shell (DOM).** Add a labelled `<select>` (or a two-button group) to `index.html`'s `#boot-shell` and wire it in `src/ui/BootShell.ts`. It dispatches `settings.localeSet`. Give it a stable `data-testid="language-selector"` for E2E. `BootShell` is explicitly retained by the architecture's target tree, so this is not throwaway work.
  - [ ] **In-canvas (Phaser).** Add `src/adapters/phaser/ui/LanguageSelector.ts` — the first inhabitant of the architecture's `adapters/phaser/ui/` folder, which Story 1.12 fills out with `DialogueBox` / `ProposalChoice` / `SceneNav`. Keep it a small renderer factory that owns create/update/destroy of its Phaser objects (Consistency Rule) and dispatches the same typed action. Mount it in `LaboratoryScene` (the only scene with real content today) and register it so later scenes can reuse it.
  - [ ] Both selectors must reflect the **current** locale from `selectLocale`, not local component state.
  - [ ] Every localized surface re-renders on the store subscription that already exists — verify `ApparatusRenderer` re-applies its text on update rather than only in `create()`, and that the boot shell and print view re-render too. This is the concrete meaning of AC2's "every open scene re-renders its text".
  - [ ] Integration test `tests/integration/LocaleSwitch.test.ts` (AC7): dispatch `settings.localeSet` → assert the selector projection updates, the settings repository received a write, and a text-producing selector/renderer returns French. Use the injected-fake pattern from `tests/integration/SceneRouter.test.ts`; do not instantiate a real `Phaser.Game` in Vitest.

- [ ] **Task 6 — Route surviving surfaces through the layer (AC: 1, 5, 6)**
  - [ ] **`ApparatusRenderer`** (`src/adapters/phaser/renderers/ApparatusRenderer.ts:74, 75, 80, 146, 151, 152, 204, 287`): replace every literal with a `t()` call. This is the live laboratory surface, not a placeholder.
  - [ ] **`LectureBookRenderer`** chrome/labels: localize the UI chrome (page controls, "Show summary", close). Leave the rendition body text alone (decision above).
  - [ ] **Boot shell + `index.html`**: `'Laboratory shell ready.'` (`src/ui/BootShell.ts:1`) and the three boot status strings in `src/main.ts:50, 64, 66`. Static markup in `index.html` (`eyebrow`, `h1`, the intro `<p>`, the button label) must be populated by `createBootShell` from the layer, since the pre-hydration HTML cannot know the locale. Keep `<html lang>` in sync with the active locale.
  - [ ] **Print view** (`src/ui/print/CaseRecordPrintView.ts`): all section headings, `term()` labels, and the empty-state strings. Route the observation line's numeric parts through `formatMeasurement`. Note `source.provenance.category.replace(/-/g, ' ')` at line ~41 — that renders an enum id as English prose; replace it with `t('source.provenance.' + category)`.
  - [ ] **Error messages**: add an `error.<code>` key per `Result` error code produced by `src/domain/` and `src/core/` (8 in domain/core plus the adapter-level ones in `IndexedDbRepository`/`caseRecordRepository`). The presentation resolves `t('error.' + result.error.code, params)`; the English `message` field stays as the dev-facing default and the fallback. Two codes interpolate content — `missing-contextual-sources` (an artifact label) and the readiness messages — so pass params through rather than pre-formatting in the domain.
  - [ ] **Locale-aware measurement formatting** (AC6): `selectFormattedControlValue` (`src/core/store/selectors.ts:28-31`) currently does `toFixed(...) + ' ' + unit`. Route it through `formatMeasurement(selectLocale(state), ...)`. Keep the `decimalPlaces(control.step)` precision rule unchanged.
  - [ ] **Update E2E specs that assert formatted numbers.** Any spec matching `0.25 mm`-style text must either run in `en` (set the locale explicitly at start) or match locale-aware output. Check `tests/e2e/young-experiment.spec.ts`, `accessible-control.spec.ts`, and `youngExperimentHelpers.ts`.

- [ ] **Task 7 — French typography: glyphs and layout (AC: 4)**
  - [ ] Create `src/adapters/phaser/textStyles.ts` exporting named font stacks (e.g. `UI_FONT_STACK`, `BOOK_FONT_STACK`) and shared `Phaser.Types.GameObjects.Text.TextStyle` factories. Replace the scattered literal `fontFamily: 'system-ui'` / `'Georgia, serif'` / `'monospace'` strings in `ApparatusRenderer`, `LectureBookRenderer`, and `PhasePlaceholderScene`. Each stack must end in a generic family (`sans-serif` / `serif` / `monospace`).
  - [ ] **Do not add a downloaded webfont.** The current stacks (`system-ui`, `Georgia, serif`, `monospace`) resolve to fonts that carry the full Latin-1 + `œ`/`Œ` + guillemets repertoire on every supported desktop browser/OS, and a font download would work against NFR2 (5-second cached first interaction) and NFR15/the offline gate. Verify rather than assume — see the render check below.
  - [ ] Add a French pangram + diacritic constant used by the check: `« Voilà l'œuvre d'un cœur naïf : à Noël, où l'on fêtait ça. » é è ê ë à â ç î ï ô û ù œ Œ`.
  - [ ] Add `tests/e2e/french-typography.spec.ts` (chromium at 1280×720, matching NFR1/AC4): switch to `fr`, then assert on the laboratory surface that (a) no rendered text object reports a width exceeding its wrap bound (clipping), and (b) the pangram renders at a non-zero, expected-ratio width — a tofu/missing-glyph run measures visibly differently from correct text. Prefer a measured assertion over a screenshot diff so it is stable in CI.
  - [ ] **Budget layout for length, not just glyphs.** French runs roughly 15–25% longer than English; overflow is a far likelier AC4 failure than a missing glyph. Where a fixed-width Phaser `Text` holds authored copy, give it `wordWrap` and reuse the shrink-to-fit loop already proven in `LectureBookRenderer.ts:198-200, 229-231` rather than inventing a new mechanism.

- [ ] **Task 8 — Authoring note + verification (AC: 1–7)**
  - [ ] Write `docs/i18n-authoring.md` (short — one page): the key-naming convention, "no literal player-facing string in `src/adapters/phaser/`, `src/ui/print/`, or `index.html`", how to add a key to both locales, which case fields are localized vs. canonical, and the canonical-value traps below. Later scene stories (1.11, 1.12, 2.1, 2.3, 2.5) are the readers.
  - [ ] Run and pass: `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run test:e2e:offline`.
  - [ ] **Verify the offline-reload gate explicitly** (AC2): set `fr`, reload offline, confirm the language persists and the app boots. This is a release gate, not an optional check.
  - [ ] Confirm no existing spec regressed. Note in the Dev Agent Record that the `deferred-work.md` "stale e2e notebook button" items were already failing at baseline `128f1bf` — do not attribute those to this story, and do not fix them here.

## Dev Notes

### ⚠️ Canonical-value traps — read before writing code

**Governing rule, applied everywhere below:** *the domain consumes the canonical `en` string; the presentation resolves the active locale by stable id* (`ruleId`, `sourceId`, `controlId`, `RecognitionId`, error `code`, `RECOGNITION_IDS`). Locale never enters `src/domain/`, and no persisted value ever changes with the active language.

That rule is not aesthetic. Four values look like display strings but are **persisted and equality-validated on load** — localizing them in place silently destroys saved progress the moment a player switches language. A tempting alternative, *resolve the whole `CaseDefinition` to one locale at the loading boundary*, breaks exactly here: it would make `state.caseDefinition` locale-dependent, and revalidation compares recomputed results against stored ones.

1. **`ExperimentResult.label` / `.unit`.** `calculateYoungFringeSpacing` (`src/domain/apparatus/calculateYoungFringeSpacing.ts:29`) returns `{ label: 'Fringe spacing', value, unit: 'mm' }`. That object is stored verbatim in `RunRecord.result` and compared for **string equality** in three places: `AppState.reduceRecordRun` (`src/core/store/AppState.ts:236-238`) and twice in `validateCaseRecordForDefinition` (`src/schemas/CaseRecordSchema.ts:184-186, 279-280`). If the label becomes French, every previously recorded run fails revalidation. **Leave the calculator untouched.** Display resolves `t('experiment.result.fringeSpacing')` and formats `value` + `unit` through `formatMeasurement`.

2. **Recognition labels and descriptions.** `recognitionDefinitions()` (`src/domain/recognition/recognitionRules.ts:26-45`) supplies `label`/`description`, they are written into the record, and `CurrentRecognitionSchema` (`src/schemas/CaseRecordSchema.ts:79-84`) rejects any record whose label/description does not match the authored contract byte-for-byte. **Do not localize `definitions`.** Keep the canonical English in the domain and record, and resolve display text by `RecognitionId`: `t('recognition.source-discipline.label')`.

3. **Persisted peer-review feedback.** `evaluatePeerReview` (`src/domain/review/peerReviewRules.ts:26-31`) copies `rule.feedback` and `rule.revisionPath` verbatim into each `PeerReviewIssue`; those issues are written into `DecisionHistoryEntry.feedback` and persisted. On load, `validateCaseRecordForDefinition` **recomputes** the review and compares `JSON.stringify(feedback.issues) !== JSON.stringify(entry.feedback.issues)` (`src/schemas/CaseRecordSchema.ts:234-236`, and again for `completion` at `286-294`). A decision saved in English would therefore be rejected outright after switching to French. **`evaluatePeerReview` must keep emitting the canonical `en` text.** The review panel resolves the localized text by `issue.ruleId` (and `issue.code`), which both already travel with the issue.

4. **`Result.error.message`.** `ResultError` already carries a stable `code` (`src/core/errors/Result.ts`). Localize by code at the presentation boundary; leave the `message` field as the dev-facing default and the fallback. Do not thread a `Locale` parameter into `src/domain/` — that would break the purity rule and put presentation concerns in the phase machine.

**The one genuine exception — `overreachPhrases`.** These are *detection* phrases matched against the learner's own typed conclusion (`peerReviewRules.ts:46-49`), so an English-only list never fires for a French learner. But making detection depend on the active locale would make the recomputation in trap 3 locale-dependent and reintroduce the same record rejection. **Author a French phrase list and always match against the union of both locales**, regardless of the active language. Detection stays deterministic, records stay portable, and the FR learner gets the same calibration feedback. (The pivot replaces free-text conclusions with 1-of-4 proposals, so this path is transitional — do not over-engineer it.)

**One more, milder:** `evaluateContextReadiness` returns `missingArtifactLabels` built from `displayName` (`src/domain/cases/contextPredictionReadiness.ts:15-17`), which becomes `LocalizedText`. Keep it returning the canonical `en` labels and **add a parallel `missingArtifactIds`** so the presentation can resolve localized names by id. `selectMissingContextArtifactLabels` (`src/core/store/selectors.ts:47-48`) and the `missing-contextual-sources` error message are the two consumers.

### Current implementation: preserve and extend

These are the exact surfaces this story touches. Read them before writing code.

- **Store shape and freezing.** `src/core/store/AppState.ts` builds every state through `freezeState`, which deep-freezes each slice. Adding `locale` means touching `freezeState`, `createInitialAppState`, `createAppStateFromCaseRecord`, and `reduceReplayStart`. `reduceAppState` is an exhaustive `switch` over the `AppAction` union — adding the action without a case is a `tsc` error, which is the safety net you want.
- **Store notification.** `createStore` (`src/core/store/createStore.ts:24-27`) notifies *all* `listeners` on every successful dispatch. Scenes and the `SceneRouter` already subscribe via `store.subscribe`, so a locale change automatically reaches every open scene — **provided each renderer re-applies its text on update rather than only in `create()`**. That is the whole mechanism behind AC2's re-render requirement; no new event bus is needed.
- **Persistence boundary.** `IndexedDbRepository` (`src/adapters/persistence/IndexedDbRepository.ts`) opens `quantique-progress` at **version 1** with a single `case-records` store. Its `DatabaseConnection` type hard-codes `storeName: 'case-records'`; widen it. `caseRecordRepository.ts` is the pattern to copy for `settingsRepository.ts`: constructor injection of a storage seam, Zod validation on read, typed `Result` out.
- **Boot sequence.** `src/main.ts` → `createBootShell` → `registerOfflineCache` → `loadCaseDefinition('young-interference')` → restore saved record → `createStore` → mount DOM panels → `StartGame` → on Phaser `ready`, construct the `SceneRouter`. Settings load belongs immediately before `createStore`.
- **Phaser game.** `src/game/main.ts` runs at 1024×768 with `Scale.FIT`; the routed phase scenes plus a persistent `LectureBookScene` overlay are registered there. AC4 names 1280×720 — that is the *viewport* target from NFR1, and `Scale.FIT` maps the 1024×768 canvas into it. Test at a 1280×720 viewport.
- **Scene lifecycle.** `LaboratoryScene` is the reference: store `unsubscribe`, `this.events.once('shutdown', this.shutdown, this)`, destroy renderers in `shutdown()`. The `LanguageSelector` renderer factory must follow it.
- **Content loading.** `src/adapters/content/loadCaseDefinition.ts` parses with `CaseDefinitionSchema.safeParse` and returns a typed `Result` — the single Zod boundary for case content. AC3's "Zod rejects a case missing a required locale **before domain logic**" is already structurally satisfied by this ordering; you are extending the schema, not moving the boundary.
- **Existing partial i18n scaffolding — reuse it, do not duplicate it.** Story 1.10 anticipated this work: `ScenarioDialogueBeat.textKey` (`src/domain/cases/ScenarioScript.ts:13-17`) is already a key rather than inline text, `PhasePlaceholderScene`'s comment defers copy to this story, and `RenditionLocale` / `LocalizedTextualRendition` already model a per-locale rendition. Align your key convention with `textKey` so Story 1.11 can resolve dialogue beats through the same lookup without a second mechanism.

### Architecture compliance (must follow)

- **ADR-010 (this story).** All player-facing text resolves through an i18n layer with `en`/`fr` resources; case strings carry both locales (Zod-validated); locale lives in the store and persists in settings; Phaser fonts include the French glyph set. Localization beyond EN/FR is out of scope.
- **ADR-001 (revised v1.1).** One authoritative store; Phaser scenes are the sole interactive surface and dispatch typed intents; no direct state mutation from scenes. The `LanguageSelector` dispatches; it never writes state or touches IndexedDB.
- **ADR-002 / ADR-007.** Settings persist to IndexedDB via `idb`; the print view remains the only DOM surface besides the boot frame.
- **Purity.** `src/domain/` imports no Phaser, DOM, `fetch`, or IndexedDB — and, by the decision above, no locale either. `src/core/i18n/` is pure TypeScript (`Intl` and `import.meta.env` only) and is safe to import from `core/` and up.
- **Layering.** `src/adapters/` owns side effects and may depend inward on `core/` and `domain/`; the direction never reverses. Locale resources live in `core/` because both `adapters/phaser/` and `ui/print/` consume them.
- **Configuration.** The architecture's Configuration section already states: *"Player settings store language (EN/FR), audio, display, and input preferences"* and maps them to `IndexedDB/settings`. Task 3 is the literal implementation of that line.
- **Naming.** `PascalCase.ts` for classes (`LanguageSelector.ts`), `camelCase.ts` for modules (`translate.ts`, `formatNumber.ts`, `settingsRepository.ts`), `UPPER_SNAKE_CASE` for constants (`LOCALES`, `DEFAULT_LOCALE`), domain events `noun.verb` (`settings.localeSet` follows the existing `apparatus.controlSet` / `theory.conclusionSet` action style).
- **Consistency rules.** Renderer factories own Phaser object create/update/destroy; tests assert public actions and selectors, never renderer internals or incidental pixels.

### Project Structure Notes

- **`src/core/i18n/` is a new folder not in the architecture's target tree.** It belongs in `core/` (pure, shared by `adapters/phaser/` and `ui/print/`) rather than `config/` (typed build defaults) or `domain/` (must stay presentation-free). Record the addition in the Dev Agent Record so the architecture tree can be updated.
- **`src/adapters/phaser/ui/` is in the target tree but does not exist yet.** `LanguageSelector.ts` creates it; Story 1.12 adds `DialogueBox` / `ProposalChoice` / `SceneNav` alongside.
- **Layout drift is pre-existing and out of scope.** The architecture shows `src/app/` and `createPhaserGame.ts`; the code uses `src/main.ts` + `src/game/main.ts`. Story 1.10 explicitly deferred that realignment — do not restructure here.
- **`dist/` is build output.** Edit `public/cases/young-interference/case.json` only; `dist/` regenerates via `npm run build`.
- **`public/style.css` is the DOM stylesheet.** The boot-shell selector needs minimal styling there; do not restyle the panels being retired.

### Testing standards

- **Runners.** Vitest for `tests/unit/**` and `tests/integration/**` (`npm run test`); Playwright for `tests/e2e/**` (`npm run test:e2e`, chromium by default; the E2E server runs `npm run build && npm run preview` on `127.0.0.1:4173`).
- **No real `Phaser.Game` in Vitest.** Node has no canvas. Keep `translate`, `formatMeasurement`, and `resolveLocalizedText` pure and unit-test them directly; for anything router- or scene-shaped, inject a minimal fake exactly as `tests/integration/SceneRouter.test.ts` does.
- **Assert the public surface.** Selectors, typed actions, and rendered text — never renderer private fields.
- **AC7 is two specific tests.** (a) a unit test asserting resource completeness **in both directions** plus English fallback; (b) an integration test asserting the selector switches language, persists it, and re-renders text. Do not merge them into one.
- **AC4 wants a measured render check, not a screenshot diff.** Screenshot baselines are brittle across CI font rendering; assert text-object widths against wrap bounds and the pangram against an expected width range.
- **Offline reload is a release gate.** `npm run test:e2e:offline` must cover locale persistence, not just case progress.
- **Known-failing baseline specs.** Several e2e specs fail at baseline `128f1bf` for reasons tracked in `deferred-work.md` (a notebook button renamed out from under ~6 specs; a `young-experiment.spec.ts:19` disabled-state mismatch). Establish which specs fail *before* your changes and report the delta — do not adopt or fix them here.

### Project Context Rules

Extracted from `_bmad-output/project-context.md`, filtered to this story.

**⚠️ `project-context.md` is stale relative to the 2026-08-05 pivot.** It is dated 2026-08-04 and still asserts the pre-pivot dual-surface model ("Semantic HTML owns all essential controls…", "Every essential Phaser gesture needs an equivalent semantic HTML control", the accessibility rules). Those are superseded by ADR-001 (revised), ADR-008, and NFR6/NFR7 in `epics.md`. **Where the two conflict, follow the pivot documents.** Flag the staleness in the Dev Agent Record; regenerating that file is a separate task.

Rules that **do** apply here:

- **Stack, pinned.** Phaser 4.2.1, TypeScript, Vite 8.1.5, `idb` 8.0.3, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1. The lockfile is committed to pin the exact Vite patch. **Add no new runtime dependency** — no `i18next`, no `formatjs`, no font package. The layer is ~100 lines of project-owned TypeScript over `Intl`; a dependency would contradict the pinned-stack rule and the static-offline release constraint.
- **Phaser boundaries.** Domain code never imports Phaser. Phaser objects are created, updated, and destroyed only by renderer factories under `src/adapters/phaser/`. Clean up scene subscriptions and display objects on shutdown.
- **Performance.** Do not log, parse JSON, touch IndexedDB, or allocate transient collections in render/update hot paths — resolve translations on state change, not per frame. Target 60 FPS at 1280×720.
- **Organization.** No generic `services/`, `managers/`, or `helpers/` catch-all. `src/domain/` stays pure. `src/adapters/` owns all side effects. Only repositories fetch and validate case JSON; only persistence adapters touch IndexedDB. Case definitions under `public/cases/` are immutable content; player progress belongs only in IndexedDB.
- **Naming.** `PascalCase` classes/files, `camelCase` modules/functions, `UPPER_SNAKE_CASE` constants, `kebab-case` case IDs/assets, `noun.verb` domain events, `camelCase` JSON fields.
- **Testing.** Unit-test all pure validators and migrations with Vitest using fixtures; never require Phaser or a browser to test logic. Test invalid content/imports as expected `Result` failures, and confirm valid local progress survives a failed import or save.
- **Platform/build.** Static hosted web app, cache-versioned assets, no backend, no network request may block core play. Offline reload is a release gate. Export/import stays versioned JSON; print uses the semantic CSS print view.
- **Don't-miss.** Do not expose raw errors or log learner-entered conclusions by default — the `i18n.missingKey` warning must be dev-only and must never carry player text. Do not mutate shipped case definitions or mix them with player progress. Do not create hard-fail states.
- **Superseded — ignore:** the semantic-HTML-authoritative rules, the "every Phaser gesture needs a semantic equivalent" rule, axe/accessibility acceptance, and non-colour-only encoding (ADR-008; NFR6/NFR7 de-scoped; Story 7-2 descoped).

### Previous story intelligence

**From Story 1.10 (scene router, done 2026-08-05) — the most recent completed work:**

- 1.10 deliberately left hooks for this story: `ScenarioDialogueBeat.textKey`, the `PhasePlaceholderScene` comment deferring copy to 1.1b/ADR-010, and the neutral development marker instead of authored placeholder copy. Use them.
- **The `sw.js` cache-name precedent is directly applicable.** 1.10 bumped `CACHE_NAME` to `v2` because `scenarioScript` became required in a `.strict()` schema and a stale cached `case.json` boots into "content unavailable". Adding required `fr` fields is the same change class — bump to `v3` and write the same style of comment.
- **Phaser scene-manager timing.** The `SceneRouter` is constructed on the game's `ready` event, not inline, because before the scene manager boots `start` only flags a key and `stop` is a silent no-op. If the language selector needs a scene reference at boot, respect the same ordering.
- **Store-notify reentrancy.** `SceneRouter.activate` wraps `route()` in try/catch because it runs inside `notify` inside `dispatch`, and an escaping throw would break `dispatch`'s `Result` contract. A subscriber that persists settings runs in the same position — **do not let a rejected IndexedDB write throw out of the subscriber**; catch it and degrade.

**From the 1.10 code review (`deferred-work.md`, 2026-08-05) — carry-forward risks:**

- `LectureBookScene` is auto-started, never routed, and reaches directly into `LaboratoryScene`. It is therefore always active alongside the routed scene — so "the active scene" is not single-valued, and nothing ever stops it (its scroll listener and renderer are never released). If you localize its chrome, remember it never re-runs `create()`; it must re-render text from the store subscription. Story 2.1 owns the coupling; do not fix it here.
- The production offline race (worker caches per response, no atomic swap) is untracked. Bumping `CACHE_NAME` does not fix it — a user who reloads offline mid-cache still gets a degraded boot. Not this story's job, but do not claim offline-reload robustness beyond what the gate actually tests.
- `#game-container` is `aria-hidden="true"` while becoming the authoritative surface. Accessibility is de-scoped (ADR-008); note it, do not act on it.

**From the earlier Epic 1 stories:** the codebase consistently uses typed `Result` returns for expected failures, constructor injection for testability, `.strict()` Zod objects with `superRefine` for cross-field rules, and comments that explain *why* a non-obvious choice was made. Match that voice — especially the `superRefine`-with-authored-message pattern when you add locale-completeness validation.

### Git intelligence

Recent commits (`128f1bf` Review 1.10, `7f54d27` Dev 1.10, `c5eba0f` Story 1.10, `c431537` Change course) show the working rhythm: a story commit, a dev commit, then a review commit. Files touched most recently — `src/schemas/CaseDefinitionSchema.ts`, `src/domain/cases/ScenarioScript.ts`, `src/game/main.ts`, `src/main.ts`, `public/sw.js` — are the same files this story extends, so the 1.10 diffs are the best available style reference. `c431537 "Change course"` is the pivot commit that rewrote the planning artifacts; anything predating it in `docs/` or `project-context.md` should be read with suspicion.

### Latest technical information

- **Zod 4.4.3.** `z.enum(LOCALES)` accepts a `readonly` tuple directly, so `LOCALES` can back both the TS union and the schema with no duplication. Keep using `.strict()` + `superRefine` with authored messages, as the existing schemas do. Note the ordering behaviour already documented in `CaseDefinitionSchema.ts:116-118`: a `superRefine` is skipped once the base parse fails, so put the locale-completeness rule in the object schema itself (both keys required) rather than in a refinement, and reserve `superRefine` for cross-field rules like equal list lengths.
- **`Intl.NumberFormat`.** Universally available in the supported desktop browsers (Chrome, Firefox, Safari, Edge) and in Node 20+ (full ICU), so the same code path is exercised in Vitest and in the browser. French formatting uses a comma decimal separator and U+202F (narrow no-break space) as the group separator — **assert on the exact code point in tests**, not on a plain space, or the test will pass locally and fail in CI on a different ICU build. Construct formatters once and reuse them; constructing one per call is a known hot-path cost.
- **Vite 8.1.x.** `import.meta.env.DEV` is statically replaced at build time, so a `if (import.meta.env.DEV)` guard around the `i18n.missingKey` warning is tree-shaken out of the production bundle — which is what makes the dev-only requirement in AC5 real rather than nominal.
- **Phaser 4.2.1 text.** `Phaser.GameObjects.Text` renders through the canvas 2D text API, so glyph coverage is the browser's font resolution, not Phaser's — a CSS-style `fontFamily` stack with a generic fallback is the correct mechanism and no font loader is required. `Text.width` / `.height` reflect the measured render, which is what makes the AC4 measured check possible. Keep using `resolution` as the existing renderers do so accented glyphs stay crisp on high-DPI displays.
- **`idb` 8.0.3.** The `upgrade` callback receives the old version; guard each `createObjectStore` with `objectStoreNames.contains(...)` exactly as the current v1 code does, so a fresh install and a v1→v2 upgrade both land correctly. The existing `blocked` / `blocking` handling already covers the multi-tab upgrade case — do not remove it.

### References

- [epics.md — Story 1.1b](_bmad-output/planning-artifacts/epics.md#L200-L244), [NFR19](_bmad-output/planning-artifacts/epics.md#L71), [UX-DR5](_bmad-output/planning-artifacts/epics.md#L99)
- [game-architecture.md — Content Model / Internationalization](_bmad-output/game-architecture.md#L199), [ADR-010](_bmad-output/game-architecture.md#L232), [Configuration](_bmad-output/game-architecture.md#L289-L303), [Project Structure](_bmad-output/game-architecture.md#L342-L457)
- [sprint-change-proposal-2026-08-05.md — Addendum A](_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-05.md#L193-L200)
- [gdd.md — Bilingual at launch](_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md#L202), [Out of scope](_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md#L238)
- [EXPERIENCE.md — v1 interface languages](_bmad-output/planning-artifacts/ux-designs/ux-Quantique-2026-08-04/EXPERIENCE.md#L94-L96)
- [project-context.md](_bmad-output/project-context.md) *(stale re: the pivot — see Project Context Rules)*
- [1-10-scene-router-and-adventure-flow.md](_bmad-output/implementation-artifacts/1-10-scene-router-and-adventure-flow.md), [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md)
- Code: [AppState.ts](src/core/store/AppState.ts), [AppAction.ts](src/core/store/AppAction.ts), [selectors.ts](src/core/store/selectors.ts#L28-L31), [createStore.ts](src/core/store/createStore.ts), [CaseRecordProjection.ts](src/core/store/CaseRecordProjection.ts), [Result.ts](src/core/errors/Result.ts)
- Code: [CaseDefinition.ts](src/domain/cases/CaseDefinition.ts), [ScenarioScript.ts](src/domain/cases/ScenarioScript.ts#L8-L17), [calculateYoungFringeSpacing.ts](src/domain/apparatus/calculateYoungFringeSpacing.ts#L29), [recognitionRules.ts](src/domain/recognition/recognitionRules.ts#L26-L45), [peerReviewRules.ts](src/domain/review/peerReviewRules.ts)
- Code: [CaseDefinitionSchema.ts](src/schemas/CaseDefinitionSchema.ts), [CaseRecordSchema.ts](src/schemas/CaseRecordSchema.ts#L79-L84), [validateCaseRecordForDefinition](src/schemas/CaseRecordSchema.ts#L136-L141)
- Code: [IndexedDbRepository.ts](src/adapters/persistence/IndexedDbRepository.ts#L13-L35), [caseRecordRepository.ts](src/adapters/persistence/caseRecordRepository.ts), [sw.js](public/sw.js#L1-L6)
- Code: [main.ts](src/main.ts), [game/main.ts](src/game/main.ts), [BootShell.ts](src/ui/BootShell.ts), [index.html](index.html), [CaseRecordPrintView.ts](src/ui/print/CaseRecordPrintView.ts)
- Code: [ApparatusRenderer.ts](src/adapters/phaser/renderers/ApparatusRenderer.ts), [LectureBookRenderer.ts](src/adapters/phaser/renderers/LectureBookRenderer.ts#L196-L235), [PhasePlaceholderScene.ts](src/adapters/phaser/scenes/PhasePlaceholderScene.ts)
- Content: [case.json](public/cases/young-interference/case.json)

## Open Questions

Saved for after implementation planning — none of these block starting.

1. **First-run default locale.** This story defaults to `en`. Should first run instead read `navigator.language` and pick `fr` for a `fr-*` browser? It is better for French classrooms but adds a browser API to the boot path and makes E2E locale-dependent unless every spec sets the locale explicitly. Recommendation: ship `en` + a prominent boot selector now; revisit with the Story 2.4 educator validation, which covers both locales.
2. **Primary-source rendition language.** Confirm the decision that the Bakerian Lecture and Opticks archive text stay in the original English with localized chrome and a "presented in the original English" note. A French *translation* of a primary source would be a new sourced artifact requiring provenance and rights review (NFR11, FR26/FR27) — a content story, not a foundation story.
3. **French `forbiddenPath` collisions.** *route* and *phase* are ordinary French words that the current authored-content guard would reject. Confirm the preferred fix: a locale-specific word list (recommended), or narrowing the rule to the arrow forms only.
4. **FR copy review.** Who signs off on the French translations for scientific-register accuracy? The UX spine mandates a specific microcopy voice ("short declarative", never score language, never right/wrong framing) — that voice needs to survive translation. Story 2.4's educator validation gate covers both locales but is downstream of the copy being written.
5. **Case-definition version compatibility policy.** The `1.4.0 → 1.5.0` bump extends an ad-hoc allowlist in `validateCaseRecordForDefinition` that already hard-codes `1.2.0`. Worth replacing with a declared compatibility range before Epic 3 adds more case versions?

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
