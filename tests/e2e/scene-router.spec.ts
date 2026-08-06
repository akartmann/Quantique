import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const expectActiveScene = async (page: import('@playwright/test').Page, sceneKey: string): Promise<void> => {
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', sceneKey);
};

const TYPED_CONCLUSION = 'The two recorded configurations support an interference inference.';
const TYPED_LIMITATION = 'These observations do not settle every interpretation of light.';

/**
 * The authored conclusion claims, read from the case rather than restated, so the probe below can say
 * precisely what the canvas is allowed to have written into the field.
 */
const AUTHORED_CLAIMS: readonly string[] = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { conclusionProposals: { claim: { en: string } }[] }).conclusionProposals.map(({ claim }) => claim.en);

/** Clicks the laboratory apparatus "increase slit spacing" control on the canvas, in design coordinates. */
const clickApparatusIncrease = async (page: import('@playwright/test').Page): Promise<void> => {
    const bounds = await page.locator('#game-container canvas').boundingBox();
    if (!bounds) throw new Error('The routed Phaser surface did not render.');
    await page.mouse.click(bounds.x + (540 / 1024) * bounds.width, bounds.y + (603 / 768) * bounds.height);
};

test('walks the Young scene sequence, keeping the active scene mirroring the case phase', async ({ page }) => {
    await page.goto('/');

    // context
    await expectActiveScene(page, 'Library');

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await expectActiveScene(page, 'Library');

    // prediction
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await expectActiveScene(page, 'Colleagues');

    await page.getByLabel('Tentative prediction').fill('A larger screen distance may widen the pattern.');
    await page.getByRole('button', { name: 'Record a prediction' }).click();

    // experiment
    await page.getByRole('button', { name: 'Continue to experimentation' }).click();
    await expectActiveScene(page, 'Laboratory');

    // The routed laboratory scene is live: its canvas controls drive the authoritative state.
    await expect(page.getByLabel('Slit spacing (mm)')).toHaveValue('0.25');
    await clickApparatusIncrease(page);
    await expect(page.getByLabel('Slit spacing (mm)')).toHaveValue('0.3');

    await page.getByRole('button', { name: 'Run experiment' }).click();
    await page.getByLabel('Screen distance (m)').fill('3');
    await page.getByLabel('Screen distance (m)').press('Enter');
    await page.getByRole('button', { name: 'Run experiment' }).click();
    await expectActiveScene(page, 'Laboratory');

    const notebook = page.getByRole('region', { name: 'Measurement notebook' });
    await notebook.getByRole('checkbox', { name: 'Select Observation 1 for comparison' }).check();
    await notebook.getByRole('checkbox', { name: 'Select Observation 2 for comparison' }).check();
    await notebook.getByLabel('Comparison note').fill('The recorded spacing differs across these two bounded configurations.');
    await notebook.getByRole('button', { name: 'Save comparison note' }).click();

    const board = page.getByRole('region', { name: 'Theory board' });
    await board.getByRole('checkbox', { name: 'Select Observation 1 as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Observation 2 as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Thomas Young’s 1801 lecture record as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Opticks reference as conclusion support' }).check();
    const conclusionField = board.getByLabel('Conclusion', { exact: true });
    const limitationField = board.getByLabel('Limitation or alternative explanation');
    await conclusionField.fill(TYPED_CONCLUSION);
    await limitationField.fill(TYPED_LIMITATION);

    // synthesis and review share the authored theory-board scene
    await board.getByRole('button', { name: 'Continue investigation to synthesis' }).click();
    await expectActiveScene(page, 'TheoryBoard');

    // Leaving the laboratory really tore its scene down: its canvas controls no longer respond. This
    // is what the probe is *for*, and it holds whatever the theory board draws at that coordinate.
    const slitSpacing = page.getByLabel('Slit spacing (mm)');
    const slitSpacingBeforeClick = await slitSpacing.inputValue();
    await clickApparatusIncrease(page);
    await expect(slitSpacing).toHaveValue(slitSpacingBeforeClick);

    // The same click also lands on whatever the theory board now draws there, and the cards no longer
    // sit at a fixed offset: Story 1.12 puts a dialogue panel above them whose measured height — and so
    // the top of the first card — follows the beat being read. The coordinate currently falls inside the
    // third card with two pixels to spare, so pinning "a card was hit" would be pinning a coincidence,
    // and it would fail as a confusing conclusion-field error the next time a beat is re-worded.
    //
    // So the assertion is the invariant instead: the field holds either the player's own words or one
    // authored claim adopted verbatim — never a blend, a partial write, or anything else. That still
    // catches a real defect, and it is why the 1.11 review objected to the side effect being *silent*
    // rather than to its particular outcome.
    // Settled by the awaited assertion above, which already round-tripped to the browser after the click.
    expect([TYPED_CONCLUSION, ...AUTHORED_CLAIMS]).toContain(await conclusionField.inputValue());

    // Restore the player's own words unconditionally, so the review and debrief below exercise the
    // conclusion they assert on rather than one the canvas happened to write.
    await conclusionField.fill(TYPED_CONCLUSION);
    await limitationField.fill(TYPED_LIMITATION);
    await expect(conclusionField).toHaveValue(TYPED_CONCLUSION);

    await board.getByRole('button', { name: 'Request review' }).click();
    await expectActiveScene(page, 'TheoryBoard');

    const review = page.getByRole('region', { name: 'Peer review' });
    await review.getByRole('button', { name: 'Request peer feedback' }).click();
    await review.getByRole('button', { name: 'Save reviewed revision' }).click();

    // debrief
    const debrief = page.getByRole('region', { name: 'Historical debrief' });
    await debrief.getByRole('button', { name: 'Open historical debrief' }).click();
    await expectActiveScene(page, 'Debrief');

    // A counterfactual replay returns the case to context, and the scene follows it back.
    await debrief.getByRole('button', { name: 'Start counterfactual replay — not the recorded historical result' }).click();
    await expectActiveScene(page, 'Library');
});

test('restores a reloaded session into the scene matching the persisted phase', async ({ page }) => {
    await page.goto('/');
    await expectActiveScene(page, 'Library');

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await page.getByLabel('Tentative prediction').fill('A larger screen distance may widen the pattern.');
    await page.getByRole('button', { name: 'Record a prediction' }).click();
    await page.getByRole('button', { name: 'Continue to experimentation' }).click();
    await expectActiveScene(page, 'Laboratory');

    const progress = page.getByRole('region', { name: 'Save, export, import, and print' });
    await progress.getByRole('button', { name: 'Save progress' }).click();
    await expect(progress.getByRole('status', { name: 'Progress status' })).toHaveText('Progress saved on this device.');

    await page.reload();

    await expectActiveScene(page, 'Laboratory');
});
