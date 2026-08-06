# Adding player-facing text (EN + FR)

Quantique ships English and French from the first release (ADR-010, NFR19). Every player-facing
string resolves through the i18n layer. This page is the short version for anyone adding a scene,
a widget, or case content.

## The one rule

**No literal player-facing string in `src/adapters/phaser/`, `src/ui/print/`, or `index.html`.**

Text comes from one of exactly two places:

| Kind | Lives in | Resolved with |
| --- | --- | --- |
| App-owned interface text | `src/core/i18n/locales/{en,fr}.ts` | `translate(locale, key)` / `createTranslator(locale)` |
| Authored case content | `public/cases/**/case.json` as `LocalizedText` | `resolveLocalizedText(text, locale)` |

The active locale always comes from the store: `selectLocale(state)`. Never from a local field or a
constructor argument captured once.

## Where the language comes from

**The browser, not the player.** `resolveBrowserLocale()` reads `navigator.languages`, matches on the
primary subtag (`fr`, `fr-FR`, `fr-CA` → French; `frr` → no match), walks the list in the browser's
own priority order, and falls back to `en`. `main.ts` calls it synchronously before anything renders
and passes the result into `createInitialAppState`.

There is **no language control anywhere in the game**, and the language is **never stored**:
`navigator.languages` is available on every boot including an offline reload, so there is nothing to
persist and nothing that can go stale. Consequently `AppState.locale` never transitions — there is no
locale action to dispatch — but renderers should still resolve their text at render time rather than
capturing it at construction, so re-adding an override later stays a small change.

To test in French, give the browser context a French language: `test.use({ locale: 'fr-FR' })` in
Playwright, or `resolveBrowserLocale(['fr-FR'])` in Vitest.

### Why interface text is a TypeScript module, not fetched JSON

`fr.ts` is typed `Record<TranslationKey, string>` where `TranslationKey = keyof typeof en`, so a key
added to `en.ts` and forgotten in `fr.ts` fails `npm run typecheck`. Bundling also keeps locale
resources out of `public/sw.js`, a fetch-through worker with no atomic pre-cache — an unfetched
locale file would be a 503 on an offline reload.

## Adding an interface string

1. Add a flat dotted key to `src/core/i18n/locales/en.ts`, grouped under an existing comment block.
2. Add the same key to `fr.ts`. `tsc` will demand it.
3. Use `{name}` for interpolation. Both locales must use the same placeholder names — a unit test
   asserts this, because a renamed placeholder in one language silently prints `{name}` to a player.
4. Resolve it: `const t = createTranslator(selectLocale(state)); t('your.key', { name })`.

Missing keys fall back to English, then to a humanised key — never a raw key or an empty string. The
fallback logs a dev-only `i18n.missingKey` warning carrying **only** the key and the locale; never
put player-entered text in it.

## Adding case content

Wrap the field in `LocalizedText` (`{ en, fr }`) or `LocalizedTextList` (`{ en: [], fr: [] }`) and
update the TypeScript type, the Zod schema, and `case.json` **in lockstep**. Zod requires both
locales and equal list lengths, and rejects the case before any domain logic runs.

Adding a required field to the strict case schema also means:

- bump `case.json` `version`,
- extend the compatibility allowance in `validateCaseRecordForDefinition`
  (`src/schemas/CaseRecordSchema.ts`) so existing saved records still load,
- bump `CACHE_NAME` in `public/sw.js`, or a stale cached `case.json` boots into "content
  unavailable".

### What stays canonical (single string, never translated)

`id`, `sourceId`, `controlId`, `sourceRefs`, `provenance.reference`, `creatorOrOrigin`,
`citation.citationText`, `archiveUrl`, `apparatus.primaryControls[].unit` (SI symbols are identical
in French), and `experiment.modelVersion`.

## Archival renditions

A readable source carries **one rendition per shipped locale**, and each declares what it is:

- `kind: 'transcription'` — reproduces the printed source. **Exactly one per source**, enforced by
  Zod. Two transcriptions of the same pages in different languages is a provenance claim nobody has
  reviewed.
- `kind: 'translation'` — a modern rendering of that transcription. The book shows
  `book.translatedRendition` on every translated spread, and the locale's `citation.reuseStatement`
  must say plainly that the pages are a translation and that the source of record is the original.

Renditions must be **page-for-page aligned**: same section ids, same `sourcePages`, same paragraph
counts. Zod enforces it, so the spread count and the printed page numbers mean the same thing to
every reader.

`citation.citationText` and `archiveUrl` never change language — they cite the original.

**A new translation of a historical source needs a human review before release** (NFR11, FR26, FR27,
and the project's "no unreviewed historical assets or claims" rule). The `kind` tag and the in-book
notice keep the claim honest; they are not a substitute for that review.

## ⚠️ Canonical-value traps

**Governing rule: the domain consumes the canonical `en` string; the presentation resolves the
active locale by stable id** (`ruleId`, `sourceId`, `controlId`, `RecognitionId`, error `code`).
Locale never enters `src/domain/`.

That is not stylistic. Four values look like display text but are **persisted and equality-validated
on load** — localizing them in place silently destroys saved progress the moment a player switches
language.

1. **`ExperimentResult.label` / `.unit`.** `calculateYoungFringeSpacing` returns
   `{ label: 'Fringe spacing', … }`, stored verbatim in `RunRecord.result` and string-compared in
   `reduceRecordRun` and twice in `validateCaseRecordForDefinition`. Leave the calculator alone;
   display resolves `t('experiment.result.fringeSpacing')` and formats through `formatRecordedValue`.
2. **Recognition labels and descriptions.** `CurrentRecognitionSchema` rejects any record whose
   label or description does not match the authored contract byte-for-byte. Keep
   `recognitionDefinitions()` English; resolve display text by id, e.g.
   `t('recognition.source-discipline.label')`.
3. **Persisted peer-review feedback.** `evaluatePeerReview` copies `rule.feedback.en` into each
   issue; those are written into `DecisionHistoryEntry.feedback` and recomputed and JSON-compared on
   load. A decision saved in English would be rejected after switching to French. The review surface
   localizes by `issue.ruleId` against the case definition.
4. **`Result.error.message`.** Localize by the stable `code` at the presentation boundary with
   `translateError`; the `message` field stays the dev-facing default and the final fallback. Do not
   thread a `Locale` into `src/domain/`.

Milder: `evaluateContextReadiness` returns canonical `missingArtifactLabels` **and** a parallel
`missingArtifactIds`. Use `selectMissingContextArtifactNames` for display and leave the labels alone.

**The one genuine exception — `overreachPhrases`.** These are *detection* phrases matched against
the learner's own conclusion, so an English-only list never fires for a French learner. But making
detection depend on the active locale would make trap 3's recomputation locale-dependent. Author
both lists and always match **the union of both locales**, regardless of the active language.

A tempting alternative — resolving the whole `CaseDefinition` to one locale at the loading boundary
— breaks exactly here: it would make `state.caseDefinition` locale-dependent while revalidation
compares recomputed results against stored ones.

## Numbers and units

Use `formatMeasurement(locale, value, decimals, unit)` for a value whose precision comes from an
authored control step, and `formatRecordedValue(locale, value, unit)` for a value the domain already
rounded. French renders `0,25 mm` — comma decimal, U+202F narrow no-break space before the unit.
Assert on the exact code point in tests, never a plain space. Recorded scientific values stay
canonical numbers in the record; only their rendering changes.

## Rendering text

Resolve strings in `render()`, from `selectLocale(state)` — not once in `create()` or a constructor.
The locale is fixed for a session today, so nothing breaks either way, but reading it at render time
is what keeps the surfaces override-ready and costs nothing.

## Fonts

Use the stacks in `src/adapters/phaser/textStyles.ts` (`uiTextStyle`, `bookTextStyle`,
`monoTextStyle`). Do not add a downloaded webfont: the platform stacks already carry the full French
repertoire, and a font download works against NFR2 and the offline gate.

Budget for **length**, not just glyphs. French runs roughly 15–25% longer than English, and overflow
is a far likelier failure than a missing glyph. Give any fixed-width `Text` holding authored copy a
`wordWrap`, and reuse the shrink-to-fit loops in `LectureBookRenderer` rather than inventing a new
mechanism. `tests/e2e/french-typography.spec.ts` measures both.

## Tests to keep passing

- `tests/unit/I18n.test.ts` — resource completeness in both directions, fallback, interpolation.
- `tests/integration/LocaleProjection.test.ts` — a French browser produces French text, formatting
  and case content in a single first paint.
- `tests/e2e/french-typography.spec.ts` — glyph coverage and wrap bounds at 1280×720.
- `tests/e2e/offline-reload.spec.ts` — a French browser is still French after an offline reload.
  Release gate.

## Not localized on purpose

- The retiring `src/ui/*` DOM panels. They read authored text as canonical `.en` and are deleted by
  Stories 1.11, 1.12, 2.1, 2.3 and 2.5 as each Phaser scene reaches parity. Each replacement scene
  localizes its own text as it is built. **Two exceptions are kept and fully localized: the print
  view, and the Curated Record** — the Curated Record is where a learner first meets the sources, so
  an English-only version would defeat the point. Story 2.1's `LibraryScene` inherits its keys.
- `PhasePlaceholderScene`'s development marker. It is not player copy.
- `src/game/scenes/{Boot,Game,GameOver,MainMenu,Preloader}.ts` — unused Phaser-template leftovers
  that `src/game/main.ts` never registers.
- Any locale beyond EN and FR (NFR19, ADR-010).
- An in-game language selector, and any stored language preference. The browser is the sole input.
