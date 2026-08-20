import { expect, test, type Page } from '@playwright/test';

import { stepAffordanceCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { debriefAdvanceControlCentre } from '../../src/adapters/phaser/scenes/debriefGeometry';
import { en } from '../../src/core/i18n/locales/en';
import {
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
    WALK_TO_DEBRIEF_COST_MS,
    clickDesign,
    expectActiveScene,
    gotoCase,
    recordedObservations,
    recordedSetting,
    walkToDebrief,
    walkToTheBoard,
    waitForInputToSettle
} from './canvasHelpers';

/**
 * The router: the active scene mirrors the authoritative phase, and nothing else moves it (ADR-009).
 *
 * **Rewritten canvas-only** (Story 2.12). This file drove forty-three DOM locators — a free-text
 * prediction, `Run experiment`, four support checkboxes, the notebook's comparison controls, and a probe
 * that typed into the theory board's conclusion and limitation fields. Every one of those controls is
 * deleted, and the three free-text actions behind them are removed from `AppAction` (D5).
 *
 * ## Where the typed-field probe went
 *
 * `:112-126` used to prove, through those two fields, that a stray canvas click cannot leave the draft
 * carrying one proposal's claim beside another's limitation. **That property survives the deletion and
 * its evidence did not** — with no free-text path there is no second writer, but "no blend, no partial
 * write" is still the rule the one remaining writer has to obey. It is re-asserted at the store, in
 * `tests/integration/ProposalSelection.test.ts`, where it can be checked against *every* authored
 * proposal rather than against whichever one a click happened to land on.
 *
 * What is left here is what only a browser can say: that the router really activates and tears down
 * scenes, that a torn-down scene stops responding, and that a reload lands the player back in the phase
 * they left.
 */

test.setTimeout(30_000 + WALK_TO_DEBRIEF_COST_MS);

/** The slot the slit-spacing instrument stands in, derived rather than fixed at zero. */
const SLIT_SPACING_SLOT = 0;
const SLIT_SPACING_STEP_UP = stepAffordanceCentre(SLIT_SPACING_SLOT, 1);

/** What the record says the slit spacing reads — the bench's own state, observed from the record. */
const slitSpacing = (page: Page) => recordedSetting(page, 'Slit spacing');

test('walks the Young scene sequence, keeping the active scene mirroring the case phase', async ({ page }) => {
    await walkToDebrief(page);

    // Every transition on the way is asserted inside the walk itself; arriving here is the last one.
    await expectActiveScene(page, 'Debrief');

    // A counterfactual replay returns the case to context, and the scene follows it back.
    await clickDesign(page, debriefAdvanceControlCentre(DESIGN_WIDTH, DESIGN_HEIGHT));
    await expectActiveScene(page, 'Library');
    // A replay is a fresh investigation rather than a re-reading of the finished one.
    await expect(recordedObservations(page)).toHaveCount(0);
});

/**
 * A scene the router stopped really stopped: its controls no longer reach the store.
 *
 * This is the half of the old typed-field probe that genuinely needed a browser, kept and sharpened.
 * The bench's step affordance is clicked at its **derived** coordinate after the player has left the
 * laboratory; if the scene were still live the slit spacing would move, and the record would say so.
 *
 * It is not trivially true: the same click at the same coordinate moves the setting while the bench is
 * up, which is asserted first — so a coordinate that had drifted into empty space would fail the
 * positive half rather than pass the negative one by accident.
 */
test('stops responding to a scene the router has torn down', async ({ page }) => {
    await walkToTheBoard(page);
    await expectActiveScene(page, 'TheoryBoard');

    const afterLeaving = await slitSpacing(page).textContent();
    expect(afterLeaving).toBeTruthy();

    await clickDesign(page, SLIT_SPACING_STEP_UP);
    await waitForInputToSettle(page);

    await expect(slitSpacing(page)).toHaveText(afterLeaving!);
    await expectActiveScene(page, 'TheoryBoard');
});

test('restores a reloaded session into the scene matching the persisted phase', async ({ page }) => {
    await gotoCase(page);
    await expectActiveScene(page, 'Library');
    await expect(page.getByRole('heading', { name: en['boot.title'] })).toBeVisible();

    await walkToTheBoard(page);
    await expectActiveScene(page, 'TheoryBoard');
    // **No manual save.** The autosave `attachAutosave` wires is what has to have written, which is
    // exactly what this reload then reads back (Story 2.12, AC3).
    await page.waitForTimeout(500);

    await page.reload();

    await expectActiveScene(page, 'TheoryBoard');
    await expect(recordedObservations(page)).toHaveCount(2);
});
