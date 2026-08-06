import { expect, test } from '@playwright/test';

import {
    DIALOGUE_TOP,
    PROPOSAL_SURFACE_LEFT,
    PROPOSAL_SURFACE_WIDTH
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { dialogueAdvanceControlCentre } from '../../src/adapters/phaser/ui/DialogueBox';

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

const canvas = (page: import('@playwright/test').Page) => page.locator('#game-container canvas');

/** Derived from the widget, never restated: the panel's gutters are the widget's business. */
const ADVANCE = dialogueAdvanceControlCentre({
    x: PROPOSAL_SURFACE_LEFT,
    y: DIALOGUE_TOP,
    width: PROPOSAL_SURFACE_WIDTH
});

/** The archival book's own canvas "Close book" control, which covers the whole surface once opened. */
const BOOK_CLOSE = { x: 512, y: 678 };

const clickDesign = async (page: import('@playwright/test').Page, point: Readonly<{ x: number; y: number }>): Promise<void> => {
    const bounds = await canvas(page).boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    await page.mouse.click(bounds.x + (point.x / 1024) * bounds.width, bounds.y + (point.y / 768) * bounds.height);
};

test('advances the authored conversation on the canvas without touching the investigation', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    // Inspecting a source publishes the reference book over the whole canvas. It has to be closed, or
    // every click below is legitimately suppressed by the overlay.
    await clickDesign(page, BOOK_CLOSE);
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Colleagues');

    const prediction = page.getByLabel('Tentative prediction');
    await expect(prediction).toHaveValue('');
    const firstBeat = await canvas(page).screenshot();

    await clickDesign(page, ADVANCE);

    // The panel repainted: a widget that moved its index without redrawing left this identical.
    await expect(async () => {
        expect(Buffer.compare(await canvas(page).screenshot(), firstBeat)).not.toBe(0);
    }).toPass();
    // And advancing is not choosing. The advance control sits above the cards, so a click falling
    // through to one — or a card whose hit area still covered the panel — would adopt a proposal here.
    await expect(prediction).toHaveValue('');
});

test('keeps choosing a proposal working after the conversation has moved the cards', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await clickDesign(page, BOOK_CLOSE);
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', 'Colleagues');

    // Advance first, so the cards have been re-laid-out at least once before anything is clicked.
    await clickDesign(page, ADVANCE);

    // Mid-height of the surface, which is inside a card whatever the panel's measured height: the cards
    // divide everything below it. The recorded prediction is the observable proof a card was hit.
    await clickDesign(page, { x: 512, y: 500 });

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
