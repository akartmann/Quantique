import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { bookCloseControlCentre, bookNextControlCentre, bookSummaryToggleCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
import { libraryAdvanceControlCentre, libraryArtifactCentre } from '../../src/adapters/phaser/scenes/libraryGeometry';
import { advanceControlCentreOnBoard, lastProposalCardProbe } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { en } from '../../src/core/i18n/locales/en';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    clickDesign,
    clickUntilScene,
    expectActiveScene,
    waitForBookToClose,
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

const ARTIFACT_COUNT = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { contextualArtifacts: unknown[] }).contextualArtifacts.length;

/** One object per authored artifact, at the count the room actually draws. */
const artifactAt = (index: number): Readonly<{ x: number; y: number }> => {
    const centre = libraryArtifactCentre(index, ARTIFACT_COUNT, DESIGN_WIDTH);
    if (!centre) throw new Error(`The reading room draws no object at index ${index}.`);
    return centre;
};

const LEAVE_THE_ROOM = libraryAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT);
const BOOK_CLOSE = bookCloseControlCentre();
const BOOK_NEXT = bookNextControlCentre();
const BOOK_SUMMARY = bookSummaryToggleCentre();
const PREDICTION_CARD = lastProposalCardProbe(DESIGN_HEIGHT);
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
    await page.goto('/');
    await expect(page.getByRole('heading', { name: en['boot.title'] })).toBeVisible();
    await expectActiveScene(page, 'Library');

    for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
        await readReference(page, index);
    }

    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');

    // --- AC5's Blocker A: the prediction cards are live ------------------------------------------
    // Before this story all four refused on a canvas-only path, because nothing on the canvas could
    // satisfy the context gate and the phase never left `context`. Choosing one and then advancing on
    // it is the proof that the choice was accepted rather than refused.
    await clickDesign(page, PREDICTION_CARD);
    await clickUntilScene(page, PREDICTION_ADVANCE, 'Laboratory');
});

test('re-opens a reference already on the record, without refusing it', async ({ page }) => {
    await page.goto('/');
    await expectActiveScene(page, 'Library');

    // AC2's "re-opening an already-inspected artifact is a no-op success, never an error the surface
    // must explain away". The store answers a second `source.inspected` with
    // `duplicate-inspected-source`, so a room that dispatched one would paint a refusal here — and the
    // player would have done nothing but read the same page twice.
    //
    // What proves it: the second read leaves the record intact and the room still openable. If the
    // re-read had been dispatched and refused, the walk below would still work — so the assertion that
    // carries the weight is the *integration* test's, which shows the reducer refusing a duplicate.
    // This one pins that the surface stays usable across a re-read.
    await readReference(page, 0);
    await readReference(page, 0);
    await readReference(page, 1);

    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');
});

test('reveals and dismisses the reference summary from the book itself', async ({ page }) => {
    // Re-pointed from `curated-record.spec.ts`, which drove this through the retired DOM panel. The
    // assertion is the same one and it is sharper here: the summary's own close control shares the
    // close control's coordinate, so if "Show summary" had not opened, that second click would have
    // closed the *book* — and the page-turn afterwards would then have done nothing and left the room
    // reachable. Closing the book last and leaving is what proves it was open the whole time.
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

    await page.goto('/');
    await expectActiveScene(page, 'Library');

    await clickDesign(page, artifactAt(0));
    await waitForBookToOpen(page);
    await clickDesign(page, BOOK_SUMMARY);
    await clickDesign(page, BOOK_CLOSE);
    // Still open on the spread: paging works, which the summary panel has no control for.
    await clickDesign(page, BOOK_NEXT);
    await waitForPageTurn(page);

    await clickDesign(page, BOOK_CLOSE);
    await waitForBookToClose(page);
    await readReference(page, 1);
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
    await page.goto('/');
    await expectActiveScene(page, 'Library');

    for (let index = 0; index < ARTIFACT_COUNT; index += 1) {
        await clickDesign(page, artifactAt(index));
        await clickDesign(page, BOOK_CLOSE);
    }

    await clickUntilScene(page, LEAVE_THE_ROOM, 'Colleagues');
});

test('refuses to leave the room with nothing read, and stays where it was', async ({ page }) => {
    await page.goto('/');
    await expectActiveScene(page, 'Library');

    // The control is live, the click reaches it, and the router stays put. Whether the refusal also
    // *says why* cannot be seen from the DOM: that is `resolveAdvanceView`'s decision and is asserted
    // in `tests/unit/AdvanceView.test.ts`, and the authored line it paints in
    // `tests/unit/ReadingGateHints.test.ts`. This test does not stand in for either.
    await clickDesign(page, LEAVE_THE_ROOM);

    await expectActiveScene(page, 'Library');
});

test('does not let a click meant for the reference book leave the room underneath it', async ({ page }) => {
    await page.goto('/');
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
