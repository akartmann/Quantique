import { expect, test } from '@playwright/test';

import {
    DIALOGUE_PANEL_WIDTH,
    DIALOGUE_TOP,
    PROPOSAL_SURFACE_LEFT,
    boardDialogueAdvanceControlCentre,
    lastProposalCardProbe
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { DESIGN_HEIGHT, DESIGN_WIDTH, canvas, clickDesign } from './canvasHelpers';

/**
 * AC1's advance control, exercised on the canvas — the only place it can be.
 *
 * This is not a decorative check. Two defects that every unit and integration test passed through were
 * only reachable here: an advance that moved the widget's beat index without repainting the panel, so
 * the conversation appeared frozen; and a proposal card whose Phaser hit area kept the size it had at
 * construction after the card was resized, leaving it clickable in the gap below where it is drawn.
 *
 * The assertions are deliberately coarse — "the canvas changed", "the prediction did not" — because
 * pinning pixels or card bands would pin a layout that AC1 requires to move with the beat being read.
 */

/**
 * Derived from the **board**, never restated: the panel's gutters are the widget's business and the
 * panel's width is the board's.
 *
 * This used to call the widget helper with `PROPOSAL_SURFACE_WIDTH`, which was the panel's width right
 * up until Story 2.9 narrowed the panel so the control column could sit beside it instead of above it.
 * The click then landed on empty canvas and this spec failed — which is the good outcome, and the
 * reason the board exports one resolved point for both to read.
 */
const ADVANCE = boardDialogueAdvanceControlCentre();

/** Inside the last card wherever the band starts. Derived, never a mid-surface guess — see the helper. */
const CARD = lastProposalCardProbe(DESIGN_HEIGHT);

/**
 * A screenshot of just the dialogue panel's band, not the whole canvas.
 *
 * "Some pixel somewhere changed" is satisfied by any nondeterminism on the surface, independently of the
 * repaint under test — the assertion read stronger than it was (1.12 review). Clipping to the band the
 * widget owns means only a panel repaint can satisfy it. The band is derived from the widget's own
 * geometry, and is deliberately generous vertically so it covers the counter, the control, and a beat
 * body of any wrapped height.
 */
const panelShot = async (page: import('@playwright/test').Page): Promise<Buffer> => {
    const bounds = await canvas(page).boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    const scaleX = bounds.width / DESIGN_WIDTH;
    const scaleY = bounds.height / DESIGN_HEIGHT;
    return page.screenshot({
        clip: {
            x: bounds.x + (PROPOSAL_SURFACE_LEFT * scaleX),
            y: bounds.y + (DIALOGUE_TOP * scaleY),
            width: DIALOGUE_PANEL_WIDTH * scaleX,
            height: 120 * scaleY
        }
    });
};

test('advances the authored conversation on the canvas without touching the investigation', async ({ page }) => {
    await page.goto('/');

    // The DOM record is used only to satisfy the context gate. It no longer opens anything: Story 2.8
    // retired the always-on book overlay, so this panel records the inspection and draws nothing over
    // the canvas. The `clickDesign(BOOK_CLOSE)` that used to follow was deleted with it — with no book
    // to dismiss, that click would land on live canvas at (512, 678), and a stray click on a proposal
    // board is exactly the kind of side effect the 2.7 review called out.
    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Colleagues');

    const prediction = page.getByLabel('Tentative prediction');
    await expect(prediction).toHaveValue('');
    const firstBeat = await panelShot(page);

    // A click that misses the control must not satisfy the repaint assertion below, so prove the shot is
    // stable when nothing has been advanced. Without this the whole check could pass on canvas noise.
    expect(Buffer.compare(await panelShot(page), firstBeat)).toBe(0);

    await clickDesign(page, ADVANCE);

    // The panel repainted: a widget that moved its index without redrawing left this identical.
    await expect(async () => {
        expect(Buffer.compare(await panelShot(page), firstBeat)).not.toBe(0);
    }).toPass();
    // And advancing is not choosing. The advance control sits above the cards, so a click falling
    // through to one — or a card whose hit area still covered the panel — would adopt a proposal here.
    await expect(prediction).toHaveValue('');
});

test('keeps choosing a proposal working after the conversation has moved the cards', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Colleagues');

    // Advance first, so the cards have been re-laid-out at least once before anything is clicked.
    await clickDesign(page, ADVANCE);

    // Inside the last card, anchored to the canvas floor rather than guessed at mid-surface: the band's
    // top moves with the beat being read, and the cards have gaps between them. The recorded prediction
    // is the observable proof a card was hit.
    await clickDesign(page, CARD);

    const prediction = page.getByLabel('Tentative prediction');
    await expect(prediction).not.toHaveValue('');
    // Adopted verbatim from the authored set, not blended or partially written.
    const authored = await page.evaluate(async () => {
        const response = await fetch('/cases/young-interference/case.json');
        const definition = await response.json() as { predictionProposals: { text: { en: string } }[] };
        return definition.predictionProposals.map(({ text }) => text.en);
    });
    expect(authored).toContain(await prediction.inputValue());
});
