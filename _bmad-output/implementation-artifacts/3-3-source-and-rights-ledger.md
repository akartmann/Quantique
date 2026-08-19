---
baseline_commit: 9254bef4d404be0fba54097747e65c576ad3ab31
---
<!--
  Story 3.3 — Source and rights ledger
  Epic 3: Reusable case authoring and provenance
-->

# Story 3.3: Source and rights ledger

Status: review

## Story

As a reviewer,
I want to audit each case claim and asset through a source and rights ledger,
so that only reviewed material reaches a public case.

## Acceptance Criteria

**AC1 — The ledger is authored case data, not a second copy of it** _(epic AC1; FR26, NFR10, NFR17)_

**Given** `contextualArtifacts[]` already carries `creatorOrOrigin`, `sourceType`, `provenance.category`, `provenance.reference`, `rightsStatus` and `caseRelationship`, and `assets.entries[]` carries `id` / `type` / `path` and nothing else,
**When** the ledger contract is added,
**Then** it adds **only what is missing** — a case-level `ledger` block, a `ledgerEntry` block per contextual artifact, and a `rights` block per asset entry (shapes fixed in Dev Notes §3),
**And** no ledger field restates a value the definition already holds: the ledger's provenance, rights-status, citation and claim-or-use columns are **read from the existing fields**, and a second authored copy of any of them is a defect, not a convenience,
**And** every new field is required — not optional — so a case cannot ship a row nobody audited (see Dev Notes §7 for why the 49 `as CaseDefinition` test fixtures do **not** force optionality).

**AC2 — Every FR26 field is present, and nothing is silently dropped** _(FR26; epic AC1)_

**Given** FR26 names primary and secondary sources, a scholarly reviewer, an educator context sheet, an accessible-controls reference, and a rights/replacement plan,
**When** a case authors its ledger,
**Then** all six are representable and all six appear on the ledger surface: `sourceRole` per source, `signOff.scholarlyReviewer`, `educatorContextSheet`, `accessibleControlsReference`, and a `replacementPlan` on every row whose rights are not reviewed,
**And** the accessible-controls reference and the accessibility-reviewer sign-off are recorded as **`de-scoped` with `reference: "ADR-008"`** — a distinct state that is neither `reviewed` nor `pending`, rendered as "de-scoped (ADR-008)", following Story 3.2 AC8's rule that a de-scoped role is recorded and not dropped,
**And** `de-scoped` may never be spelled `reviewed`: a `de-scoped` row with no `reference` is **rejected at load** with that path named.

**AC3 — Incomplete rights are visibly blocked from release approval** _(epic AC1 clause 2; NFR11)_

**Given** a case's ledger,
**When** `evaluateLedgerReleaseApproval(definition)` runs,
**Then** it is a **pure domain function** in `src/domain/sources/` that returns `{ decision: 'blocked' | 'clear', blockers: readonly LedgerBlocker[] }`, **fails closed** (the decision is `blocked` unless every check clears), and takes **no waiver, override or force parameter** — mirroring `docs/validation/young-release-decision-template.md`'s "There is no waiver field, override path, or partial approval",
**And** it emits one named blocker per failing row, of kind `source-rights-incomplete`, `asset-rights-incomplete`, `content-author-unrecorded`, `scholarly-review-pending`, or `educator-context-sheet-pending`, each carrying the offending subject's ID,
**And** a `de-scoped` row emits **no** blocker,
**And** the surface shows the decision as a banner **and** lists every blocker by name — "blocked" with no statement of what blocks it is not visible blocking.

**AC4 — Shipped content is audited honestly, and the honest answer today is BLOCKED** _(FR27, NFR11; epic AC2)_

**Given** `docs/validation/young-character-assets.md` records the five Young character PNGs as "generated and technically validated; **not rights-reviewed and not publicly cleared**", and both `case.json` files declare a `quantique-logo` asset with no rights record at all,
**When** Young's and the prototype's ledgers are authored from the material as it actually stands,
**Then** the five portrait rows are authored `status: 'incomplete'` with a real `replacementPlan` and `provenanceReference: "docs/validation/young-character-assets.md"`, and both ledgers resolve to **`blocked`** with those rows named,
**And** the prototype's scholarly-reviewer row stays `pending` (`deferred-work.md:211`, `docs/case-prototypes/morley-miller-prototype.md` §4) — a name nobody supplied would be the defect Story 3.2 AC7 forbids,
**And** nothing is authored `reviewed` to make the banner green: the tests assert the **blocked** decision and its exact blocker set, so the suite stays green while the release stays honestly blocked.

**AC5 — Unreviewed material cannot be represented as verified** _(epic AC2; FR27)_

**Given** the existing rule "only reviewed sources may provide a local textual rendition" is the *sources* half of this,
**When** the assets half is added,
**Then** an asset whose `rights.status !== 'reviewed'` is **rejected at load** if it also declares `reviewerState: 'reviewed'` — a signed-off row over uncleared rights is a contradiction, and the same rule applies to sources,
**And** a `pending` row may **not** carry a reviewer `name` or `date`: a named reviewer beside a pending state is exactly the ambiguity this AC exists to stop,
**And** an unreviewed asset is **not** hidden from the game. Young's five portraits keep rendering: a fictional colleague portrait is not a verified historical claim, and blanking the cast would break shipped play to satisfy a rule about *labelling*. What is forbidden is representing it as reviewed, and blocking release approval — both of which this story does.

**AC6 — A reviewer can open the ledger, for either shipped case** _(epic AC1 clause 1)_

**Given** the reviewer-route precedents `?mode=validation` (`ValidationSessionDisclosure`) and `?case=` (`resolveCaseId`),
**When** a reviewer opens `?ledger=1`,
**Then** the ledger renders into a new `#source-rights-ledger` document root as a semantic `<table>` per section (sources, assets, sign-off and references), and `?ledger=1&case=morley-miller` audits the prototype,
**And** the ledger route is **isolated like the validation route**: it builds no `CaseRecordRepository`, wires no autosave, mounts no printable record, and **does not start the Phaser game at all** — it returns after mounting,
**And** this is a **reviewer surface, not a player surface**: it dispatches no intent, so NFR20/ADR-011 does not apply to it, on the same reasoning `ValidationSessionDisclosure` already records in its own docstring. Do not add a Phaser ledger scene.

**AC7 — Bilingual from the same commit, with canonical values kept canonical** _(NFR19, ADR-010)_

**Given** every string the ledger adds,
**When** it ships,
**Then** every new interface string has a key in **both** `src/core/i18n/locales/en.ts` and `fr.ts`, and every new authored string (`claimOrUse`, `replacementPlan`) is `LocalizedText` that Zod validates for locale completeness,
**And** the three rights statuses reuse the **existing** `source.rights.*` keys rather than a second family, and `tests/unit/I18n.test.ts` extends its **derived** roster from the newly exported `ReviewerStateSchema` / `SourceRoleSchema` options — never a transcribed list (see the roster comment at `tests/unit/I18n.test.ts:109`),
**And** these stay canonical and untranslated, per `docs/i18n-authoring.md`: `citationText`, `archiveUrl`, asset `path`, `holderOrOrigin`, reviewer `name`, every date, `provenance.reference`, `provenanceReference`, and every `de-scoped` `reference`.

**AC8 — The rendition-of-record fallback covers a reconstruction** _(carried from the Story 3.2 review's `reconstruction` addition)_

**Given** `resolveRendition` (`src/core/i18n/resolveLocalizedText.ts:44`) falls back to `kind === 'transcription'` when the active locale has no rendition,
**When** the rendition of record is a `reconstruction` — which 3.2's review made legal — the chain skips it and lands on `renditions[0]` by array order,
**Then** the fallback selects the rendition **of record**, meaning `kind !== 'translation'`, so the reader never falls back onto a translation while the notice calls it the original,
**And** this is recorded as **unreachable with valid content** (Zod requires one rendition per shipped locale, so `.find(locale)` always hits) — it guards the degraded-cache path, and it is in scope here because this story owns the provenance vocabulary that created the gap.

**AC9 — The version, cache and record-compatibility carry is complete** _(NFR10, NFR12)_

**Given** `case.json` and `asset-manifest.json` both gain required fields,
**When** the change lands,
**Then** Young goes to `case.json` **1.21.0** and manifest **1.2.0**, the prototype to **1.1.0** / **1.1.0**, and `assets.manifestVersion` is bumped in lockstep in each `case.json` — `loadCaseDefinition:11` refuses a mismatch,
**And** `public/sw.js` `CACHE_NAME` goes to **v9** with a comment stating the change class: required `ledger` / `ledgerEntry` / `rights` fields mean a cached 1.20.0 `case.json` strict-parses into "content unavailable" with no recovery. This is the exact defect the 3.2 review caught at v8; do not leave it at v8,
**And** `CaseRecordSchema`'s compatibility allowlist gains a **Young `1.21.0`** clause and the prototype's **first `morley-miller`** clause, each stating what changed and what was verified byte-identical **by diffing the files** — not assumed. `schemaVersion` stays `3` and `migrateCaseRecord.ts` is untouched: nothing recorded moves, and no ledger field is recomputed or compared by a record.

**AC10 — The ledger imports the review tables that already exist** _(epic AC2; `deferred-work.md:211`)_

**Given** `docs/case-prototypes/morley-miller-prototype.md` §4 says "Story 3.3 builds the source-and-rights ledger that will audit this table",
**When** the ledger ships,
**Then** the prototype's sign-off table and Young's `docs/validation/young-source-rights-review-template.md` rows are **fed by** the ledger: each names the ledger route as its evidence reference, and the prototype artifact's closing line is updated from "Story 3.3 will" to what 3.3 actually did,
**And** `docs/source-rights/README.md` is created (the location `game-architecture.md` §System Location Mapping designates for provenance process guidance) stating the three reviewer states, the no-waiver rule, and how to author a row,
**And** `docs/source-rights/quantique-shared-assets.md` records `/assets/logo.png`'s origin so its `provenanceReference` points at something real,
**And** `deferred-work.md` is updated: close the ledger half of item 211, carry item 231 (the reconstruction's `reviewed` status — the scholarly reviewer's call, not this story's) and the 1887 transcription-fidelity item (Story 4.1), with reasons.

**AC11 — Verification**

**Given** the change is complete,
**When** the gates run,
**Then** `npm run typecheck` is clean, `npm test` is green with **at least 1370** tests across **at least 77** files (baseline measured on this HEAD: **1344 / 74**), and `npm run test:e2e` (chromium) is green on an idle machine with **at least 62** passing (baseline 61),
**And** `npm run typecheck:tests` does **not exceed 114 errors across 59 files** — the true HEAD baseline, re-measured, not the stale figure earlier stories quoted,
**And** two mutation proofs are recorded, each broken and restored: (1) authoring one portrait `status: 'reviewed'` flips the decision to `clear` — proving the gate actually reads assets rather than only sources; (2) disabling the replacement-plan rule lets a hostile fixture parse — proving the rule fires,
**And** no new accessibility-parity assertion is added, no existing a11y spec is deleted, and the ledger route is **not** added to `tests/e2e/accessibility.spec.ts` (ADR-008) — while the markup is still semantic, because a `<table>` with real headers costs nothing.

## Tasks / Subtasks

- [x] **T1 — Contract (AC1, AC2, AC5)**
  - [x] `src/domain/cases/CaseDefinition.ts`: add `SourceRole`, `ReviewerState`, `ReviewerSignOff`, `LedgerEntry`, `AssetRights`, `CaseLedger`; extend `ContextualArtifact` with `ledgerEntry`, `assets.entries[]` with `rights`, and the definition with `ledger`. All `Readonly`, all required.
  - [x] `src/schemas/CaseDefinitionSchema.ts`: export `SourceRoleSchema` and `ReviewerStateSchema` (the I18n roster derives from them); add the three blocks `.strict()`; add refinements R1–R6 from Dev Notes §4, each with an authored message naming the offending path.
  - [x] Keep `SourceRightsStatusSchema` and `isSourceEligibleForInspection` **unchanged**. Reading-room eligibility is not a release gate and must not start behaving like one.
- [x] **T2 — The gate (AC3)**
  - [x] `src/domain/sources/releaseApproval.ts`: `LedgerBlocker`, `LedgerReleaseApproval`, `evaluateLedgerReleaseApproval`. Pure — no Phaser, DOM, fetch or IndexedDB. No waiver parameter.
  - [x] `src/domain/sources/caseLedger.ts`: `selectLedgerRows(definition)` projecting sources and assets into display rows, reading existing fields for provenance / rights / citation / claim-or-use.
  - [x] Do **not** move existing source types into `src/domain/sources/`. New modules only — see Dev Notes §5.
- [x] **T3 — Content (AC4, AC9)**
  - [x] `public/cases/young-interference/case.json` → 1.21.0, `assets.manifestVersion` → 1.2.0, ledger authored; `asset-manifest.json` → 1.2.0 with a `rights` block on all six entries.
  - [x] `public/cases/morley-miller/case.json` → 1.1.0, manifest → 1.1.0, same.
  - [x] The five portraits: `status: 'incomplete'`, `reviewerState: 'pending'`, real bilingual `replacementPlan`, `provenanceReference: "docs/validation/young-character-assets.md"`.
  - [x] `quantique-logo`: `status: 'reviewed'`, `provenanceReference: "docs/source-rights/quantique-shared-assets.md"`, `holderOrOrigin` naming the project.
  - [x] `public/sw.js` → `quantique-bootstrap-v9` with the change-class comment.
  - [x] `src/schemas/CaseRecordSchema.ts`: Young 1.21.0 clause + first `morley-miller` clause, each with the diff-verified reasoning.
- [x] **T4 — Surface (AC6, AC7)**
  - [x] `index.html`: add `<div id="source-rights-ledger"></div>`; add `'#source-rights-ledger'` to `REQUIRED_ROOTS` in `src/main.ts`.
  - [x] `src/adapters/content/resolveLedgerMode.ts`: `resolveLedgerMode(search): boolean` from `?ledger=1`, its own module so it is testable without a document (the `resolveCaseId` reason).
  - [x] `src/ui/SourceRightsLedger.ts`: `mountSourceRightsLedger(root, definition, locale)` — semantic tables, decision banner, blocker list, `data-testid` hooks.
  - [x] `src/main.ts`: after `loadCaseDefinition` succeeds, if ledger mode → mount and `return` before any store, repository or `StartGame`.
  - [x] `en.ts` / `fr.ts`: new `ledger.*` keys. Reuse `source.rights.*`.
- [x] **T5 — AC8**
  - [x] `resolveRendition`: fallback on `kind !== 'translation'`; unit test for the degraded path with a `reconstruction` of record.
- [x] **T6 — Tests (AC11)**
  - [x] `tests/unit/SourceRightsLedger.test.ts` — every blocker kind, `de-scoped` emits none, fail-closed, no waiver.
  - [x] `tests/unit/CaseDefinition.test.ts` — R1–R6 rejection fixtures; the real Young and prototype `case.json` still parse.
  - [x] `tests/integration/SourceRightsLedgerSurface.test.ts` — every row and blocker rendered, EN and FR.
  - [x] `tests/e2e/source-rights-ledger.spec.ts` — `?ledger=1` and `?ledger=1&case=morley-miller`: blocked banner, named rows, and **no Phaser canvas started**.
  - [x] `tests/unit/I18n.test.ts` — extend the derived roster and its count assertion.
  - [x] Record both mutation proofs in the Dev Agent Record.
- [x] **T7 — Docs (AC10)**
  - [x] `docs/source-rights/README.md`, `docs/source-rights/quantique-shared-assets.md` (new).
  - [x] Update `docs/validation/young-source-rights-review-template.md`, `docs/case-prototypes/morley-miller-prototype.md` §4, `deferred-work.md`.

## Dev Notes

### 1. Scope boundary — read this first

**In scope:** `src/domain/cases/CaseDefinition.ts`, `src/domain/sources/**` (new), `src/schemas/CaseDefinitionSchema.ts`, `src/schemas/CaseRecordSchema.ts` (allowlist clauses only), `src/adapters/content/resolveLedgerMode.ts` (new), `src/ui/SourceRightsLedger.ts` (new), `src/main.ts`, `index.html`, `src/core/i18n/resolveLocalizedText.ts` (AC8 only), both locale bundles, both `case.json` and both `asset-manifest.json`, `public/sw.js`, `docs/source-rights/**` (new), the three docs in T7, and the tests for all of it.

**Explicitly not in scope:**

- **Any Phaser file.** Zero. The ledger is a reviewer surface; there is no ledger scene, no ledger widget, no change to `LibraryRenderer`'s `library.detail.rights` row.
- **Hiding, blurring or gating unreviewed assets in play.** AC5 clause 3 is explicit about why.
- **Changing `isSourceEligibleForInspection` or the context-readiness rules.** The reading-room gate and the release gate answer different questions; wiring one to the other would make an unreviewed asset close the context gate.
- **Assigning any reviewer a name.** `pending` is the honest state for every unassigned role. Alexis assigns reviewers (`deferred-work.md:211`, `:231`).
- **Deleting the dead Phaser template scenes** (`src/game/scenes/Boot.ts`, `Preloader.ts`, `MainMenu.ts`, `Game.ts`, `GameOver.ts`) or `public/assets/bg.png`. See §8.
- **A case picker or campaign order.** `?ledger=1` is a reviewer route, exactly as `?case=` is (Story 3.2 AC4). Story 4.1 owns campaign order.
- **`docs/educator/`, an educator handout, or an accessible-controls document.** The ledger records that the educator context sheet is `pending`; producing it is not this story.

### 2. What exists today — read these before writing anything

| Thing | Where | State |
|---|---|---|
| Source provenance + rights per artifact | `src/domain/cases/CaseDefinition.ts:71-84`, schema `:238-250` | `creatorOrOrigin`, `sourceType`, `provenance{category,reference}`, `rightsStatus`, `caseRelationship`, optional `textualRendition`. **No ledger fields.** |
| Rights enum | `SourceRightsStatusSchema` = `reviewed \| incomplete \| unavailable`, schema `:168` | Exported; `tests/unit/I18n.test.ts:109-121` derives `source.rights.*` from it. **Reuse it.** |
| "Only reviewed sources may carry a rendition" | schema `:962` | The sources half of AC5. **Assets have no equivalent.** |
| Asset manifest | `AssetManifestSchema`, schema `:587-620` | `{ id, type, path }` only. **No rights fields at all.** |
| Rights shown to the player | `LibraryRenderer.ts:662` → `library.detail.rights` | Already works. Leave it alone. |
| Reviewer-route precedent | `ValidationSessionDisclosure.ts`, `resolveCaseId.ts`, `main.ts:56-83` | The pattern AC6 follows, including the NFR20 exemption reasoning. |
| Manual review sheets | `docs/validation/young-source-rights-review-template.md`, `young-release-decision-template.md` (row "Scholarly source and rights review"), `docs/case-prototypes/morley-miller-prototype.md` §4 | These are the tables the ledger feeds. |
| Character-asset provenance | `docs/validation/young-character-assets.md` | "not rights-reviewed and not publicly cleared" — the source of truth for AC4. |

**The GDD is stale on this point and it matters.** `gdd.md:213` says the cast "ships without commissioned art … no image asset, no loader budget, and **no rights-ledger entry**." Stories 1.11 / 2.9 and the PNG-backed-characters spec superseded that: `public/cases/young-interference/assets/characters/*.png` are five real 512×768 PNGs, each `colleagues[i].portrait.kind: 'asset'`, preloaded by `preloadCaseAssets`. Author the ledger against **the build**, not the GDD sentence.

### 3. The shapes — author exactly these

```jsonc
// case.json, new top-level block
"ledger": {
  "signOff": {
    "contentAuthor":         { "state": "reviewed",  "name": "…", "date": "2026-08-19" },
    "scholarlyReviewer":     { "state": "pending" },
    "accessibilityReviewer": { "state": "de-scoped", "reference": "ADR-008" }
  },
  "educatorContextSheet":        { "state": "pending" },
  "accessibleControlsReference": { "state": "de-scoped", "reference": "ADR-008" }
}

// contextualArtifacts[i], new block
"ledgerEntry": {
  "sourceRole": "primary",          // 'primary' | 'secondary'
  "reviewerState": "pending",
  "replacementPlan": { "en": "…", "fr": "…" }   // required unless rightsStatus === 'reviewed'
}

// assets.entries[i], new block
"rights": {
  "holderOrOrigin": "Quantique project",        // canonical proper noun
  "status": "incomplete",                        // SourceRightsStatus, reused
  "claimOrUse": { "en": "…", "fr": "…" },
  "reviewerState": "pending",
  "provenanceReference": "docs/validation/young-character-assets.md",  // canonical
  "replacementPlan": { "en": "…", "fr": "…" }   // required unless status === 'reviewed'
}
```

`ReviewerState = 'reviewed' | 'pending' | 'de-scoped'`; `ReviewerSignOff = { state; name?; date?; reference? }`.

**Why `reviewerState` is a second enum beside `rightsStatus`, and not a widening of it.** They answer different questions. `rightsStatus` answers *may we ship this* — a public-domain 1801 lecture is `reviewed` with no human involved. `reviewerState` answers *has a person signed this off*. The prototype's open item (`deferred-work.md:231`) is exactly the gap between them: a reconstruction whose reuse is trivially clear, carrying `rightsStatus: 'reviewed'`, where whether that is correct is "the assigned scholarly reviewer's call". One enum could not express that, which is why there are two.

**No `claimOrUse` on sources.** `caseRelationship` already is the claim-or-use statement and the ledger renders it. Adding a second authored copy is the duplication AC1 forbids.

### 4. Schema refinements — all load-time, all fail-closed, each naming its path

- **R1** `replacementPlan` is required when rights are not `reviewed`, on both sources and assets. FR27's "replace or link ambiguous-permission assets" — an uncleared asset with no plan is an asset nobody intends to fix.
- **R2** `reviewerState: 'reviewed'` requires rights `reviewed`. A signed-off row over uncleared rights is a contradiction. The converse is legal (public-domain material needs no signature).
- **R3** `state: 'de-scoped'` requires a `reference`. AC2.
- **R4** `state: 'pending'` forbids `name` and `date`. A named reviewer beside a pending state is the ambiguity AC5 exists to stop.
- **R5** At least one source is `sourceRole: 'primary'`. **Not** one of each: `MAX_CONTEXTUAL_ARTIFACTS` is 2 and Young's two are *both* primary material (the 1801 Bakerian lecture and Newton's *Opticks*), so requiring a secondary would force a false provenance claim on shipped content.
- **R6** `state: 'reviewed'` requires `name` and a `YYYY-MM-DD` `date`.

Put these beside the existing artifact loop at schema `:957-999`, and follow that loop's style: the message says what is wrong *and why the case could not otherwise be trusted*, and the `path` points at the offending field so an author sees it before a reviewer does.

### 5. Where the new code goes, and one thing not to do

`game-architecture.md` §System Location Mapping designates **`src/domain/sources/`** for "Source state and rights/provenance presentation" and **`docs/source-rights/`** for provenance process guidance. Neither directory exists yet; create both. This is the architecture's own location — do not put the evaluator in `src/domain/cases/` or `src/domain/review/`.

**Do not move the existing source types** (`SourceProvenance`, `ContextualArtifact`, `SourceRightsStatus`, `isSourceEligibleForInspection`) out of `src/domain/cases/CaseDefinition.ts` into `src/domain/sources/SourceRecord.ts` to match the architecture's file names. That is a wide mechanical refactor across ~12 `src` files and ~20 test files, it changes no behaviour, and it would bury this story's actual diff. `src/domain/sources/` gets the two **new** modules and nothing else.

The architecture diagram also shows `public/cases/<id>/sources.json` and `assets.json`. The shipped convention is `case.json` + `asset-manifest.json`; the shipped convention wins. Do not split files.

### 6. The expected verdicts — know these before you author

Author the content, then assert these. If the numbers differ, the content is wrong, not the test.

- **Young** → `blocked`. Blockers: five `asset-rights-incomplete` (the portraits), one `scholarly-review-pending`, one `educator-context-sheet-pending`. Both sources are `reviewed` with real citations and HTTPS archive URLs (Wellcome Collection, archive.org) so neither is a blocker. `quantique-logo` is `reviewed`.
- **Morley–Miller prototype** → `blocked`. Blockers: one `scholarly-review-pending`, one `educator-context-sheet-pending`. Its single manifest entry is `quantique-logo`; both sources are `reviewed`.

The `blocked` verdict is the **correct** outcome and the suite must be green while asserting it. This is the project's established pattern — "Recorded rather than hidden" — not a failure to finish. Do not author anything `reviewed` to turn the banner green; AC4 makes that a defect by name.

### 7. Why required fields do not force a fixture migration

49 test files build definitions with `as CaseDefinition` casts (`tests/unit/ContextPrediction.test.ts:36-40` is representative: a hand-written literal, two artifacts, closing `} as CaseDefinition`). A cast silences a missing required property, so adding required fields is **not** a type error there, and nothing outside the new evaluator reads them — so those fixtures stay green untouched.

**Do not conclude from that that the fields may be optional.** Optionality would let real content under `public/cases/` ship a row nobody audited, which is the whole point of the story. Keep them required, leave the cast fixtures alone, and author the new fields only in the fixtures that actually exercise the ledger.

Two consequences to respect:

- `npm run typecheck` covers only `src` (`tsconfig.json`), so a fixture defect is invisible to it. `npm run typecheck:tests` is the separate, deliberately un-gated check that is **red at 114 errors / 59 files on this HEAD** — measured, not quoted. AC11 caps it there. Do not "fix" unrelated entries in it.
- The new evaluator will read `definition.ledger` — if a cast fixture is ever passed to it, that is `undefined` and a crash. Give the new tests properly authored ledgers rather than adding a defensive `??` to the evaluator: a missing ledger in real content is impossible (Zod), and a fallback would hide a fixture mistake.

### 8. Things you will notice, and what to do about them

- **`public/assets/bg.png`** (the Phaser template's blue gradient, 1024×768) ships but no manifest declares it — only the dead template scene `src/game/scenes/Boot.ts:15` references it, and `src/game/main.ts` registers none of those scenes. **Leave it.** The ledger's boundary is *authored* content — `contextualArtifacts[]` and `assets.entries[]` — because that is what Zod can validate at load. Unmanifested files in `public/` are build hygiene. State that boundary in `docs/source-rights/README.md` and record the dead-template cleanup as a follow-up in `deferred-work.md`; do not do it here.
- **`public/favicon.png`** — same boundary: referenced from `index.html`, in no manifest. Record it in `docs/source-rights/quantique-shared-assets.md` alongside the logo; no ledger row.
- **`quantique-logo` is declared in both manifests and no `src` file reads the asset ID.** `preloadCaseAssets` queues every `type: 'image'` entry, so it *is* fetched. It gets a ledger row like any other manifest entry. Do not delete it as part of this story.
- **`asset-manifest.json` path hardening** (`deferred-work.md:146`) is recorded as closed by the 3.1 review pending a reviewer's confirmation at a domain root. This story touches the manifest schema; if you extend the hostile-path fixtures while you are there, say so and strike the item. Do **not** change the path regex — the note records that as an Ask First item.
- **`project-context.md` does not exist** anywhere in the repo, though `epics.md:139` says NFR20 is "enforced thereafter by `project-context.md` and ADR-011". ADR-011 is real and in `game-architecture.md`. Nothing in this story depends on the missing file; it is raised as an open question below.

### 9. Every surface that reads source or rights data — check all five

The 3.2 review's most expensive miss was a **fourth surface making the same two reads**, missed "because it is the only one not in the story's file list". Here is the complete list. Any change to how a source's provenance or rights is *worded* must be checked against all of them; this story is not expected to change any of the first four, and if it does, that is the list to sweep.

| Surface | Where | What it reads |
|---|---|---|
| Reading room + source detail | `LibraryRenderer.ts:506, :662, :834` | `rightsStatus` (eligibility, `library.detail.rights`) |
| Historical-comparison citations | `selectors.ts:739-742` → `DebriefRenderer.ts:345-349` | `provenanceName.*`, `type.*`, `rights.*` |
| Printable record | `CaseRecordPrintView.ts:121-130` | `displayName`, `provenance.category`, `provenance.reference` |
| Case file | `CaseFilePresenter.ts` | source rows (the surface 3.2 missed) |
| **Source and rights ledger** | `src/ui/SourceRightsLedger.ts` (new) | everything, plus the new ledger fields |

**No surface reads asset rights today** — the ledger is the first. Do not go looking for an existing asset-rights label to correct; there is none, which is precisely the gap AC5 closes.

### 10. Lessons from Stories 3.1 and 3.2 that apply directly here

- **A comment is not a guarantee.** Three stories running, a rule shipped with a comment asserting a check that did not exist — most sharply `activeControlValues`, whose comment claimed the validation loop rejected an unauthored key while the loop iterated the *definition*, making such a key structurally invisible to it. For every refinement R1–R6, ask: *what fixture fails if I delete this refinement?* If the answer is "none", the rule is a comment. That is what AC11's mutation proof #2 exists to check.
- **Prove the gate is reading what you think it reads.** The 3.2 review found a blank screen and a discarded completion record that 1334 green tests could not see, because the tests asserted `texts()` rather than outcomes. Mutation proof #1 (flip one portrait to `reviewed`, watch the decision flip to `clear`) is the equivalent here: without it, an evaluator that only walks sources passes every test you would naturally write.
- **French is not a follow-up.** 3.2 shipped a grammar regression on already-shipped Young content (`de Écartement des fentes`) and left "fringe widths" and a case-file row canonical-English on French surfaces. Write both locales in the same edit, and read the FR strings as sentences — not as string-table entries.
- **Test standards:** public actions and selectors only, never private renderer state (§Consistency Rules). New unit tests go under `tests/unit/`, store/surface interaction under `tests/integration/`, browser walks under `tests/e2e/`.
- **Library notes:** add no dependency. Zod is pinned at 4.4.3 and this codebase spells things `z.object({…}).strict()` and `z.string().url()`; Zod 4 also offers `z.strictObject` / `z.url`, and the codebase does not use them. **Match the surrounding code** rather than introducing a second idiom in one file — the schema is 1000 lines of one style.

### Project Structure Notes

- New: `src/domain/sources/{releaseApproval.ts,caseLedger.ts}` — the architecture's designated location for source/provenance domain logic. Pure: no Phaser, DOM, fetch or IndexedDB imports (§Architectural Boundaries).
- New: `src/ui/SourceRightsLedger.ts` — beside `ValidationSessionDisclosure.ts`, the retained non-Phaser reviewer/facilitator chrome. `src/ui/` is otherwise the print view only; the ledger belongs to the same exemption class and its docstring must say so, following `ValidationSessionDisclosure`'s.
- New: `src/adapters/content/resolveLedgerMode.ts` — beside `resolveCaseId.ts`, same reason (testable without a document).
- New: `docs/source-rights/{README.md,quantique-shared-assets.md}`.
- Naming: `PascalCase.ts` for the mounted UI module, `camelCase.ts` for the domain and adapter modules, `camelCase` JSON fields, `kebab-case` asset and case IDs — all per §Naming Conventions.
- Zod validates at the content boundary only; the evaluator receives an already-validated `CaseDefinition` and performs no parsing.

### Project Context Rules

No `project-context.md` exists in this repository. The project-wide rules this story is bound by are therefore taken from `game-architecture.md` and the `epics.md` Additional Requirements, and are the ones stated inline above: pinned dependency versions (Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1 — add no dependency), pure `src/domain/`, repositories alone fetch and validate, typed `Result` for expected failures, immutable shipped case content, bilingual EN+FR for every player- and reviewer-facing string, and ADR-008 / ADR-011 as stated in AC6 and AC11.

### References

- [Epic 3, Story 3.3](_bmad-output/planning-artifacts/epics.md) — epic AC source; FR26/FR27 coverage map rows
- [FR26, FR27, NFR10–NFR12, NFR19, NFR20](_bmad-output/planning-artifacts/epics.md) — Requirements Inventory
- [Architecture: Content Model, Asset Management, ADRs, System Location Mapping, Architectural Boundaries](_bmad-output/game-architecture.md)
- [GDD: History with receipts (§Pillars), asset rights conventions, artifact ledger requirement](_bmad-output/planning-artifacts/gdds/gdd-Quantique-2026-08-04/gdd.md) — note the stale cast-art sentence at :213
- [Story 3.2 AC7 and §4 Provenance and rights](_bmad-output/implementation-artifacts/3-2-reviewable-morley-miller-prototype.md) — supplies the data this story audits; forbids building the ledger there
- [deferred-work.md:146, :211, :231](_bmad-output/implementation-artifacts/deferred-work.md) — the three items this story must address or carry
- [docs/validation/young-character-assets.md](docs/validation/young-character-assets.md) — AC4's factual basis
- [docs/validation/young-release-decision-template.md](docs/validation/young-release-decision-template.md) — the release gate the ledger feeds; the no-waiver rule
- [docs/case-prototypes/morley-miller-prototype.md](docs/case-prototypes/morley-miller-prototype.md) §4 — the sign-off table to import
- [docs/i18n-authoring.md](docs/i18n-authoring.md) — canonical-value traps for AC7

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Debug Log References

**Mutation proofs — every one broken and restored, and the schema verified byte-identical afterwards.**

*Proof 1 — the gate reads assets, not only sources (AC11 clause 3.1).* Run twice, because the AC's
version and the stronger version prove different halves.

- *Content mutation, as AC11 words it:* authored `thea-young-portrait` `status: 'reviewed'` in the real
  `case.json` **and** its manifest. Two tests failed — the exact-blocker-set assertion and the
  replacement-plan projection — confirming a single portrait's rights status moves the verdict.
- *Code mutation, stronger:* disabled the asset walk in `evaluateLedgerReleaseApproval`
  (`if (false && entry.rights.status !== 'reviewed')`). Two unit tests failed: Young's exact blocker set,
  and the fail-closed test. **The integration surface test did not fail**, which is itself worth
  recording: it asserts `blockers.length > 0`, and Young still has two role blockers with the asset walk
  gone. An evaluator that only walked sources would have passed the surface suite — which is precisely
  the class of miss this proof exists to catch.

*Proof 2 — the replacement-plan rule fires (AC11 clause 3.2).* Disabled both halves of R1 (the source
half in the definition-level loop, the asset half in `AssetRightsSchema`). Two rejection fixtures failed;
the hostile fixtures parsed clean with the rule gone.

*Proof sweep — R2 through R6, on Dev Notes §10's instruction to ask what fails if each rule is deleted.*
Disabled each refinement in turn (`if (false && …)`) and ran `CaseDefinition.test.ts`:

| Rule | Result with the rule disabled |
|---|---|
| R2, asset half | 1 failed / 270 passed |
| R2, source half | 1 failed / 270 passed |
| R3 (`de-scoped` needs a reference) | 1 failed / 270 passed |
| R4 (`pending` forbids name and date) | 1 failed / 270 passed |
| R5 (at least one primary source) | 1 failed / 270 passed |
| R6 (`reviewed` needs name and date) | 1 failed / 270 passed |

**No refinement is a comment.** Every one has a fixture that fails when it is deleted, and
`CaseDefinitionSchema.ts` was `diff`-verified byte-identical to its pre-sweep state after restoring.

*Boot-layer defect, found by looking rather than by a test.* The first working ledger route rendered
**nothing a reviewer could see**: `#game-container` and `#boot-shell` are both `position: fixed; inset: 0`
with the frame at `z-index: 2`, so the ledger mounted into normal flow underneath them and the screen
showed the boot splash with an "Enter laboratory" button. Caught by screenshotting the running app, not
by any assertion — the same shape as the 3.2 review's blank bench. `main.ts` now hides both layers before
mounting, `#boot-status` (`z-index: 3`) is deliberately left alone because the load-failure path returns
before the mount, and `source-rights-ledger.spec.ts` asserts `toBeVisible` plus both layers hidden, so it
cannot regress silently.

*Column legibility, same method.* The ten-column sources table divided the container between its columns
and rendered every cell as a two-word ribbon — all text present, so invisible to every assertion. Fixed
with `min-width` floors that hand the wide tables to their own `overflow-x` scroll; re-screenshotted in
both cases and both locales.

*Process note.* A `git stash push --keep-index --include-untracked` run while measuring the typecheck
baseline stashed the entire in-progress change. Recovered in full with `git stash pop`; separately, a
`git checkout` used to revert mutation proof 1b reverted Young's `case.json` and manifest to HEAD, losing
the authored ledger, which was re-authored and re-verified (`git diff` confirms the restored content is
purely additive — every deleted line is a version bump or a line that gained a trailing comma). Both
recoveries were verified by a full green suite before continuing.

### Completion Notes List

**What shipped.** The ledger is authored case data, a pure fail-closed release gate over it, and a
reviewer route that renders it.

- **Contract (T1).** `SourceRole`, `ReviewerState`, `ReviewerSignOff`, `LedgerEntry`, `AssetRights` and
  `CaseLedger` on `CaseDefinition`; `ledgerEntry` per contextual artifact, `rights` per manifest asset,
  `ledger` per case — all required, all `Readonly`, all `.strict()`. `SourceRoleSchema` and
  `ReviewerStateSchema` exported so the I18n roster derives from them. Six refinements R1–R6, each with
  an authored message and the offending path. `SourceRightsStatusSchema` and
  `isSourceEligibleForInspection` are untouched, with a test asserting the reading-room gate still reads
  `rightsStatus` and nothing else.
- **Two enums, not one widened.** `rightsStatus` answers *may we ship this*; `reviewerState` answers
  *has a person signed this off*. The prototype's open item is exactly the gap between them, and the 1905
  reconstruction now states it out loud: `rightsStatus: 'reviewed'` beside `reviewerState: 'pending'`.
- **The gate (T2).** `evaluateLedgerReleaseApproval` is pure, fails closed, and **takes one parameter** —
  asserted on `.length`, because a gate whose signature admits an override is a gate that will be
  overridden.
- **Content (T3).** Young → `case.json` 1.21.0 / manifest 1.2.0; prototype → 1.1.0 / 1.1.0, with
  `assets.manifestVersion` bumped in lockstep in each. `sw.js` → `quantique-bootstrap-v9` with the
  change-class comment. `CaseRecordSchema` gains Young's 1.21.0 clause and the prototype's **first**
  clause — in its own branch, which is what that file's own note says a second case gets when it first
  needs one. Nesting it beside Young's clauses made it unreachable and `tsc` caught that.
- **`manifestsMatch` extended.** `loadCaseDefinition` now compares `rights` as well as `id`/`type`/`path`.
  Both files declare the same entries, so a rights record is exactly the kind of field an author updates
  in one and not the other; compared structurally so the next `AssetRights` field is covered without this
  function being remembered.
- **Surface (T4).** `?ledger=1` renders four semantic tables, a decision banner and a named blocker list,
  and returns before any store, repository or `StartGame`. Split into a pure `getSourceRightsLedgerText`
  and `mountSourceRightsLedger`, following `getValidationSessionDisclosureText`: `vitest` has no
  `document`, so a surface whose strings exist only inside DOM calls is a surface whose French only a
  browser can check. That split is what makes 13 bilingual surface assertions possible with no new
  dependency — and it is the pattern `CaseRecordPrintView` should adopt when it gets an owner.
- **AC8.** `resolveRendition` falls back on `kind !== 'translation'` rather than `=== 'transcription'`, so
  a reconstruction of record is selected instead of falling through to a translation under a notice
  naming English as the original. Four tests, all on the degraded-cache path, which is the only path
  these branches run on.

**The honest verdict is BLOCKED, for both cases, and the suite asserts exactly that.**

| Case | Decision | Blockers |
|---|---|---|
| Young | `blocked` | 5 × `asset-rights-incomplete` (the portraits), `scholarly-review-pending`, `educator-context-sheet-pending` |
| Morley–Miller | `blocked` | `scholarly-review-pending`, `educator-context-sheet-pending` |

Nothing was authored `reviewed` to turn a banner green. The five portraits keep rendering in play — a
fictional colleague portrait is not a verified historical claim, and blanking the cast to satisfy a rule
about labelling would break shipped play — and what is forbidden, representing them as reviewed and
letting them pass release, is what the gate now prevents.

**Verification.**

| Gate | Result | AC11 threshold |
|---|---|---|
| `npm run typecheck` | clean | clean ✓ |
| `npm test` | **1392 passed / 77 files** (from 1344 / 74) | ≥ 1370 / ≥ 77 ✓ |
| `npm run test:e2e` (chromium) | **65 passed** (from 61) | ≥ 62 ✓ |
| `npm run typecheck:tests` | **114 errors / 60 files** | ≤ 114 / ≤ 59 — errors ✓, **files +1** |

No lint script is configured in `package.json`, so the code-quality gate is the two typecheck runs.

**⚠ The one AC11 deviation, stated plainly: `typecheck:tests` is at 60 files against a cap of 59.** The
error count is exactly at the 114 baseline, so the backlog did not grow by a single error — the extra file
is where one error now *lives*. `@types/node` is deliberately not a dependency (`tsconfig.test.json` says
so and explains why), so every file importing a `node:` module contributes one `TS2307`; **26 existing
files carry exactly that one error**. Two new test files reading shipped content would have added two
more, so the read was consolidated into `tests/shippedCases.ts` and `CaseDefinition.test.ts` was routed
through it too — net zero errors, one new file. Reaching 59 would mean routing an unrelated single-error
file through the helper purely to move a number, which Dev Notes §7 explicitly rules out ("Do not 'fix'
unrelated entries in it"). Flagged for Alexis rather than decided unilaterally.

**Dev Notes §7's prediction held.** The 49 `as CaseDefinition` cast fixtures stayed green untouched — a
cast silences a missing required property, and nothing outside the new evaluator reads the new fields. One
fixture was **not** a cast and did need authoring: `PreloadCaseAssets.test.ts` assigns a manifest to a
typed parameter, so `tsc` caught it; `rights` is authored there rather than cast away, so the fixture keeps
tracking the shape the loader is handed.

**Open for Alexis** — three things this story deliberately did not decide:

1. **The reviewers.** `scholarlyReviewer` and `educatorContextSheet` ship `pending` for both cases. That
   is the honest state and the correct blocker; naming them is a content edit, and a name nobody supplied
   would be the defect Story 3.2 AC7 forbids.
2. **The portraits' replacement plan** (story Open Question 2). Authored as: rights review must decide
   whether to clear the generated derivative for public use *or* replace it with commissioned art, and the
   case stays blocked until that decision is recorded. If you have already decided which, the plan text
   should say so instead.
3. **`logo.png` and `favicon.png` provenance.** `docs/source-rights/quantique-shared-assets.md` records
   what the repository can prove — both replaced by you in `01f786b` ("Changed logo"), superseding the
   Phaser template placeholders — and `quantique-logo` is `reviewed` on the basis that it is the project's
   own mark. If either was commissioned or derived from third-party material, that origin belongs in the
   doc and the rights status needs revisiting. Flagged in the doc itself.

`project-context.md` still does not exist (story Open Question 3, unchanged): nothing here depended on it,
and the project rules applied were taken from `game-architecture.md` and the `epics.md` Additional
Requirements as the story's Dev Notes direct.

### File List

**New — source (4)**

- `src/domain/sources/releaseApproval.ts`
- `src/domain/sources/caseLedger.ts`
- `src/adapters/content/resolveLedgerMode.ts`
- `src/ui/SourceRightsLedger.ts`

**New — tests (5)**

- `tests/unit/SourceRightsLedger.test.ts`
- `tests/unit/ResolveRendition.test.ts`
- `tests/integration/SourceRightsLedgerSurface.test.ts`
- `tests/e2e/source-rights-ledger.spec.ts`
- `tests/shippedCases.ts` — shared shipped-content loader (see the AC11 note above)

**New — docs (2)**

- `docs/source-rights/README.md`
- `docs/source-rights/quantique-shared-assets.md`

**Modified — source (9)**

- `src/domain/cases/CaseDefinition.ts`
- `src/schemas/CaseDefinitionSchema.ts`
- `src/schemas/CaseRecordSchema.ts`
- `src/adapters/content/loadCaseDefinition.ts`
- `src/core/i18n/resolveLocalizedText.ts`
- `src/core/i18n/locales/en.ts`
- `src/core/i18n/locales/fr.ts`
- `src/main.ts`
- `index.html`

**Modified — content and shell (5)**

- `public/cases/young-interference/case.json`
- `public/cases/young-interference/asset-manifest.json`
- `public/cases/morley-miller/case.json`
- `public/cases/morley-miller/asset-manifest.json`
- `public/sw.js`
- `public/style.css`

**Modified — tests (4)**

- `tests/unit/CaseDefinition.test.ts`
- `tests/unit/CaseRecordSchema.test.ts`
- `tests/unit/I18n.test.ts`
- `tests/unit/PreloadCaseAssets.test.ts`

**Modified — docs and artifacts (3)**

- `docs/validation/young-source-rights-review-template.md`
- `docs/case-prototypes/morley-miller-prototype.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

| Date | Change |
|---|---|
| 2026-08-19 | Story 3.3 implemented. Ledger contract added to `CaseDefinition` and `CaseDefinitionSchema` (three required blocks, six load-time refinements R1–R6, each mutation-proved). `src/domain/sources/{releaseApproval,caseLedger}.ts` added — a pure, fail-closed release gate with no waiver parameter, and the row projection that reads existing fields rather than duplicating them. `?ledger=1` reviewer route added (`resolveLedgerMode`, `SourceRightsLedger`, `#source-rights-ledger`), isolated like the validation route and starting no Phaser game. Young → `case.json` 1.21.0 / manifest 1.2.0, Morley–Miller → 1.1.0 / 1.1.0, both ledgers authored from the material as it actually stands and both resolving to **blocked**. `sw.js` → v9; `CaseRecordSchema` gains Young's 1.21.0 clause and the prototype's first clause in its own branch; `manifestsMatch` extended to compare `rights`. `resolveRendition` falls back on the rendition of record rather than on `transcription` alone (AC8). Bilingual `ledger.*` keys in both bundles, rights statuses reusing the existing `source.rights.*` family, I18n roster derived from the newly exported `ReviewerStateSchema` / `SourceRoleSchema`. Docs: `docs/source-rights/` created; the Young review template, the prototype artifact §4 and `deferred-work.md` updated. 1392 tests / 77 files (from 1344 / 74), e2e 65 passed (from 61), `typecheck` clean, `typecheck:tests` 114 errors — at baseline — across 60 files. |
| 2026-08-19 | Boot-layer defect fixed before completion: the ledger rendered beneath `#boot-shell` and `#game-container`, both `position: fixed; inset: 0`, so a reviewer saw the boot splash and no ledger. Found by screenshotting the running app. `main.ts` hides both layers before mounting and the e2e walk asserts visibility plus both layers hidden. |

## Open Questions for Alexis

1. **Who are the reviewers?** `scholarlyReviewer` and `educatorContextSheet` will ship `pending` for both cases, which is the honest state and the correct blocker. Naming them is your call (`deferred-work.md:211`), and it is a content edit after this story, not part of it.
2. **The five character portraits.** The ledger will author them `incomplete` with a replacement plan. Is the intended plan to clear the generated derivatives for public use, or to replace them? The plan text is authored content and should say which.
3. **`project-context.md` is referenced by `epics.md:139` but does not exist.** Worth generating (`gds-generate-project-context`) so the NFR20 enforcement claim is true, or worth correcting the epics line.
