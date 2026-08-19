# Source and rights process

How a Quantique case records where its material came from, whether its reuse is cleared, and who signed
that off — and how a reviewer audits all three.

This is the process guidance for `src/domain/sources/`, the location
`_bmad-output/game-architecture.md` §System Location Mapping designates for source and rights work.

## Open the ledger

The ledger is a **generated artifact**, not a game feature and not a route.

```
npm run audit:ledger                      # every known case, both locales
npm run audit:ledger young-interference   # one case
```

It writes `docs/source-rights/<case-id>-ledger.<locale>.md` — four tables (sources, assets, sign-off and
references), a release-approval banner, and a named list of every row that blocks release, with each
blocker pointing at the row that states it. **The exit code is part of the contract:** `1` when any
audited case is blocked, `2` when a case id is unknown or the two content files disagree. So the gate is
usable by a release step and not only readable by a person.

Story 3.3 first shipped this as a `?ledger=1` surface mounting tables into the document. The code review
removed it: `project-context.md` §Engine holds `src/ui/` to exactly three modules ("Do not add a fourth")
and the document to three elements outside `#game-container`, "each either transient or unseen". Epic 3's
criterion is "**when** a reviewer **opens** its ledger" and names no route, so a file satisfies it — and
satisfies it better in one respect, because the two review documents that describe their tables as read
from the authored `ledger` block "rather than transcribed" are now telling the truth.

An unknown case id **fails** rather than defaulting to Young. `resolveCaseId` falls back for the *game*
route, on the reasoning that a mistyped link should open the game rather than a boot error; on an audit
the same fallback would hand a reviewer a confident BLOCKED ledger for the wrong case.

## The three reviewer states

`reviewerState` answers **has a person signed this off**. It is a separate question from `rightsStatus`,
which answers **may we ship this**, and the two are deliberately not one field:

| State | Means | Requires |
|---|---|---|
| `reviewed` | A named person signed this off on a date. | `name` and a `YYYY-MM-DD` `date`. |
| `pending` | Nobody has. This is the honest state for an unassigned role. | No `name` and no `date` — a name beside `pending` reads as a signature nobody gave. |
| `de-scoped` | A recorded decision says the role does not apply. | A `reference` naming that decision, e.g. `ADR-008`. |

A public-domain 1801 lecture is `rightsStatus: 'reviewed'` with **nobody's signature on it** — no human
was involved and none is needed. That is why one enum could not carry both questions.

`de-scoped` is never spelled `reviewed`. It renders as "De-scoped (ADR-008)", and a `de-scoped` row with
no reference is rejected when the case loads, with the offending path named.

## There is no waiver

`evaluateLedgerReleaseApproval` takes a case and nothing else. It has **no waiver field, no override
path, and no partial approval** — the same rule
`docs/validation/young-release-decision-template.md` states in prose, enforced on the signature so it
cannot be argued with. It fails closed: the decision is `blocked` unless every check clears.

A row that should not block is fixed in the **content**, two ways and no others:

1. clear its rights, or
2. record the decision that de-scoped its role.

Both are authored, both are readable, and both leave a trace a reviewer can follow. Editing the
evaluator to make a banner green is the defect this design exists to prevent.

**`blocked` is a normal state, not a broken one.** Both shipped cases are blocked today and the test
suite asserts exactly that. Nothing is authored `reviewed` to turn a banner green.

## What blocks release

| Blocker | Fires when |
|---|---|
| `source-rights-incomplete` | A source's `rightsStatus` is not `reviewed`. |
| `asset-rights-incomplete` | An asset's `rights.status` is not `reviewed`. |
| `content-author-unrecorded` | No content author is recorded. |
| `scholarly-review-pending` | The scholarly reviewer role is open. |
| `educator-context-sheet-pending` | The educator context sheet is open. |

The content author is the one role `de-scoped` cannot answer for: somebody wrote the case, and if nobody
is recorded that *is* the blocker. Letting `de-scoped` clear it would be a waiver spelled differently.

## Authoring a row

Every field below is **required**, and required is the point: an optional ledger would let a case ship a
row nobody audited.

### A source — `contextualArtifacts[i].ledgerEntry`

```jsonc
"ledgerEntry": {
  "sourceRole": "primary",        // 'primary' | 'secondary' — its role in *this case's* argument
  "reviewerState": "pending",
  "replacementPlan": { "en": "…", "fr": "…" }   // required unless rightsStatus is 'reviewed'
}
```

At least one source must be `primary`. **Not one of each**: Young's two are both primary material — the
1801 Bakerian lecture and Newton's *Opticks* — so requiring a secondary would force a false provenance
claim onto content that has already shipped.

There is deliberately **no `claimOrUse` on a source**. `caseRelationship` already is the claim-or-use
statement and the ledger renders it. The ledger likewise *reads* the provenance, rights status and
citation from the fields that already hold them. A second authored copy of any of them is a defect, not
a convenience: two answers to one question drift.

### An asset — `assets.entries[i].rights`

```jsonc
"rights": {
  "holderOrOrigin": "Quantique project",         // canonical proper noun
  "status": "incomplete",                        // reviewed | incomplete | unavailable
  "claimOrUse": { "en": "…", "fr": "…" },
  "reviewerState": "pending",
  "provenanceReference": "docs/validation/young-character-assets.md",
  "replacementPlan": { "en": "…", "fr": "…" }   // required unless status is 'reviewed'
}
```

An asset has no `caseRelationship`, so `claimOrUse` is authored here. The same block goes in the case's
`asset-manifest.json`, and the two must agree field for field — `loadCaseDefinition` refuses a mismatch.

### The case — `ledger`

```jsonc
"ledger": {
  "signOff": {
    "contentAuthor":         { "state": "reviewed", "name": "…", "date": "2026-08-19" },
    "scholarlyReviewer":     { "state": "pending" },
    "accessibilityReviewer": { "state": "de-scoped", "reference": "ADR-008" }
  },
  "educatorContextSheet":        { "state": "pending" },
  "accessibleControlsReference": { "state": "de-scoped", "reference": "ADR-008" }
}
```

### Which strings translate

`claimOrUse` and `replacementPlan` are `LocalizedText` and need **both** locales; Zod checks that when
the case loads. Everything else on a ledger row is canonical and stays untranslated: `citationText`,
`archiveUrl`, an asset `path`, `holderOrOrigin`, a reviewer `name`, every date,
`provenance.reference`, `provenanceReference`, and every `de-scoped` `reference`. See
`docs/i18n-authoring.md`.

## What the ledger covers, and what it does not

The ledger's boundary is **authored content**: `contextualArtifacts[]` and `assets.entries[]`. That is
the boundary because it is exactly what Zod validates when a case loads, so a missing row is a load
failure rather than an omission nobody notices.

Files in `public/` that no manifest declares are **outside** it and are build hygiene, not ledger rows —
`public/favicon.png`, referenced from `index.html`, and `public/assets/bg.png`, referenced only by the
unregistered Phaser template scenes. Their origins are recorded in
[quantique-shared-assets.md](quantique-shared-assets.md) so the boundary is stated rather than silently
drawn.

## Where the code is

| Module | What it does |
|---|---|
| `src/domain/sources/releaseApproval.ts` | The gate. Pure, fails closed, no waiver parameter. |
| `src/domain/sources/caseLedger.ts` | Projects sources and assets into display rows, reading existing fields. |
| `src/domain/sources/ledgerReport.ts` | The text projection and the markdown serializer. Pure — no document, no file, no network. |
| `scripts/auditLedger.mjs` | Reads the shipped content, writes the reports, sets the exit code. Loads `src` through Vite so no dependency is added. |
| `src/schemas/CaseDefinitionSchema.ts` | The six load-time refinements, each naming its own path. |

The reading-room gate (`isSourceEligibleForInspection`) is **not** wired to this one and must not be.
They answer different questions: wiring them together would make an uncleared asset close the context
gate and leave a player unable to finish a case for a reason about labelling.
