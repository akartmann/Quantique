# Quantique shared asset provenance

The assets that belong to the project rather than to any one case. Written so that
`quantique-logo`'s `provenanceReference` points at something real, and so the ledger's coverage boundary
is stated rather than silently drawn.

Date: 2026-08-19 (Story 3.3)

## In the ledger

| Asset ID | File | Size | Holder or origin | Rights status |
|---|---|---|---|---|
| `quantique-logo` | `public/assets/logo.png` | 500 × 91 | Quantique project | Reviewed |

`quantique-logo` is declared in both shipped cases' manifests and gets a ledger row in each, so its
rights are audited wherever it ships.

**What the repository records about it.** The file was replaced by Alexis Kartmann in commit `01f786b`
("Changed logo", 2026-08-08), superseding the placeholder that arrived with the Phaser Vite + TypeScript
template in `29266cd`. It is the project's own mark, used only as the project's own mark, and its reuse
is cleared on that basis.

**Confirmed by Alexis, 2026-08-19 (code review of Story 3.3).** The mark is the project's own and derives
from no third-party material — commissioned or otherwise. That closes the question this section used to
leave open, and it is why `rights.status` stays `reviewed`.

> **One honest caveat about the vocabulary, recorded rather than smoothed over.** `project-context.md`
> §Organization defines `rightsStatus: 'reviewed'` as asserting the material *is* public-domain, "not
> merely that somebody looked at it". The project's own mark is not public-domain — it is ours — so
> `reviewed` is being used here to mean "cleared for us to ship", which is the question the ledger is
> actually asking. The enum has no member for own work, and adding one is a change to a shared vocabulary
> that AC7 told Story 3.3 to reuse; it is carried in `deferred-work.md` rather than made inside a review.
>
> `reviewerState` is `pending`, and that is not an oversight. `reviewed` there would assert a named person
> signed this off on a date, which `docs/source-rights/README.md` requires and `AssetRights` has no fields
> to carry. Nobody signed anything; the row says so.

## Outside the ledger, and why

The ledger audits **authored content** — `contextualArtifacts[]` and `assets.entries[]` — because that is
exactly what Zod validates when a case loads, so a missing row is a load failure rather than an omission
nobody notices. Files sitting in `public/` that no manifest declares are build hygiene. They are recorded
here so the boundary is visible to the reviewer who wonders why they are not rows.

| File | Size | Referenced by | Origin |
|---|---|---|---|
| `public/favicon.png` | 512 × 512 | `index.html` `<link rel="icon">` | Replaced alongside the logo in `01f786b`; same origin and the same open question above. |
| `public/assets/bg.png` | 1024 × 768 | `src/game/scenes/Boot.ts` only — a template scene that `src/game/main.ts` does not register, so nothing loads it | Unmodified from the Phaser Vite + TypeScript template (`29266cd`), which is the template the README names as this repository's starting point. |

`bg.png` ships and is never fetched. Deleting it and the five unregistered template scenes is real
cleanup and is recorded as a follow-up in `_bmad-output/implementation-artifacts/deferred-work.md`
rather than done here: Story 3.3 is a content-and-contract story, and deleting scene files in it would
bury the diff a reviewer needs to read.

## Character portraits

The five Young character PNGs are **not** here. They are case content, they carry ledger rows in
`public/cases/young-interference/`, and their provenance and rights standing are recorded in
[../validation/young-character-assets.md](../validation/young-character-assets.md) — which is what their
`provenanceReference` points at. They are `incomplete` with a replacement plan, and they block Young's
release approval today.
