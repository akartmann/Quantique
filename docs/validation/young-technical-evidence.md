# Young validation technical evidence

**Recorded by:** QA / release lead — _assign before release_
**Recorded date:** _YYYY-MM-DD — unrecorded_
**Commit under review:** _Commit — must be the candidate being released_
**Baseline commit for comparison:** `87f0ab5`

> **Every row below is unrecorded.** The previous all-Pass table was captured on 2026-08-05 against the
> pre-pivot build. Twelve stories have landed since, the interactive surface moved into Phaser, and the
> baseline is now `87f0ab5`. That table is stale and was reset rather than carried forward — a recorded
> Pass from a superseded build is worse than no evidence, because it reads as verification.

| Evidence | Result (Pass / Blocked) | Notes |
| --- | --- | --- |
| `npm run typecheck` | _Unrecorded_ | _Notes_ |
| `npm test` | _Unrecorded_ | _Notes_ |
| `npm run build` | _Unrecorded_ | _Notes_ |
| `npm run test:e2e` | _Unrecorded_ | _Notes — name every failure and classify it against the baseline_ |
| `npm run test:e2e:a11y` | _Unrecorded_ | _Notes. **Supporting context only, never a gate** (ADR-008)._ |
| `npm run test:e2e:offline` | _Unrecorded_ | _Notes_ |
| `npm run test:e2e:cross-browser` | _Unrecorded_ | _Notes — name any browser that was unavailable rather than recording it as passed_ |

Playwright runs with `PLAYWRIGHT_BROWSERS_PATH=0`.

## Known baseline-failing e2e specs — do not record these as a Pass, and do not attribute them to a candidate change

These specs **already fail on the baseline** `87f0ab5`. They are carried in
`_bmad-output/implementation-artifacts/deferred-work.md` and are pre-existing: ~6 specs still click a
notebook button named `Record prepared observation` that no longer exists in `src/`, and
`young-experiment.spec.ts` asserts `aria-disabled='true'` on a control that is hard-`disabled`, so
Playwright cannot click it.

Measured baseline totals on `87f0ab5`:

| Suite | Baseline result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | Pass — 34 files, 424 tests |
| `npm run build` | Pass |
| `npm run test:e2e` (chromium) | **7 failed, 33 passed** |
| `npm run test:e2e:offline` (chromium) | **1 failed, 4 passed** |
| `npm run test:e2e:a11y` (chromium) | **1 failed, 1 passed** |
| `npm run test:e2e:cross-browser` | **31 failed, 89 passed** (7 chromium, 11 firefox, 13 webkit) |

### Chromium baseline failures

**Match these by spec title, not by line number.** A line number shifts whenever anything above the
test changes — an added import is enough — and a shifted line silently reads as "not in the list", which
the rule above then classifies as a candidate regression. The title column is the stable key; the line
numbers are a convenience and are correct as of `87f0ab5` plus this story's edits.

| Baseline-failing spec | Spec title (stable key) | Cause |
| --- | --- | --- |
| `tests/e2e/accessibility.spec.ts:6` | `has no automated accessibility violations in the boot shell, Curated Record, notebook comparison, or exposed Theory Board` | Stale `Record prepared observation` notebook flow |
| `tests/e2e/curated-record.spec.ts:179` | `snapshots inspected source labels into a new notebook observation` | Stale `Record prepared observation` notebook flow |
| `tests/e2e/inquiry-recognition.spec.ts:4` | `keeps inquiry recognition semantic, non-intrusive, and available without audio` | Stale `Record prepared observation` notebook flow |
| `tests/e2e/offline-reload.spec.ts:72` | `restores saved progress and decision history after an offline reload` | Stale `Record prepared observation` notebook flow |
| `tests/e2e/progress-portability.spec.ts:4` | `exports only portable progress and recovers from invalid or incompatible imports` | Stale `Record prepared observation` notebook flow |
| `tests/e2e/theory-board.spec.ts:3` | `supports a keyboard-accessible evidence-to-conclusion draft with recoverable readiness guidance` | Stale `Record prepared observation` notebook flow |
| `tests/e2e/young-experiment.spec.ts:12` | `runs the bounded Young experiment through its semantic controls and preserves its scientific record` | Run-experiment `aria-disabled` vs hard-`disabled` mismatch (the failing assertion is at `:18`; `deferred-work.md` cites `:19`) |

### Additional firefox / webkit baseline failures

Beyond the seven above, which fail in all three browsers, these fail on the baseline in the
non-chromium projects only. They are **not** tracked in `deferred-work.md` and have no owner — they need
one before cross-browser release verification (Story 7.3) can mean anything.

| Baseline-failing spec | Spec title (stable key) | firefox | webkit |
| --- | --- | --- | --- |
| `tests/e2e/accessible-control.spec.ts:56` | `projects Phaser pointer and touch changes through the same semantic readout` | fails | fails |
| `tests/e2e/dialogue-advance.spec.ts:68` | `advances the authored conversation on the canvas without touching the investigation` | fails | fails |
| `tests/e2e/dialogue-advance.spec.ts:98` | `keeps choosing a proposal working after the conversation has moved the cards` | fails | fails |
| `tests/e2e/scene-router.spec.ts:31` | `walks the Young scene sequence, keeping the active scene mirroring the case phase` | fails | fails |
| `tests/e2e/offline-reload.spec.ts:17` | `boots in French and stays French after an offline reload` | passes | **fails** |
| `tests/e2e/offline-reload.spec.ts:137` | `loads the cached validation route after an online warm-up without progress controls` | passes | **fails** (`page.reload: WebKit encountered an internal error` at the offline step) |

Establish the baseline result on `87f0ab5` **before** comparing a candidate run. Record a failure in
this list as **pre-existing**; record any *other* failure as a candidate regression.

**What each row's Pass means.** A suite row is **Pass** when the candidate run introduces **no failure
that is not already enumerated above**, and every failure it does show is named and classified in the
notes. A suite row is **Blocked** when the candidate shows any unenumerated failure, when a failure is
recorded without classification, or when a browser or suite was not run at all.

Never fabricate a Pass, never record a suite as passed without naming its failures, and never quietly
widen the enumerated list to absorb a new failure — moving a candidate regression into the
baseline table is the same defect as recording a false Pass, and it is harder to spot afterwards.
Growing that list requires the release owner's signature on the row below.

This is deliberately a **no-regression** gate rather than a **green-suite** gate. A green-suite reading
would make these rows permanently Blocked while the pre-existing failures stand, which blocks the
release on work no one is assigned and tells the release owner nothing about the candidate. The
pre-existing failures are not thereby forgiven — they carry a named owner in the row below, and that row
**is** blocking.

| Prerequisite | Owner | Evidence reference | Result (Pass / Blocked) | Follow-up date |
| --- | --- | --- | --- | --- |
| **Enumerated baseline failures are owned** — every spec in the two tables above has a named owner and a dated remediation plan, including the six non-chromium failures that `deferred-work.md` did not previously track | _QA / release lead_ | _Reference_ | _Result_ | _YYYY-MM-DD_ |
| **The enumerated list has not grown without signature** — if any spec was added to the baseline tables since the last decision, the release owner has signed that it is genuinely pre-existing and not a candidate regression | _Release owner_ | _Reference_ | _Result_ | _YYYY-MM-DD_ |

## What automated evidence does and does not establish

Automated evidence verifies only product behavior: the validation route boots into a fresh Young state,
mounts no progress export/import/print surface, preserves normal learner-owned progress byte-for-byte,
exposes no later case, renders its facilitator disclosure in the browser's resolved locale, and can load
after a cache warm-up.

It does **not** establish learner learning outcomes, voluntary exploration, educator value, EN + FR
content completeness, motion safety, source/rights approval, low-end-laptop performance, or human
cached-offline acceptance. No test, rendered FPS estimate, or axe run may be presented as any of those.

## Current release position

**Blocked.** Every row in this table is unrecorded, and the following facilitator- or reviewer-owned
gates remain unperformed and must be recorded with named owners and evidence references before a release
owner can change the decision:

- Stories 2.5 and 2.6 shipped (prerequisite — no moderated session may be scheduled before both land)
- 15–30 moderated sessions, including at least one `en` and one `fr` session, and both >=60% measures
- At least five educator affirmative responses
- Scholarly source and rights review
- EN + FR content completeness across every Young surface
- Reduced-motion / no-flashing check on the Phaser scenes
- A 10-minute 1280×720 low-end-laptop 60-FPS check
- Human cached-offline acceptance

Manual accessibility acceptance is **not** among them (ADR-008): findings are recorded as non-blocking
and carried to the post-MVP accessibility owner. No waiver or override is available for the gates that
remain.
