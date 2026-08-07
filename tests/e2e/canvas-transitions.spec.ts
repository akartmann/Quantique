import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { advanceControlCentreOnBoard, lastProposalCardProbe } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
// From `apparatusGeometry`, not `ApparatusRenderer`. That renderer stopped importing Phaser as a
// *value* in Story 2.10, so it is technically importable here now — but a spec deriving a click target
// must not have to construct a renderer to get one, and the geometry/painting split is the point. The
// routing shell's geometry is split out of `PhasePlaceholderScene` for the same reason (it extends
// `Scene`), and `libraryGeometry` out of `LibraryScene` and `LibraryRenderer` again.
import {
    KNOB_TRAVEL_RADIUS,
    advanceToSynthesisControlCentre,
    knobCentre,
    notebookCloseControlCentre,
    notebookControlCentre,
    notebookSaveControlCentre,
    notebookSelectionCentre,
    startTheLightControlCentre
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { KNOB_ARC_END_RAD } from '../../src/adapters/phaser/renderers/instrumentView';
import { placeholderAdvanceControlCentre } from '../../src/adapters/phaser/scenes/phasePlaceholderGeometry';
import { libraryAdvanceControlCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { en } from '../../src/core/i18n/locales/en';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    artifactAt,
    clickDesign,
    clickUntilScene,
    dragDesignUntil,
    expectActiveScene,
    waitForBookToClose,
    waitForBookToOpen,
    waitForInputToSettle,
    startTheLightUntilRecorded,
    RUN_STEP_COST_MS
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
 * ## What is *not* a canvas click here, and why
 *
 * Every **transition** below is a canvas click. Two intents that *gate* those transitions still have
 * no canvas dispatcher at all, so they stay on their current DOM path and are annotated inline with
 * the story that closes each:
 *
 * | Gating intent | Only dispatcher today | Owner |
 * | --- | --- | --- |
 * | `theory.supportRunSelected` / `theory.supportSourceSelected` | `src/ui/theory/TheoryBoard.ts` | Story 2.11 |
 * | `peerReview.requested` / `revision.saved` | `src/ui/review/ConclusionReviewPanel.ts` | Story 2.11 |
 *
 * **`source.inspected` left this table in Story 2.8.** The reading room dispatches it from the canvas
 * now, so the `context → prediction` step below is a genuine canvas walk rather than a DOM reach-in,
 * and this file no longer has to open the reference book to get out of the way of its own gate.
 *
 * **`experiment.run`, `apparatus.controlSet` and the three `comparison.*` intents left it in Story
 * 2.10.** The bench has real instruments, a control that starts the light, and a notebook overlay, so
 * the `experiment → synthesis` and `synthesis → review` steps below are canvas walks too. The bench's
 * own behaviour — the drag, the run, the lock, the comparison — is `young-canvas-experiment.spec.ts`;
 * what stays here is only enough of it to reach the next transition.
 *
 * The remaining two rows were carried as *unowned* through the 2.7 development notes and the 2.7
 * review before the 2.8 review assigned them to **Story 2.11** (`deferred-work.md` §Assigned). They
 * must land before Story 2.12, whose completion check is "every player intent is dispatchable from the
 * canvas" and which deletes their only dispatchers.
 *
 * So this is honestly **"each transition is dispatchable from the canvas"**, not yet "the Young case
 * can be completed with canvas clicks alone" — two intents short of it, and 2.11 closes both.
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
 * part of one problem** (corrected at review 2026-08-07 — this docstring used to argue against the cap
 * that `playwright.config.ts` applies in the same commit, so two of the three records agreed and this one
 * contradicted them). The measurement showed three problems wearing one name:
 *
 * 1. **Not budget at all.** The walk's waits were calibrated in frames — Phaser processes pointer input
 *    once per rendered frame — so every one of them stretched under load. {@link dragDesignUntil} and
 *    {@link startTheLightUntilRecorded} replaced them with bounded retries on the thing the gesture was
 *    supposed to achieve, which is why a lost drag or a swallowed press now fails where it happens.
 * 2. **Genuine wall-clock, budgeted here.** Story 2.10 added two run animations, a notebook overlay and a
 *    typed note to this walk. It does more, so it takes longer: the default plus what the two runs
 *    actually cost, read from the renderer that runs them, plus the same allowance again for the rest of
 *    the walk. Derived rather than rounded, so a change to the animation moves this with it.
 * 3. **Contention, settled at suite level.** What remained after (1) and (2) is many browsers competing
 *    for frames, which is a fact about the suite rather than about this spec — so it is answered in
 *    `playwright.config.ts` by `workers: 5`, with the measurements recorded there.
 *
 * Splitting the walk was the fourth option and remains the wrong one: the single continuous walk **is**
 * the property this spec asserts.
 */
test.setTimeout(30_000 + (4 * RUN_STEP_COST_MS));

const BOOK_CLOSE = bookCloseControlCentre();
/**
 * The way out of the reading room, and the way out of the debrief.
 *
 * These were **one** constant until Story 2.8, because `LibraryScene` and `DebriefScene` were both
 * `PhasePlaceholderScene` and the shell put its control in the same place in each. The library is a
 * real scene now with a layout of its own, so the two coordinates are genuinely different and each is
 * read from the host that draws it. `DebriefScene` is the shell's last subclass; Story 2.11 takes the
 * second of these with it.
 */
const LEAVE_THE_ROOM = libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);
const SHELL_ADVANCE = placeholderAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);
const PREDICTION_ADVANCE = advanceControlCentreOnBoard('prediction');
const LABORATORY_ADVANCE = advanceToSynthesisControlCentre();
const BOARD_ADVANCE = advanceControlCentreOnBoard('conclusion');
const CARD = lastProposalCardProbe(DESIGN_HEIGHT);

const CASE_DEFINITION = JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as {
    contextualArtifacts: { displayName: { en: string; fr: string } }[];
    apparatus: { primaryControls: { id: string; max: number }[] };
};
const SOURCE_NAMES = CASE_DEFINITION.contextualArtifacts.map(({ displayName }) => displayName);

/** The bench's own controls (Story 2.10), every one derived from `apparatusGeometry`. */
const START_THE_LIGHT = startTheLightControlCentre();
const OPEN_THE_NOTEBOOK = notebookControlCentre();
/**
 * Which slot the screen-distance instrument stands in, read from the content rather than fixed at 1.
 *
 * The bench gives one slot per authored control in authored order, so a case that listed the two the
 * other way round would put this drag on the slit spacing — and the run would still record, and the
 * walk would still reach the theory board, and this spec would pass having varied the wrong thing.
 */
const SCREEN_DISTANCE_SLOT = CASE_DEFINITION.apparatus.primaryControls.findIndex(({ id }) => id === 'screenDistanceM');
if (SCREEN_DISTANCE_SLOT < 0) throw new Error('The authored case must carry a screen-distance control.');
/** Where a drag to the far end of the travel lands, read from the authored bound rather than as 4. */
const FURTHEST_THROW = CASE_DEFINITION.apparatus.primaryControls[SCREEN_DISTANCE_SLOT]!.max;
/** The far end of that knob's travel, derived from the arc the conversion module exports. */
const SCREEN_DISTANCE_TRAVEL_END = {
    x: knobCentre(SCREEN_DISTANCE_SLOT).x + (Math.cos(KNOB_ARC_END_RAD) * (KNOB_TRAVEL_RADIUS - 6)),
    y: knobCentre(SCREEN_DISTANCE_SLOT).y + (Math.sin(KNOB_ARC_END_RAD) * (KNOB_TRAVEL_RADIUS - 6))
};

test('takes every forward transition of the Young case from the canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: en['boot.title'] })).toBeVisible();
    await expectActiveScene(page, 'Library');

    // --- context → prediction ------------------------------------------------------------------
    // A canvas walk since Story 2.8: each reference is taken off the shelf, which records
    // `source.inspected` and opens the book over the room. The book has to be closed before the next
    // click, because it legitimately suppresses everything underneath it while it is open.
    for (let index = 0; index < SOURCE_NAMES.length; index += 1) {
        await clickDesign(page, artifactAt(index));
        await waitForBookToOpen(page);
        await clickDesign(page, BOOK_CLOSE);
        await waitForBookToClose(page);
    }

    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');

    // --- prediction → experiment ---------------------------------------------------------------
    // The prediction itself is a canvas act already (Story 1.11): one of four attributed proposals.
    await clickDesign(page, CARD);
    await clickDesign(page, PREDICTION_ADVANCE);
    await expectActiveScene(page, 'Laboratory');

    // --- experiment → synthesis ----------------------------------------------------------------
    // A canvas walk since Story 2.10: the light is started from the bench's own control and the throw
    // is varied on its own instrument. Two observations at **different** screen distances are what the
    // significant-measure gate asks for — `configurationKey` reads a repeat at one setting as a
    // replication, so pressing start twice would record two observations and leave the gate shut.
    // The press is **retried until the run is recorded**, for the same reason the drag below is: a press
    // landing a frame before the bench is handed back reaches nothing, and the failure surfaces at the
    // transition several steps later rather than here.
    await startTheLightUntilRecorded(page, START_THE_LIGHT, 1);
    // The setting is **observed**, never driven, and it is what the retry waits on. A lost drag would
    // otherwise surface at the transition below as a routing error, because two observations at the
    // same setting are a replication and the gate correctly stays shut.
    await dragDesignUntil(page, knobCentre(SCREEN_DISTANCE_SLOT), SCREEN_DISTANCE_TRAVEL_END, async () => {
        await expect(page.getByLabel('Screen distance (m)')).toHaveValue(String(FURTHEST_THROW), { timeout: 1_500 });
    });
    await startTheLightUntilRecorded(page, START_THE_LIGHT, 2);

    // The comparison and its note are a **bench** act since Story 2.10 — the notebook is an overlay
    // over the laboratory, so it is opened here rather than from the theory board the DOM panel used
    // to be reachable from. The overlay suppresses the bench while it is up and hands it back on close.
    await clickDesign(page, OPEN_THE_NOTEBOOK);
    await waitForInputToSettle(page);
    await clickDesign(page, notebookSelectionCentre(0));
    await waitForInputToSettle(page);
    await clickDesign(page, notebookSelectionCentre(1));
    await waitForInputToSettle(page);
    // **No click into the note field.** It is deliberately not interactive — `applyVisibility` states so
    // in as many words — because there is no cursor on a canvas to invite one, so the field takes keys
    // from the moment a pair is selected. The click here landed on the interactive backdrop, which
    // swallowed it: an inert step that asserted nothing and made the walk read as though a click were
    // required (review 2026-08-07).
    // Deliberately short. The reducer only refuses a *blank* note, and what this walk is proving is
    // that the intent is canvas-dispatchable at all; the note's content is
    // `young-canvas-experiment.spec.ts`'s subject, and every character here is a keystroke through
    // Phaser's input queue that this walk pays for twice over at nine workers.
    await page.keyboard.type('Wider');
    await clickDesign(page, notebookSaveControlCentre());
    await waitForInputToSettle(page);
    await clickDesign(page, notebookCloseControlCentre());
    await waitForInputToSettle(page);

    await clickDesign(page, LABORATORY_ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');

    // --- synthesis → review --------------------------------------------------------------------
    // Choosing the conclusion is a canvas act (Story 1.11) and sets the draft's claim and limitation.
    // Its supporting evidence is not: the two support selections are Story 2.11's, and they are the
    // last DOM reach-in in this walk.
    await clickDesign(page, CARD);

    const board = page.getByRole('region', { name: 'Theory board' });
    await board.getByRole('checkbox', { name: 'Select Observation 1 as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Observation 2 as conclusion support' }).check();
    for (const displayName of SOURCE_NAMES) {
        await board.getByRole('checkbox', { name: `Select ${displayName.en} as conclusion support` }).check();
    }

    await clickDesign(page, BOARD_ADVANCE);
    // The theory board hosts `synthesis` **and** `review`, so the scene deliberately does not change
    // here. That the phase did is proven by what follows: `peerReview.requested` is refused outside
    // `review`, and `case.debriefCompleted` is refused unless a reviewed revision was saved in it.
    await expectActiveScene(page, 'TheoryBoard');

    // --- review → debrief ----------------------------------------------------------------------
    const peerReview = page.getByRole('region', { name: 'Peer review' });
    await peerReview.getByRole('button', { name: 'Request peer feedback' }).click();
    await peerReview.getByRole('button', { name: 'Save reviewed revision' }).click();

    // `clickUntilScene`, not a single click, and the reason is the *previous* advance rather than this
    // one. The theory board hosts both phases, so the router leaves the scene standing across
    // `synthesis → review` and the control's label changes from "To your reviewers" to "Close the
    // case" under the cursor — which starts `ADVANCE_RELABEL_LOCKOUT_MS`, a deliberate 400ms window in
    // which the control ignores clicks so a double-click cannot skip `review` entirely.
    //
    // The two DOM clicks above take about 125ms, so a spec clicking at machine speed lands inside that
    // window and is correctly ignored. This test passed before Story 2.8 only because nine parallel
    // workers slowed the machine past 400ms — run on its own, at HEAD or at the story's baseline
    // commit, it failed either way. Retrying is what a player does without noticing, and the helper is
    // bounded, so a genuinely dead control still fails.
    await clickUntilScene(page, BOARD_ADVANCE, 'Debrief');

    // --- post-debrief replay -------------------------------------------------------------------
    await clickDesign(page, SHELL_ADVANCE);
    await expectActiveScene(page, 'Library');
    // A replay is a fresh investigation, not a re-reading of the finished one.
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).locator('.notebook-observation')).toHaveCount(0);
});

test('refuses a transition the evidence has not earned, and stays where it was', async ({ page }) => {
    await page.goto('/');
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

/*
 * The third test that used to live here — "does not let a click meant for the reference book advance
 * the phase underneath it" — moved to `library-reading.spec.ts` in Story 2.8, along with the room it
 * was about. It is not gone: the book is now owned by the scene it covers, so the suppression it pins
 * is a fact about the reading room rather than about a session-wide overlay, and it belongs with the
 * rest of that room's behaviour.
 */
