import { expect, test } from '@playwright/test';

test('opens the sourced historical debrief and keeps it intact through counterfactual replay', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    await page.getByRole('button', { name: 'Continue to prediction' }).click();
    await page.getByLabel('Tentative prediction').fill('A larger screen distance may widen the pattern.');
    await page.getByRole('button', { name: 'Record a prediction' }).click();
    await page.getByRole('button', { name: 'Continue to experimentation' }).click();
    await page.getByRole('button', { name: 'Run experiment' }).click();
    await page.getByLabel('Screen distance (m)').fill('3');
    await page.getByLabel('Screen distance (m)').press('Enter');
    await page.getByRole('button', { name: 'Run experiment' }).click();

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
    await board.getByLabel('Conclusion', { exact: true }).fill('The two recorded configurations support an interference inference.');
    await board.getByLabel('Limitation or alternative explanation').fill('These observations do not settle every interpretation of light.');
    await board.getByRole('button', { name: 'Continue investigation to synthesis' }).click();
    await board.getByRole('button', { name: 'Request review' }).click();
    const review = page.getByRole('region', { name: 'Peer review' });
    await review.getByRole('button', { name: 'Request peer feedback' }).click();
    await review.getByRole('button', { name: 'Save reviewed revision' }).click();

    const debrief = page.getByRole('region', { name: 'Historical debrief' });
    await debrief.getByRole('button', { name: 'Open historical debrief' }).click();
    await expect(debrief.getByRole('heading', { name: 'Young’s record and the earlier Opticks reference' })).toBeVisible();
    await expect(debrief.getByText('Thomas Young’s 1801 lecture record')).toBeVisible();
    await debrief.getByText('Optional deeper theory').click();
    await expect(debrief.getByText(/selected wavelength, slit spacing, and screen distance/)).toBeVisible();

    await debrief.getByRole('button', { name: 'Start counterfactual replay — not the recorded historical result' }).click();
    await expect(debrief.getByText('Counterfactual replay — not the recorded historical result')).toBeVisible();
    await expect(debrief.getByText('The two recorded configurations support an interference inference.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).locator('.notebook-observation')).toHaveCount(0);
});
