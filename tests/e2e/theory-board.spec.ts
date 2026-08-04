import { expect, test } from '@playwright/test';

test('supports a keyboard-accessible evidence-to-conclusion draft with recoverable readiness guidance', async ({ page }) => {
    await page.goto('/');
    const consultation = page.getByRole('region', { name: 'Evidence-responsive consultation' });
    const consultationRequest = consultation.getByRole('button', { name: 'Request consultation' });
    await consultationRequest.focus();
    await page.keyboard.press('Space');
    await expect(consultationRequest).toBeFocused();
    await expect(consultation.getByRole('status')).toHaveText('A next actionable step is available below.');
    await expect(consultation.getByText('Record a second observation in the measurement notebook.')).toBeVisible();
    await expect(consultation.getByText('In-play observation')).toBeVisible();
    await expect(consultation.getByText('Plain-language guidance')).toBeVisible();
    await expect(consultation.getByText('Technical or source detail')).toBeVisible();
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
    await firstRun.focus();
    await page.keyboard.press('Space');
    await expect(firstRun).toBeFocused();
    const secondRun = board.getByRole('checkbox', { name: 'Select Observation 2 as conclusion support' });
    await secondRun.focus();
    await page.keyboard.press('Space');
    const youngSource = board.getByRole('checkbox', { name: 'Select Thomas Young’s 1801 lecture record as conclusion support' });
    await youngSource.focus();
    await page.keyboard.press('Space');
    const opticksSource = board.getByRole('checkbox', { name: 'Select Opticks reference as conclusion support' });
    await opticksSource.focus();
    await page.keyboard.press('Space');

    const conclusion = board.getByLabel('Conclusion', { exact: true });
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
