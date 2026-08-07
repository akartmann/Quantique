import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { advanceControlCentreOnBoard, lastProposalCardProbe } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
// From `apparatusGeometry`, not `ApparatusRenderer`: that renderer imports Phaser as a *value*
// (`BlendModes`), Phaser touches `window` at import time, and these specs run in Node. The routing
// shell's geometry is split out of `PhasePlaceholderScene` for the same reason — it extends `Scene`,
// and `libraryGeometry` out of `LibraryScene` and `LibraryRenderer` for the same reason again.
import { advanceToSynthesisControlCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { placeholderAdvanceControlCentre } from '../../src/adapters/phaser/scenes/phasePlaceholderGeometry';
import { libraryAdvanceControlCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { en } from '../../src/core/i18n/locales/en';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    artifactAt,
    clickDesign,
    clickUntilScene,
    expectActiveScene,
    waitForBookToClose,
    waitForBookToOpen
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
 * Every **transition** below is a canvas click. Four intents that *gate* those transitions still have
 * no canvas dispatcher at all, so they stay on their current DOM path and are annotated inline with
 * the story that closes each:
 *
 * | Gating intent | Only dispatcher today | Owner |
 * | --- | --- | --- |
 * | `experiment.run` | `src/ui/apparatus/ApparatusControls.ts` | Story 2.10 |
 * | `comparison.runSelected` / `comparison.noteSaved` | `src/ui/notebook/NotebookPanel.ts` | Story 2.10 |
 * | `theory.supportRunSelected` / `theory.supportSourceSelected` | `src/ui/theory/TheoryBoard.ts` | unowned |
 * | `peerReview.requested` / `revision.saved` | `src/ui/review/ConclusionReviewPanel.ts` | unowned |
 *
 * **`source.inspected` left this table in Story 2.8.** The reading room dispatches it from the canvas
 * now, so the `context → prediction` step below is a genuine canvas walk rather than a DOM reach-in,
 * and this file no longer has to open the reference book to get out of the way of its own gate. The
 * reading room's own behaviour — the pickup, the book, the refusal, the suppression — is
 * `library-reading.spec.ts`; what stays here is only enough of it to reach the next transition.
 *
 * So this is honestly **"each transition is dispatchable from the canvas"**, not "the Young case can be
 * completed with canvas clicks alone". The latter becomes true when 2.10 lands and is verified in full
 * by 2.12. `apparatus.controlSet` is the one exception in the list below: it *is* canvas-dispatchable
 * through the laboratory's step buttons, but those buttons export no geometry, so deriving a click
 * target for them would mean restating literals. It stays on the DOM path here and Story 2.10 gives it
 * the knob and the geometry.
 *
 * Canvas *text* is deliberately not asserted **anywhere in this file** — it cannot be read from the
 * DOM. That includes refusal messages, and the layer that owns them is `tests/unit/AdvanceView.test.ts`,
 * which asserts the hint, the localized error, the precedence between them, and the hint's withdrawal
 * against `resolveAdvanceView` directly. `french-typography.spec.ts` measures advance *label* widths and
 * says nothing about a refusal, so it is not the answer to "does a refused click say why".
 */

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

const SOURCE_NAMES = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { contextualArtifacts: { displayName: { en: string; fr: string } }[] })
    .contextualArtifacts.map(({ displayName }) => displayName);

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
    // `experiment.run` is Story 2.10's; so is the knob that varies the throw. Two observations at
    // different screen distances are what the significant-measure gate asks for.
    await page.getByRole('button', { name: 'Run experiment' }).click();
    await page.getByLabel('Screen distance (m)').fill('3');
    await page.getByLabel('Screen distance (m)').press('Enter');
    await page.getByRole('button', { name: 'Run experiment' }).click();

    await clickDesign(page, LABORATORY_ADVANCE);
    await expectActiveScene(page, 'TheoryBoard');

    // --- synthesis → review --------------------------------------------------------------------
    // Choosing the conclusion is a canvas act (Story 1.11) and sets the draft's claim and limitation.
    // Its supporting evidence is not: the notebook comparison is Story 2.10's and the support
    // selections are unowned in the 2.7–2.12 plan.
    await clickDesign(page, CARD);

    const notebook = page.getByRole('region', { name: 'Measurement notebook' });
    await notebook.getByRole('checkbox', { name: 'Select Observation 1 for comparison' }).check();
    await notebook.getByRole('checkbox', { name: 'Select Observation 2 for comparison' }).check();
    await notebook.getByLabel('Comparison note').fill('The recorded spacing differs across these two bounded configurations.');
    await notebook.getByRole('button', { name: 'Save comparison note' }).click();

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
