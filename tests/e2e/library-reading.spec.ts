import { expect, test } from '@playwright/test';

import { bookCloseControlCentre, bookNextControlCentre, bookSummaryToggleCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
import { libraryAdvanceControlCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { advanceControlCentreOnBoard } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { en } from '../../src/core/i18n/locales/en';
import {
    ARTIFACT_COUNT,
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    artifactAt,
    clickDesign,
    clickUntilScene,
    chooseProposalThroughColleague,
    enterTheLaboratory,
    expectActiveScene,
    gotoCase,
    recordedSources,
    waitForBookToClose,
    waitForInputToSettle,
    waitForBookToOpen,
    waitForPageTurn
} from './canvasHelpers';

/**
 * The reading room, driven with **canvas clicks only** (Story 2.8, AC8).
 *
 * This is the spec that makes `context` honest. Until this story, `source.inspected` was dispatchable
 * only from the retired `CuratedRecord` DOM panel — one of the nine intents the 2026-08-06 correction
 * found unreachable from the canvas — so every walk through this phase reached in through the DOM and
 * `canvas-transitions.spec.ts` said so in its own header table. Nothing below touches a DOM control.
 *
 * ## What it can and cannot assert
 *
 * Canvas text cannot be read from the DOM, so nothing here asserts a string. What it asserts is
 * *behaviour that only a working surface produces*: the router's `data-active-scene`, and whether a
 * click at a derived coordinate had the effect the design says it should. The strings are covered
 * where they can be — bundle completeness in `tests/unit/I18n.test.ts`, authored locales in
 * `tests/unit/ReadingGateHints.test.ts`, and French widths in `french-typography.spec.ts`. That is the
 * same division `canvas-transitions.spec.ts` documents.
 *
 * Every click target is **derived** from exported geometry. The 1.12 review set that rule after a spec
 * pinned a literal that had silently drifted into the gap between two cards, and AC7 restates it.
 */

const LEAVE_THE_ROOM = libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);
const BOOK_CLOSE = bookCloseControlCentre();
const BOOK_NEXT = bookNextControlCentre();
const BOOK_SUMMARY = bookSummaryToggleCentre();
const PREDICTION_ADVANCE = advanceControlCentreOnBoard('prediction');

/**
 * Takes one reference off the shelf, pages it, and puts it back.
 *
 * Paging before closing is not decoration: it is what distinguishes "the book opened" from "the click
 * did nothing". `BOOK_NEXT` sits at (836, 678), which in the room underneath is inside the gate line's
 * band — a non-interactive rectangle — so if the book were not open this click would change nothing at
 * all, and the reading the walk depends on would never have been recorded.
 */
const readReference = async (page: Parameters<typeof clickDesign>[0], index: number): Promise<void> => {
    await clickDesign(page, artifactAt(index));
    await waitForBookToOpen(page);
    await clickDesign(page, BOOK_NEXT);
    await waitForPageTurn(page);
    await clickDesign(page, BOOK_CLOSE);
    await waitForBookToClose(page);
};

test('reads both references and leaves the room, without touching a DOM control', async ({ page }) => {
    await gotoCase(page);
    // Subsumes the boot-title assertion this line used to carry: `enterTheLaboratory` waits on the same
    // hydrated heading before it clicks, and the heading is gone once the frame is dismissed.
    await enterTheLaboratory(page);
    await expectActiveScene(page, 'Library');

    for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
        await readReference(page, index);
    }

    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');

    // --- AC5's Blocker A: the prediction cards are live ------------------------------------------
    // Before this story all four refused on a canvas-only path, because nothing on the canvas could
    // satisfy the context gate and the phase never left `context`. Choosing one and then advancing on
    // it is the proof that the choice was accepted rather than refused.
    await chooseProposalThroughColleague(page, 3);
    await clickUntilScene(page, PREDICTION_ADVANCE, 'Laboratory');
});

test('re-opens a reference already on the record, without refusing it', async ({ page }) => {
    // GitHub's serialized Chromium walk completes legitimately just over the default 30-second budget.
    // The assertions still require the book's suppression and a real scene transition.
    test.setTimeout(45_000);
    await gotoCase(page);
    await enterTheLaboratory(page);
    await expectActiveScene(page, 'Library');

    // AC2's "re-opening an already-inspected artifact is a no-op success, never an error the surface
    // must explain away". `LibraryRenderer.pickUp` short-circuits on `selectIsSourceInspected` and opens
    // the book **without dispatching**; a room that dispatched anyway would be answered with
    // `duplicate-inspected-source`, and `pickUp` would paint that refusal and return *without opening*.
    //
    // How that difference is made observable. Every reference is read first, so the way out is unlocked
    // — then the re-open is the only thing standing between the player and the exit. An open book
    // suppresses the room underneath it (`setInputEnabled(false)`), so:
    //
    //   guard present  → the book opens → the exit is covered → the room does not change
    //   guard removed  → the dispatch is refused → no book opens → the exit is live → the room is left
    //
    // The 2.8 review found the previous version of this test passing with the guard deleted, because it
    // only walked out at the end — which both branches do. This one cannot.
    await readReference(page, 0);
    await readReference(page, 1);

    await clickDesign(page, artifactAt(0));
    await waitForBookToOpen(page);
    await clickDesign(page, LEAVE_THE_ROOM);
    await expectActiveScene(page, 'Library');

    // …and the room is genuinely leavable once the re-opened book is closed, so the assertion above is
    // a suppression rather than a gate that was never open.
    await clickDesign(page, BOOK_CLOSE);
    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');
});

test('reveals and dismisses the reference summary from the book itself', async ({ page }) => {
    // This full reading-room walk has the same valid serialized-run budget as the re-opened-book path.
    test.setTimeout(45_000);
    // Re-pointed from `curated-record.spec.ts`, which drove this through the retired DOM panel and
    // ended on a DOM assertion that genuinely proved the book was still open.
    //
    // The canvas equivalent, and why the order matters. The summary's dismiss control sits at the same
    // coordinate as the book's close control, so one click means "close the summary" when the summary
    // is up and "close the book" when it is not. Reading the *other* reference first unlocks the way
    // out, which turns that ambiguity into an observable difference:
    //
    //   summary opened      → the click dismisses it → the book is still open → the exit stays covered
    //   summary never opened → the click closes the book → the exit is live → the room is left
    //
    // The 2.8 review proved the previous version passed with `drawSummary` disabled entirely, because
    // its trailing clicks landed in the gate band — a non-interactive rectangle — and the walk finished
    // regardless.
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

    await gotoCase(page);
    await enterTheLaboratory(page);
    await expectActiveScene(page, 'Library');

    await readReference(page, 1);

    await clickDesign(page, artifactAt(0));
    await waitForBookToOpen(page);
    await clickDesign(page, BOOK_SUMMARY);
    await waitForInputToSettle(page);
    await clickDesign(page, BOOK_CLOSE);
    // The *close-fade* wait, deliberately, not the shorter input settle: `isOverlayVisible` stays true
    // for the whole 180ms fade and keeps the room suppressed while it runs, so a shorter wait cannot
    // tell "the summary was dismissed and the book is still open" from "the book is on its way out".
    // Waiting the fade out means a book that was closing is gone by the time the exit is tested.
    await waitForBookToClose(page);

    await clickDesign(page, LEAVE_THE_ROOM);
    await expectActiveScene(page, 'Library');

    // Back on the spread, so paging still works — a control the summary panel does not carry.
    await clickDesign(page, BOOK_NEXT);
    await waitForPageTurn(page);

    await clickDesign(page, BOOK_CLOSE);
    await waitForBookToClose(page);
    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');

    expect(errors).toEqual([]);
});

test('opens and closes the reference book under reduced motion', async ({ page }) => {
    // The retained no-flashing / photosensitivity guard. It survives the a11y de-scope (ADR-008) as a
    // standing project requirement, so it moved here with the book rather than being dropped with the
    // panel that used to drive it.
    //
    // Under `reduce` the open and close tweens do not run at all — `hide()` destroys the overlay
    // immediately — so no animation wait is needed, and *that* is the thing being checked: the same
    // walk with none of the timing the animated path needs.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoCase(page);
    await enterTheLaboratory(page);
    await expectActiveScene(page, 'Library');

    /**
     * Every reference but the last, opened and closed with no animation wait at all.
     *
     * The retry is **not** an animation wait, and adding one would defeat this test: under `reduce`
     * there is no tween, and running the walk without the animated path's timing is the whole subject.
     * What it recovers from is a click Phaser dropped because it had not yet processed the previous
     * frame — after which the room correctly holds a reader who has not read everything, and the failure
     * surfaces at the exit below as a room that refuses to be left, five seconds of bounded retry that
     * could never help, and no sign of the click that was actually lost. That was this suite's most
     * frequent flake under three-engine concurrency, and it predates Story 2.12.
     *
     * The condition is the record's own count of readings, so a shelf that stopped recording still
     * fails — here, where the cause is.
     */
    for (let index = 0; index < ARTIFACT_COUNT - 1; index += 1) {
        await expect(async () => {
            await clickDesign(page, artifactAt(index));
            await clickDesign(page, BOOK_CLOSE);
            await expect(recordedSources(page)).toHaveCount(index + 1, { timeout: 1_000 });
        }).toPass({ timeout: 15_000, intervals: [150, 300, 600, 900] });
    }

    // The last is left open, and the way out — unlocked by the readings above — must be covered by it.
    // Without this the test proved only that *closing* worked: a book that never opened would leave the
    // same record behind and the same walk would finish.
    //
    // `waitForInputToSettle` is not an animation wait — under `reduce` there is no tween to wait out,
    // which is the whole point of this test. It is the two frames Phaser needs to apply the hit-area
    // change, without which the next click races the suppression it is meant to observe.
    await expect(async () => {
        await clickDesign(page, artifactAt(ARTIFACT_COUNT - 1));
        await expect(recordedSources(page)).toHaveCount(ARTIFACT_COUNT, { timeout: 1_000 });
    }).toPass({ timeout: 15_000, intervals: [150, 300, 600, 900] });
    await waitForInputToSettle(page);
    await clickDesign(page, LEAVE_THE_ROOM);
    await expectActiveScene(page, 'Library');

    await clickDesign(page, BOOK_CLOSE);
    // The same two frames the open needed, for the same reason and stated once above: closing hands the
    // room's hit areas back, and Phaser applies that on its next pass. `clickUntilScene` retries, but a
    // first click inside that window is a click the room legitimately swallows — and on Firefox, where
    // frames are longer, it was landing there often enough to exhaust the retry (Story 2.12; the flake
    // predates this story and reproduces on its baseline).
    await waitForInputToSettle(page);
    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');
});

test('refuses to leave the room with nothing read, and stays where it was', async ({ page }) => {
    await gotoCase(page);
    await enterTheLaboratory(page);
    await expectActiveScene(page, 'Library');

    // The control is live, the click reaches it, and the router stays put. Whether the refusal also
    // *says why* cannot be seen from the DOM: that is `resolveAdvanceView`'s decision and is asserted
    // in `tests/unit/AdvanceView.test.ts`, and the authored line it paints in
    // `tests/unit/ReadingGateHints.test.ts`. This test does not stand in for either.
    await clickDesign(page, LEAVE_THE_ROOM);

    await expectActiveScene(page, 'Library');
});

test('does not let a click meant for the reference book leave the room underneath it', async ({ page }) => {
    await gotoCase(page);
    await enterTheLaboratory(page);
    await expectActiveScene(page, 'Library');

    // Every reference is read first, so the advance would otherwise succeed — which is what makes this
    // a real test of the suppression rather than one the gate passes for free. Reading the last one
    // leaves its book open over the control.
    for (let index = 0; index < ARTIFACT_COUNT - 1; index += 1) {
        await readReference(page, index);
    }
    // The last one is left open, so the book covers the advance control the reading has just unlocked.
    await clickDesign(page, artifactAt(ARTIFACT_COUNT - 1));
    await waitForBookToOpen(page);

    await clickDesign(page, LEAVE_THE_ROOM);
    await expectActiveScene(page, 'Library');

    // …and closing the book restores the control, so the suppression is a suppression and not a broken
    // control. `clickUntilScene` covers the closing fade, during which it is still — correctly — inert.
    await clickDesign(page, BOOK_CLOSE);
    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');
});
