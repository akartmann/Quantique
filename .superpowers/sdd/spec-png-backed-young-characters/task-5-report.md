# Task 5 verification report — PNG-backed Young characters

## Status

Implemented the Task 5 compatibility and verification scope only:

- `public/sw.js` now uses `quantique-bootstrap-v7`, with the required rationale that the 1.16 case/manifest image bundle cannot mix with cached 1.15/manifest 1.0 responses.
- Added the two deferred schema/compatibility boundaries without changing their already-correct production implementations:
  - a 1.16.0 definition rejects a 1.1.0 record;
  - `rivalLab.portraitAssetId` rejects an ID absent from the authored manifest.
- Strengthened the offline reload release-gate test to observe Thea's authored portrait online, then observe the same response served by the service worker after offline reload. It also replaces the former 500 ms autosave sleep with a poll of the real persisted record.

No renderer, schema, case, manifest, generated asset, provenance, preload, frozen-intent, or rights-status behaviour was changed.

## Mutation proof

Both new regression tests were executed against deliberately weakened production code, then production was restored and the tests rerun:

| Boundary | Deliberate mutation | Mutation result | Restored result |
| --- | --- | --- | --- |
| 1.16 compatibility | Added `1.1.0` to the 1.16 allowlist | New test failed: received `{ ok: true }` instead of `incompatible-case-record` | Passed |
| Rival portrait manifest link | Disabled the rival-specific manifest guard | New test failed: schema parse succeeded instead of failing | Passed |

## Automated verification

- Focused unit tests: `CaseDefinition.test.ts` + `CaseRecordSchema.test.ts` — **288 passed**.
- TypeScript: `tsc --noEmit` — **passed**.
- Full Vitest: **68 files, 1,178 tests passed**.
- Focused offline Playwright: `offline-reload.spec.ts` Chromium — **5 passed**. The portrait response was observed on online warm-up and the same path returned HTTP 200 with `fromServiceWorker() === true` after offline reload; saved progress restored in `TheoryBoard`.
- Full Chromium Playwright, run directly against a local production Vite preview because no `npm` executable is present: **50 passed, 6 failed** in 3.7 minutes. The failures are outside Task 5's changed paths: two dialogue transitions stuck in Library, one boot-shell hide timeout, one Playwright-artifact `EPERM` read, one validation active-scene timeout, and one experiment run timeout. The focused Task 5 offline gate passed in this same environment.

The provided bundled `pnpm` attempted an implicit network install under the restricted sandbox. It was not allowed to complete. I restored exactly the nine package directories it had moved from `node_modules/.ignored` to their verified original targets, preserved pre-existing targets, and used the existing local Vite/Vitest/Playwright packages directly afterwards. Empty `.ignored` scope folders and the untracked `.pnpm-store/` were left untouched.

## Manual visual inspection

Inspected the running production preview at **1280×720**, French locale, normal motion:

- Prediction: all four Young colleagues display as recognizable label-free transparent portraits; feet align on the shared baseline, plaques are readable, and proposal cards do not overlap the figures.
- Conclusion: the reordered colleague stage retains the same clean alpha edges, baseline alignment, speaker emphasis, and readable cards.
- Rival: Arthur Bell appears as the distinct transparent rival portrait, with a readable plaque and critique panel; no overlap or missing-texture placeholder was visible.
- Browser console: no error-level messages observed during the walk.

The in-app browser exposed neither a locale override nor reduced-motion emulation. I therefore did **not** claim manual EN or reduced-motion visual evidence. Existing automated coverage did pass the French/English typography bounds and the reduced-motion route in the full Chromium run.

## Concerns

The full Chromium suite was not green in this constrained run (six unrelated failures above); it should be rerun in the standard `npm`-capable environment before release. The Task 5 focused offline release gate and all unit/type checks are green.
