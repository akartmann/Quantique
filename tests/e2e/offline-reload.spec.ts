import { expect, test } from '@playwright/test';

test('restores saved progress and decision history after an offline reload', async ({ page, context }) => {

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    await page.waitForFunction(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    const contextPanel = page.getByRole('region', { name: 'Young context and prediction' });
    await contextPanel.getByRole('button', { name: 'Continue to prediction' }).click();
    await contextPanel.getByLabel('Tentative prediction').fill('A stable pattern may appear.');
    await contextPanel.getByRole('button', { name: 'Record a prediction' }).click();
    await contextPanel.getByRole('button', { name: 'Continue to experimentation' }).click();
    const recordObservation = page.getByRole('button', { name: 'Record prepared observation' });
    await recordObservation.click();
    await recordObservation.click();
    const board = page.getByRole('region', { name: 'Theory board' });
    await board.getByRole('checkbox', { name: 'Select Observation 1 as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Observation 2 as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Thomas Young’s 1801 lecture record as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Opticks reference as conclusion support' }).check();
    await board.getByLabel('Conclusion', { exact: true }).fill('The prepared observations support a bounded conclusion.');
    await board.getByLabel('Limitation or alternative explanation').fill('The prepared evidence does not resolve every alternative explanation.');
    await board.getByRole('button', { name: 'Continue investigation to synthesis' }).click();
    await board.getByRole('button', { name: 'Request review' }).click();
    const peerReview = page.getByRole('region', { name: 'Peer review' });
    await peerReview.getByRole('button', { name: 'Request peer feedback' }).click();
    await peerReview.getByRole('button', { name: 'Save reviewed revision' }).click();
    const progress = page.getByRole('region', { name: 'Save, export, import, and print' });
    await progress.getByRole('button', { name: 'Save progress' }).click();
    await expect(progress.getByRole('status', { name: 'Progress status' })).toHaveText('Progress saved on this device.');

    await context.setOffline(true);
    await page.reload();

    const entryButton = page.getByRole('button', { name: 'Enter laboratory' });
    await expect(entryButton).toBeVisible();
    await entryButton.click();
    await expect(page.locator('#boot-status')).toHaveText('Laboratory shell ready.');
    await expect(page.getByRole('region', { name: 'Measurement notebook' }).getByText('Observed result')).toHaveCount(2);
    await expect(page.getByRole('region', { name: 'Young context and prediction' }).getByLabel('Tentative prediction')).toHaveValue('A stable pattern may appear.');
    await expect(page.getByRole('region', { name: 'Decision history' }).getByRole('heading', { name: 'Version 1' })).toBeVisible();
    const recognition = page.getByRole('region', { name: 'Inquiry recognition' });
    await expect(recognition).toContainText('Source discipline recorded');
    await expect(recognition).toContainText('Replication recorded');
    await expect(recognition).toContainText('Calibrated conclusion recorded');
    await page.getByRole('region', { name: 'Curated Record' }).getByRole('button', { name: 'Read the lecture record' }).click();
    const reader = page.getByRole('region', { name: 'Young context and prediction' }).getByRole('article', { name: 'Read the lecture record' });
    await expect(reader.locator('.contextual-text-section')).toHaveCount(2);
    await expect(reader.getByRole('status')).toHaveText('Book spread 1 of 50.');
    await reader.getByRole('button', { name: 'Next page' }).click();
    await expect(reader.getByRole('status')).toHaveText('Book spread 2 of 50.');
});

test('loads the cached validation route after an online warm-up without progress controls', async ({ page, context }) => {
    await page.goto('/?mode=validation');
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.ready);
    await page.reload();

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('region', { name: 'Young validation session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter laboratory' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Save, export, import, and print' })).toHaveCount(0);
});
