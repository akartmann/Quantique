import { expect, test } from '@playwright/test';

import { libraryAdvanceControlCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { debriefAdvanceControlCentre } from '../../src/adapters/phaser/scenes/debriefGeometry';
import { revisitToPredictionControlCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { revisitControlCentreOnBoard } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { en } from '../../src/core/i18n/locales/en';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    WALK_TO_DEBRIEF_COST_MS,
    clickDesign,
    expectActiveScene,
    gotoCase,
    recordedObservations,
    walkToDebrief,
    walkToTheBoard
} from './canvasHelpers';

/**
 * AC2 on the canvas: **every forward transition is taken from the scene the player is standing in.**
 *
 * What this reaches that no unit or integration test can — the router really activating the scene
 * (`data-active-scene`), and each advance control really having a live hit area at the coordinate its
 * host places it at. Every click target is **derived** from exported geometry rather than restated as
 * a literal, which is the rule the 1.12 review set after a spec pinned a coordinate that had silently
 * drifted into the gap between two cards.
 *
 * ## No gating intent is left unowned
 *
 * | Gating intent | Only dispatcher today | Owner |
 * | --- | --- | --- |
 * | *(none)* | — | — |
 *
 * **The table is empty as of Story 2.11**, and that is the change this spec records. It carried two
 * rows through the 2.7 development notes and the 2.7 review before the 2.8 review assigned both to
 * 2.11: `theory.supportRunSelected` / `theory.supportSourceSelected` and `peerReview.requested` /
 * `revision.saved`, whose only dispatchers were `src/ui/theory/TheoryBoard.ts` and
 * `src/ui/review/ConclusionReviewPanel.ts`. The case file on the theory board dispatches all six from
 * the canvas now, so the four `board.getByRole('checkbox').check()` calls and the two peer-review
 * button clicks that used to sit in the middle of this walk are gone.
 *
 * The rest left earlier: `source.inspected` in Story 2.8 (the reading room), and `experiment.run`,
 * `apparatus.controlSet` and the three `comparison.*` intents in Story 2.10 (the bench and its
 * notebook).
 *
 * So this is now honestly **"the Young case can be completed with canvas clicks alone"**, which is
 * what the paragraph here used to say it was two intents short of. Story 2.12's completion check is
 * "every player intent is dispatchable from the canvas", and it deletes the panels those six used to
 * live in; nothing in this walk depends on one any more.
 *
 * **The two remaining DOM-only intents are gone too, as of Story 2.12.** They were
 * `consultation.requested` and `apparatus.reset` — neither gating a transition and neither required to
 * complete a case, which is why they were never in the table above, and both carrying a decision owed
 * before this story started. The decisions were taken rather than deferred again: the consultation is a
 * control on the case-file overlay (D4), and the reset is a control in the bench's own control row
 * (D3). `theory-board.spec.ts` drives the first and `YoungExperimentBench.test.ts` and
 * `ApparatusRun.test.ts` the second.
 *
 * So there is no player intent left whose only dispatcher is under `src/ui/` — which is ADR-011's
 * completeness condition, and the condition on which the eleven panels were deleted.
 *
 * ## Where the walk itself lives
 *
 * In `canvasHelpers.ts`, as {@link walkToDebrief}, because `debrief-replay.spec.ts` needs the same
 * journey and `artifactAt` was copy-pasted between two specs in the very commit that created that file
 * to stop exactly this. **The transitions are asserted inside the walk**, at each step, so extracting
 * it did not reduce this spec's property to "we ended up in the debrief somehow".
 *
 * Canvas *text* is deliberately not asserted **anywhere in this file** — it cannot be read from the
 * DOM. That includes refusal messages, and the layer that owns them is `tests/unit/AdvanceView.test.ts`,
 * which asserts the hint, the localized error, the precedence between them, and the hint's withdrawal
 * against `resolveAdvanceView` directly. `french-typography.spec.ts` measures advance *label* widths and
 * says nothing about a refusal, so it is not the answer to "does a refused click say why".
 */

/**
 * The whole-case walk's own budget — one of the three parts of the `canvas-transitions` decision Story
 * 2.10 was asked to take.
 *
 * **This raise is not an alternative to the worker cap; both were applied, and each answers a different
 * part of one problem** (corrected at review 2026-08-07). The measurement showed three problems wearing
 * one name:
 *
 * 1. **Not budget at all.** The walk's waits were calibrated in frames — Phaser processes pointer input
 *    once per rendered frame — so every one of them stretched under load. `dragDesignUntil` and
 *    `startTheLightUntilRecorded` replaced them with bounded retries on the thing the gesture was
 *    supposed to achieve, which is why a lost drag or a swallowed press now fails where it happens.
 * 2. **Genuine wall-clock, budgeted here.** Story 2.10 added two run animations, a notebook overlay and a
 *    typed note to this walk, and Story 2.11 added a case file opened twice. It does more, so it takes
 *    longer: the default plus what the runs actually cost, read from the helper that runs them, plus the
 *    same allowance again for the rest of the walk. Derived rather than rounded.
 * 3. **Contention, settled at suite level.** What remained after (1) and (2) is many browsers competing
 *    for frames, which is a fact about the suite rather than about this spec — so it is answered in
 *    `playwright.config.ts` by `workers: 5`.
 *
 * Splitting the walk was the fourth option and remains the wrong one: the single continuous walk **is**
 * the property this spec asserts.
 */
test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

const LEAVE_THE_ROOM = libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);
/**
 * The way out of the debrief, read from the room that draws it.
 *
 * It was `placeholderAdvanceControlCentre` until Story 2.11 — `DebriefScene` was the last
 * routing-shell subclass, and the shell put its control in the same place in every scene it shelled.
 * The shell and its geometry module are deleted; this reads the real room.
 */
const DEBRIEF_REPLAY = debriefAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);

test('takes every forward transition of the Young case from the canvas', async ({ page }) => {
    // The boot assertion this line used to carry now lives inside `walkToDebrief`, next to `goto('/')`,
    // where it is the precondition it was written to be rather than a fact about the DOM shell that
    // happens to still be mounted once the player is standing in the debrief (2.11 review).
    await walkToDebrief(page);

    // --- post-debrief replay -------------------------------------------------------------------
    await clickDesign(page, DEBRIEF_REPLAY);
    await expectActiveScene(page, 'Library');
    // A replay is a fresh investigation, not a re-reading of the finished one.
    await expect(recordedObservations(page)).toHaveCount(0);
});

test('refuses a transition the evidence has not earned, and stays where it was', async ({ page }) => {
    await gotoCase(page);
    await expectActiveScene(page, 'Library');

    // Nothing read, so `missing-contextual-sources` refuses. What is observable *here* is that the
    // player does not move — the control is live, the click reached it, and the router stayed put.
    // Whether the refusal also says why is the other half of AC4 and cannot be seen from the DOM at
    // all: it is asserted on `resolveAdvanceView` in `tests/unit/AdvanceView.test.ts`, which is the
    // layer that decides it, and the authored line in `tests/unit/ReadingGateHints.test.ts`. This test
    // does not stand in for either.
    await clickDesign(page, LEAVE_THE_ROOM);

    await expectActiveScene(page, 'Library');
});

test('lets the player revisit the bench and first meeting from the canvas', async ({ page }) => {
    await walkToTheBoard(page);

    await clickDesign(page, revisitControlCentreOnBoard());
    await expectActiveScene(page, 'Laboratory');

    await clickDesign(page, revisitToPredictionControlCentre());
    await expectActiveScene(page, 'Colleagues');
});

/*
 * The third test that used to live here — "does not let a click meant for the reference book advance
 * the phase underneath it" — moved to `library-reading.spec.ts` in Story 2.8, along with the room it
 * was about. It is not gone: the book is now owned by the scene it covers, so the suppression it pins
 * is a fact about the reading room rather than about a session-wide overlay, and it belongs with the
 * rest of that room's behaviour. The case file's equivalent — "a click meant for the overlay must not
 * choose a conclusion" — is pinned in `debrief-replay.spec.ts`, with the surface it belongs to.
 */
