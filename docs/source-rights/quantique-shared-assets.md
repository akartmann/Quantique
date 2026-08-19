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

> **⚠ Open for Alexis.** This records the file's *history in this repository*, which is what the
> repository can prove. If the mark was commissioned or derived from third-party material, that origin
> belongs here and the rights status should be revisited. Recorded rather than assumed, on the rule that
> nothing unreviewed may be represented as reviewed.

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
