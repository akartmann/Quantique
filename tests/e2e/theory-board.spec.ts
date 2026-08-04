import { expect, test } from '@playwright/test';

test('supports a keyboard-accessible evidence-to-conclusion draft with recoverable readiness guidance', async ({ page }) => {
    await page.goto('/');
    const board = page.getByRole('region', { name: 'Theory board' });
    await expect(board).toBeVisible();
    await expect(board.getByText('Record observations in the measurement notebook before selecting support.')).toBeVisible();
    await board.getByRole('button', { name: 'Request review' }).click();
    await expect(board.getByRole('status', { name: 'Theory board status' })).toHaveText('Select at least 2 recorded observations.');

    await page.getByRole('button', { name: 'Inspect Thomas Young’s 1801 lecture record' }).click();
    await page.getByRole('button', { name: 'Inspect Opticks reference' }).click();
    const recordObservation = page.getByRole('button', { name: 'Record prepared observation' });
    await recordObservation.click();
    await recordObservation.click();

    const firstRun = board.getByRole('checkbox', { name: 'Select Observation 1 as conclusion support' });
    await firstRun.check();
    await expect(firstRun).toBeFocused();
    await board.getByRole('checkbox', { name: 'Select Observation 2 as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Thomas Young’s 1801 lecture record as conclusion support' }).check();
    await board.getByRole('checkbox', { name: 'Select Opticks reference as conclusion support' }).check();

    const conclusion = board.getByLabel('Conclusion');
    await conclusion.fill('The prepared observations support a bounded conclusion.');
    await expect(conclusion).toBeFocused();
    await board.getByLabel('Limitation or alternative explanation').fill('The prepared evidence does not resolve every alternative explanation.');
    await expect(board.getByRole('status', { name: 'Theory board status' })).toHaveText('Your selected evidence and limitation are ready for review.');

    const requestReview = board.getByRole('button', { name: 'Request review' });
    await requestReview.click();
    await expect(requestReview).toBeFocused();
    await expect(board.getByRole('status', { name: 'Theory board status' })).toHaveText('Cannot advance from context to review.');
    await expect(conclusion).toHaveValue('The prepared observations support a bounded conclusion.');
});
