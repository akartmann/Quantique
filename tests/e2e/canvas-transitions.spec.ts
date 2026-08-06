import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { advanceControlCentreOnBoard, lastProposalCardProbe } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { bookCloseControlCentre } from '../../src/adapters/phaser/renderers/LectureBookRenderer';
// From `apparatusGeometry`, not `ApparatusRenderer`: that renderer imports Phaser as a *value*
// (`BlendModes`), Phaser touches `window` at import time, and these specs run in Node. The routing
// shell's geometry is split out of `PhasePlaceholderScene` for the same reason — it extends `Scene`.
import { advanceToSynthesisControlCentre } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { placeholderAdvanceControlCentre } from '../../src/adapters/phaser/scenes/phasePlaceholderGeometry';
import { en } from '../../src/core/i18n/locales/en';

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
 * Every **transition** below is a canvas click. Five intents that *gate* those transitions still have
 * no canvas dispatcher at all and are explicitly out of this story's scope, so they stay on their
 * current DOM path and are annotated inline with the story that closes each:
 *
 * | Gating intent | Only dispatcher today | Owner |
 * | --- | --- | --- |
 * | `source.inspected` | `src/ui/sources/CuratedRecord.ts` | Story 2.8 |
 * | `experiment.run` | `src/ui/apparatus/ApparatusControls.ts` | Story 2.10 |
 * | `comparison.runSelected` / `comparison.noteSaved` | `src/ui/notebook/NotebookPanel.ts` | Story 2.10 |
 * | `theory.supportRunSelected` / `theory.supportSourceSelected` | `src/ui/theory/TheoryBoard.ts` | unowned |
 * | `peerReview.requested` / `revision.saved` | `src/ui/review/ConclusionReviewPanel.ts` | unowned |
 *
 * So this is honestly **"each transition is dispatchable from the canvas"**, not "the Young case can be
 * completed with canvas clicks alone". The latter becomes true when 2.8 and 2.10 land and is verified
 * in full by 2.12. `apparatus.controlSet` is the one exception in the list below: it *is* canvas-
 * dispatchable through the laboratory's step buttons, but those buttons export no geometry, so
 * deriving a click target for them would mean restating literals. It stays on the DOM path here and
 * Story 2.10 gives it the knob and the geometry.
 *
 * Canvas *text* is deliberately not asserted: it cannot be read from the DOM, and
 * `french-typography.spec.ts` already measures every advance label against its wrap bound in both
 * locales.
 */

const canvas = (page: Page) => page.locator('#game-container canvas');

const BOOK_CLOSE = bookCloseControlCentre();
const LIBRARY_ADVANCE = placeholderAdvanceControlCentre(1024, 768);
const DEBRIEF_ADVANCE = placeholderAdvanceControlCentre(1024, 768);
const PREDICTION_ADVANCE = advanceControlCentreOnBoard('prediction');
const LABORATORY_ADVANCE = advanceToSynthesisControlCentre();
const BOARD_ADVANCE = advanceControlCentreOnBoard('conclusion');
const CARD = lastProposalCardProbe(768);

const SOURCE_NAMES = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { contextualArtifacts: { displayName: { en: string; fr: string } }[] })
    .contextualArtifacts.map(({ displayName }) => displayName);

/** The canvas is sticky, so a click is mapped through the live bounding box rather than assumed. */
const clickDesign = async (page: Page, point: Readonly<{ x: number; y: number }>): Promise<void> => {
    const bounds = await canvas(page).boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    await page.mouse.click(bounds.x + (point.x / 1024) * bounds.width, bounds.y + (point.y / 768) * bounds.height);
};

const expectActiveScene = async (page: Page, sceneKey: string): Promise<void> => {
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', sceneKey);
};

/**
 * Clicks a canvas control until the router reports the expected scene.
 *
 * Needed for exactly one click in this walk: the first one after the reference book closes.
 * `LectureBookRenderer.isOverlayVisible` stays true for the whole 180ms closing fade — **deliberately**,
 * so that a click during the fade cannot fall through to the surface still painted underneath — and
 * the suppression lifts only when the overlay is destroyed. There is no DOM signal for that moment,
 * so the spec does what a player does and clicks again.
 *
 * This is not a way to make a dead control pass: `toPass` is bounded, and a control that never
 * dispatches still fails the timeout. The suppression itself is asserted directly in the third test,
 * which is where "a click during the book must do nothing" is pinned rather than tolerated.
 */
const clickUntilScene = async (page: Page, point: Readonly<{ x: number; y: number }>, sceneKey: string): Promise<void> => {
    await expect(async () => {
        await clickDesign(page, point);
        await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', sceneKey, { timeout: 400 });
    }).toPass({ timeout: 5_000 });
};

test('takes every forward transition of the Young case from the canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: en['boot.title'] })).toBeVisible();
    await expectActiveScene(page, 'Library');

    // --- context → prediction ------------------------------------------------------------------
    // `source.inspected` has no canvas dispatcher until Story 2.8, so the gate is satisfied from the
    // curated record. Inspecting publishes the reference book over the whole canvas, and leaving it
    // open would legitimately suppress every canvas click below — the suppression Story 2.7 extended
    // to this very scene.
    for (const displayName of SOURCE_NAMES) {
        await page.getByRole('button', { name: `Inspect ${displayName.en}` }).click();
    }
    await clickDesign(page, BOOK_CLOSE);

    await clickUntilScene(page, LIBRARY_ADVANCE, 'Colleagues');

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

    await clickDesign(page, BOARD_ADVANCE);
    await expectActiveScene(page, 'Debrief');

    // --- post-debrief replay -------------------------------------------------------------------
    await clickDesign(page, DEBRIEF_ADVANCE);
    await expectActiveScene(page, 'Library');
    // A replay is a fresh investigation, not a re-reading of the finished one.
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).locator('.notebook-observation')).toHaveCount(0);
});

test('refuses a transition the evidence has not earned, and stays where it was', async ({ page }) => {
    await page.goto('/');
    await expectActiveScene(page, 'Library');

    // No source inspected, so `missing-contextual-sources` refuses. The control must neither move the
    // player nor go silent — a refused click that looks identical to a dead one is the defect AC4 is
    // written against. What it says is measured by `french-typography.spec.ts`; what it must not do is
    // route, and that is observable here.
    await clickDesign(page, LIBRARY_ADVANCE);

    await expectActiveScene(page, 'Library');
});

test('does not let a click meant for the reference book advance the phase underneath it', async ({ page }) => {
    await page.goto('/');
    await expectActiveScene(page, 'Library');

    // The exact defect 1.12, 2.5, and 2.6 each had to fix, now reachable in `context` too: the book is
    // opened by inspecting a source, it covers the whole canvas, and the library's advance control sits
    // under it. Both gate sources are inspected first, so the advance would otherwise succeed — which
    // is what makes this a real test rather than one the gate passes for free.
    for (const displayName of SOURCE_NAMES) {
        await page.getByRole('button', { name: `Inspect ${displayName.en}` }).click();
    }

    await clickDesign(page, LIBRARY_ADVANCE);

    await expectActiveScene(page, 'Library');

    // …and closing the book restores it, so the suppression is a suppression and not a broken control.
    // The retry covers the 180ms closing fade, during which the control is still — correctly — inert.
    await clickDesign(page, BOOK_CLOSE);
    await clickUntilScene(page, LIBRARY_ADVANCE, 'Colleagues');
});
