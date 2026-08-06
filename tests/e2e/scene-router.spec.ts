import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const expectActiveScene = async (page: import('@playwright/test').Page, sceneKey: string): Promise<void> => {
    await expect(page.locator('#game-container')).toHaveAttribute('data-active-scene', sceneKey);
};

const TYPED_CONCLUSION = 'The two recorded configurations support an interference inference.';
const TYPED_LIMITATION = 'These observations do not settle every interpretation of light.';

/**
 * The authored conclusion proposals, read from the case rather than restated, so the probe below can say
 * precisely what the canvas is allowed to have written into the two fields.
 *
 * Both halves, not just the claim: choosing a proposal writes the claim **and** its stated limitation
 * together, so carrying the pair is what lets the probe reject a partial write.
 */
const AUTHORED_CONCLUSIONS: readonly Readonly<{ claim: string; limitation: string }>[] = (JSON.parse(
    readFileSync(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf-8')
) as { conclusionProposals: { claim: { en: string }; limitation: { en: string } }[] })
    .conclusionProposals.map(({ claim, limitation }) => ({ claim: claim.en, limitation: limitation.en }));

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
    // the top of the first card — follows the beat being read. Pinning "a card was hit" would pin a
    // coincidence and break on the next beat re-wording, so that is not what this asserts; card
    // hit-testing is `dialogue-advance.spec.ts`' subject, and it probes a *derived* coordinate.
    //
    // What this asserts is the invariant a stray canvas click must not break: the two fields stay
    // **consistent** — either both hold the player's own words, or both come from the same authored
    // proposal. A conclusion adopted without its limitation, a blend, or a partial write all fail here,
    // which is the class of defect the 1.11 review actually objected to (a silent side effect), and
    // unlike a bare "the value is one of these" it cannot be satisfied by the click doing nothing *and*
    // by the click corrupting half the draft.
    await expect(async () => {
        const [conclusion, limitation] = await Promise.all([
            conclusionField.inputValue(),
            limitationField.inputValue()
        ]);
        const typedBoth = conclusion === TYPED_CONCLUSION && limitation === TYPED_LIMITATION;
        const adoptedOne = AUTHORED_CONCLUSIONS.some((authored) =>
            authored.claim === conclusion && authored.limitation === limitation);

        expect(typedBoth || adoptedOne,
            `The draft is neither the player's own words nor one authored proposal adopted whole. Conclusion: ${conclusion} / Limitation: ${limitation}`
        ).toBe(true);
    }).toPass();

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
